import { describe, expect, it } from 'vitest'

import { parseCommandInvocation } from '../../scripts/cli/command-invocation.ts'
import { resolveSetupRecoveryRoots, verifySetupRecoveryWorktrees } from '../../scripts/context/setup-recovery-worktree.ts'
import type { ContextCommandRunner } from '../../scripts/context/runtime.ts'

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
