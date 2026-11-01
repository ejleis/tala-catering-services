#!/usr/bin/env node
'use strict'

/**
 * PreToolUse guard for Tala's Event Catering Services.
 *
 * Enforces the owner rules deterministically (instructions in CLAUDE.md are
 * only requests; a hook is enforcement):
 *
 *   1. Pushes to `main` need Eli's consent. Anything that could update `main`
 *      returns "ask", so Claude Code stops and asks Eli to approve. When the
 *      guard cannot prove a push targets another branch, it asks. Pushes to
 *      other branches are allowed. Sub-agents may not push at all.
 *   2. Real env files are off limits (.env, .env.local, server/.env, ...),
 *      including wildcard, recursive and dotenv reads that would reach them.
 *      Templates ending in `.example` (such as .env.example) are allowed.
 *   3. No requests to the production API's order/payment routes. They would
 *      create real Maya checkouts.
 *   4. Edits to the guard and Claude settings, and Supabase connector calls
 *      that are not read-only, ask Eli first.
 *
 * Contract: reads the hook JSON on stdin. Exit 0 with no output = no objection.
 * Exit 0 with a JSON "ask" decision on stdout = ask Eli. Exit 2 = block; stderr
 * is shown to Claude. Any internal error blocks. This is best-effort text
 * matching, not a sandbox: a determined command can be written to evade it.
 */

const { execFileSync } = require('node:child_process')
const path = require('node:path')

const PROTECTED_BRANCH = 'main'

const SECRET_ENV_MESSAGE =
  'Real env files hold secrets and must not be read or changed in a session. ' +
  'Ask Eli to edit them himself, or use .env.example for the list of variable names.'
const BROAD_READ_MESSAGE =
  'Recursive, wildcard or dotenv reads from the shell can reach real env files and print secrets. ' +
  'Use the Grep tool (it skips gitignored and hidden files) or name the exact files to read.'
const PROD_API_MESSAGE =
  'Requests to the production order and payment routes would create real Maya checkouts. ' +
  'Eli runs those himself (see the payment-test-runbook skill).'
const SUBAGENT_PUSH_MESSAGE = 'Sub-agents never push. Report the change to the main session instead.'

// ------------------------------------------------------------------ helpers

/** True for .env, .env.local, .env.production, server/.env, .envrc; false for *.example. */
function isSecretEnvPath(filePath) {
  const base = lastComponent(filePath).toLowerCase()
  return base.startsWith('.env') && !base.endsWith('.example')
}

function lastComponent(p) {
  const parts = String(p).split(/[\\/]/)
  return parts[parts.length - 1] || ''
}

const hasWildcard = (s) => /[*?[]/.test(s)

/** A glob whose last part could match a real env file (".e*", "*env*", ".*", "*"). */
function globMayHitEnv(glob) {
  const last = lastComponent(glob).toLowerCase()
  if (!hasWildcard(last) || last.endsWith('.example')) return false
  return last.startsWith('.') || last.includes('env') || /^\*(\.\*)?$/.test(last)
}

function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      windowsHide: true,
    }).trim()
  } catch {
    return null
  }
}

