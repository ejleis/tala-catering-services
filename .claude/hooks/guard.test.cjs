'use strict'

// Run from the repo root:  node --test .claude/hooks/guard.test.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const GUARD = path.join(__dirname, 'guard.cjs')

// Throwaway repos so the guard can read the current branch and git config.
const repos = []
function makeRepo(branch, { upstream, config = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tala-guard-'))
  repos.push(dir)
  const git = (...args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'init')
  if (branch !== 'main') git('switch', '-q', '-c', branch)
  if (upstream) {
    git('config', `branch.${branch}.remote`, 'origin')
    git('config', `branch.${branch}.merge`, `refs/heads/${upstream}`)
  }
  for (const [key, value] of Object.entries(config)) git('config', key, value)
  return dir
}
const ON_MAIN = makeRepo('main')
const ON_FEATURE = makeRepo('feature/ai-integration', { upstream: 'feature/ai-integration' })
const FEATURE_TRACKING_MAIN = makeRepo('feature/x', { upstream: 'main' })
const PUSH_MATCHING = makeRepo('feature/m', { config: { 'push.default': 'matching' } })
const REMOTE_PUSH_MAP = makeRepo('feature/r', { config: { 'remote.origin.push': 'refs/heads/feature/r:refs/heads/main' } })
const WITH_ALIASES = makeRepo('feature/a', {
  config: { 'alias.x': 'push', 'alias.y': '!git', 'alias.z': 'x', 'alias.st': 'status -sb' },
})
test.after(() => {
  for (const dir of repos) fs.rmSync(dir, { recursive: true, force: true })
})

function run(toolName, toolInput, cwd = ON_FEATURE, extra = {}) {
  return spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: toolInput, cwd, ...extra }),
    encoding: 'utf8',
  })
}

const blocked = (toolName, toolInput, cwd, extra) => {
  const result = run(toolName, toolInput, cwd, extra)
  assert.equal(result.status, 2, `expected block for ${JSON.stringify(toolInput)}: ${result.stdout}`)
  assert.match(result.stderr, /Blocked by \.claude\/hooks\/guard\.cjs/)
}
const allowed = (toolName, toolInput, cwd, extra) => {
  const result = run(toolName, toolInput, cwd, extra)
  assert.equal(result.status, 0, `expected allow for ${JSON.stringify(toolInput)}: ${result.stderr}`)
  assert.equal(result.stdout, '', `expected no decision for ${JSON.stringify(toolInput)}: ${result.stdout}`)
}
const asks = (toolName, toolInput, cwd, extra) => {
  const result = run(toolName, toolInput, cwd, extra)
  assert.equal(result.status, 0, `expected ask for ${JSON.stringify(toolInput)}: ${result.stderr}`)
  const out = JSON.parse(result.stdout || '{}')
  assert.equal(out.hookSpecificOutput?.permissionDecision, 'ask', `expected ask for ${JSON.stringify(toolInput)}`)
}
const sh = (command) => ({ command })

// ---------------------------------------------------------------- pushes

test('allows pushes to feature branches', () => {
  allowed('Bash', sh('git push'))
  allowed('PowerShell', sh('git push -u origin feature/ai-integration'))
  allowed('Bash', sh('git push origin HEAD'))
  allowed('Bash', sh('git push --force-with-lease origin feature/ai-integration'))
  allowed('PowerShell', sh('git add . ; git commit -m "x" ; git push'))
  allowed('Bash', sh(`git -C "${ON_FEATURE}" push`), ON_MAIN)
  allowed('Bash', sh('git commit -m "fix checkout page" && git push'))
  allowed('Bash', sh('git commit -m "cd into the right folder" && git push'))
})

test('asks before any push that names main', () => {
  asks('Bash', sh('git push origin main'))
  asks('Bash', sh('git push origin main --force'))
  asks('Bash', sh('git push origin Main'))
  asks('Bash', sh('git push origin HEAD:main'))
  asks('Bash', sh('git push origin head:main'))
  asks('Bash', sh('git push origin @:main'))
  asks('Bash', sh('git push origin +feature/ai-integration:refs/heads/main'))
  asks('Bash', sh('git push origin feature/ai-integration:"refs/heads/main"'))
  asks('Bash', sh('git push origin ma""in'))
  asks('Bash', sh('git push origin :main'))
  asks('Bash', sh('git push origin --delete main'))
  asks('Bash', sh('git push --all origin'))
  asks('Bash', sh('git push --mirror origin'))
  asks('Bash', sh('git push origin feature/ai-integration && git push origin main'))
  asks('PowerShell', sh('git push origin $branch'))
})

