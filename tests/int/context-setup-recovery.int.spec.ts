import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContextCommandResult, ContextCommandRunner } from '../../scripts/context/runtime.ts'
import type { NormalizedContextEvidence } from '../../scripts/context/model.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'
import { parseCommandInvocation } from '../../scripts/cli/command-invocation.ts'

const harness = vi.hoisted(() => ({
  evidence: null as NormalizedContextEvidence | null,
  alternateEvidence: null as NormalizedContextEvidence | null,
  alternateAt: Number.POSITIVE_INFINITY,
  collectCalls: 0,
  head: '',
  tracking: '',
}))

vi.mock('../../scripts/context/evidence.ts', () => ({
  collectContextEvidence: () => {
    if (!harness.evidence) throw new Error('setup recovery evidence fixture missing')
    harness.collectCalls += 1
    const source = harness.alternateEvidence && harness.collectCalls >= harness.alternateAt
      ? harness.alternateEvidence
      : harness.evidence
    const current = structuredClone(source)
    current.localGit.head = harness.head
    current.localGit.pushed = harness.head === current.protectedBase.sha
    current.localGit.durable = current.localGit.pushed
    current.localGit.reasons = current.localGit.pushed ? [] : ['LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream']
    if (current.setupBaseRecovery) current.setupBaseRecovery.localUpstreamHead = harness.tracking
    return current
  },
}))

import { recoverSetupBase } from '../../scripts/context/setup-recovery.ts'

const repo = 'bemoat/bemoat-web-starter'
const oldHead = 'a'.repeat(40)
const liveHead = 'b'.repeat(40)
const issue594TargetHead = '46fe5363697cb24f0db5a6d4338a5540665bb697'
const issue594LiveMain = 'e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3'
const issue594PolicySha = 'd587ff2c6ac4a314b193e321613c3299c83b6da5'

function evidence(overrides: Partial<NormalizedContextEvidence> = {}): NormalizedContextEvidence {
  return {
    repository: { owner: 'bemoat', name: 'bemoat-web-starter', nameWithOwner: repo, url: `https://github.com/${repo}` },
    protectedBase: { branch: 'main', sha: liveHead, source: 'live GitHub ref', url: `https://github.com/${repo}/tree/main` },
    policy: { path: 'docs/mission-control/mission-control-guide.md', policyId: 'bemoat-mission-control', version: '1.5.0', sourceSha: liveHead, trustedFounderLogin: 'bemoat', url: `https://github.com/${repo}/blob/main/docs/mission-control/mission-control-guide.md` },
    issue: { number: '585', title: 'Deterministic setup recovery', state: 'OPEN', url: `https://github.com/${repo}/issues/585`, objective: null, scope: null, acceptanceCriteria: [], dependencies: [], taskSize: 'core', missionControlMode: 'required', workflowProfile: 'STANDARD' },
    localGit: { branch: 'main', head: oldHead, upstream: 'origin/main', originRepository: repo, clean: true, detached: false, pushed: false, durable: false, reasons: ['LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream'] },
    activePr: null,
    currentHeadVerification: null,
    durableContext: { latestHandoff: null, handoffs: [], historicalResults: [] },
    setupBaseRecovery: { liveUpstreamHead: liveHead, localUpstreamHead: oldHead, ancestry: 'STRICT_ANCESTOR' },
    evidenceErrors: [],
    ...overrides,
  }
}

function binding(expectedLocalHead = oldHead) {
  return {
    issueNumber: '585',
    expectedRepository: repo,
    expectedBaseBranch: 'main',
    expectedBaseSha: liveHead,
    expectedLocalHead,
  }
}

