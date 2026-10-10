import { createHash } from 'node:crypto'
import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseCommandInvocation } from '../../scripts/cli/command-invocation.ts'
import { getCommandContract } from '../../scripts/cli/command-contract.ts'
import { runContextCommand, type ContextCommandResult, type ContextCommandRunner } from '../../scripts/context/runtime.ts'
import { validateContext } from '../../scripts/context/trusted-source-bootstrap-validation.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'
import { COMMITTED_WIP_PATHS } from '../../scripts/context/committed-wip-recovery.ts'

const COMMAND = 'bemoat:context:bootstrap-source'
const REPO = 'bemoat/bemoat-web-starter'
const ISSUE_BRANCH = 'fix/630-trusted-source-bootstrap'
const PR = '777'
const PR_HEAD = 'a'.repeat(40)
const MERGE = 'b'.repeat(40)
const LIVE_MAIN = 'c'.repeat(40)
const BASE_A = '0e99786f0b087de46a2518d5874beb999892dd6c'
const TARGET_HEAD = '9c057c2a741d361b6138b95ff115bd3e56049fbd'
const TARGET_TREE = '717a04a858b4768deddf814822e3467407606f11'
const TARGET_BRANCH = 'fix/627-seamless-multi-objective-continuation'
const HANDOFF_COMMENT_ID = '6088681412'
const HANDOFF_DIGEST = 'f'.repeat(64)
const RECOVERY = 'bemoat:context:recover-committed-wip'
const CONTEXT = 'bemoat:context'
const repositoryRoot = realpathSync(resolve('.'))
const runtimePath = resolve('scripts/context/trusted-source-bootstrap.ts')
const runtimeAvailable = existsSync(runtimePath)
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function copyRuntimeProject(from: string, to: string) {
  cpSync(join(from, 'scripts'), join(to, 'scripts'), { recursive: true })
  for (const file of ['.gitignore', 'package.json', 'pnpm-lock.yaml']) {
    copyFileSync(join(from, file), join(to, file))
  }
}

function snapshotTree(root: string): string {
  const entries: unknown[] = []
  const visit = (directory: string, prefix = '') => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name)
      const relativePath = prefix ? `${prefix}/${name}` : name
      const info = lstatSync(path)
      if (info.isSymbolicLink()) entries.push(['link', relativePath, readlinkSync(path)])
      else if (info.isDirectory()) {
        entries.push(['directory', relativePath, info.mode & 0o777])
        visit(path, relativePath)
      } else if (info.isFile()) {
        entries.push(['file', relativePath, info.mode & 0o777, createHash('sha256').update(readFileSync(path)).digest('hex')])
      } else entries.push(['other', relativePath, info.mode & 0o777])
    }
  }
  visit(root)
  return JSON.stringify(entries)
}

function initializeDisposableGitRoot(root: string) {
  const commands: Array<[string, string[]]> = [
    ['git', ['init', '--quiet', '--initial-branch=main']],
    ['git', ['config', 'user.name', 'Bemoat Test Fixture']],
    ['git', ['config', 'user.email', 'fixture@example.invalid']],
    ['git', ['add', '.']],
    ['git', ['commit', '--quiet', '-m', 'fixture']],
  ]
  for (const [command, args] of commands) {
    const result = runContextCommand(command, args, { cwd: root })
    if (result.status !== 0 || result.error) throw new Error(result.stderr || result.error?.message || `${command} failed`)
  }
}

function createDisposableExternalCommandStubs(root: string, source: string, target: string, destination: string) {
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const handoff: HandoffRecord = {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'read_only',
    repository: REPO,
    issue_number: '627',
    objective: 'Objective 1 — read-only contract and transition trace: characterize the authorized recovery proof.',
    permitted_scope: ['Read-only evidence characterization.'],
    prohibited_scope: ['No source edits or future-objective authorization.'],
    executing_agent: 'Codex #627 Execution Controller',
    provider: 'OpenAI',
    branch: TARGET_BRANCH,
    exact_head: BASE_A,
    protected_base: { branch: 'main', sha: BASE_A },
    pr: null,
    verified_evidence: [{ kind: 'authority', value: 'Read-only objective authority.', url: null }],
    route: 'IMPLEMENT',
    next_action: { route: 'IMPLEMENT', description: 'Run fresh Context before later work.' },
    stop_conditions: ['Do not modify the target during proof.'],
    local_durability: { required: true, durable: true, reason: null },
  }
  const handoffComment = {
    id: Number(HANDOFF_COMMENT_ID),
    body: renderHandoffComment(handoff),
    html_url: `https://github.com/${REPO}/issues/627#issuecomment-${HANDOFF_COMMENT_ID}`,
    issue_url: `https://api.github.com/repos/${REPO}/issues/627`,
    user: { id: 36528988, login: 'bemoat' },
  }
  const policyContent = '---\npolicy_id: bemoat-mission-control\nversion: 1.7.0\ncanonical_repository: bemoat/bemoat-web-starter\ntrusted_founder_login: bemoat\n---\n'
  const data = {
    repository: REPO,
    source,
    target,
    destination,
    main: LIVE_MAIN,
    targetHead: TARGET_HEAD,
    targetTree: TARGET_TREE,
    handoffComment,
    changedPaths: COMMITTED_WIP_PATHS,
    wipSubject: 'wip(#627): preserve incomplete multi-objective routing candidate',
    policy: Buffer.from(policyContent).toString('base64'),
    issue: {
      number: 627,
      title: 'fix: recover committed WIP through trusted source',
      state: 'OPEN',
      url: `https://github.com/${REPO}/issues/627`,
      body: '## Objective\nRecover the committed #627 WIP safely.\n\n## Scope\nUse the verified recovery path.\n\n## Acceptance Criteria\n- Preserve the exact target identity.\n',
      comments: [] as unknown[],
    },
  }
  const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`
  const changedPathPrint = COMMITTED_WIP_PATHS.map((path) => ` ${shellQuote(path)}`).join('')
  const issueJson = shellQuote(JSON.stringify(data.issue))
  const handoffJson = shellQuote(JSON.stringify(handoffComment))
  const handoffListJson = shellQuote(JSON.stringify([[handoffComment]]))
  const policyJson = shellQuote(JSON.stringify({ sha: LIVE_MAIN, encoding: 'base64', content: data.policy }))
  const mainRefJson = shellQuote(JSON.stringify({ object: { sha: LIVE_MAIN } }))
  const targetRefJson = shellQuote(JSON.stringify({ object: { sha: TARGET_HEAD } }))
  const gitStub = `#!/bin/sh\nargs="$*"\ncwd="$(pwd -P)"\ntarget=${shellQuote(realpathSync(target))}\nbase='https://github.com/${REPO}.git'\n` +
    `case "$args" in\n` +
    `  'rev-parse --show-toplevel') printf '%s\\n' "$cwd" ;;\n` +
    `  'rev-parse --git-common-dir') printf '%s\\n' "$cwd/.git" ;;\n` +
    `  'rev-parse HEAD') if [ "$cwd" = "$target" ]; then printf '%s\\n' '${TARGET_HEAD}'; else printf '%s\\n' '${LIVE_MAIN}'; fi ;;\n` +
    `  'rev-parse HEAD^{tree}'|'rev-parse ${TARGET_HEAD}^{tree}') printf '%s\\n' '${TARGET_TREE}' ;;\n` +
    `  'rev-parse ${TARGET_HEAD}^') printf '%s\\n' '${BASE_A}' ;;\n` +
    `  'show -s --format=%an%n%s ${TARGET_HEAD}') printf '%s\\n' 'Bemoat' 'wip(#627): preserve incomplete multi-objective routing candidate' ;;\n` +
    `  'diff --name-only -z '*) printf '%s\\0'${changedPathPrint} ;;\n` +
    `  'merge-base --is-ancestor ${BASE_A} ${TARGET_HEAD}') exit 0 ;;\n` +
    `  'merge-base --is-ancestor ${TARGET_HEAD} ${BASE_A}') exit 1 ;;\n` +
    `  'status --porcelain=v1 --untracked-files=all'|'status --short') ;;\n` +
    `  'remote get-url origin'|'remote get-url upstream') printf '%s\\n' "$base" ;;\n` +
    `  'symbolic-ref --quiet --short HEAD'|'branch --show-current') if [ "$cwd" = "$target" ]; then printf '%s\\n' '${TARGET_BRANCH}'; else printf '%s\\n' 'main'; fi ;;\n` +
    `  'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') if [ "$cwd" = "$target" ]; then printf '%s\\n' 'origin/${TARGET_BRANCH}'; else printf '%s\\n' 'origin/main'; fi ;;\n` +
    `  'rev-parse --verify --quiet refs/remotes/origin/main') if [ "$cwd" = "$target" ]; then printf '%s\\n' '${TARGET_HEAD}'; else printf '%s\\n' '${LIVE_MAIN}'; fi ;;\n` +
    `  'rev-parse --verify --quiet refs/remotes/origin/${TARGET_BRANCH}') printf '%s\\n' '${TARGET_HEAD}' ;;\n` +
    `  'ls-remote --heads '* ) branch=""; for arg do branch="$arg"; done; branch="\${branch#refs/heads/}"; case "$branch" in main) printf '%s\\trefs/heads/main\\n' '${LIVE_MAIN}' ;; '${TARGET_BRANCH}') printf '%s\\trefs/heads/${TARGET_BRANCH}\\n' '${TARGET_HEAD}' ;; esac ;;\n` +
    `  'worktree list --porcelain') printf 'worktree %s\\nHEAD %s\\nbranch refs/heads/%s\\n' "$cwd" '${TARGET_HEAD}' '${TARGET_BRANCH}' ;;\n` +
    `  *) exit 0 ;;\nesac\n`
  const ghStub = `#!/bin/sh\nargs="$*"\ncase "$args" in\n` +
    `  'issue view '*) printf '%s\\n' ${issueJson} ;;\n` +
    `  'pr list '*) printf '%s\\n' '[]' ;;\n` +
    `  'api repos/${REPO}/git/ref/heads/main') printf '%s\\n' ${mainRefJson} ;;\n` +
    `  'api repos/${REPO}/git/ref/heads/${encodeURIComponent(TARGET_BRANCH)}') printf '%s\\n' ${targetRefJson} ;;\n` +
    `  'api repos/${REPO}/issues/comments/${HANDOFF_COMMENT_ID}') printf '%s\\n' ${handoffJson} ;;\n` +
    `  'api --paginate --slurp repos/${REPO}/issues/627/comments') printf '%s\\n' ${handoffListJson} ;;\n` +
    `  'api repos/${REPO}/contents/docs/mission-control/mission-control-guide.md?ref=${LIVE_MAIN}') printf '%s\\n' ${policyJson} ;;\n` +
    `  'api repos/${REPO}/rulesets?includes_parents=true') printf '%s\\n' '[]' ;;\n` +
    `  'api repos/${REPO}/branches/main/protection'|'api repos/${REPO}/git/ref/heads/dev') printf '%s\\n' '404 not found' >&2; exit 1 ;;\n` +
    `  *) printf 'offline fixture: %s\\n' "$args" >&2; exit 1 ;;\nesac\n`
  writeFileSync(join(bin, 'git'), gitStub, { mode: 0o755 })
  writeFileSync(join(bin, 'gh'), ghStub, { mode: 0o755 })
  return bin
}