test('asks when the push is split, nested or spelled differently', () => {
  asks('Bash', sh('git push origin \\\n  main'))
  asks('Bash', sh('git push \\\n  origin HEAD:main'))
  asks('PowerShell', sh('git push origin `\n  main'))
  asks('PowerShell', sh('git.exe push origin main'))
  asks('PowerShell', sh('& "C:/Program Files/Git/cmd/git.exe" push origin main'))
  asks('Bash', sh('/usr/bin/git push origin main'))
  asks('Bash', sh('bash -c "git push origin feature/x"'))
  asks('PowerShell', sh('powershell -Command "git push origin feature/x"'))
})

test('asks when git options or config can change the push target', () => {
  asks('Bash', sh('git --git-dir .git push origin feature/x'))
  asks('Bash', sh('git --work-tree . push origin feature/x'))
  asks('Bash', sh('git -c push.default=matching push'))
  asks('Bash', sh('git push'), PUSH_MATCHING)
  asks('Bash', sh('git push origin feature/r'), REMOTE_PUSH_MAP)
  asks('Bash', sh(`git -C ${path.basename(ON_MAIN)} push`), os.tmpdir())
})

test('asks when the command switches branch or folder before pushing', () => {
  asks('Bash', sh('git checkout main && git merge feat && git push'))
  asks('Bash', sh('git checkout main && git merge feat && git push origin HEAD'))
  asks('PowerShell', sh('git switch main; git merge feat; git push'))
  asks('Bash', sh('cd ../other && git push'))
  asks('PowerShell', sh('Push-Location ..\\other; git push'))
})

test('asks for a bare or HEAD push while on main or tracking main', () => {
  asks('Bash', sh('git push'), ON_MAIN)
  asks('Bash', sh('git push origin HEAD'), ON_MAIN)
  asks('Bash', sh('git push origin @'), ON_MAIN)
  asks('Bash', sh('git push'), FEATURE_TRACKING_MAIN)
  asks('Bash', sh(`git -C "${ON_MAIN}" push`), ON_FEATURE)
})

test('asks before merging through gh', () => {
  asks('Bash', sh('gh pr merge 12 --squash'))
  asks('Bash', sh('gh api -X PUT repos/o/r/pulls/3/merge'))
  asks('Bash', sh('gh api -X POST repos/o/r/merges -f base=main -f head=feat'))
})

test('blocks every push from a sub-agent', () => {
  blocked('Bash', sh('git push origin feature/x'), ON_FEATURE, { agent_id: 'abc123' })
  allowed('Bash', sh('git status'), ON_FEATURE, { agent_id: 'abc123' })
})

test('allows git commands that merely mention push', () => {
  allowed('Bash', sh('git commit -m "fix push notification bug"'))
  allowed('Bash', sh('git log --oneline --grep push'))
  allowed('Bash', sh('git fetch origin main'))
  allowed('Bash', sh('git status --short'))
})

// ---------------------------------------------------------------- env files

test('blocks real env files in shell commands and file tools', () => {
  blocked('Bash', sh('cat server/.env'))
  blocked('PowerShell', sh('Get-Content server\\.env.production'))
  blocked('Bash', sh('cp ../.env.example .env'))
  blocked('Read', { file_path: '/repo/.env' })
  blocked('Edit', { file_path: 'C:\\repo\\server\\.env' })
  blocked('Write', { file_path: '/repo/.env.local' })
})

test('blocks wildcard, recursive and dotenv reads that reach env files', () => {
  blocked('Bash', sh('cat server/.e*'))
  blocked('Bash', sh('cat server/.*'))
  blocked('PowerShell', sh('Get-Content server/*'))
  blocked('PowerShell', sh('Get-Content server/*env*'))
  blocked('Bash', sh('grep -rn MAYA_SECRET_KEY server/'))
  blocked('Bash', sh('grep -R MAYA server'))
  blocked('Bash', sh('grep --recursive MAYA server'))
  blocked('Bash', sh('rg --hidden MAYA'))
  blocked('Bash', sh('rg -uu MAYA'))
  blocked('Bash', sh('rg --no-ignore MAYA server'))
  blocked('PowerShell', sh('findstr /s MAYA *'))
  blocked('PowerShell', sh('Select-String -Path server/* -Pattern MAYA_SECRET'))
  blocked('PowerShell', sh('Get-ChildItem -Recurse server | Select-String MAYA'))
  blocked('PowerShell', sh('gci -r server | Get-Content'))
  blocked('Bash', sh('find server -type f -exec cat {} +'))
  blocked('Bash', sh('find server -type f | xargs grep MAYA'))
  blocked('Bash', sh(`cd server && node -e "require('dotenv').config();console.log(process.env.MAYA_SECRET_KEY)"`))
})