function founderGateEvidence(): NormalizedContextEvidence {
  const record: HandoffRecord = {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'read_only',
    repository: repo,
    issue_number: '585',
    objective: 'Founder review is required before the next objective action.',
    permitted_scope: ['Issue #585 context review.'],
    prohibited_scope: ['Do not begin objective work before Founder authorization.'],
    executing_agent: 'Codex',
    provider: 'OpenAI Codex',
    branch: 'main',
    exact_head: oldHead,
    protected_base: { branch: 'main', sha: liveHead },
    pr: null,
    verified_evidence: [{ kind: 'gate', value: 'Founder review required.', url: null }],
    route: 'FOUNDER_GATE',
    next_action: { route: 'FOUNDER_GATE', description: 'Founder authorization is required.' },
    stop_conditions: ['Wait for Founder authorization.'],
    local_durability: { required: true, durable: true, reason: null },
  }
  const body = renderHandoffComment(record)
  const source = { id: '77', body, createdAt: '2026-10-07T00:00:00Z', url: `https://github.com/${repo}/issues/585#issuecomment-77` }
  return evidence({ durableContext: { latestHandoff: source, handoffs: [source], historicalResults: [] } })
}

function response(stdout = '', status = 0): ContextCommandResult {
  return { status, stdout, stderr: status === 0 ? '' : 'failed', error: null }
}