it('registers the setup-only public contract, package script, and JSON help inputs', () => {
  const contract = getCommandContract(COMMAND)
  expect(contract, 'the trusted-source command must be registered').toBeTruthy()
  if (!contract) return
  expect(contract.safe_help_invocation).toBe('pnpm run bemoat:context:bootstrap-source -- --help --json')
  const writes = Array.isArray(contract.writes) ? contract.writes.map(String).join(' ') : ''
  expect(writes).toMatch(/destination/i)
  expect(writes).toMatch(/target.*no|no.*target/i)
  expect(writes).toMatch(/GitHub.*no|no.*GitHub/i)
  const inputs = [
    ...(Array.isArray(contract.required_inputs) ? contract.required_inputs : []),
    ...(Array.isArray(contract.optional_flags) ? contract.optional_flags as Array<{ name: string }> : []),
  ] as Array<{ name: string }>
  const names = inputs.map((input) => input.name)
  expect(names).toEqual(expect.arrayContaining(['pr_number', 'target_worktree', 'destination']))
  expect(names).not.toContain('expected_pr_head')
  expect(parseCommandInvocation(COMMAND, ['--help', '--json'])).toMatchObject({ mode: 'help', format: 'json' })
  expect(parseCommandInvocation(COMMAND, [
    '--pr-number', PR, '--target-worktree', '/retained/627', '--destination', '/recovery/source', '--json',
  ])).toMatchObject({ mode: 'run', values: { pr_number: PR, target_worktree: '/retained/627', destination: '/recovery/source' } })
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  expect(packageJson.scripts[COMMAND]).toBe('node ' + contract.entrypoint)
})

it('has a runtime seam for injected read and clone evidence', () => {
  expect(runtimeAvailable, 'expected scripts/context/trusted-source-bootstrap.ts').toBe(true)
})

type Fixture = { source: string; target: string; destination: string; marker: string; calls: Array<{ command: string; args: string[]; cwd: string; env?: NodeJS.ProcessEnv; result?: ContextCommandResult }>; run: ContextCommandRunner }
const ok = (stdout = ''): ContextCommandResult => ({ status: 0, stdout, stderr: '', error: null })
const fail = (stderr = 'fixture failure'): ContextCommandResult => ({ status: 1, stdout: '', stderr, error: null })
function pullPayload(overrides: Record<string, unknown> = {}) {
  return {
    number: Number(PR), state: 'closed', merged_at: '2026-10-10T00:00:00Z', merge_commit_sha: MERGE,
    base: { ref: 'main', repo: { full_name: REPO } },
    head: { ref: ISSUE_BRANCH, sha: PR_HEAD, repo: { full_name: REPO } }, body: 'Closes #630',
    ...overrides,
  }
}

function successfulProofPayload(targetRoot: string, sourceRoot: string, detailsOverrides: Record<string, unknown> = {}) {
  const sourceIdentity = { repository: REPO, branch: 'main', head: LIVE_MAIN, live_protected_base: LIVE_MAIN, historical_A: BASE_A, clean: true }
  const targetIdentity = { repository: REPO, branch: TARGET_BRANCH, upstream: `origin/${TARGET_BRANCH}`, head: TARGET_HEAD, tree: TARGET_TREE, live_remote_head: TARGET_HEAD, clean: true }
  const historicalHandoff = {
    comment_id: HANDOFF_COMMENT_ID,
    url: `https://github.com/${REPO}/issues/627#issuecomment-${HANDOFF_COMMENT_ID}`,
    author: 'bemoat', objective_mode: 'read_only', route: 'IMPLEMENT', exact_head: BASE_A,
    protected_base: { branch: 'main', sha: BASE_A }, body_sha256: HANDOFF_DIGEST,
  }
  const retryBinding = {
    issue: '627', comment: HANDOFF_COMMENT_ID, handoff_body_sha256: HANDOFF_DIGEST,
    A: BASE_A, B: TARGET_HEAD, tree: TARGET_TREE, repository: REPO, branch: TARGET_BRANCH,
    base: 'main', source_head_D: LIVE_MAIN, target_root: targetRoot,
  }
  const sourceOverride = detailsOverrides.source_identity as Record<string, unknown> | undefined
  const targetOverride = detailsOverrides.target_identity as Record<string, unknown> | undefined
  const handoffOverride = detailsOverrides.historical_handoff as Record<string, unknown> | undefined
  const retryBindingOverride = detailsOverrides.retry_binding as Record<string, unknown> | undefined
  return {
    schema_version: 1, command: RECOVERY, mode: 'result', outcome: 'SUCCESS', classification: 'SUCCESS',
    mutation_performed: false, issue_number: '627', next_action: { type: 'COMMAND', command: CONTEXT },
    details: {
      route: 'STOP', objective_edit_authority_granted: false, reentry_performed: false, wip_state: 'RED_INCOMPLETE',
      immutable_A: BASE_A, immutable_B: TARGET_HEAD, exact_tree: TARGET_TREE, live_protected_main_D: LIVE_MAIN,
      historical_handoff_comment_id: HANDOFF_COMMENT_ID, historical_handoff_body_sha256: HANDOFF_DIGEST,
      canonical_source_root: sourceRoot, canonical_target_root: targetRoot,
      source_identity: { ...sourceIdentity, ...sourceOverride },
      target_identity: { ...targetIdentity, ...targetOverride },
      historical_handoff: { ...historicalHandoff, ...handoffOverride },
      retry_binding: { ...retryBinding, ...retryBindingOverride },
      ...detailsOverrides,
    },
  }
}