/** Joins Bash (backslash) and PowerShell (backtick) line continuations. */
const joinContinuations = (command) => command.replace(/[\\`]\r?\n/g, ' ')

/** Splits a command into simple commands on ; & | and newlines outside quotes. */
function splitSegments(command) {
  const segments = []
  let current = ''
  let quote = null
  for (const ch of command) {
    if (quote) {
      current += ch
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (';&|\r\n'.includes(ch)) {
      segments.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  segments.push(current)
  return segments.map((s) => s.trim()).filter(Boolean)
}

/** Words of a simple command. `value` has quotes removed, so ma""in reads as main. */
function tokenize(segment) {
  return (segment.match(/(?:"[^"]*"?|'[^']*'?|[^\s"']+)+/g) || []).map((raw) => ({
    raw,
    value: raw.replace(/["']/g, ''),
    quoted: /["']/.test(raw),
  }))
}

const commandName = (token) => lastComponent(token?.value || '').toLowerCase()
const isGit = (token) => /^git(\.exe)?$/.test(commandName(token))
const shortRef = (ref) => String(ref).replace(/^refs\/heads\//i, '')
const isHeadAlias = (ref) => /^(head|@)$/i.test(ref)

// ------------------------------------------------------------------ pushes

const DIR_CHANGERS = new Set(['cd', 'pushd', 'popd', 'chdir', 'sl', 'set-location', 'push-location', 'pop-location'])
const BRANCH_CHANGERS = new Set(['checkout', 'switch', 'worktree', 'rebase', 'reset', 'bisect'])
const SAFE_GLOBAL_OPTS = new Set(['--no-pager', '-p', '--paginate', '-P', '--no-replace-objects', '--literal-pathspecs', '--no-optional-locks'])
const PUSH_OPTS_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])

/** Parses `git [global options] <subcommand> args` from tokens starting at the git word. */
function parseGit(tokens, gitIndex, cwd) {
  let dir = cwd
  let risky = false
  let i = gitIndex + 1
  while (i < tokens.length) {
    const v = tokens[i].value
    if (v === '-C') {
      dir = path.resolve(dir || '.', tokens[i + 1]?.value || '')
      i += 2
    } else if (SAFE_GLOBAL_OPTS.has(v)) {
      i += 1
    } else if (v.startsWith('-')) {
      // -c, --git-dir, --work-tree, --namespace, --config-env ... can redirect a push.
      risky = true
      i += 1
    } else {
      break
    }
  }
  if (risky) {
    const isPush = tokens.slice(i).some((t) => t.value.toLowerCase() === 'push')
    return { sub: isPush ? 'push' : 'unknown', args: [], dir, risky }
  }
  return { sub: (tokens[i]?.value || '').toLowerCase(), args: tokens.slice(i + 1), dir, risky }
}

/** Reason string if this push could update main, otherwise null. */
function pushTargetsMain(args, dir, stateChanged) {
  const positional = []
  for (let j = 0; j < args.length; j++) {
    const v = args[j].value
    if (/[$`(){}*?%]/.test(v)) return `"${v}" cannot be checked before it runs`
    if (v === '--all' || v === '--mirror' || v === '--branches') return `"${v}" pushes every branch, including ${PROTECTED_BRANCH}`
    if (PUSH_OPTS_WITH_VALUE.has(v)) { j += 1; continue }
    if (v.startsWith('-')) continue
    positional.push(v)
  }

  const refspecs = positional.slice(1)
  const parts = (spec) => {
    const s = spec.replace(/^\+/, '')
    const at = s.indexOf(':')
    return at < 0 ? { src: s, dst: null } : { src: s.slice(0, at), dst: s.slice(at + 1) }
  }
  const needCurrent =
    refspecs.length === 0 || refspecs.some((r) => { const p = parts(r); return isHeadAlias(p.src) || isHeadAlias(p.dst || '') })

  if (!dir) return 'the working folder is unknown'
  let current = null
  if (needCurrent) {
    if (stateChanged) return 'the command switches branch or folder before pushing'
    current = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
    if (!current || current === 'HEAD') return 'the current branch could not be determined'
  }

  // Git config that can send a push somewhere other than the named branch.
  if ((git(dir, ['config', '--get', 'push.default']) || '').toLowerCase() === 'matching') {
    return 'push.default=matching pushes every matching branch, including main'
  }
  const remote = positional[0] || (current && git(dir, ['config', '--get', `branch.${current}.remote`])) || 'origin'
  if (refspecs.length === 0 || refspecs.some((r) => parts(r).dst === null)) {
    if (git(dir, ['config', '--get-all', `remote.${remote}.push`])) return `remote.${remote}.push is configured and may map the push to main`
    if ((git(dir, ['config', '--get', `remote.${remote}.mirror`]) || '').toLowerCase() === 'true') return `remote.${remote} is a mirror`
  }

  if (refspecs.length === 0) {
    if (current.toLowerCase() === PROTECTED_BRANCH) return `you are on ${PROTECTED_BRANCH}`
    const upstream = git(dir, ['config', '--get', `branch.${current}.merge`])
    if (upstream && shortRef(upstream).toLowerCase() === PROTECTED_BRANCH) return `${current} tracks ${PROTECTED_BRANCH}`
    return null
  }

  const resolve = (ref) => (isHeadAlias(ref) ? current : shortRef(ref))
  for (const raw of refspecs) {
    const { src, dst } = parts(raw)
    const target = dst === null ? resolve(src) : dst === '' ? null : resolve(dst)
    if (target && target.toLowerCase() === PROTECTED_BRANCH) return `the refspec "${raw}" updates ${PROTECTED_BRANCH}`
  }
  return null
}