test('allows env templates and ordinary code that mentions env', () => {
  allowed('Read', { file_path: '/repo/.env.example' })
  allowed('Read', { file_path: '/repo/server/.env.example' })
  allowed('Edit', { file_path: '/repo/.env.example' })
  allowed('Bash', sh('cat .env.example'))
  allowed('Bash', sh('node -e "console.log(process.env.PORT)"'))
  allowed('Bash', sh('node -e "console.log(/process\\.env\\./.test(\'x\'))"'))
  allowed('Read', { file_path: '/repo/src/lib/api.js' })
  allowed('Bash', sh('grep -n TAX_RATE server/routes/bookings.js'))
  allowed('Bash', sh('rg MAYA server'))
  allowed('Bash', sh('git grep -n MAYA'))
  allowed('Bash', sh('cat src/*.js'))
})

test('blocks Grep aimed at real env files, allows ordinary searches', () => {
  blocked('Grep', { pattern: 'KEY', path: 'server/.env' })
  blocked('Grep', { pattern: 'KEY', path: 'C:\\repo\\.env.local' })
  blocked('Grep', { pattern: 'KEY', glob: '.env*' })
  blocked('Grep', { pattern: 'KEY', glob: '.e*' })
  blocked('Grep', { pattern: 'KEY', glob: '*env*' })
  blocked('Grep', { pattern: 'KEY', path: 'server', glob: '**/.env' })
  allowed('Grep', { pattern: 'MAYA', path: 'server/.env.example' })
  allowed('Grep', { pattern: 'MAYA', glob: '*.env.example' })
  allowed('Grep', { pattern: 'TAX_RATE', path: 'server', glob: '*.js' })
  allowed('Grep', { pattern: 'process.env' })
})

// ---------------------------------------------------------------- production API

test('blocks calls to the production order and payment routes', () => {
  blocked('Bash', sh('curl -X POST https://tala-catering-api.onrender.com/api/bookings -d {}'))
  blocked('PowerShell', sh('Invoke-RestMethod https://tala-catering-api.onrender.com/api/catering-orders'))
  blocked('PowerShell', sh('$api = "https://tala-catering-api.onrender.com"; Invoke-RestMethod -Method Post -Uri "$api/api/catering-orders"'))
  blocked('Bash', sh('curl https://tala-catering-api.onrender.com//api/bookings'))
  blocked('Bash', sh('curl https://tala-catering-api.onrender.com:443/api/bookings'))
  blocked('Bash', sh('curl https://tala-catering-api.onrender.com/api/%62ookings'))
  blocked('PowerShell', sh('Invoke-RestMethod "$env:VITE_API_BASE_URL/api/bookings"'))
})

test('allows health checks, local API calls and code searches', () => {
  allowed('Bash', sh('curl https://tala-catering-api.onrender.com/health'))
  allowed('Bash', sh('curl http://localhost:3001/health'))
  allowed('Bash', sh('curl -X POST http://localhost:3001/api/bookings -d {}'))
  allowed('Bash', sh('grep -n onrender server/routes/bookings.js'))
})

// ---------------------------------------------------------------- guard files, Supabase

test('asks before changing the guard or Claude settings', () => {
  asks('Edit', { file_path: 'C:\\repo\\.claude\\hooks\\guard.cjs' })
  asks('Write', { file_path: '/repo/.claude/settings.json' })
  asks('Write', { file_path: '/repo/.claude/settings.local.json' })
  asks('Bash', sh('sed -i s/x/y/ .claude/hooks/guard.cjs'))
  asks('PowerShell', sh('Remove-Item .claude\\settings.json'))
  allowed('Read', { file_path: '/repo/.claude/hooks/guard.cjs' })
  allowed('Bash', sh('node --test .claude/hooks/guard.test.cjs 2>&1 | tail -5'))
  allowed('Edit', { file_path: '/repo/.claude/agents/tala-backend-engineer.md' })
})

test('asks before Supabase connector calls that are not read-only', () => {
  asks('mcp__claude_ai_Supabase__execute_sql', { query: 'select 1' })
  asks('mcp__claude_ai_Supabase__apply_migration', { query: 'drop table x' })
  allowed('mcp__claude_ai_Supabase__list_tables', {})
  allowed('mcp__claude_ai_Supabase__get_advisors', {})
})

// ---------------------------------------------------------------- misc

