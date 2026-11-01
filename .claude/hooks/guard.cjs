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
    // `-c alias.x=push x` and `-c alias.x="!git push" x` count as pushes too.
    const isPush = tokens.slice(i).some((t) => {
      const v = t.value.toLowerCase()
      return v === 'push' || v === 'send-pack' || (/^alias\./.test(v) && /\b(push|send-pack)\b/.test(v))
    })
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

// ------------------------------------------------------------------ command text analysis

const GIT_PUSH_RE = /\bgit(?:\.exe)?\b[\s\S]*\b(?:push|send-pack)\b/i
const GH_MUTATE_RE = /\bgh(?:\.exe)?\s+(?:api\b[\s\S]*?(?:\s-X|\s--method|\s-[fF]|\s--field|\s--raw-field|\s--input)|repo\s+sync\b)/i
const SHELL_WORD = /(?:^|[\s|;&(])(?:bash|sh|zsh|dash|ksh|fish|cmd|powershell|pwsh|iex|invoke-expression|python3?|node|ruby|perl|php|eval|source|xargs|ssh|wsl)(?=\s|$)/i
const INTERPRETERS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish', 'cmd', 'powershell', 'pwsh', 'iex', 'invoke-expression', 'python', 'python3', 'node', 'source', 'eval', 'wsl', 'xargs', 'perl', 'ruby', 'php', 'ssh', '.', 'start-process', 'invoke-command'])
// A segment that runs a script file, e.g. ./deploy.sh, .\run.ps1, C:\x\y.bat
const RUNS_SCRIPT = /^(?:\.{1,2}[\\/]|[a-z]:[\\/]|\/)|\.(?:sh|bash|ps1|psm1|py|rb|pl|php|bat|cmd)$/i
// Commands whose quoted arguments are plain text (printed, written or searched), not run.
const TEXT_COMMANDS = new Set(['echo', 'printf', 'write-output', 'write-host', 'write-error', 'set-content', 'add-content', 'out-file', 'tee', 'cat', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'select-string', 'sls', 'findstr'])
const MESSAGE_OPTION = /^(?:-[a-zA-Z]*m|--message|--body|--title|--notes|--description)$/
const MESSAGE_ATTACHED = /^(?:-[a-zA-Z]*m|--message=|--body=|--title=|--notes=)["']/

/**
 * Removes here-document bodies (<<EOF ... EOF, also inside $( ) in quotes) and PowerShell
 * here-strings (@' ... '@) from a command, so text written to a file or passed as a commit
 * message is not read as commands. Returns the remaining command and the removed bodies.
 */
function maskHeredocs(command) {
  const bodies = []
  const stack = ['top']
  let pending = []
  let out = ''
  let i = 0
  let lineStart = 0
  const n = command.length
  while (i < n) {
    const ctx = stack[stack.length - 1]
    const ch = command[i]
    if (ch === '\n') {
      out += ch
      const intro = command.slice(lineStart, i)
      i += 1
      if (pending.length && (ctx === 'top' || ctx === 'sub')) {
        for (const { delim, expands } of pending) {
          let body = ''
          while (i < n) {
            let end = command.indexOf('\n', i)
            if (end < 0) end = n
            const line = command.slice(i, end)
            i = Math.min(end + 1, n)
            if (line.trim() === delim) break
            body += line + '\n'
          }
          bodies.push({ text: body, intro, whole: false, expands })
        }
        pending = []
      }
      lineStart = i
      continue
    }
    if (ctx === 'sq') {
      out += ch
      i += 1
      if (ch === "'") stack.pop()
      continue
    }
    if (ctx === 'dq') {
      if (ch === '"') { stack.pop(); out += ch; i += 1; continue }
      if (ch === '$' && command[i + 1] === '(') { stack.push('sub'); out += '$('; i += 2; continue }
      out += ch
      i += 1
      continue
    }
    // ctx is top or sub
    if (ch === "'") { stack.push('sq'); out += ch; i += 1; continue }
    if (ch === '"') { stack.push('dq'); out += ch; i += 1; continue }
    if (ch === '$' && command[i + 1] === '(') { stack.push('sub'); out += '$('; i += 2; continue }
    if (ch === ')' && ctx === 'sub') { stack.pop(); out += ch; i += 1; continue }
    if (ch === '@' && (command[i + 1] === "'" || command[i + 1] === '"') && /^\r?\n/.test(command.slice(i + 2, i + 4))) {
      const q = command[i + 1]
      const endAt = command.indexOf(`\n${q}@`, i + 2)
      // @" ... "@ expands $( ) like an unquoted heredoc; @' ... '@ is literal.
      bodies.push({ text: command.slice(i + 2, endAt < 0 ? n : endAt), intro: command.slice(lineStart, i), whole: true, expands: q === '"' })
      out += `${q}${q}`
      if (endAt < 0) { i = n } else { i = endAt + 3; lineStart = endAt + 1 }
      continue
    }
    if (ch === '<' && command[i + 1] === '<') {
      if (command[i + 2] === '<') { out += '<<<'; i += 3; continue } // here-string, not a heredoc
      const m = /^<<-?[ \t]*(?:'([^'\r\n]+)'|"([^"\r\n]+)"|\\?([A-Za-z0-9_.\-]+))/.exec(command.slice(i))
      if (m) {
        // Only an unquoted delimiter (<<EOF) expands $( ) and backticks inside the body.
        pending.push({ delim: m[1] || m[2] || m[3], expands: !!m[3] })
        out += m[0]
        i += m[0].length
        continue
      }
    }
    out += ch
    i += 1
  }
  return { text: out, bodies }
}

const GIT_BUILTINS = new Set([
  '', 'add', 'am', 'apply', 'archive', 'bisect', 'blame', 'branch', 'bundle', 'cat-file', 'check-attr', 'check-ignore', 'checkout',
  'cherry', 'cherry-pick', 'clean', 'clone', 'commit', 'commit-tree', 'config', 'count-objects', 'credential', 'describe', 'diff',
  'diff-index', 'diff-tree', 'difftool', 'fetch', 'for-each-ref', 'format-patch', 'fsck', 'gc', 'grep', 'hash-object', 'help',
  'init', 'lfs', 'log', 'ls-files', 'ls-remote', 'ls-tree', 'maintenance', 'merge', 'mergetool', 'mv', 'name-rev', 'notes', 'prune',
  'pull', 'read-tree', 'rebase', 'reflog', 'remote', 'repack', 'reset', 'restore', 'rev-list', 'rev-parse', 'revert', 'rm',
  'shortlog', 'show', 'show-ref', 'sparse-checkout', 'stash', 'status', 'submodule', 'switch', 'symbolic-ref', 'tag', 'update-ref',
  'var', 'version', 'whatchanged', 'worktree', 'write-tree',
])

/** Alias that expands to a push? Follows alias chains a few levels deep. */
function aliasPushes(sub, args, dir, defs, depth = 0) {
  const expansion = defs[sub] ?? (dir ? git(dir, ['config', '--get', `alias.${sub}`]) : null)
  if (!expansion) return false
  if (/\b(?:push|send-pack)\b/i.test(expansion)) return true
  if (expansion.startsWith('!') && args.some((a) => /^(push|send-pack)$/i.test(a.value))) return true
  const words = expansion.replace(/^!/, '').trim().split(/\s+/)
  const next = ((words[0] === 'git' ? words[1] : words[0]) || '').toLowerCase()
  if (next && depth < 4 && !GIT_BUILTINS.has(next)) return aliasPushes(next, args, dir, defs, depth + 1)
  return false
}

/**
 * Deliberately disabled (1 Nov 2026 review): trying to recognise quoted text that only
 * MENTIONS a push (commit messages, echo, heredocs) opened several bypasses (bash -cm "…",
 * echo … | bash.exe, scripts written then run). Any quoted text containing `git … push` is
 * therefore treated as a possible push: the main session is asked, sub-agents are blocked.
 * The cost is an occasional extra prompt for a commit message that mentions a push.
 */
const TEXT_EXEMPTION_ENABLED = false

/** True when the quoted token is plain text (a commit message, echoed or searched text), not a nested command. */
function isTextToken(tokens, index) {
  if (!TEXT_EXEMPTION_ENABLED) return false
  const token = tokens[index]
  const head = commandName(tokens[0])
  const prev = index > 0 ? tokens[index - 1].value : ''
  // Message options only count for git and gh: `bash -m "git push ..."` is not a commit message.
  const gitOrGh = /^(git|gh)(\.exe)?$/.test(head)
  const isMessage =
    (gitOrGh && (MESSAGE_OPTION.test(prev) || MESSAGE_ATTACHED.test(token.raw))) ||
    (head === 'gh' && /^-[bt]$/.test(prev)) ||
    TEXT_COMMANDS.has(head)
  if (!isMessage) return false
  // Double quotes can still run $( ) or `...`; heredoc bodies were already removed from the text.
  if (token.raw.includes('"') && /\$\(|`/.test(token.raw)) return false
  return true
}

/** Reason string if this `gh` call changes the repository through the API, otherwise null. */
function ghMutationReason(tokens, g) {
  const sub = (tokens[g + 1]?.value || '').toLowerCase()
  const rest = tokens.slice(g + 2).map((t) => t.value)
  if (sub === 'repo' && (rest[0] || '').toLowerCase() === 'sync') return 'gh repo sync updates a branch of the repository'
  if (sub !== 'api') return null
  let method = null
  let hasField = false
  for (let k = 0; k < rest.length; k++) {
    const v = rest[k]
    const attached = /^(?:-X=?|--method=)(.+)$/i.exec(v)
    if (/^(-X|--method)$/i.test(v)) method = rest[k + 1] ?? ''
    else if (attached) method = attached[1]
    else if (/^-[fF]/.test(v) || /^--(field|raw-field|input)\b/.test(v)) hasField = true
  }
  const mutating = method !== null ? !/^(get|head)$/i.test(method) : hasField
  return mutating ? 'gh api with a method other than GET (or with fields) can change the repository' : null
}

/** Returns { found, reason, gh }: whether the command pushes, why it may reach main, and any gh API mutation. */
function analysePushes(rawCommand, cwd) {
  const { text: command, bodies } = maskHeredocs(rawCommand)
  let stateChanged = false
  let found = false
  let gh = null
  let exemptedPushText = false
  const aliasDefs = {}

  // Heredoc / here-string bodies only count when something feeds them to a shell.
  for (const body of bodies) {
    // An expanding body runs its $( ) and backticks while the text is being written,
    // even when nothing feeds it to a shell (cat > file <<EOF ... $(git push) ... EOF).
    if (body.expands && /\$\(|`/.test(body.text)) {
      if (GIT_PUSH_RE.test(body.text)) return { found: true, reason: 'a here-document runs git push through $( ) or backticks', gh }
      if (GH_MUTATE_RE.test(body.text)) gh = 'a here-document changes the repository through gh in $( ) or backticks'
    }
    // Any here-document or here-string that contains a push counts, whether or not we can see
    // it being fed to a shell (it may be written to a script and run, or piped to bash.exe).
    if (GIT_PUSH_RE.test(body.text)) return { found: true, reason: 'a here-document contains git push, which cannot be checked', gh }
    if (GH_MUTATE_RE.test(body.text)) gh = 'a here-document changes the repository through gh'
  }

  for (const segment of splitSegments(command)) {
    const tokens = tokenize(segment)
    if (!tokens.length) continue
    const head = commandName(tokens[0])
    if (DIR_CHANGERS.has(head)) stateChanged = true
    // Push text that was echoed or written earlier in this command, then run: piped into an
    // interpreter, or written to a script that a later segment executes.
    if (exemptedPushText && (INTERPRETERS.has(head) || RUNS_SCRIPT.test(tokens[0].value) || tokens.some((t) => RUNS_SCRIPT.test(t.value) && INTERPRETERS.has(head)))) {
      return { found: true, reason: 'text containing git push is run as a script', gh }
    }

    // bash -c "git push ...", powershell -Command "git push ...", and similar.
    // Quoted commit messages, echoed text and search patterns are plain text and are skipped.
    for (let t = 0; t < tokens.length; t++) {
      if (!tokens[t].quoted) continue
      const value = tokens[t].value
      const hitsGit = GIT_PUSH_RE.test(value)
      const hitsGh = GH_MUTATE_RE.test(value)
      if (!hitsGit && !hitsGh) continue
      if (isTextToken(tokens, t)) { if (hitsGit) exemptedPushText = true; continue }
      if (hitsGit) return { found: true, reason: 'a nested shell runs git push, which cannot be checked', gh }
      gh = 'a nested shell changes the repository through gh'
    }

    const ghIndex = tokens.findIndex((t) => /^gh(\.exe)?$/.test(commandName(t)))
    if (ghIndex >= 0) gh = ghMutationReason(tokens, ghIndex) || gh

    const dashed = tokens.find((t) => /^git-(push|send-pack)(\.exe)?$/.test(commandName(t)))
    if (dashed) return { found: true, reason: `${commandName(dashed)} can update ${PROTECTED_BRANCH}`, gh }
    if (tokens.some((t) => /^git-subtree(\.exe)?$/.test(commandName(t))) && tokens.some((t) => t.value.toLowerCase() === 'push')) {
      return { found: true, reason: 'git subtree push can update main', gh }
    }

    const gitIndex = tokens.findIndex(isGit)
    if (gitIndex < 0) continue
    const parsed = parseGit(tokens, gitIndex, cwd)
    if (parsed.sub !== 'push') {
      if (BRANCH_CHANGERS.has(parsed.sub)) stateChanged = true
      if (parsed.sub === 'config') {
        parsed.args.forEach((a, k) => {
          const m = /^alias\.(.+)$/i.exec(a.value)
          if (m && parsed.args[k + 1]) aliasDefs[m[1].toLowerCase()] = parsed.args[k + 1].value
        })
      } else if (parsed.sub === 'send-pack') {
        return { found: true, reason: 'git send-pack can update main', gh }
      } else if (parsed.sub === 'subtree' && parsed.args.some((a) => a.value.toLowerCase() === 'push')) {
        return { found: true, reason: 'git subtree push can update main', gh }
      } else if (parsed.sub && !GIT_BUILTINS.has(parsed.sub) && !parsed.risky && aliasPushes(parsed.sub, parsed.args, parsed.dir, aliasDefs)) {
        return { found: true, reason: `the git alias "${parsed.sub}" expands to a push`, gh }
      }
      continue
    }
    found = true
    if (parsed.risky) {
      return { found, reason: 'git options before push (-c, --git-dir, --work-tree, ...) can change where it pushes', gh }
    }
    const reason = pushTargetsMain(parsed.args, parsed.dir, stateChanged)
    if (reason) return { found, reason, gh }
  }
  return { found, reason: null, gh }
}

const GH_PR_MERGE = /(^|[\s;&|(])gh(\.exe)?\s+pr\s+merge(?=\s|$|[;&|)])/i
const GH_API_MERGE = /(^|[\s;&|(])gh(\.exe)?\s+api\b[^;&|\n]*(\/merges?\b|\/git\/refs)/i

// ------------------------------------------------------------------ env files

const ENV_TOKEN = /(?:^|[\s"'=\\/:<>|;&(])(\.env[\w.\-]*)/gi
const SEARCHERS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'findstr', 'select-string', 'sls'])
const READERS = new Set(['cat', 'type', 'gc', 'get-content', 'head', 'tail', 'less', 'more', 'strings', 'select-string', 'sls', 'grep', 'rg', 'findstr'])
const LISTERS = new Set(['get-childitem', 'gci', 'dir', 'ls'])

const GREP_VALUE_OPTS = new Set(['-m', '--max-count', '-A', '-B', '-C', '--after-context', '--before-context', '--context', '--include', '--exclude', '--exclude-dir', '--label', '-d', '--directories', '-D', '--devices', '-t', '-T', '--type', '--type-not', '--type-add', '-j', '--threads', '-M', '--max-columns', '--max-depth', '--color', '--colour'])
const SLS_VALUE_OPTS = new Set(['include', 'exclude', 'encoding', 'context', 'culture', 'inputobject'])

/** Path and glob arguments of a Select-String call: the pattern is not one. */
function selectStringPaths(args) {
  const out = []
  let patternGiven = false
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    const opt = /^-([a-z]+)(?::(.*))?$/i.exec(a)
    if (opt) {
      const name = opt[1].toLowerCase()
      const attached = opt[2]
      if (name.length >= 4 && 'pattern'.startsWith(name)) {
        patternGiven = true
        if (attached === undefined) k += 1
      } else if (name.includes('path') || name === 'lp' || (name.length >= 3 && 'literalpath'.startsWith(name))) {
        // -Path, -LiteralPath and their aliases (-PSPath, -LP, ...): the value is read.
        const value = attached !== undefined ? attached : args[++k]
        if (value !== undefined) out.push(...value.split(','))
      } else if (SLS_VALUE_OPTS.has(name) && attached === undefined) {
        k += 1
      }
      continue // other options are switches (-NotMatch, -SimpleMatch, -CaseSensitive, ...)
    }
    if (!patternGiven) patternGiven = true // the first positional argument is the pattern
    else out.push(...a.split(','))
  }
  return out
}

/** Path and glob arguments of grep, rg, findstr and similar: the pattern is not one. */
function grepStylePaths(name, args) {
  const out = []
  let patternGiven = false
  let literal = false
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (!literal && a === '--') { literal = true; continue }
    if (!literal && a.startsWith('--')) {
      const eq = a.indexOf('=')
      const key = eq < 0 ? a : a.slice(0, eq)
      const attached = eq < 0 ? undefined : a.slice(eq + 1)
      if (key === '--regexp') { patternGiven = true; if (attached === undefined) k += 1 }
      else if (key === '--file') {
        // --file reads patterns FROM a file: that file is read, so check it like a path.
        patternGiven = true
        const v = attached !== undefined ? attached : args[++k]
        if (v !== undefined) out.push(v)
      }
      else if (key === '--glob' || key === '--iglob') { const v = attached !== undefined ? attached : args[++k]; if (v !== undefined) out.push(v) }
      else if (GREP_VALUE_OPTS.has(key) && attached === undefined) k += 1
      continue
    }
    if (!literal && a.length > 1 && a.startsWith('-') && !/^-\d+$/.test(a)) {
      // In a short-option group, -e/-f take a value: either the rest of the group
      // (grep -e. / -ex / -fFILE) or the next argument (grep -rne PATTERN).
      const letters = a.slice(1)
      const ef = letters.search(/[ef]/)
      if (ef >= 0 && /^[a-zA-Z0-9]*$/.test(letters.slice(0, ef))) {
        const flag = letters[ef]
        const rest = letters.slice(ef + 1)
        patternGiven = true
        if (flag === 'e') { if (!rest) k += 1 }
        else if (rest) out.push(rest) // -fFILE: FILE is read
        else { if (args[k + 1] !== undefined) out.push(args[k + 1]); k += 1 }
        continue
      }
      const last = /^-[a-zA-Z0-9]*([a-zA-Z])$/.exec(a)?.[1]
      if (last === 'g' && name === 'rg') { if (args[k + 1] !== undefined) out.push(args[k + 1]); k += 1 }
      else if (last && /^[mABCtTjMdD]$/.test(last) && a.length === 2) k += 1
      continue
    }
    if (!literal && name === 'findstr' && /^\/[a-z](:.*)?$/i.test(a)) {
      if (/^\/[cg]:/i.test(a)) patternGiven = true
      continue
    }
    if (!patternGiven) patternGiven = true // the first non-option argument is the pattern
    else out.push(a)
  }
  return out
}

