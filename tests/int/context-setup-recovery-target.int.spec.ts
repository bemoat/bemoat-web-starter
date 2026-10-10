import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseCommandInvocation } from '../../scripts/cli/command-invocation.ts'
import { getCommandContract } from '../../scripts/cli/command-contract.ts'
import { resolveSetupRecoveryRoots, verifySetupRecoveryWorktrees } from '../../scripts/context/setup-recovery-worktree.ts'
import type { ContextCommandResult, ContextCommandRunner } from '../../scripts/context/runtime.ts'
import type { NormalizedContextEvidence } from '../../scripts/context/model.ts'

const cliHarness = vi.hoisted(() => ({
  run: null as ContextCommandRunner | null,
  evidence: null as NormalizedContextEvidence | null,
  calls: [] as Array<{ command: string; args: string[]; cwd: string }>,
  head: '',
  tracking: '',
}))

vi.mock('../../scripts/context/runtime.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../scripts/context/runtime.ts')>()
  return {
    ...actual,
    runContextCommand: (command: string, args: readonly string[], options?: { cwd?: string }) => {
      if (!cliHarness.run) throw new Error('CLI recovery command runner fixture missing')
      return cliHarness.run(command, args, options)
    },
  }
})

vi.mock('../../scripts/context/evidence.ts', () => ({
  collectContextEvidence: () => {
    if (!cliHarness.evidence) throw new Error('CLI recovery evidence fixture missing')
    const current = structuredClone(cliHarness.evidence)
    current.localGit.head = cliHarness.head
    current.localGit.pushed = cliHarness.head === current.protectedBase.sha
    current.localGit.durable = current.localGit.pushed
    current.localGit.reasons = current.localGit.pushed ? [] : ['LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream']
    if (current.setupBaseRecovery) current.setupBaseRecovery.localUpstreamHead = cliHarness.tracking
    return current
  },
}))

const repository = 'bemoat/bemoat-web-starter'
const localHead = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const issue594TargetHead = '46fe5363697cb24f0db5a6d4338a5540665bb697'
const issue594LiveMain = 'e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3'

type WorktreeOverrides = {
  branch?: string; sourceHead?: string; sourceStatus?: string; sourceOrigin?: string; sourceRoot?: string;
  targetHead?: string; targetStatus?: string; targetBranch?: string; targetOrigin?: string;
  targetUpstream?: string; targetTracking?: string; targetRoot?: string;
  githubSha?: string; remoteSha?: string;
}