/** Returns { found, reason }: whether the command pushes, and why it may reach main. */
function analysePushes(command, cwd) {
  let stateChanged = false
  let found = false
  for (const segment of splitSegments(command)) {
    const tokens = tokenize(segment)
    if (!tokens.length) continue
    if (DIR_CHANGERS.has(commandName(tokens[0]))) stateChanged = true

    // bash -c "git push ...", powershell -Command "git push ...", and similar.
    if (tokens.some((t) => t.quoted && /\bgit(\.exe)?\b[\s\S]*\bpush\b/i.test(t.value))) {
      return { found: true, reason: 'a nested shell runs git push, which cannot be checked' }
    }

    const gitIndex = tokens.findIndex(isGit)
    if (gitIndex < 0) continue
    const parsed = parseGit(tokens, gitIndex, cwd)
    if (parsed.sub !== 'push') {
      if (BRANCH_CHANGERS.has(parsed.sub)) stateChanged = true
      continue
    }
    found = true
    if (parsed.risky) {
      return { found, reason: 'git options before push (-c, --git-dir, --work-tree, ...) can change where it pushes' }
    }
    const reason = pushTargetsMain(parsed.args, parsed.dir, stateChanged)
    if (reason) return { found, reason }
  }
  return { found, reason: null }
}

const GH_PR_MERGE = /(^|[\s;&|(])gh(\.exe)?\s+pr\s+merge(?=\s|$|[;&|)])/i
const GH_API_MERGE = /(^|[\s;&|(])gh(\.exe)?\s+api\b[^;&|\n]*(\/merges?\b|\/git\/refs)/i

// ------------------------------------------------------------------ env files

const ENV_TOKEN = /(?:^|[\s"'=\\/:<>|;&(])(\.env[\w.\-]*)/gi
const SEARCHERS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'findstr', 'select-string', 'sls'])
const READERS = new Set(['cat', 'type', 'gc', 'get-content', 'head', 'tail', 'less', 'more', 'strings', 'select-string', 'sls', 'grep', 'rg', 'findstr'])
const LISTERS = new Set(['get-childitem', 'gci', 'dir', 'ls'])

function envFileReason(command) {
  for (const m of command.matchAll(ENV_TOKEN)) {
    const after = command[m.index + m[0].length]
    if (after === '\\') continue // a regex escape such as process\.env\. , not a file
    if (!m[1].toLowerCase().endsWith('.example')) return SECRET_ENV_MESSAGE
  }

  if (/\bdotenv\b/i.test(command) && /process\.env|console\.|print/i.test(command)) return BROAD_READ_MESSAGE
  if (/\bfind\b[^|;&]*-exec(dir)?\s+(cat|grep|head|tail|less|more|strings|type)\b/i.test(command)) return BROAD_READ_MESSAGE
  if (/\bxargs\s+(-\S+\s+)*(cat|grep|head|tail|less|more|strings)\b/i.test(command)) return BROAD_READ_MESSAGE

  const segments = splitSegments(command).map(tokenize).filter((t) => t.length)
  let recursiveListing = false
  let readerInPipeline = false
  for (const tokens of segments) {
    const name = commandName(tokens[0])
    const args = tokens.slice(1).map((t) => t.value)
    if (READERS.has(name) && args.some((a) => !a.startsWith('-') && globMayHitEnv(a))) return BROAD_READ_MESSAGE
    if (SEARCHERS.has(name)) {
      if ((name === 'grep' || name === 'egrep' || name === 'fgrep') &&
          args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === '--recursive' || a === '--dereference-recursive' || /^--directories=recurse$/.test(a))) {
        return BROAD_READ_MESSAGE
      }
      if (name === 'rg' && args.some((a) => /^-[a-zA-Z.]*(u|\.)/.test(a) || a === '--hidden' || /^--no-ignore/.test(a))) return BROAD_READ_MESSAGE
      if (name === 'findstr' && args.some((a) => /^\/s$/i.test(a))) return BROAD_READ_MESSAGE
      if ((name === 'select-string' || name === 'sls') && args.some((a) => hasWildcard(a))) return BROAD_READ_MESSAGE
    }
    if (LISTERS.has(name) && args.some((a) => /^-(r|recurse|force)$/i.test(a))) recursiveListing = true
    if (READERS.has(name) && tokens !== segments[0]) readerInPipeline = true
  }
  if (recursiveListing && readerInPipeline) return BROAD_READ_MESSAGE
  return null
}