test('allows ordinary development commands', () => {
  allowed('Bash', sh('npm run build'))
  allowed('Bash', sh('npm run check:rooms'))
  allowed('PowerShell', sh('Select-String -Path src\\data\\hotels.js -Pattern rate'))
  allowed('Glob', { pattern: '**/*.js' })
})

// ---------------------------------------------------------------- search patterns are not paths

test('allows search patterns that contain wildcard characters', () => {
  allowed('PowerShell', sh('Select-String -Path src\\data\\hotels.js -Pattern \'[A-Z_]+\''))
  allowed('PowerShell', sh('Select-String -Path x -Pattern \'TODO*\''))
  allowed('PowerShell', sh('Select-String -Path x -SimpleMatch -Pattern "a*b"'))
  allowed('PowerShell', sh('sls \'TODO*\' src\\a.js'))
  allowed('PowerShell', sh('Select-String "TODO*" -Path src\\a.js'))
  allowed('Bash', sh('grep -n \'process.env.*KEY\' server/routes/catering.js'))
  allowed('Bash', sh('grep -n \'^remote:\\s*$\' file.txt'))
  allowed('Bash', sh('grep -e \'a*b\' -n server/routes/catering.js'))
  allowed('Bash', sh('rg \'fo+.*bar\' src'))
  allowed('PowerShell', sh('git diff | Select-String -NotMatch "LF will be replaced"'))
  allowed('PowerShell', sh('npm run check:rooms | Select-String -Pattern "^(✔|✖)"'))
})

test('still blocks searches whose path or glob can reach env files', () => {
  blocked('PowerShell', sh('Select-String -Path server/* -Pattern X'))
  blocked('PowerShell', sh('Select-String -Pattern X -Path server/*'))
  blocked('PowerShell', sh('Select-String -Pattern X server/*'))
  blocked('PowerShell', sh('sls X server/*'))
  blocked('PowerShell', sh('Select-String -LiteralPath server/* -Pattern X'))
  blocked('PowerShell', sh('Select-String -Path a.js,server/* -Pattern X'))
  blocked('Bash', sh('grep KEY server/*'))
  blocked('Bash', sh('grep -e KEY server/.e*'))
  blocked('Bash', sh('grep -n KEY server/.*'))
  blocked('Bash', sh('rg -g \'.e*\' KEY'))
  blocked('Bash', sh('rg --glob=.e* KEY'))
  blocked('Bash', sh('cat server/.e*'))
  blocked('PowerShell', sh('Get-Content server/*'))
  blocked('Bash', sh('grep -rn KEY server/'))
})

// ---------------------------------------------------------------- push bypasses

test('asks for aliases and plumbing commands that push', () => {
  asks('Bash', sh('git config alias.x push && git x origin main'))
  asks('Bash', sh('git config alias.x push; git x origin main'))
  asks('Bash', sh('git config --global alias.p "!git push" ; git p origin main'))
  asks('Bash', sh('git -c alias.x=push x origin main'))
  asks('Bash', sh('git x origin main'), WITH_ALIASES)
  asks('Bash', sh('git z origin main'), WITH_ALIASES)
  asks('Bash', sh('git y push origin main'), WITH_ALIASES)
  asks('Bash', sh(`git -C "${WITH_ALIASES}" x origin main`), ON_FEATURE)
  asks('Bash', sh('git subtree push --prefix=dist origin main'))
  asks('Bash', sh('git subtree push --prefix=dist origin feature/x'))
  asks('Bash', sh('git send-pack origin main'))
  asks('Bash', sh('git send-pack git@github.com:o/r.git main'))
  asks('Bash', sh('git-send-pack origin main'))
  allowed('Bash', sh('git st'), WITH_ALIASES)
  allowed('Bash', sh('git subtree pull --prefix=dist origin main'))
  allowed('Bash', sh('git config alias.st status'))
  blocked('Bash', sh('git x origin main'), WITH_ALIASES, { agent_id: 'abc123' })
  blocked('Bash', sh('git send-pack origin main'), ON_FEATURE, { agent_id: 'abc123' })
})