function sourceRunner(overrides: WorktreeOverrides = {}): ContextCommandRunner {
  return (command, args, options) => {
    const cwd = options?.cwd ?? ''
    const key = args.join(' ')
    if (command === 'git' && key === 'rev-parse --show-toplevel') return { status: 0, stdout: `${cwd === '/target' ? overrides.targetRoot ?? cwd : overrides.sourceRoot ?? cwd}\n`, stderr: '', error: null }
    if (command === 'git' && key === 'rev-parse HEAD') return { status: 0, stdout: `${cwd === '/target' ? overrides.targetHead ?? localHead : overrides.sourceHead ?? baseSha}\n`, stderr: '', error: null }
    if (command === 'git' && key === 'status --short') return { status: 0, stdout: cwd === '/target' ? overrides.targetStatus ?? '' : overrides.sourceStatus ?? '', stderr: '', error: null }
    if (command === 'git' && key === 'symbolic-ref --quiet --short HEAD' && cwd === '/target') return overrides.targetBranch === '<detached>'
      ? { status: 1, stdout: '', stderr: '', error: null }
      : { status: 0, stdout: `${overrides.targetBranch ?? 'main'}\n`, stderr: '', error: null }
    if (command === 'git' && key === 'symbolic-ref --quiet --short HEAD') return overrides.branch === '<detached>'
      ? { status: 1, stdout: '', stderr: '', error: null }
      : { status: 0, stdout: `${overrides.branch ?? 'main'}\n`, stderr: '', error: null }
    if (command === 'git' && key === 'remote get-url origin') return { status: 0, stdout: `${cwd === '/target' ? overrides.targetOrigin ?? `https://github.com/${repository}.git` : overrides.sourceOrigin ?? `https://github.com/${repository}.git`}\n`, stderr: '', error: null }
    if (command === 'git' && key === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return { status: 0, stdout: `${overrides.targetUpstream ?? 'origin/main'}\n`, stderr: '', error: null }
    if (command === 'git' && key === `rev-parse --verify --quiet refs/remotes/origin/main`) return { status: 0, stdout: `${overrides.targetTracking ?? localHead}\n`, stderr: '', error: null }
    if (command === 'git' && key === 'ls-remote --heads origin refs/heads/main') return { status: 0, stdout: `${overrides.remoteSha ?? baseSha}\trefs/heads/main\n`, stderr: '', error: null }
    if (command === 'gh' && key === `api repos/${repository}/git/ref/heads/main`) return { status: 0, stdout: JSON.stringify({ object: { sha: overrides.githubSha ?? baseSha } }), stderr: '', error: null }
    return { status: 1, stdout: '', stderr: `unhandled ${command} ${key}`, error: null }
  }
}

describe('Issue #592 explicit target setup recovery command contract', () => {
  // Authority: the protected Mission Control guide says Context is read-only
  // and recovery grants no objective-edit authority. The registered
  // recover-setup contract limits mutation to a clean stale protected branch
  // and routes success only to fresh Context.
  it('keeps setup recovery separate from task-owned WIP repair authority', () => {
    const contract = getCommandContract('bemoat:context:recover-setup')
    if (!contract) throw new Error('bemoat:context:recover-setup contract missing')

    expect(contract.accepted_pre_states.join(' ')).toMatch(/clean attached canonical protected branch/i)
    expect(contract.accepted_pre_states.join(' ')).toMatch(/strictly behind the exact live protected base/i)
    expect(contract.writes.join(' ')).toMatch(/no .*objective-file writes/i)
    expect(contract.next_action_rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'SUCCESS',
        next_action: expect.objectContaining({ type: 'COMMAND', command: 'bemoat:context' }),
      }),
    ]))
  })

  // Authority: Issue #592 requires the current protected-main source to expose
  // one explicit stale target while retaining the existing exact binding.
  it('parses one explicit absolute target alongside the exact recovery binding', () => {
    const invocation = parseCommandInvocation('bemoat:context:recover-setup', [
      '592',
      '--expected-repository', 'bemoat/bemoat-web-starter',
      '--expected-base-branch', 'main',
      '--expected-base-sha', 'b'.repeat(40),
      '--expected-local-head', 'a'.repeat(40),
      '--target-worktree', '/worktrees/stale-main',
      '--json',
    ])

    expect(invocation).toMatchObject({
      mode: 'run',
      values: {
        issue_number: '592',
        expected_repository: 'bemoat/bemoat-web-starter',
        expected_base_branch: 'main',
        expected_base_sha: 'b'.repeat(40),
        expected_local_head: 'a'.repeat(40),
        target_worktree: '/worktrees/stale-main',
      },
    })
  })

  // Authority: registered CLI Discovery defines safe help as the public
  // command surface; it must advertise only the explicit target path mode.
  it('publishes target mode in registered machine-readable help', () => {
    const invocation = parseCommandInvocation('bemoat:context:recover-setup', ['--help', '--json'])
    expect(invocation).toMatchObject({ mode: 'help' })
    if (invocation.mode !== 'help') throw new Error('expected help invocation')
    expect(invocation.contract.optional_flags).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'target_worktree',
        syntax: '--target-worktree <absolute-path>',
        value_type: 'path',
      }),
    ]))
  })

  // Authority: #592 permits separate clone/worktree topology and requires
  // independently verified canonical source/target roots.
  it('accepts distinct canonical roots without requiring a shared Git directory', () => {
    const roots = resolveSetupRecoveryRoots({
      sourceCwd: '/source-link',
      targetWorktree: '/target-link',
      realpath: (path) => path === '/source-link' ? '/source-clone' : '/target-clone',
      stat: () => ({ isDirectory: () => true }),
    })
    expect(roots).toMatchObject({ sourceCwd: '/source-clone', targetCwd: '/target-clone', separateTarget: true })
  })

  it('rejects relative and same-root target paths', () => {
    expect(() => resolveSetupRecoveryRoots({
      sourceCwd: '/source', targetWorktree: 'relative', realpath: (path) => path, stat: () => ({ isDirectory: () => true }),
    })).toThrow('absolute path')
    expect(() => resolveSetupRecoveryRoots({
      sourceCwd: '/source', targetWorktree: '/source', realpath: (path) => path, stat: () => ({ isDirectory: () => true }),
    })).toThrow('must be distinct')
  })

  it('rejects a repeated target flag during argument parsing', () => {
    expect(() => parseCommandInvocation('bemoat:context:recover-setup', [
      '592', '--expected-repository', repository, '--expected-base-branch', 'main',
      '--expected-base-sha', baseSha, '--expected-local-head', localHead,
      '--target-worktree', '/one', '--target-worktree', '/two', '--json',
    ])).toThrow()
  })

  it.each([
    ['attached protected-main source', {}],
    ['detached exact-SHA source', { branch: '<detached>' }],
  ])('verifies a clean exact-live source and separate target root for %s', (_story, overrides) => {
    expect(verifySetupRecoveryWorktrees({
      sourceCwd: '/source', targetCwd: '/target', expectedRepository: repository,
      expectedBaseBranch: 'main', expectedBaseSha: baseSha, separateTarget: true,
      expectedLocalHead: localHead, boundary: 'initial',
      run: sourceRunner(overrides),
    })).toBeNull()
  })

  it.each([
    ['stale source', { sourceHead: localHead }],
    ['dirty source', { sourceStatus: ' M file.txt' }],
    ['wrong-origin source', { sourceOrigin: 'https://github.com/bemoat/other.git' }],
    ['wrong-root source', { sourceRoot: '/other' }],
    ['wrong attached branch', { branch: 'dev' }],
    ['ambiguous live base', { remoteSha: 'c'.repeat(40) }],
  ])('rejects %s before recovery mutation', (_story, overrides) => {
    expect(verifySetupRecoveryWorktrees({
      sourceCwd: '/source', targetCwd: '/target', expectedRepository: repository,
      expectedBaseBranch: 'main', expectedBaseSha: baseSha, separateTarget: true,
      expectedLocalHead: localHead, boundary: 'initial',
      run: sourceRunner(overrides),
    })).not.toBeNull()
  })

  // Authority: Issue #592 requires an independently bound, clean, attached
  // canonical target. Each case must fail even when the source remains valid.
  it.each([
    ['dirty target', { targetStatus: ' M file.txt' }],
    ['detached target', { targetBranch: '<detached>' }],
    ['wrong target branch', { targetBranch: 'dev' }],
    ['wrong target origin', { targetOrigin: 'https://github.com/bemoat/other.git' }],
    ['wrong target upstream', { targetUpstream: 'origin/dev' }],
    ['moved target HEAD', { targetHead: 'c'.repeat(40) }],
    ['moved target tracking ref', { targetTracking: 'c'.repeat(40) }],
    ['wrong target root', { targetRoot: '/other' }],
    ['moved live base', { githubSha: 'c'.repeat(40) }],
  ])('rejects %s with an otherwise eligible exact-live source', (_story, overrides) => {
    expect(verifySetupRecoveryWorktrees({
      sourceCwd: '/source', targetCwd: '/target', expectedRepository: repository,
      expectedBaseBranch: 'main', expectedBaseSha: baseSha, separateTarget: true,
      expectedLocalHead: localHead, boundary: 'initial', run: sourceRunner(overrides),
    })).not.toBeNull()
  })

  // Authority: Issue #594 acceptance criteria require recognizing the exact
  // recurring #588 state: a clean canonical attached main target whose HEAD
  // is 46fe536..., while origin/main and both live protected-main authorities
  // equal e3f5f7f.... The Issue also requires target identity and cleanliness
  // to remain bound. The current merged #592 contract's target equality rule
  // is the behavior this characterization challenges.
  it('accepts the exact benign protected-main tracking-ref-ahead target state', () => {
    expect(verifySetupRecoveryWorktrees({
      sourceCwd: '/source', targetCwd: '/target', expectedRepository: repository,
      expectedBaseBranch: 'main', expectedBaseSha: issue594LiveMain, separateTarget: true,
      expectedLocalHead: issue594TargetHead, boundary: 'initial',
      run: sourceRunner({
        targetHead: issue594TargetHead,
        targetTracking: issue594LiveMain,
        sourceHead: issue594LiveMain,
        githubSha: issue594LiveMain,
        remoteSha: issue594LiveMain,
      }),
    })).toBeNull()
  })

  // Authority: Issue #594 explicitly preserves STOP for every tracking SHA
  // other than the exact live protected-base SHA on this new path.
  it('rejects the recurring target shape when its tracking SHA is not exact live main', () => {
    expect(verifySetupRecoveryWorktrees({
      sourceCwd: '/source', targetCwd: '/target', expectedRepository: repository,
      expectedBaseBranch: 'main', expectedBaseSha: issue594LiveMain, separateTarget: true,
      expectedLocalHead: issue594TargetHead, boundary: 'initial',
      run: sourceRunner({
        targetHead: issue594TargetHead,
        targetTracking: 'c'.repeat(40),
        sourceHead: issue594LiveMain,
        githubSha: issue594LiveMain,
        remoteSha: issue594LiveMain,
      }),
    })).not.toBeNull()
  })

  // Authority: the registered retry contract accepts an original binding at
  // an exact completed target as a no-op, but only when HEAD and tracking
  // both equal the exact base. Completed state is not valid after initial read.
  it('accepts the completed exact-base pair only at initial target validation', () => {
    const args = {
      sourceCwd: '/source', targetCwd: '/target', expectedRepository: repository,
      expectedBaseBranch: 'main', expectedBaseSha: baseSha, separateTarget: true,
      expectedLocalHead: localHead,
    }
    expect(verifySetupRecoveryWorktrees({ ...args, boundary: 'initial', run: sourceRunner() })).toBeNull()
    expect(verifySetupRecoveryWorktrees({
      ...args, boundary: 'initial', run: sourceRunner({ targetHead: baseSha, targetTracking: baseSha }),
    })).toBeNull()
    expect(verifySetupRecoveryWorktrees({
      ...args, boundary: 'initial', run: sourceRunner({ targetHead: baseSha, targetTracking: localHead }),
    })).not.toBeNull()
    expect(verifySetupRecoveryWorktrees({
      ...args, boundary: 'initial', run: sourceRunner({ targetHead: localHead, targetTracking: baseSha }),
    })).not.toBeNull()
    expect(verifySetupRecoveryWorktrees({
      ...args, boundary: 'before-fetch', run: sourceRunner({ targetHead: baseSha, targetTracking: baseSha }),
    })).not.toBeNull()
    expect(verifySetupRecoveryWorktrees({
      ...args, boundary: 'before-merge', run: sourceRunner({ targetHead: baseSha, targetTracking: baseSha }),
    })).not.toBeNull()
  })

  // Authority: the target branch has fast-forwarded immediately before CAS,
  // while its old tracking ref must remain unchanged for the compare-and-swap.
  it('accepts only the bound post-merge target HEAD at the tracking update boundary', () => {
    const args = {
      sourceCwd: '/source', targetCwd: '/target', expectedRepository: repository,
      expectedBaseBranch: 'main', expectedBaseSha: baseSha, separateTarget: true,
      expectedLocalHead: localHead, boundary: 'before-tracking-update' as const,
    }
    expect(verifySetupRecoveryWorktrees({ ...args, run: sourceRunner({ targetHead: baseSha }) })).toBeNull()
    expect(verifySetupRecoveryWorktrees({ ...args, run: sourceRunner({ targetHead: localHead }) })).not.toBeNull()
    expect(verifySetupRecoveryWorktrees({ ...args, run: sourceRunner({ targetHead: baseSha, targetTracking: baseSha }) })).not.toBeNull()
  })
})