function runner(options: {
  fetchStatus?: number; mergeStatus?: number; fetchedHead?: string; remoteAfter?: string; trackingBeforeFetch?: string;
  trackingAfterFetch?: string; ancestryStatus?: number; reverseAncestryStatus?: number; postStatus?: string;
  postUpstream?: string; liveRefDriftsAfterRead?: number; driftedLiveSha?: string; githubRefSha?: string;
  remoteAfterMerge?: string; duplicateLiveRef?: boolean; initialHead?: string; exactLiveHead?: string;
} = {}) {
  const initialHead = options.initialHead ?? oldHead
  const exactLiveHead = options.exactLiveHead ?? liveHead
  const calls: string[] = []
  const state = { head: initialHead, tracking: initialHead, fetchHead: '', live: exactLiveHead, status: '', upstream: 'origin/main' }
  let liveReads = 0
  state.tracking = options.trackingBeforeFetch ?? initialHead
  harness.head = initialHead
  harness.tracking = state.tracking
  const run: ContextCommandRunner = (_command, args) => {
    const key = args.join(' ')
    calls.push(key)
    if (key.startsWith('ls-remote --heads origin refs/heads/main')) {
      liveReads += 1
      const live = options.liveRefDriftsAfterRead !== undefined && liveReads > options.liveRefDriftsAfterRead
        ? options.driftedLiveSha ?? 'c'.repeat(40)
        : options.remoteAfter ?? state.live
      return response(`${live}\trefs/heads/main\n${options.duplicateLiveRef ? `${live}\trefs/heads/main\n` : ''}`)
    }
    if (key === 'rev-parse --verify --quiet refs/remotes/origin/main') return response(`${state.tracking}\n`)
    if (key === 'fetch --no-tags --no-recurse-submodules --refmap= origin refs/heads/main:') {
      if (options.fetchStatus) return response('', options.fetchStatus)
      state.fetchHead = options.fetchedHead ?? state.live
      state.tracking = options.trackingAfterFetch ?? initialHead
      harness.tracking = state.tracking
      return response()
    }
    if (key === 'rev-parse --verify --quiet FETCH_HEAD') return response(`${state.fetchHead}\n`)
    if (key === `merge-base --is-ancestor HEAD ${exactLiveHead}`) return response('', options.ancestryStatus ?? 0)
    if (key === `merge-base --is-ancestor ${exactLiveHead} HEAD`) return response('', options.reverseAncestryStatus ?? 1)
    if (key === `merge --ff-only ${exactLiveHead}`) {
      if (options.mergeStatus) return response('', options.mergeStatus)
      state.head = state.fetchHead
      harness.head = state.head
      if (options.remoteAfterMerge) state.live = options.remoteAfterMerge
      if (options.postStatus !== undefined) state.status = options.postStatus
      if (options.postUpstream) state.upstream = options.postUpstream
      return response()
    }
    if (
      key === `update-ref refs/remotes/origin/main ${exactLiveHead} ${initialHead}` ||
      key === `update-ref refs/remotes/origin/main ${exactLiveHead} ${exactLiveHead}`
    ) {
      state.tracking = exactLiveHead
      harness.tracking = exactLiveHead
      return response()
    }
    if (key === 'rev-parse HEAD') return response(`${state.head}\n`)
    if (key === 'status --short') return response(state.status)
    if (key === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return response(`${state.upstream}\n`)
    if (key === 'remote get-url origin') return response(`https://github.com/${repo}.git\n`)
    // collectContextEvidence runs these reads; their values are represented by
    // the authority-bound fixture above. Unused GitHub reads are harmless.
    if (_command === 'gh' && key === `api repos/${repo}/git/ref/heads/main`) {
      return response(JSON.stringify({ object: { sha: options.githubRefSha ?? exactLiveHead } }))
    }
    if (_command === 'gh') return response('{}')
    return response('', 1)
  }
  return { calls, run, state }
}

describe('Issue #585 clean stale protected-base setup recovery', () => {
  beforeEach(() => {
    harness.evidence = evidence()
    harness.alternateEvidence = null
    harness.alternateAt = Number.POSITIVE_INFINITY
    harness.collectCalls = 0
    harness.head = oldHead
    harness.tracking = oldHead
  })

  // Authority: Issue #594 acceptance requires the registered recovery behavior
  // to fast-forward the exact recurring target HEAD to exact live main, while
  // preserving clean state and using only --ff-only. This test exercises the
  // recovery command's production path; it is expected to expose the current
  // precondition rejection of HEAD != origin/main.
  it('recovers the exact #594 benign tracking-ref-ahead target to clean live main', () => {
    harness.evidence = evidence({
      policy: { ...evidence().policy, version: '1.7.0', sourceSha: issue594PolicySha },
      protectedBase: { ...evidence().protectedBase, sha: issue594LiveMain },
      issue: { ...evidence().issue, number: '594', title: 'fix(context): recover stale protected target after shared tracking-ref advance', url: `https://github.com/${repo}/issues/594` },
      localGit: { ...evidence().localGit, head: issue594TargetHead },
      setupBaseRecovery: {
        liveUpstreamHead: issue594LiveMain,
        localUpstreamHead: issue594LiveMain,
        ancestry: 'STRICT_ANCESTOR',
        targetWorktree: '/target',
      },
    })
    harness.head = issue594TargetHead
    harness.tracking = issue594LiveMain
    const git = runner({
      initialHead: issue594TargetHead,
      exactLiveHead: issue594LiveMain,
      trackingBeforeFetch: issue594LiveMain,
      trackingAfterFetch: issue594LiveMain,
    })
    const invocation = parseCommandInvocation('bemoat:context:recover-setup', [
      '594', '--expected-repository', repo, '--expected-base-branch', 'main',
      '--expected-base-sha', issue594LiveMain, '--expected-local-head', issue594TargetHead,
      '--json',
    ])
    if (invocation.mode !== 'run') throw new Error('expected a registered recovery run invocation')
    const source = { repository: repo, branch: 'main', head: issue594LiveMain, clean: true as const }
    const sourceChecks: Array<{ boundary: string; initialTracking?: string }> = []
    const result = recoverSetupBase({
      cwd: '/target',
      run: git.run,
      verifySource: (boundary, initialTracking) => {
        sourceChecks.push({ boundary, initialTracking })
        return source.repository === repo && source.branch === 'main' &&
          source.head === issue594LiveMain && source.clean
          ? null
          : 'Protected-main source no longer matches the exact clean canonical source binding.'
      },
      binding: {
        issueNumber: String(invocation.values.issue_number),
        expectedRepository: String(invocation.values.expected_repository),
        expectedBaseBranch: String(invocation.values.expected_base_branch),
        expectedBaseSha: String(invocation.values.expected_base_sha),
        expectedLocalHead: String(invocation.values.expected_local_head),
      },
    })

    expect(result).toMatchObject({
      classification: 'SUCCESS', mutationPerformed: true, currentHead: issue594LiveMain,
      route: 'STOP', nextAction: { type: 'COMMAND', command: 'bemoat:context' },
    })
    expect(git.state).toMatchObject({ head: issue594LiveMain, tracking: issue594LiveMain, status: '', upstream: 'origin/main' })
    expect(git.calls).toContain(`merge --ff-only ${issue594LiveMain}`)
    expect(git.calls).not.toContain(`update-ref refs/remotes/origin/main ${issue594TargetHead} ${issue594LiveMain}`)
    expect(git.calls.filter((call) => call.startsWith('update-ref refs/remotes/origin/main '))).toEqual([
      `update-ref refs/remotes/origin/main ${issue594LiveMain} ${issue594LiveMain}`,
    ])
    expect(sourceChecks.map(({ boundary }) => boundary)).toEqual([
      'initial', 'before-fetch', 'before-merge', 'before-tracking-update',
    ])
    expect(sourceChecks.slice(1).map(({ initialTracking }) => initialTracking)).toEqual([
      issue594LiveMain, issue594LiveMain, issue594LiveMain,
    ])
    expect(git.calls.some((call) => /\b(reset|rebase|stash|push|commit|checkout|switch)\b/.test(call))).toBe(false)
  })

  // Authority: Issue #585 acceptance criteria and execution-handoff-contract.md
  // “Clean stale protected-base setup recovery” require an exact bound fetch,
  // strict ancestry/no local-only commits, ff-only, exact readback, and no
  // objective-edit authority; the registered command contract defines no-op.
  it('fast-forwards only to the exact bound live base and recommends only fresh Context', () => {
    const git = runner()
    const result = recoverSetupBase({ cwd: '/repo', run: git.run, binding: binding() })

    expect(result).toMatchObject({ classification: 'SUCCESS', mutationPerformed: true, currentHead: liveHead, route: 'STOP', nextAction: { type: 'COMMAND', command: 'bemoat:context' } })
    expect(git.calls).toContain('fetch --no-tags --no-recurse-submodules --refmap= origin refs/heads/main:')
    expect(git.calls).toContain(`merge --ff-only ${liveHead}`)
    expect(git.calls.some((call) => /\b(reset|rebase|stash|push|commit|checkout|switch)\b/.test(call))).toBe(false)
  })

  // Authority: Issue #592 and the source-target recovery contract require the
  // protected-main source to be revalidated before every target mutation;
  // source drift must stop before the next fetch, fast-forward, or ref CAS.
  it('revalidates an explicit source at each recovery mutation boundary', () => {
    const git = runner()
    let checks = 0
    const result = recoverSetupBase({
      cwd: '/target',
      run: git.run,
      binding: binding(),
      verifySource: () => { checks += 1; return null },
    })

    expect(result).toMatchObject({ classification: 'SUCCESS', currentHead: liveHead, route: 'STOP', nextAction: { type: 'COMMAND', command: 'bemoat:context' } })
    expect(checks).toBe(4)
    expect(git.calls).toContain(`merge --ff-only ${liveHead}`)
    expect(git.calls).toContain(`update-ref refs/remotes/origin/main ${liveHead} ${oldHead}`)
  })

  it.each([
    ['before fetch', 2, false, false],
    ['before fast-forward', 3, true, false],
    ['before tracking-ref update', 4, true, true],
  ])('stops if the protected-main source drifts %s', (_phase, driftCheck, fetched, merged) => {
    const git = runner()
    let checks = 0
    const result = recoverSetupBase({
      cwd: '/target',
      run: git.run,
      binding: binding(),
      verifySource: () => { checks += 1; return checks === driftCheck ? 'Source no longer matches the exact live protected base.' : null },
    })

    expect(result.route).toBe('STOP')
    expect(result.nextAction.type).toBe('STOP')
    expect(git.calls.some((call) => call.startsWith('fetch '))).toBe(fetched)
    expect(git.calls.some((call) => call.startsWith('merge '))).toBe(merged)
    expect(git.calls.some((call) => call.startsWith('update-ref '))).toBe(false)
  })

  // Authority: the same contract classifies a bound exact-base retry as a
  // read-only no-op followed by fresh Context; no Git write is authorized.
  it('treats an exact-base invocation as a no-op with no Git mutation', () => {
    harness.evidence = evidence({ localGit: { ...evidence().localGit, head: liveHead, pushed: true, durable: true, reasons: [] }, setupBaseRecovery: { liveUpstreamHead: liveHead, localUpstreamHead: liveHead, ancestry: 'UNPROVEN_UNTIL_FETCH' } })
    const git = runner()
    git.state.head = liveHead
    git.state.tracking = liveHead
    harness.head = liveHead
    harness.tracking = liveHead
    const result = recoverSetupBase({ cwd: '/repo', run: git.run, binding: binding(liveHead) })

    expect(result).toMatchObject({ classification: 'NO_OP_IDENTICAL_RETRY', mutationPerformed: false, nextAction: { type: 'COMMAND', command: 'bemoat:context' } })
    expect(git.calls.some((call) => /\b(fetch|merge)\b/.test(call))).toBe(false)
  })

  // Authority: #585's registered retry contract allows an identical retry;
  // once at the exact bound protected SHA, it is a no-op followed by Context.
  it('treats replay of the original binding after successful recovery as a no-op', () => {
    const git = runner()
    const bound = binding()
    const first = recoverSetupBase({ cwd: '/repo', run: git.run, binding: bound })
    const callsAfterFirst = [...git.calls]
    const retryBoundaries: string[] = []
    const retry = recoverSetupBase({
      cwd: '/repo', run: git.run, binding: bound,
      verifySource: (boundary) => { retryBoundaries.push(boundary); return null },
    })

    expect(first.classification).toBe('SUCCESS')
    expect(retry).toMatchObject({ classification: 'NO_OP_IDENTICAL_RETRY', mutationPerformed: false, currentHead: liveHead, nextAction: { type: 'COMMAND', command: 'bemoat:context' } })
    expect(retryBoundaries).toEqual(['initial'])
    expect(git.calls.slice(callsAfterFirst.length).some((call) => /\b(fetch|merge)\b/.test(call))).toBe(false)
  })

  it.each([
    ['dirty checkout', { localGit: { ...evidence().localGit, clean: false } }],
    ['wrong origin', { localGit: { ...evidence().localGit, originRepository: 'bemoat/other' } }],
    ['wrong branch', { localGit: { ...evidence().localGit, branch: 'feature/585-test' } }],
    ['detached checkout', { localGit: { ...evidence().localGit, branch: '<detached>', detached: true } }],
    ['closed Issue', { issue: { ...evidence().issue, state: 'CLOSED' } }],
    ['active PR', { activePr: [] }],
  ] as const)('stops before fetch for %s', (_label, override) => {
    harness.evidence = evidence(override as Partial<NormalizedContextEvidence>)
    const git = runner()
    const result = recoverSetupBase({ cwd: '/repo', run: git.run, binding: binding() })
    expect(result.route).toBe('STOP')
    expect(git.calls.some((call) => call.startsWith('fetch '))).toBe(false)
  })

  // Authority: the registered recovery contract requires a clean worktree and
  // stops before fetch if local Git evidence cannot prove that precondition.
  it('stops before fetch when status evidence is unavailable', () => {
    harness.evidence = evidence({ localGit: { ...evidence().localGit, clean: false, reasons: ['EVIDENCE_CONFLICT: git status --short failed; working-tree cleanliness is unavailable'] } })
    const git = runner()
    const result = recoverSetupBase({ cwd: '/repo', run: git.run, binding: binding() })

    expect(result.route).toBe('STOP')
    expect(git.calls.some((call) => call.startsWith('fetch '))).toBe(false)
  })

  // Authority: the command contract binds the exact repository and protected
  // branch from Context. A later source change is a STOP; after fetch it also
  // records that a Git mutation may already have occurred and forbids merge.
  it.each([
    ['repository changed before fetch', { phase: 'initial', mutate: { repository: { ...evidence().repository, nameWithOwner: 'bemoat/other' }, localGit: { ...evidence().localGit, originRepository: 'bemoat/other' } } }],
    ['base branch changed before fetch', { phase: 'initial', mutate: { protectedBase: { ...evidence().protectedBase, branch: 'dev' }, localGit: { ...evidence().localGit, branch: 'dev', upstream: 'origin/dev' } } }],
    ['repository changed after fetch', { phase: 'post-fetch', mutate: { repository: { ...evidence().repository, nameWithOwner: 'bemoat/other' }, localGit: { ...evidence().localGit, originRepository: 'bemoat/other' } } }],
    ['base branch changed after fetch', { phase: 'post-fetch', mutate: { protectedBase: { ...evidence().protectedBase, branch: 'dev' }, localGit: { ...evidence().localGit, branch: 'dev', upstream: 'origin/dev' } } }],
  ] as const)('fails closed when %s', (_label, scenario) => {
    const changed = evidence(scenario.mutate as Partial<NormalizedContextEvidence>)
    if (scenario.phase === 'initial') harness.evidence = changed
    else {
      harness.alternateEvidence = changed
      harness.alternateAt = 2
    }
    const git = runner()
    const result = recoverSetupBase({ cwd: '/repo', run: git.run, binding: binding() })

    expect(result.classification).toBe('HEAD_DRIFT')
    expect(result.route).toBe('STOP')
    expect(result.mutationPerformed).toBe(scenario.phase === 'post-fetch')
    expect(git.calls.some((call) => call.startsWith('fetch '))).toBe(scenario.phase === 'post-fetch')
    expect(git.calls.some((call) => call.startsWith('merge '))).toBe(false)
  })

  // Authority: execution-handoff-contract.md preserves current-head STOP and
  // FOUNDER_GATE evidence, while setup recovery grants no objective authority.
  // A gate discovered after the Context binding must never be bypassed.
  it.each([
    ['before fetch', 'initial', false],
    ['after fetch', 'post-fetch', true],
  ] as const)('does not fast-forward through fresh FOUNDER_GATE evidence %s', (_label, phase, fetched) => {
    if (phase === 'initial') harness.evidence = founderGateEvidence()
    else {
      harness.alternateEvidence = founderGateEvidence()
      harness.alternateAt = 2
    }
    const git = runner()
    const result = recoverSetupBase({ cwd: '/repo', run: git.run, binding: binding() })

    expect(result.route).toBe('STOP')
    expect(result.nextAction.type).toBe('STOP')
    expect(result.mutationPerformed).toBe(fetched)
    expect(git.calls.some((call) => call.startsWith('fetch '))).toBe(fetched)
    expect(git.calls.some((call) => call.startsWith('merge '))).toBe(false)
  })

  it.each([
    ['moved live ref', { remoteAfter: 'c'.repeat(40) }],
    ['missing live ref', { remoteAfter: '' }],
    ['ambiguous duplicate live refs', { duplicateLiveRef: true }],
    ['FETCH_HEAD mismatch', { fetchedHead: 'c'.repeat(40) }],
    ['fetch failure', { fetchStatus: 1 }],
    ['ff-only failure', { mergeStatus: 1 }],
    ['tracking-ref readback mismatch', { trackingAfterFetch: 'c'.repeat(40) }],
    ['local tracking-ref mismatch before fetch', { trackingBeforeFetch: 'c'.repeat(40) }],
    ['local-only commit', { reverseAncestryStatus: 0 }],
    ['divergent history', { ancestryStatus: 1 }],
    ['mid-recovery GitHub base drift', { githubRefSha: 'c'.repeat(40) }],
    ['mid-recovery origin base drift', { liveRefDriftsAfterRead: 3 }],
    ['post-fast-forward dirty state', { postStatus: ' M unrelated.txt' }],
    ['post-fast-forward upstream mismatch', { postUpstream: 'origin/other' }],
    ['post-fast-forward remote mismatch', { remoteAfterMerge: 'c'.repeat(40) }],
  ])('fails closed without objective authority for %s', (_label, options) => {
    const git = runner(options)
    const result = recoverSetupBase({ cwd: '/repo', run: git.run, binding: binding() })
    expect(result.route).toBe('STOP')
    expect(result.nextAction.type).toBe('STOP')
    expect(result.reasons.length).toBeGreaterThan(0)
  })
})