function successfulContextPayload(overrides: Record<string, unknown> = {}) {
  const defaults = {
    schema_version: 1, command: CONTEXT, mode: 'context', mutation_performed: false,
    issue_number: '627', route: 'STOP',
    next_action: { type: 'STOP', command: null as string | null, description: 'Stop and reconstruct fresh target Context.' },
    repository: { owner: 'bemoat', name: 'bemoat-web-starter', nameWithOwner: REPO, url: `https://github.com/${REPO}` },
    protected_base: { branch: 'main', sha: LIVE_MAIN, source: 'live GitHub ref', url: `https://github.com/${REPO}/tree/main` },
    policy: { path: 'docs/mission-control/mission-control-guide.md', policyId: 'bemoat-mission-control', version: '1.7.0', sourceSha: LIVE_MAIN },
    issue: { number: '627', title: 'fix: recover committed WIP through trusted source' },
    local_git: { branch: TARGET_BRANCH, head: TARGET_HEAD, upstream: `origin/${TARGET_BRANCH}`, originRepository: REPO, clean: true, detached: false, pushed: true, durable: true, reasons: [] as string[] },
  }
  return {
    ...defaults,
    ...overrides,
    repository: { ...defaults.repository, ...(overrides.repository as Record<string, unknown> | undefined) },
    protected_base: { ...defaults.protected_base, ...(overrides.protected_base as Record<string, unknown> | undefined) },
    local_git: { ...defaults.local_git, ...(overrides.local_git as Record<string, unknown> | undefined) },
    issue: { ...defaults.issue, ...(overrides.issue as Record<string, unknown> | undefined) },
    ...(overrides.next_action && typeof overrides.next_action === 'object'
      ? { next_action: { ...defaults.next_action, ...(overrides.next_action as Record<string, unknown>) } }
      : {}),
  }
}

function successfulHelpPayload(command: string, tier: 'A' | 'B', required: string[], optional: string[], overrides: Record<string, unknown> = {}) {
  // Mirror command-help.ts envelope fields; safe_help_invocation belongs to registry metadata and is absent here.
  return {
    schema_version: 1, command, mode: 'help', classification: 'HELP', tier,
    required_inputs: required.map((name) => ({ name })),
    optional_flags: optional.map((name) => ({ name })),
    writes: [] as unknown[], retry_contract: {}, role_contracts: {}, next_action_rules: [] as unknown[],
    ...overrides,
  }
}

type FixtureOptions = {
  compare?: Record<string, unknown>
  existingDestination?: boolean
  destinationHasMarker?: boolean
  destinationStatus?: string
  destinationHead?: string
  destinationTracking?: string
  destinationOrigin?: string
  sharedCommonDir?: 'source' | 'target'
  cloneFailure?: boolean
  proofHelpResult?: ContextCommandResult
  contextHelpResult?: ContextCommandResult
  proofHelpOverrides?: Record<string, unknown>
  contextHelpOverrides?: Record<string, unknown>
  proofResult?: ContextCommandResult
  contextResult?: ContextCommandResult
  proofDetails?: Record<string, unknown>
  contextOverrides?: Record<string, unknown>
  sourceStatus?: string
  sourceHead?: string
  sourceBranch?: string
  sourceOrigin?: string
  targetStatus?: string
  targetHead?: string
  targetTree?: string
  targetBranch?: string
  targetOrigin?: string
  targetUpstream?: string
  targetLiveSha?: string
  pull?: Record<string, unknown>
  githubMainSha?: string
  remoteMainSha?: string
  liveMainPackageJson?: string
  liveMainLockfile?: string
  githubDevSha?: string
  remoteDevSha?: string
  contextHelpUnavailable?: boolean
  mainDriftAfterClone?: string
  realDRuntime?: boolean
  missingResolver?: boolean
  missingSourceDependency?: boolean
}