const issue594PolicySha = 'd587ff2c6ac4a314b193e321613c3299c83b6da5'

function cliResponse(stdout = '', status = 0): ContextCommandResult {
  return { status, stdout, stderr: status === 0 ? '' : 'failed', error: null }
}

function cliEvidence(targetWorktree: string): NormalizedContextEvidence {
  return {
    repository: { owner: 'bemoat', name: 'bemoat-web-starter', nameWithOwner: repository, url: `https://github.com/${repository}` },
    protectedBase: { branch: 'main', sha: issue594LiveMain, source: 'live GitHub ref', url: `https://github.com/${repository}/tree/main` },
    policy: { path: 'docs/mission-control/mission-control-guide.md', policyId: 'bemoat-mission-control', version: '1.7.0', sourceSha: issue594PolicySha, trustedFounderLogin: 'bemoat', url: `https://github.com/${repository}/blob/main/docs/mission-control/mission-control-guide.md` },
    issue: { number: '594', title: 'fix(context): recover stale protected target after shared tracking-ref advance', state: 'OPEN', url: `https://github.com/${repository}/issues/594`, objective: 'Recover the exact benign protected target.', scope: 'Exact #588 recurrence only.', acceptanceCriteria: ['Recognize the exact tracking-ref-ahead state.'], dependencies: [], taskSize: 'medium', missionControlMode: 'required', workflowProfile: 'STANDARD' },
    localGit: { branch: 'main', head: issue594TargetHead, upstream: 'origin/main', originRepository: repository, clean: true, detached: false, pushed: false, durable: false, reasons: ['LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream'] },
    activePr: null,
    currentHeadVerification: null,
    durableContext: { latestHandoff: null, handoffs: [], historicalResults: [] },
    setupBaseRecovery: { liveUpstreamHead: issue594LiveMain, localUpstreamHead: issue594LiveMain, ancestry: 'STRICT_ANCESTOR', targetWorktree },
    evidenceErrors: [],
  }
}