test('asks before mutating gh api calls and gh repo sync', () => {
  asks('Bash', sh('gh api -X PUT repos/o/r/contents/x -f message=m'))
  asks('Bash', sh('gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc'))
  asks('Bash', sh('gh api -XPOST repos/o/r/issues -f title=t'))
  asks('Bash', sh('gh api --method DELETE repos/o/r/git/refs/heads/x'))
  asks('Bash', sh('gh api --method=POST repos/o/r/issues'))
  asks('Bash', sh('gh api -X post repos/o/r/issues'))
  asks('Bash', sh('gh api repos/o/r/issues -f title=t'))
  asks('Bash', sh('gh api repos/o/r/issues --input body.json'))
  asks('Bash', sh('gh repo sync o/r'))
  asks('Bash', sh('gh pr merge 5'))
  asks('Bash', sh('bash -c "gh api -X PUT repos/o/r/contents/x"'))
  allowed('Bash', sh('gh api repos/o/r/pulls'))
  allowed('Bash', sh('gh api -X GET search/issues -f q=bug'))
  allowed('Bash', sh('gh pr view 5'))
  allowed('Bash', sh('gh pr create --title "Add gh api -X PUT docs" --body "text"'))
})

// ---------------------------------------------------------------- text that merely mentions a push

test('does not treat commit messages or written files as pushes', () => {
  const agent = { agent_id: 'abc123' }
  allowed('Bash', sh('git commit -m "docs: explain git push origin main"'), ON_FEATURE, agent)
  allowed('Bash', sh('git commit -am "never run git push by hand"'), ON_FEATURE, agent)
  allowed('Bash', sh('git commit -m"x" -m "then git push origin main"'), ON_FEATURE, agent)
  allowed('Bash', sh('git commit --message "git push origin main"'), ON_FEATURE, agent)
  allowed('Bash', sh('gh pr create --title "t" --body "Run git push origin main later"'), ON_FEATURE, agent)
  allowed('Bash', sh('echo "git push origin main"'), ON_FEATURE, agent)
  allowed('PowerShell', sh('Set-Content notes.txt "git push origin main"'), ON_FEATURE, agent)
  allowed('Bash', sh('grep -n "git push" docs/notes.md'), ON_FEATURE, agent)
  allowed('PowerShell', sh('Select-String -Path README.md -Pattern "git push"'), ON_FEATURE, agent)
  allowed('Bash', sh("cat > notes.md <<'EOF'\nRun this:\ngit push origin main\nEOF"), ON_FEATURE, agent)
  allowed('Bash', sh("cat > notes.md <<EOF\ngit push origin main\nEOF\ngit status"), ON_FEATURE, agent)
  allowed('Bash', sh("cat > deploy.sh <<'EOF'\n#!/bin/sh\ngit push origin main\nEOF"), ON_FEATURE, agent)
  allowed('Bash', sh('git commit -m "$(cat <<\'EOF\'\nFix things; do not git push origin main here\n\nIt\'s fine.\nEOF\n)"'), ON_FEATURE, agent)
  allowed('PowerShell', sh("$msg = @'\nrun git push origin main\n'@\ngit commit -m $msg"), ON_FEATURE, agent)
  allowed('PowerShell', sh("Set-Content -Path notes.md -Value @'\ngit push origin main\n'@"), ON_FEATURE, agent)
})

test('still asks for pushes hidden in nested shells and fed scripts', () => {
  asks('Bash', sh('bash -c "git push origin feature/x"'))
  asks('Bash', sh('sh -c \'git push origin main\''))
  asks('PowerShell', sh('powershell -Command "git push origin feature/x"'))
  asks('PowerShell', sh('pwsh -c "git push"'))
  asks('Bash', sh('ruby -e "system(\'git push origin main\')"'))
  asks('Bash', sh('echo "$(git push origin main)"'))
  asks('Bash', sh('git commit -m "$(git push origin main)"'))
  asks('Bash', sh("bash <<'EOF'\ngit push origin main\nEOF"))
  asks('Bash', sh("cat <<EOF | bash\ngit push origin main\nEOF"))
  asks('Bash', sh('echo "git push origin main" | bash'))
  asks('PowerShell', sh("$s = @'\ngit push origin main\n'@\niex $s"))
  asks('Bash', sh("cat > notes.md <<'EOF'\nhello\nEOF\ngit push origin main"))
  asks('Bash', sh('git commit -m "x" \n git push origin main'))
  blocked('Bash', sh('bash -c "git push origin feature/x"'), ON_FEATURE, { agent_id: 'abc123' })
  blocked('Bash', sh("bash <<'EOF'\ngit push origin main\nEOF"), ON_FEATURE, { agent_id: 'abc123' })
  blocked('Bash', sh("cat > n.md <<'EOF'\nhi\nEOF\ngit push"), ON_FEATURE, { agent_id: 'abc123' })
})

test('fails closed on unparseable or unexpected input', () => {
  for (const input of ['not json', 'null', '[]', '"text"']) {
    const result = spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8' })
    assert.equal(result.status, 2, `expected block for input ${input}`)
  }
})