/** Arguments that may be file paths or globs (a search pattern is left out). */
function pathArgs(name, args) {
  if (name === 'select-string' || name === 'sls') return selectStringPaths(args)
  if (SEARCHERS.has(name)) return grepStylePaths(name, args)
  return args.filter((a) => !a.startsWith('-'))
}

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
    const paths = pathArgs(name, args)
    if (READERS.has(name) && paths.some((a) => !a.startsWith('-') && globMayHitEnv(a))) return BROAD_READ_MESSAGE
    if (SEARCHERS.has(name)) {
      if ((name === 'grep' || name === 'egrep' || name === 'fgrep') &&
          args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === '--recursive' || a === '--dereference-recursive' || /^--directories=recurse$/.test(a))) {
        return BROAD_READ_MESSAGE
      }
      if (name === 'rg' && args.some((a) => /^-[a-zA-Z.]*(u|\.)/.test(a) || a === '--hidden' || /^--no-ignore/.test(a))) return BROAD_READ_MESSAGE
      if (name === 'findstr' && args.some((a) => /^\/s$/i.test(a))) return BROAD_READ_MESSAGE
      if ((name === 'select-string' || name === 'sls') && paths.some((a) => hasWildcard(a))) return BROAD_READ_MESSAGE
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

  if (pushes.gh) return { ask: `${pushes.gh}. Eli, approve only if you consent.` }
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