function cliRunner({ source, trackingDrift = false }: { source: string; trackingDrift?: boolean }): ContextCommandRunner {
  return (command, args, options = {}) => {
    const cwd = options.cwd ?? ''
    const key = args.join(' ')
    cliHarness.calls.push({ command, args: [...args], cwd })
    if (command === 'gh' && key === `api repos/${repository}/git/ref/heads/main`) {
      return cliResponse(JSON.stringify({ object: { sha: issue594LiveMain } }))
    }
    if (command !== 'git') return cliResponse('', 1)
    if (key === 'rev-parse --show-toplevel') return cliResponse(`${cwd}\n`)
    if (key === 'status --short') return cliResponse('')
    if (key === 'remote get-url origin') return cliResponse(`https://github.com/${repository}.git\n`)
    if (key === 'symbolic-ref --quiet --short HEAD') return cliResponse('main\n')
    if (key === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return cliResponse('origin/main\n')
    if (key === 'rev-parse HEAD') return cliResponse(`${cwd === source ? issue594LiveMain : cliHarness.head}\n`)
    if (key === 'rev-parse --verify --quiet refs/remotes/origin/main') {
      return cliResponse(`${trackingDrift ? 'c'.repeat(40) : cliHarness.tracking}\n`)
    }
    if (key === 'ls-remote --heads origin refs/heads/main') return cliResponse(`${issue594LiveMain}\trefs/heads/main\n`)
    if (key === 'fetch --no-tags --no-recurse-submodules --refmap= origin refs/heads/main:') return cliResponse()
    if (key === 'rev-parse --verify --quiet FETCH_HEAD') return cliResponse(`${issue594LiveMain}\n`)
    if (key === `merge-base --is-ancestor HEAD ${issue594LiveMain}`) return cliResponse('', 0)
    if (key === `merge-base --is-ancestor ${issue594LiveMain} HEAD`) return cliResponse('', 1)
    if (key === `merge --ff-only ${issue594LiveMain}`) {
      cliHarness.head = issue594LiveMain
      return cliResponse()
    }
    if (key === `update-ref refs/remotes/origin/main ${issue594LiveMain} ${issue594LiveMain}`) {
      cliHarness.tracking = issue594LiveMain
      return cliResponse()
    }
    return cliResponse('', 1)
  }
}

async function runRegisteredTargetRecovery({ source, target, trackingDrift = false }: {
  source: string
  target: string
  trackingDrift?: boolean
}): Promise<{ stdout: string; exitCode: typeof process.exitCode }> {
  cliHarness.evidence = cliEvidence(target)
  cliHarness.head = issue594TargetHead
  cliHarness.tracking = issue594LiveMain
  cliHarness.calls = []
  cliHarness.run = cliRunner({ source, trackingDrift })
  const originalArgv = process.argv
  const originalExitCode = process.exitCode
  const originalLifecycleEvent = process.env.npm_lifecycle_event
  let stdout = ''
  const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk)
    return true
  })
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(source)
  process.argv = [process.execPath, 'scripts/agent-context-recover-setup.ts', '594',
    '--expected-repository', repository,
    '--expected-base-branch', 'main',
    '--expected-base-sha', issue594LiveMain,
    '--expected-local-head', issue594TargetHead,
    '--target-worktree', target,
    '--json',
  ]
  delete process.env.npm_lifecycle_event
  process.exitCode = undefined
  try {
    await vi.resetModules()
    await import('../../scripts/agent-context-recover-setup.ts')
    return { stdout, exitCode: process.exitCode }
  } finally {
    process.argv = originalArgv
    process.exitCode = originalExitCode
    if (originalLifecycleEvent === undefined) delete process.env.npm_lifecycle_event
    else process.env.npm_lifecycle_event = originalLifecycleEvent
    write.mockRestore()
    cwd.mockRestore()
  }
}