// ------------------------------------------------------------------ production API

function prodApiReason(command) {
  let text = command
  try { text = decodeURIComponent(command) } catch { /* keep the raw text */ }
  const route = /\/+api\/+(bookings|catering-orders|inquir|maya)/i.test(text)
  if (!route) return null
  if (/tala-catering-api|onrender\.com/i.test(text) || /VITE_API_BASE_URL/i.test(text)) return PROD_API_MESSAGE
  return null
}

// ------------------------------------------------------------------ guard files

const isGuardFile = (p) => {
  const n = '/' + String(p).replace(/\\/g, '/')
  return /\/\.claude\/hooks\//i.test(n) || /\/\.claude\/settings(\.local)?\.json$/i.test(n)
}
const GUARD_PATH_IN_COMMAND = /\.claude[\\/](hooks|settings)/i
const WRITE_VERBS =
  />|\bsed\s+-i|\bperl\s+-\w*i|\brm\b|\bmv\b|\bcp\b|\btee\b|\bdel\b|\bren\b|\btruncate\b|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|Rename-Item|New-Item|Clear-Content|writeFile|\bgit\s+(checkout|restore|rm|mv|stash|reset)\b/i

// ------------------------------------------------------------------ main check

function checkCommand(rawCommand, input) {
  const command = joinContinuations(rawCommand)
  const cwd = input.cwd || process.cwd()

  const prod = prodApiReason(command)
  if (prod) return { block: prod }
  const env = envFileReason(command)
  if (env) return { block: env }

  const pushes = analysePushes(command, cwd)
  if (pushes.found && input.agent_id) return { block: SUBAGENT_PUSH_MESSAGE }

  if (GH_PR_MERGE.test(command) || GH_API_MERGE.test(command)) {
    return { ask: `Merging through gh usually updates ${PROTECTED_BRANCH}. Eli, approve only if you consent.` }
  }
  const withoutRedirects = command.replace(/\d?>&\d|\d?>\s*(\/dev\/null|\$null|nul)\b/gi, '')
  if (GUARD_PATH_IN_COMMAND.test(command) && WRITE_VERBS.test(withoutRedirects)) {
    return { ask: 'This command may change the guard hook or Claude settings. Eli, approve only if you intended that.' }
  }
  if (pushes.reason) {
    return { ask: `This push may update ${PROTECTED_BRANCH} (${pushes.reason}). Eli, approve only if you consent to pushing to ${PROTECTED_BRANCH}.` }
  }
  return null
}

function check(input) {
  const tool = String(input.tool_name || '')
  const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}

  if (tool === 'Bash' || tool === 'PowerShell') return checkCommand(String(toolInput.command || ''), input)

  if (/^mcp__/i.test(tool) && /supabase/i.test(tool)) {
    const action = tool.split('__').pop()
    if (/^(list_|get_|search_|generate_)/i.test(action)) return null
    return { ask: `Supabase "${action}" can change data or settings. Eli, approve only if you intended that.` }
  }

  const target = toolInput.file_path || toolInput.notebook_path || toolInput.path
  if (typeof target === 'string' && isSecretEnvPath(target)) return { block: SECRET_ENV_MESSAGE }

  // Grep can also aim at env files through its glob filter (".env*", ".e*", "*env*").
  if (tool === 'Grep' && typeof toolInput.glob === 'string') {
    const glob = toolInput.glob
    if ((/\.env/i.test(glob) && !/\.example$/i.test(glob)) || globMayHitEnv(glob)) return { block: SECRET_ENV_MESSAGE }
  }

  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool) && typeof target === 'string' && isGuardFile(target)) {
    return { ask: 'This edits the guard hook or Claude settings. Eli, approve only if you intended that.' }
  }
  return null
}

function block(message) {
  process.stderr.write(`Blocked by .claude/hooks/guard.cjs: ${message}\n`)
  process.exitCode = 2
}

function ask(message) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `.claude/hooks/guard.cjs: ${message}`,
      },
    }),
  )
}

const chunks = []
process.stdin.on('data', (chunk) => chunks.push(chunk))
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      block('unexpected hook input, so the call is blocked to be safe.')
      return
    }
    const result = check(input)
    if (result?.block) block(result.block)
    else if (result?.ask) ask(result.ask)
  } catch (error) {
    block(`internal error (${error && error.message}), so the call is blocked to be safe.`)
  }
})