function fixture(settings: FixtureOptions = {}): Fixture {
  const compare = settings.compare ?? {
  status: 'ahead', ahead_by: 2, behind_by: 0,
  base_commit: { sha: MERGE }, merge_base_commit: { sha: MERGE },
  }
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bemoat-630-bootstrap-'))); roots.push(root)
  const source = join(root, 'execution'); const target = join(root, 'target'); const destination = join(root, 'source-D')
  const marker = join(destination, 'preserve.txt')
  mkdirSync(source); mkdirSync(target)
  if (settings.realDRuntime) {
    copyRuntimeProject(repositoryRoot, source)
    if (settings.missingResolver) rmSync(join(source, 'scripts', 'context', 'trusted-source-bootstrap-dependency-resolver.mjs'))
  }
  else {
    const sourceContext = join(source, 'scripts', 'context')
    mkdirSync(sourceContext, { recursive: true })
    if (!settings.missingResolver) {
      copyFileSync(
        join(repositoryRoot, 'scripts', 'context', 'trusted-source-bootstrap-dependency-resolver.mjs'),
        join(sourceContext, 'trusted-source-bootstrap-dependency-resolver.mjs'),
      )
    }
    for (const file of ['package.json', 'pnpm-lock.yaml']) copyFileSync(join(repositoryRoot, file), join(source, file))
  }
  if (!settings.missingSourceDependency) {
    if (settings.realDRuntime) {
      const fixtureNodeModules = join(source, 'node_modules')
      mkdirSync(fixtureNodeModules)
      cpSync(realpathSync(join(repositoryRoot, 'node_modules', 'zod')), join(fixtureNodeModules, 'zod'), { recursive: true })
    } else {
      mkdirSync(join(source, 'node_modules'))
    }
  }
  const externalBin = settings.realDRuntime ? createDisposableExternalCommandStubs(root, source, target, destination) : null
  if (settings.existingDestination) {
    mkdirSync(destination)
    if (settings.realDRuntime) {
      copyRuntimeProject(source, destination)
      mkdirSync(join(destination, '.next'))
      writeFileSync(join(destination, '.next', 'preserve-ignored.txt'), 'keep this ignored fixture file')
      if (settings.destinationHasMarker !== false) writeFileSync(marker, 'preserve destination')
      initializeDisposableGitRoot(destination)
    } else if (settings.destinationHasMarker !== false) writeFileSync(marker, 'preserve destination')
  }
  const calls: Fixture['calls'] = []
  let cloneAttempted = false
  const run: ContextCommandRunner = (command, args, commandOptions = {}) => {
    const cwd = commandOptions.cwd ?? source; const key = args.join(' '); calls.push({ command, args: [...args], cwd, env: commandOptions.env })
    if (command === 'git' && args[0] === 'clone') {
      cloneAttempted = true
      if (!existsSync(destination)) mkdirSync(destination)
      if (settings.realDRuntime) {
        copyRuntimeProject(source, destination)
        mkdirSync(join(destination, '.next'))
        writeFileSync(join(destination, '.next', 'preserve-ignored.txt'), 'keep this ignored fixture file')
        initializeDisposableGitRoot(destination)
      }
      if (settings.cloneFailure) writeFileSync(marker, 'partial clone')
      return settings.cloneFailure ? fail('simulated partial clone failure') : ok()
    }
    if (command === 'git' && key === 'rev-parse --show-toplevel') return existsSync(cwd) ? ok(cwd + '\n') : fail()
    if (command === 'git' && key === 'rev-parse --git-common-dir') {
      const common = cwd === source ? join(source, '.git') : cwd === target ? join(target, '.git') :
        settings.sharedCommonDir === 'source' ? join(source, '.git') : settings.sharedCommonDir === 'target' ? join(target, '.git') : join(destination, '.git')
      return ok(common + '\n')
    }
    if (command === 'git' && key === 'status --porcelain=v1 --untracked-files=all') return ok(cwd === destination ? settings.destinationStatus ?? '' : cwd === target ? settings.targetStatus ?? '' : settings.sourceStatus ?? '')
    if (command === 'git' && key === 'remote get-url origin') return ok((cwd === destination ? settings.destinationOrigin : cwd === target ? settings.targetOrigin : settings.sourceOrigin) ?? ('https://github.com/' + REPO + '.git') + '\n')
    if (command === 'git' && key === 'rev-parse HEAD') return ok((cwd === target ? settings.targetHead ?? TARGET_HEAD : cwd === destination ? settings.destinationHead ?? LIVE_MAIN : settings.sourceHead ?? PR_HEAD) + '\n')
    if (command === 'git' && key === 'rev-parse HEAD^{tree}') return ok((settings.targetTree ?? TARGET_TREE) + '\n')
    if (command === 'git' && key === 'symbolic-ref --quiet --short HEAD') return ok((cwd === target ? settings.targetBranch ?? 'fix/627-seamless-multi-objective-continuation' : cwd === destination ? 'main' : settings.sourceBranch ?? ISSUE_BRANCH) + '\n')
    if (command === 'git' && key === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return ok((cwd === target ? settings.targetUpstream ?? 'origin/fix/627-seamless-multi-objective-continuation' : 'origin/main') + '\n')
    if (command === 'git' && key === 'rev-parse --verify --quiet refs/remotes/origin/main') return ok((cwd === destination ? settings.destinationTracking ?? LIVE_MAIN : MERGE) + '\n')
    if (command === 'git' && key === 'ls-remote --heads origin refs/heads/main') return ok(((cwd === source && cloneAttempted ? settings.mainDriftAfterClone : undefined) ?? settings.remoteMainSha ?? LIVE_MAIN) + '\trefs/heads/main\n')
    if (command === 'git' && key === `show ${LIVE_MAIN}:package.json`) return ok(settings.liveMainPackageJson ?? readFileSync(join(source, 'package.json'), 'utf8'))
    if (command === 'git' && key === `show ${LIVE_MAIN}:pnpm-lock.yaml`) return ok(settings.liveMainLockfile ?? readFileSync(join(source, 'pnpm-lock.yaml'), 'utf8'))
    if (command === 'git' && key === 'ls-remote --heads origin refs/heads/dev') return settings.remoteDevSha ? ok(settings.remoteDevSha + '\trefs/heads/dev\n') : ok('')
    if (command === 'git' && key === 'ls-remote --heads origin refs/heads/fix/627-seamless-multi-objective-continuation') return ok((settings.targetLiveSha ?? TARGET_HEAD) + '\trefs/heads/fix/627-seamless-multi-objective-continuation\n')
    if (command === 'gh' && key === 'api repos/' + REPO + '/git/ref/heads/fix%2F627-seamless-multi-objective-continuation') return ok(JSON.stringify({ object: { sha: settings.targetLiveSha ?? TARGET_HEAD } }))
    if (command === 'gh' && key === 'api repos/' + REPO + '/pulls/' + PR) return ok(JSON.stringify(pullPayload(settings.pull)))
    if (command === 'gh' && key === 'api repos/' + REPO + '/git/ref/heads/main') return ok(JSON.stringify({ object: { sha: (cwd === source && cloneAttempted ? settings.mainDriftAfterClone : undefined) ?? settings.githubMainSha ?? LIVE_MAIN } }))
    if (command === 'gh' && key === 'api repos/' + REPO + '/git/ref/heads/dev') return settings.githubDevSha
      ? ok(JSON.stringify({ object: { sha: settings.githubDevSha } }))
      : fail('dev branch does not exist')
    if (command === 'gh' && key.startsWith('api repos/' + REPO + '/compare/')) return ok(JSON.stringify(compare))
    if (command === 'pnpm' && settings.realDRuntime) {
      const baseEnv = commandOptions.env ?? process.env
      const env = { ...baseEnv, PATH: `${externalBin}:${baseEnv.PATH ?? ''}` }
      const childResult = runContextCommand(command, args, { ...commandOptions, env })
      calls[calls.length - 1]!.result = childResult
      return childResult
    }
    if (command === 'pnpm' && args.includes(RECOVERY) && args.includes('--help')) return settings.proofHelpResult ?? ok(JSON.stringify(successfulHelpPayload(
      RECOVERY, 'A', ['issue_number', 'expected_repository', 'expected_branch', 'expected_base_branch', 'expected_base_sha', 'expected_handoff_comment_id', 'expected_handoff_head', 'expected_wip_head', 'expected_wip_tree', 'target_worktree'], [], settings.proofHelpOverrides,
    )))
    if (command === 'pnpm' && args.includes(CONTEXT) && args.includes('--help')) return settings.contextHelpResult ?? (settings.contextHelpUnavailable ? fail('Context help unavailable') : ok(JSON.stringify({
      ...successfulHelpPayload(CONTEXT, 'B', ['issue_number'], ['target_worktree'], settings.contextHelpOverrides),
    })))
    if (command === 'pnpm' && args.includes(RECOVERY)) return settings.proofResult ?? ok(JSON.stringify(successfulProofPayload(target, destination, settings.proofDetails)))
    if (command === 'pnpm' && args.includes(CONTEXT)) return settings.contextResult ?? ok(JSON.stringify(successfulContextPayload(settings.contextOverrides)))
    return fail('unhandled fixture call: ' + command + ' ' + key)
  }
  return { source, target, destination, marker, calls, run }
}

const describeRuntime = runtimeAvailable ? describe : describe.skip
describeRuntime('trusted-source bootstrap injected-runner characterization', () => {
  async function invoke(f: Fixture, binding: { targetWorktree?: string; destination?: string } = {}) {
    const moduleUrl = pathToFileURL(runtimePath).href
    const runtime = await import(moduleUrl) as { bootstrapTrustedSource: (input: Record<string, unknown>) => unknown }
    return runtime.bootstrapTrustedSource({ sourceCwd: f.source, prNumber: PR, targetWorktree: binding.targetWorktree ?? f.target, destination: binding.destination ?? f.destination, run: f.run })
  }

  async function invokeWithFinalAbsenceRace(f: Fixture) {
    const preflightPath = '../../scripts/context/trusted-source-bootstrap-preflight.ts'
    let destinationChecks = 0
    vi.resetModules()
    vi.doMock(preflightPath, async (importOriginal) => {
      const original = await importOriginal<typeof import('../../scripts/context/trusted-source-bootstrap-preflight.ts')>()
      return {
        ...original,
        canonicalDestination(path: string) {
          const state = original.canonicalDestination(path)
          if (path === f.destination && !state.exists && !state.reason && ++destinationChecks === 2) {
            // Fault injection: the final absence evidence has just been read; another actor now owns this path.
            mkdirSync(f.destination)
            writeFileSync(f.marker, 'concurrently created destination')
          }
          return state
        },
      }
    })
    try {
      const runtime = await import('../../scripts/context/trusted-source-bootstrap.ts') as { bootstrapTrustedSource: (input: {
        sourceCwd: string; prNumber: string; targetWorktree: string; destination: string; run: ContextCommandRunner
      }) => unknown }
      return runtime.bootstrapTrustedSource({ sourceCwd: f.source, prNumber: PR, targetWorktree: f.target, destination: f.destination, run: f.run })
    } finally {
      vi.doUnmock(preflightPath)
      vi.resetModules()
    }
  }

  async function invokeWithRuntimeDriftAfterFinalAbsenceCheck(f: Fixture) {
    const preflightPath = '../../scripts/context/trusted-source-bootstrap-preflight.ts'
    let destinationChecks = 0
    vi.resetModules()
    vi.doMock(preflightPath, async (importOriginal) => {
      const original = await importOriginal<typeof import('../../scripts/context/trusted-source-bootstrap-preflight.ts')>()
      return {
        ...original,
        canonicalDestination(path: string) {
          const state = original.canonicalDestination(path)
          if (path === f.destination && !state.exists && !state.reason && ++destinationChecks === 2) {
            // Fault injection: source runtime bytes drift after the final D-absence readback.
            writeFileSync(join(f.source, 'package.json'), '{"name":"raced-source","dependencies":{"zod":"4.4.3"}}')
          }
          return state
        },
      }
    })
    try {
      const runtime = await import('../../scripts/context/trusted-source-bootstrap.ts') as { bootstrapTrustedSource: (input: {
        sourceCwd: string; prNumber: string; targetWorktree: string; destination: string; run: ContextCommandRunner
      }) => unknown }
      return runtime.bootstrapTrustedSource({ sourceCwd: f.source, prNumber: PR, targetWorktree: f.target, destination: f.destination, run: f.run })
    } finally {
      vi.doUnmock(preflightPath)
      vi.resetModules()
    }
  }

  // Oracle: live-main setupBaseRecoveryRoute emits STOP + COMMAND with `bemoat:context:recover-setup`; the native exact-head review requires that pair to remain acceptable while rejecting FOUNDER_GATE + COMMAND. These validator stories vary only the pair and do not claim the target Context producer emits setup recovery for retained B.
  it('accepts the canonical STOP plus setup-recovery COMMAND pair', () => {
    const payload = successfulContextPayload({
      route: 'STOP',
      next_action: { type: 'COMMAND', command: 'bemoat:context:recover-setup', description: 'Run exact bound setup recovery.' },
    })
    expect(validateContext(payload, { liveMain: LIVE_MAIN })).toBe(true)
  })

  it('rejects FOUNDER_GATE paired with COMMAND in nested Context evidence', () => {
    const payload = successfulContextPayload({
      route: 'FOUNDER_GATE',
      next_action: { type: 'COMMAND', command: 'bemoat:context:recover-setup', description: 'Run setup recovery.' },
    })
    expect(validateContext(payload, { liveMain: LIVE_MAIN })).toBe(false)
  })

  // Oracle: merged main@067a16e3634bc21a34efcc2608a7d767f094d40a docs/mission-control/command-reference.md:15-29 binds PR_READY to OPEN_PR `gh pr create` only; live no-pr-routing.ts:369-379 emits that exact pair. Neighboring producers retain FOUNDER_GATE + FOUNDER_GATE (no-pr-routing.ts:338-359) and STOP + COMMAND setup recovery (setup-base-recovery-routing.ts:60-71). These direct validator stories hold target identity constant and vary only the nested route/action pair; they do not assert that #627's bound target emits PR_READY.
  it.each([
    ['PR_READY with its canonical OPEN_PR action', 'PR_READY', 'OPEN_PR', 'gh pr create', true],
    ['PR_READY with COMMAND', 'PR_READY', 'COMMAND', 'bemoat:context:recover-setup', false],
    ['PR_READY with a noncanonical OPEN_PR command', 'PR_READY', 'OPEN_PR', 'git push', false],
    ['FOUNDER_GATE with its canonical FOUNDER_GATE action', 'FOUNDER_GATE', 'FOUNDER_GATE', null, true],
  ] as const)('validates %s', (_story, route, actionType, command, expected) => {
    const payload = successfulContextPayload({
      route,
      next_action: { type: actionType, command, description: 'Canonical route/action characterization.' },
    })
    expect(validateContext(payload, { liveMain: LIVE_MAIN })).toBe(expected)
  })

  it('preserves a destination created after the final absence check and never invokes clone', async () => {
    const f = fixture()
    const result = await invokeWithFinalAbsenceRace(f) as { classification: string; mutationPerformed: boolean; details: Record<string, unknown> }
    expect(existsSync(f.destination)).toBe(true)
    expect(readFileSync(f.marker, 'utf8')).toBe('concurrently created destination')
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(result.classification).not.toBe('SUCCESS')
    expect(result.mutationPerformed).toBe(false)
    expect(result.details.objective_edit_authority_granted).toBe(false)
  })

  // Authority: source resolver and package/lock identity must be rechecked after the final absent-D readback; a source package drift at that boundary must stop before mkdir/clone.
  it('stops before destination reservation when source runtime bytes drift after the final absence check', async () => {
    const f = fixture({ liveMainPackageJson: readFileSync(join(repositoryRoot, 'package.json'), 'utf8') })
    const result = await invokeWithRuntimeDriftAfterFinalAbsenceCheck(f) as { classification: string; route: string; mutationPerformed: boolean; details: Record<string, unknown> }

    expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false, details: { objective_edit_authority_granted: false } })
    expect(result.classification).toBe('EVIDENCE_CONFLICT')
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
    expect(existsSync(f.destination)).toBe(false)
  })

  it('clones verified live main to the explicit D, then discovers, proves, and runs target Context from D', async () => {
    const f = fixture(); const result = await invoke(f) as { classification: string; mutationPerformed: boolean; route: string; details: Record<string, unknown> }
    expect(result, JSON.stringify({ result, calls: f.calls })).toMatchObject({ classification: 'SUCCESS', mutationPerformed: true, route: 'STOP', details: { objective_edit_authority_granted: false, actual_context_route: 'STOP', target_worktree: f.target } })
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(true)
    const downstream = f.calls.filter((call) => call.command === 'pnpm')
    expect(downstream.map((call) => call.cwd)).toEqual([f.destination, f.destination, f.destination, f.destination])
    expect(downstream.map((call) => call.args.includes('--help') ? (call.args.includes(RECOVERY) ? 'proof-help' : 'context-help') : call.args.includes(RECOVERY) ? 'proof' : 'context'))
      .toEqual(['proof-help', 'context-help', 'proof', 'context'])
    expect(downstream[0]?.args).toEqual(expect.arrayContaining([RECOVERY, '--help', '--json']))
    expect(downstream[1]?.args).toEqual(expect.arrayContaining([CONTEXT, '--help', '--json']))
    expect(downstream[2]?.args).toEqual(expect.arrayContaining([RECOVERY, '--target-worktree', f.target]))
    expect(downstream[3]?.args).toEqual(expect.arrayContaining([CONTEXT, '627', '--target-worktree', f.target, '--json']))
    expect(f.calls.some((call) => call.command === 'gh' && call.args.join(' ').includes('/compare/' + MERGE + '...' + LIVE_MAIN))).toBe(true)
    expect(f.calls.filter((call) => call.command === 'git' && call.args.join(' ') === 'rev-parse --git-common-dir').map((call) => call.cwd)).toEqual(expect.arrayContaining([f.source, f.target, f.destination]))
    expect(f.calls.filter((call) => call.command === 'pnpm').every((call) => call.cwd === f.destination)).toBe(true)
  })

  // Authority: the current canonical Issue #630 Objective, Scope, and five Acceptance Criteria require registered safe help, Architecture A proof, and target Context to run from D with a constrained source-backed read-only resolver; package.json and pnpm-lock.yaml must match; D receives no installs or tracked/ignored/hidden writes. All four registered subprocesses are real; their Git/GitHub reads are answered by read-only disposable fixture executables.
  it('runs registered safe help, Architecture A proof, and target Context from D through source-only resolution without changing D', async () => {
    const f = fixture({ realDRuntime: true })
    const fakeGitProbe = runContextCommand('git', ['rev-parse', '--show-toplevel'], {
      cwd: f.target,
      env: { ...process.env, PATH: `${resolve(f.source, '..', 'bin')}:${process.env.PATH ?? ''}` },
    })
    expect(fakeGitProbe.stdout.trim()).toBe(realpathSync(f.target))
    let treeAfterClone: string | null = null
    const fixtureRun = f.run
    f.run = (command, args, options = {}) => {
      const result = fixtureRun(command, args, options)
      if (command === 'git' && args[0] === 'clone' && existsSync(f.destination) && treeAfterClone === null) {
        treeAfterClone = snapshotTree(f.destination)
      }
      return result
    }

    const result = await invoke(f) as { classification: string; mutationPerformed: boolean; route: string; details: Record<string, unknown> }
    const registeredRuns = f.calls.filter((call) => call.command === 'pnpm')
    const cloneCall = f.calls.find((call) => call.command === 'git' && call.args[0] === 'clone')
    const targetAndDestinationGitReads = f.calls.filter((call) =>
      call.command === 'git' && call.args[0] !== 'clone' && [f.target, f.destination].includes(call.cwd),
    )

    expect(result, JSON.stringify({ result, calls: registeredRuns.map(({ command, args, cwd, result: child }) => ({ command, args, cwd, child })) })).toMatchObject({
      classification: 'SUCCESS', mutationPerformed: true, route: 'STOP',
      details: { objective_edit_authority_granted: false, actual_context_route: 'STOP', target_worktree: f.target },
    })
    expect(registeredRuns.map((call) => call.cwd)).toEqual([f.destination, f.destination, f.destination, f.destination])
    expect(registeredRuns.every((call) => call.env?.GIT_OPTIONAL_LOCKS === '0')).toBe(true)
    expect(registeredRuns.map((call) => call.args.includes('--help')
      ? (call.args.includes(RECOVERY) ? 'proof-help' : 'context-help')
      : call.args.includes(RECOVERY) ? 'proof' : 'context')).toEqual(['proof-help', 'context-help', 'proof', 'context'])
    expect(cloneCall?.args).toEqual([
      'clone', '--branch', 'main', '--single-branch', '--no-tags', '--no-recurse-submodules',
      `https://github.com/${REPO}.git`, f.destination,
    ])
    expect(cloneCall?.env).toBeUndefined()
    expect(targetAndDestinationGitReads.length).toBeGreaterThan(0)
    expect(targetAndDestinationGitReads.every((call) => call.env?.GIT_OPTIONAL_LOCKS === '0')).toBe(true)
    expect(registeredRuns.every((call) => call.env !== undefined)).toBe(true)
    expect(result.details.architecture_a_proof).toMatchObject({
      command: RECOVERY, classification: 'SUCCESS', outcome: 'SUCCESS', mutation_performed: false,
    })
    expect(result.details.fresh_context).toMatchObject({
      command: CONTEXT, mode: 'context', issue_number: '627', mutation_performed: false,
      repository: { nameWithOwner: REPO }, local_git: { branch: TARGET_BRANCH, head: TARGET_HEAD, clean: true },
    })
    expect(existsSync(join(f.destination, 'node_modules'))).toBe(false)
    expect(readFileSync(join(f.source, 'package.json'))).toEqual(readFileSync(join(f.destination, 'package.json')))
    expect(readFileSync(join(f.source, 'pnpm-lock.yaml'))).toEqual(readFileSync(join(f.destination, 'pnpm-lock.yaml')))
    expect(treeAfterClone).not.toBeNull()
    expect(snapshotTree(f.destination)).toBe(treeAfterClone)
    const trackedStatus = runContextCommand('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: f.destination })
    const allStatus = runContextCommand('git', ['status', '--short', '--ignored', '--untracked-files=all'], { cwd: f.destination })
    expect(trackedStatus.status).toBe(0)
    expect(trackedStatus.stdout).toBe('')
    expect(allStatus.status).toBe(0)
    expect(allStatus.stdout).toContain('!! .next/')
  }, 15_000)

  // Authority: D must be an exact-live-main clone, while its resolver executes scripts from the verified source checkout. Source package metadata that differs from the exact live-main blobs cannot establish that runtime safely and must fail before reserving D.
  it.each([
    ['package.json', 'liveMainPackageJson', '{"name":"changed-source","dependencies":{"zod":"4.4.3"}}'],
    ['pnpm-lock.yaml', 'liveMainLockfile', "lockfileVersion: '9.0'\nsettings: {autoInstallPeers: false}\n"],
  ] as const)('stops before D creation when source %s differs from the exact live-main blob', async (file, liveMainSetting, changedSourceContents) => {
    const liveMainContents = readFileSync(join(repositoryRoot, file), 'utf8')
    const f = fixture({
      realDRuntime: true,
      [liveMainSetting]: liveMainContents,
    })
    writeFileSync(join(f.source, file), changedSourceContents)

    const result = await invoke(f) as { route: string; mutationPerformed: boolean; details: Record<string, unknown> }

    expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false, details: { objective_edit_authority_granted: false } })
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
    expect(existsSync(f.destination)).toBe(false)
  })

  // Authority: Issue #630 Acceptance Criteria require package manifest and lockfile parity and fail-closed behavior for either mismatch. They do not prescribe a more specific classification or require a particular order among read-only checks.
  it.each([
    ['package manifest', 'package.json', '{"name":"source","dependencies":{"zod":"4.4.3"}}', '{"name":"destination","dependencies":{"zod":"4.4.3"}}'],
    ['lockfile', 'pnpm-lock.yaml', "lockfileVersion: '9.0'\nsettings: {autoInstallPeers: true}\n", "lockfileVersion: '9.0'\nsettings: {autoInstallPeers: false}\n"],
  ])('fails closed when the D %s differs from the verified source', async (_label, file, sourceContents, destinationContents) => {
    const f = fixture({ realDRuntime: true, existingDestination: true, destinationHasMarker: false })
    writeFileSync(join(f.source, file), sourceContents)
    writeFileSync(join(f.destination, file), destinationContents)

    const before = readFileSync(join(f.destination, file), 'utf8')
    const result = await invoke(f) as { classification: string; route: string; mutationPerformed: boolean; details: Record<string, unknown> }

    expect(result.classification).not.toBe('SUCCESS')
    expect(result.route).toBe('STOP')
    expect(result.details.objective_edit_authority_granted).toBe(false)
    expect(result.mutationPerformed).toBe(false)
    expect(readFileSync(join(f.destination, file), 'utf8')).toBe(before)
  })

  // Authority: Issue #630 requires missing dependencies to fail closed while D remains unchanged; this negative story uses a source fixture with no node_modules so no package can be silently borrowed or installed.
  it('stops without writes when the verified source lacks an approved dependency', async () => {
    const f = fixture({ realDRuntime: true, missingSourceDependency: true })
    const result = await invoke(f) as { classification: string; route: string; mutationPerformed: boolean; details: Record<string, unknown> }

    expect(result.classification).not.toBe('SUCCESS')
    expect(result.route).toBe('STOP')
    expect(result.details.objective_edit_authority_granted).toBe(false)
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
    expect(existsSync(f.destination)).toBe(false)
  })

  it('stops before clone when compare evidence does not prove merged correction is on live main', async () => {
    const f = fixture({ compare: { status: 'diverged', ahead_by: 1, behind_by: 1, base_commit: { sha: MERGE }, merge_base_commit: { sha: 'd'.repeat(40) } } })
    try { await invoke(f) } catch { /* A thrown STOP is acceptable at this injected seam. */ }
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
  })

  // Oracle: Issue #630's approved-base rule selects live dev when present and main only while dev is absent. The current main-bound invocation cannot continue if dev appears; no alternate acquisition target is inferred here.
  it.each([
    ['matching live GitHub and origin dev refs', { githubDevSha: 'd'.repeat(40), remoteDevSha: 'd'.repeat(40) }],
    ['origin-only live dev ref', { remoteDevSha: 'd'.repeat(40) }],
  ])('stops before clone when %s changes the approved-base evidence', async (_label, settings) => {
    const f = fixture(settings)
    const result = await invoke(f) as { classification: string; mutationPerformed: boolean; details: Record<string, unknown> }
    expect(result.classification).not.toBe('SUCCESS')
    expect(result.mutationPerformed).toBe(false)
    expect(result.details.objective_edit_authority_granted).toBe(false)
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
  })

  it.each([
    ['Context safe help unavailable', { contextHelpUnavailable: true }],
    ['Context safe help malformed', { contextHelpResult: ok('{"command":"bemoat:context","mode":"help"}') }],
  ])('preserves D and stops when %s', async (_story, settings) => {
    const f = fixture({ existingDestination: true, destinationHasMarker: false, ...settings })
    const result = await invoke(f) as { classification: string; details: Record<string, unknown> }
    expect(result.classification).toMatch(/^(BLOCKED_EXTERNAL|EVIDENCE_CONFLICT)$/)
    expect(f.calls.filter((call) => call.command === 'pnpm').map((call) => call.args.includes('--help') ? 'help' : call.args.includes(RECOVERY) ? 'proof' : 'context'))
      .toEqual(['help', 'help'])
    expect(existsSync(f.destination)).toBe(true)
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
  })

  // Oracle: live --help --json returns tier A for the Architecture A proof, tier B for Context, and writes: []; command-help.ts emits tier/writes but not safe_help_invocation.
  it.each([
    ['proof help wrong tier', { proofHelpOverrides: { tier: 'B' } }],
    ['proof help declares writes', { proofHelpOverrides: { writes: ['change target'] } }],
    ['Context help wrong tier', { contextHelpOverrides: { tier: 'A' } }],
    ['Context help declares writes', { contextHelpOverrides: { writes: ['change target'] } }],
  ])('stops without downstream command when %s', async (label, settings) => {
    const f = fixture({ existingDestination: true, ...settings })
    const result = await invoke(f) as { classification: string; mutationPerformed: boolean; details: Record<string, unknown> }
    expect(result.classification).not.toBe('SUCCESS')
    expect(result.mutationPerformed).toBe(false)
    expect(result.details.objective_edit_authority_granted).toBe(false)
    const pnpmCalls = f.calls.filter((call) => call.command === 'pnpm')
    expect(pnpmCalls.every((call) => call.args.includes('--help'))).toBe(true)
    expect(pnpmCalls).toHaveLength(label.startsWith('Context') ? 2 : 1)
  })

  it('stops before Context when Architecture A proof output is malformed', async () => {
    const f = fixture({ existingDestination: true, destinationHasMarker: false, proofResult: ok('{"outcome":"SUCCESS"}') })
    const result = await invoke(f) as { classification: string; route: string; details: Record<string, unknown> }
    expect(result).toMatchObject({ classification: 'EVIDENCE_CONFLICT', route: 'STOP', details: { objective_edit_authority_granted: false } })
    expect(f.calls.filter((call) => call.command === 'pnpm').map((call) => call.args.includes('--help') ? 'help' : call.args.includes(RECOVERY) ? 'proof' : 'context'))
      .toEqual(['help', 'help', 'proof'])
  })

  // Oracle: the merged #630 contract requires the fixed Architecture A identities and exact canonical roots; the proof command's successful output serializes these as immutable_A/B, exact_tree, live_protected_main_D, canonical_source_root, and canonical_target_root. Any mismatch is forbidden evidence.
  // The proof producer verifies the fixed historical HANDOFF comment and A head, then serializes them at details.historical_handoff_comment_id, details.historical_handoff, and details.retry_binding.
  it.each([
    ['immutable A', { immutable_A: 'd'.repeat(40) }],
    ['immutable B', { immutable_B: 'd'.repeat(40) }],
    ['immutable tree', { exact_tree: 'd'.repeat(40) }],
    ['live protected-main D', { live_protected_main_D: 'd'.repeat(40) }],
    ['D source root', { canonical_source_root: '/other/D' }],
    ['original B target root', { canonical_target_root: '/other/B' }],
    ['source identity head for D', { source_identity: { head: 'd'.repeat(40) } }],
    ['target identity head for B', { target_identity: { head: 'd'.repeat(40) } }],
    ['historical HANDOFF exact_head', { historical_handoff: { exact_head: 'd'.repeat(40) } }],
    ['historical HANDOFF comment ID', { historical_handoff_comment_id: '6088681413' }],
    ['nested historical HANDOFF comment ID', { historical_handoff: { comment_id: '6088681413' } }],
    ['retry binding comment ID', { retry_binding: { comment: '6088681413' } }],
    ['retry binding target root', { retry_binding: { target_root: '/other/B' } }],
  ])('does not accept Architecture A proof with mismatched %s', async (_label, details) => {
    const f = fixture({ existingDestination: true, proofDetails: details })
    const result = await invoke(f) as { classification: string; details: Record<string, unknown> }
    expect(result.classification).not.toBe('SUCCESS')
    expect(result.details.objective_edit_authority_granted).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm' && call.args.includes(CONTEXT) && !call.args.includes('--help'))).toBe(false)
  })

  it('stops on wrong-Issue fresh Context output and preserves the valid destination', async () => {
    const f = fixture({ existingDestination: true, destinationHasMarker: false, contextResult: ok(JSON.stringify({
      schema_version: 1, command: CONTEXT, mode: 'context', mutation_performed: false, issue_number: '624', route: 'IMPLEMENT',
    })) })
    const result = await invoke(f) as { classification: string; details: Record<string, unknown> }
    expect(result.classification).toBe('EVIDENCE_CONFLICT')
    expect(f.calls.filter((call) => call.command === 'pnpm').map((call) => call.args.includes('--help') ? 'help' : call.args.includes(RECOVERY) ? 'proof' : 'context'))
      .toEqual(['help', 'help', 'proof', 'context'])
    expect(existsSync(f.destination)).toBe(true)
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
  })

  // Oracle: the merged #630 contract requires fresh Context evidence for the canonical repository, protected main, and the explicitly bound #627 B identity. Context serializes these as repository, protected_base, and local_git; mismatches are forbidden evidence, while the invoked B path remains explicit in the command argument.
  it.each([
    ['repository identity', { repository: { nameWithOwner: 'other/repo' } }],
    ['protected-base branch', { protected_base: { branch: 'dev' } }],
    ['protected-base SHA', { protected_base: { sha: 'd'.repeat(40) } }],
    ['target branch', { local_git: { branch: 'main' } }],
    ['target head', { local_git: { head: 'd'.repeat(40) } }],
    ['target upstream', { local_git: { upstream: 'origin/main' } }],
    ['target origin repository', { local_git: { originRepository: 'other/repo' } }],
    ['target clean state', { local_git: { clean: false } }],
    ['target attachment state', { local_git: { detached: true } }],
  ])('does not accept fresh Context with mismatched %s', async (_label, contextOverrides) => {
    const f = fixture({ existingDestination: true, contextOverrides })
    const result = await invoke(f) as { classification: string; details: Record<string, unknown> }
    expect(result.classification).not.toBe('SUCCESS')
    expect(result.details.objective_edit_authority_granted).toBe(false)
    const contextCall = f.calls.find((call) => call.command === 'pnpm' && call.args.includes(CONTEXT) && !call.args.includes('--help'))
    expect(contextCall?.args).toEqual(expect.arrayContaining([CONTEXT, '627', '--target-worktree', f.target, '--json']))
    expect(contextCall?.cwd).toBe(f.destination)
  })

  // Oracle: Context's public output uses the ContextRoute and ContextActionType unions and carries the nested Issue identity; malformed routing evidence cannot be treated as a valid fresh re-entry result.
  it.each([
    ['route outside the ContextRoute enum', { route: 'NOT_A_ROUTE' }],
    ['missing next_action', { next_action: undefined }],
    ['malformed next_action', { next_action: { type: 'NOT_AN_ACTION', command: 7, description: 'malformed' } }],
    ['nested Issue number mismatch', { issue: { number: '624' } }],
  ])('does not accept fresh Context with %s', async (_label, contextOverrides) => {
    const f = fixture({ existingDestination: true, contextOverrides })
    const result = await invoke(f) as { classification: string; mutationPerformed: boolean; details: Record<string, unknown> }
    expect(result.classification).not.toBe('SUCCESS')
    expect(result.mutationPerformed).toBe(false)
    expect(result.details.objective_edit_authority_granted).toBe(false)
    expect(f.calls.filter((call) => call.command === 'pnpm').map((call) =>
      call.args.includes('--help') ? (call.args.includes(RECOVERY) ? 'proof-help' : 'context-help') : call.args.includes(RECOVERY) ? 'proof' : 'context',
    )).toEqual(['proof-help', 'context-help', 'proof', 'context'])
  })

  it('reuses one explicit exact-live independent D on an identical retry without cloning', async () => {
    const f = fixture({ existingDestination: true, destinationHasMarker: false })
    const result = await invoke(f) as { classification: string; mutationPerformed: boolean; details: Record<string, unknown> }
    expect(result).toMatchObject({ classification: 'SUCCESS', mutationPerformed: false, details: { destination_state: 'REUSED', objective_edit_authority_granted: false } })
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.filter((call) => call.command === 'pnpm')).toHaveLength(4)
  })

  // Authority: the merged #630 acceptance criteria permit D subprocesses only through the verified source-backed read-only runtime; without its source resolver, bootstrap must stop before destination reservation or clone.
  it('stops before destination creation when the verified source resolver is missing', async () => {
    const f = fixture({ realDRuntime: true, missingResolver: true })
    const result = await invoke(f) as { classification: string; route: string; mutationPerformed: boolean; details: Record<string, unknown> }

    expect(result).toMatchObject({ classification: 'BLOCKED_EXTERNAL', route: 'STOP', mutationPerformed: false, details: { objective_edit_authority_granted: false } })
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(existsSync(f.destination)).toBe(false)
  })

  // Authority: a failed source-only preflight must leave a pre-existing D explicitly preserved and classified for safe retry.
  it('records an existing D as preserved when source dependency preflight fails', async () => {
    const f = fixture({ realDRuntime: true, missingSourceDependency: true, existingDestination: true })
    const result = await invoke(f) as { classification: string; route: string; mutationPerformed: boolean; details: Record<string, unknown> }

    expect(result).toMatchObject({
      classification: 'BLOCKED_EXTERNAL', route: 'STOP', mutationPerformed: false,
      details: {
        objective_edit_authority_granted: false,
        destination: f.destination,
        destination_preserved_on_stop: true,
        destination_state: 'REUSED',
      },
    })
    expect(readFileSync(f.marker, 'utf8')).toBe('preserve destination')
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
  })

  // Authority: the verified source runtime must be conflict-free before any child command or destination mutation; Node's short and long require preload options can replace the trusted resolver.
  it.each([
    ['short -r option', '-r fixture-preload'],
    ['quoted short -r option', '"-r" fixture-preload'],
    ['long --require option', '--require fixture-preload'],
    ['--import option', '--import fixture-preload'],
    ['--loader option', '--loader fixture-preload'],
  ])('stops before destination creation when NODE_OPTIONS contains a %s', async (_label, nodeOptions) => {
    const f = fixture({ realDRuntime: true })
    vi.stubEnv('NODE_OPTIONS', nodeOptions)
    try {
      const result = await invoke(f) as { classification: string; route: string; mutationPerformed: boolean; details: Record<string, unknown> }
      expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false, details: { objective_edit_authority_granted: false } })
      expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
      expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
      expect(existsSync(f.destination)).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.each(['source', 'target'] as const)('rejects D that shares the %s Git common directory', async (sharedCommonDir) => {
    const f = fixture({ existingDestination: true, sharedCommonDir })
    const result = await invoke(f) as { classification: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ classification: 'EVIDENCE_CONFLICT', mutationPerformed: false })
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(readFileSync(f.marker, 'utf8')).toBe('preserve destination')
  })

  it('preserves an invalid existing destination instead of replacing it', async () => {
    const f = fixture({ existingDestination: true, destinationStatus: '?? preserve.txt' })
    const result = await invoke(f) as { classification: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ classification: 'EVIDENCE_CONFLICT', mutationPerformed: false })
    expect(readFileSync(f.marker, 'utf8')).toBe('preserve destination')
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
  })

  it('preserves a destination path that aliases original B', async () => {
    const f = fixture(); symlinkSync(f.target, f.destination)
    const result = await invoke(f) as { classification: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ classification: 'STATE_CONFLICT', mutationPerformed: false })
    expect(realpathSync(f.destination)).toBe(f.target)
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
  })

  it.each([
    ['wrong PR number', { pull: pullPayload({ number: 778 }) }],
    ['unmerged PR', { pull: pullPayload({ state: 'open', merged_at: null }) }],
    ['wrong base repository', { pull: pullPayload({ base: { ref: 'main', repo: { full_name: 'other/repo' } } }) }],
    ['wrong base branch', { pull: pullPayload({ base: { ref: 'dev', repo: { full_name: REPO } } }) }],
    ['wrong source branch', { pull: pullPayload({ head: { ref: 'other-branch', sha: PR_HEAD, repo: { full_name: REPO } } }) }],
    ['wrong exact source head', { pull: pullPayload({ head: { ref: ISSUE_BRANCH, sha: 'd'.repeat(40), repo: { full_name: REPO } } }) }],
    ['wrong PR head repository', { pull: pullPayload({ head: { ref: ISSUE_BRANCH, sha: PR_HEAD, repo: { full_name: 'other/repo' } } }) }],
    ['missing #630 link', { pull: pullPayload({ body: 'Closes #624' }) }],
  ])('stops before cloning for %s', async (_story, settings) => {
    const f = fixture(settings)
    const result = await invoke(f) as { route: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false })
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
  })

  it.each([
    ['dirty #630 source', { sourceStatus: ' M docs/file.md' }],
    ['wrong source origin', { sourceOrigin: 'https://github.com/other/repo.git' }],
    ['wrong source branch', { sourceBranch: 'main' }],
    ['source head differs from merged PR head', { sourceHead: 'd'.repeat(40) }],
    ['dirty original B', { targetStatus: ' M docs/file.md' }],
    ['wrong original B head', { targetHead: 'd'.repeat(40) }],
    ['wrong original B tree', { targetTree: 'e'.repeat(40) }],
    ['wrong original B origin', { targetOrigin: 'https://github.com/other/repo.git' }],
    ['wrong original B branch', { targetBranch: 'main' }],
    ['wrong original B upstream', { targetUpstream: 'origin/main' }],
    ['moved original B live ref', { targetLiveSha: 'd'.repeat(40) }],
    ['GitHub and origin main disagree', { remoteMainSha: 'd'.repeat(40) }],
  ])('preserves roots and stops before clone for %s', async (_story, settings) => {
    const f = fixture(settings)
    const sourceBefore = snapshotTree(f.source)
    const result = await invoke(f) as { route: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false })
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(readdirSync(f.target)).toEqual([])
    expect(snapshotTree(f.source)).toBe(sourceBefore)
  })

  it.each([
    ['malformed compare base', { status: 'ahead', ahead_by: 2, behind_by: 0, base_commit: { sha: 'd'.repeat(40) }, merge_base_commit: { sha: MERGE } }],
    ['missing merge base', { status: 'ahead', ahead_by: 2, behind_by: 0, base_commit: { sha: MERGE } }],
    ['behind live main', { status: 'behind', ahead_by: 0, behind_by: 1, base_commit: { sha: MERGE }, merge_base_commit: { sha: 'd'.repeat(40) } }],
    ['diverged live main', { status: 'diverged', ahead_by: 1, behind_by: 1, base_commit: { sha: MERGE }, merge_base_commit: { sha: 'd'.repeat(40) } }],
  ])('stops before clone on %s evidence', async (_story, compare) => {
    const f = fixture({ compare })
    const result = await invoke(f) as { route: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false })
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
  })

  it('preserves a failed partial clone and never proceeds to discovery', async () => {
    const f = fixture({ cloneFailure: true })
    const result = await invoke(f) as { classification: string; route: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ classification: 'BLOCKED_EXTERNAL', route: 'STOP', mutationPerformed: true })
    expect(readFileSync(f.marker, 'utf8')).toBe('partial clone')
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
  })

  it.each([
    ['stale HEAD', { destinationHead: 'd'.repeat(40) }],
    ['stale origin/main tracking ref', { destinationTracking: 'd'.repeat(40) }],
    ['dirty status', { destinationStatus: '?? preserve.txt' }],
  ])('preserves an existing D with %s without recloning', async (_story, settings) => {
    const f = fixture({ existingDestination: true, ...settings })
    const result = await invoke(f) as { route: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false })
    expect(readFileSync(f.marker, 'utf8')).toBe('preserve destination')
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
  })

  it('preserves D and stops if live main moves after the clone', async () => {
    const f = fixture({ mainDriftAfterClone: 'd'.repeat(40) })
    const result = await invoke(f) as { classification: string; route: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ classification: 'HEAD_DRIFT', route: 'STOP', mutationPerformed: true })
    expect(existsSync(f.destination)).toBe(true)
    expect(f.calls.some((call) => call.command === 'pnpm')).toBe(false)
  })

  it('stops when Context returns nonzero even if stdout looks like valid target evidence', async () => {
    const f = fixture({ existingDestination: true, destinationHasMarker: false, contextResult: {
      status: 1, stdout: JSON.stringify({ schema_version: 1, command: CONTEXT, mode: 'context', mutation_performed: false, issue_number: '627', route: 'STOP' }), stderr: 'Context failed', error: null,
    } })
    const result = await invoke(f) as { classification: string; route: string }
    expect(result).toMatchObject({ classification: 'BLOCKED_EXTERNAL', route: 'STOP' })
  })

  it.each([(f: Fixture) => f.source, (f: Fixture) => join(f.target, 'nested')])('rejects destination overlap without cloning', async (destinationPath) => {
    const f = fixture()
    const destination = destinationPath(f)
    if (destination === join(f.target, 'nested')) mkdirSync(destination)
    const result = await invoke(f, { destination }) as { classification: string; route: string; mutationPerformed: boolean }
    expect(result).toMatchObject({ route: 'STOP', mutationPerformed: false })
    expect(f.calls.some((call) => call.command === 'git' && call.args[0] === 'clone')).toBe(false)
  })
})