describe('registered setup recovery target-worktree lifecycle', () => {
  let root = ''
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
    root = ''
    cliHarness.run = null
    cliHarness.evidence = null
  })

  it('wires the exact #594 recovery through the public target-worktree entrypoint and all source/target boundaries', async () => {
    root = mkdtempSync(join(tmpdir(), 'bemoat-594-target-cli-'))
    const sourcePath = join(root, 'source')
    const targetPath = join(root, 'target')
    mkdirSync(sourcePath)
    mkdirSync(targetPath)
    const source = realpathSync(sourcePath)
    const target = realpathSync(targetPath)

    const result = await runRegisteredTargetRecovery({ source, target })
    const envelope = JSON.parse(result.stdout.trim())
    const boundaries = cliHarness.calls.filter(({ command, args }) => command === 'git' && args.join(' ') === 'rev-parse --show-toplevel')
    const mutations = cliHarness.calls.filter(({ command, args }) => command === 'git' && ['fetch', 'merge', 'update-ref'].includes(args[0] ?? ''))

    expect(result.exitCode).toBe(0)
    expect(envelope).toMatchObject({
      command: 'bemoat:context:recover-setup', outcome: 'SUCCESS', classification: 'SUCCESS',
      mutation_performed: true, issue_number: '594', exact_head: issue594LiveMain,
      details: { route: 'STOP', objective_edit_authority_granted: false },
    })
    expect(boundaries.filter(({ cwd }) => cwd === target)).toHaveLength(4)
    expect(boundaries.filter(({ cwd }) => cwd === source)).toHaveLength(4)
    expect(mutations.map(({ args }) => args.join(' '))).toEqual([
      'fetch --no-tags --no-recurse-submodules --refmap= origin refs/heads/main:',
      `merge --ff-only ${issue594LiveMain}`,
      `update-ref refs/remotes/origin/main ${issue594LiveMain} ${issue594LiveMain}`,
    ])
  })

  it('stops before recovery mutation when the explicit target tracking ref drifts', async () => {
    root = mkdtempSync(join(tmpdir(), 'bemoat-594-target-drift-'))
    const sourcePath = join(root, 'source')
    const targetPath = join(root, 'target')
    mkdirSync(sourcePath)
    mkdirSync(targetPath)
    const source = realpathSync(sourcePath)
    const target = realpathSync(targetPath)

    const result = await runRegisteredTargetRecovery({ source, target, trackingDrift: true })
    const envelope = JSON.parse(result.stdout.trim())
    const mutations = cliHarness.calls.filter(({ command, args }) => command === 'git' && ['fetch', 'merge', 'update-ref'].includes(args[0] ?? ''))

    expect(result.exitCode).not.toBe(0)
    expect(envelope).toMatchObject({
      command: 'bemoat:context:recover-setup', outcome: 'STOP',
      mutation_performed: false, issue_number: '594',
    })
    expect(mutations).toEqual([])
  })
})
