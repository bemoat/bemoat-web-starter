import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { routeContext } from '../../scripts/context/router.ts'
import { authorizeContextSync } from '../../scripts/context/sync.ts'
import type { NormalizedContextEvidence, PolicyEvidence, RoleEvidence } from '../../scripts/context/model.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

const repo = 'boat1994/bemoat-web-starter'
const oldBase = '89a88f21d73038ebff33a72600be9561e13239ed'
const liveBase = '22728c339722198cd937c7c6f1c0420dc06c1f81'
const postMergeBase = 'eccb36837c7e0c2fdda0aa2871999364507aa937'
const guideBlob = 'ecc49947022953ee87a82aefbc3b69888f70a59d'
const commandReferenceBlob = 'f7e23941bd16335994abbada14ed568dc09764ed'
const head = 'f8af039bad10c0bc3c98fa69fc2c7ab9fe782180'
const branch = 'test/513-stop-resolution-characterization'
const policyPath = 'docs/mission-control/mission-control-guide.md'
const policyId = 'bemoat-mission-control'
const policyVersion = '1.3.0'
const policySourceSha = 'ecc49947022953ee87a82aefbc3b69888f70a59d'
const issueUrl = `https://github.com/${repo}/issues/513`
const prUrl = `https://github.com/${repo}/pull/514`
const handoffUrl = `${issueUrl}#issuecomment-5913355141`
const legacyStopDescription = 'Stop production correction until a Founder/protocol decision defines a deterministic, identity-bound durable resolution record and conflict rules; then reconstruct fresh #513 Context for a separate bounded objective.'
const legacyStopDigest = 'edf8134ef9892ba7f8ada31365babb3b22bc7a085f480fa2a5a2ff99f8189ed7'

function stopHandoff(): RoleEvidence {
  const record: HandoffRecord = {
    schema_version: 3,
    record_type: 'HANDOFF',
    objective_mode: 'implementation',
    repository: repo,
    issue_number: '513',
    objective: 'Resolve the confirmed blocker for the bounded Issue #513 objective.',
    permitted_scope: ['Issue #513 / PR #514 only.'],
    prohibited_scope: ['Do not merge or broaden scope.'],
    executing_agent: 'Execution / IDE Agent',
    provider: 'OpenAI Codex',
    branch,
    exact_head: head,
    protected_base: { branch: 'main', sha: oldBase },
    pr: { number: '514', url: prUrl, base: 'main', head: branch, head_sha: head },
    verified_evidence: [{ kind: 'stop-blocker', value: 'confirmed-blocker', url: null }],
    route: 'STOP',
    next_action: { route: 'STOP', description: 'Resolve the confirmed blocker before continuing.' },
    stop_conditions: ['Stop on identity or durability drift.'],
    local_durability: { required: true, durable: true, reason: null },
  }
  return {
    id: '5913355141',
    body: renderHandoffComment(record),
    createdAt: '2026-09-01T00:00:00Z',
    url: handoffUrl,
  }
}

function resolution(overrides: { baseSha?: string; blockerId?: string; policySourceSha?: string; resolutionId?: string } = {}): RoleEvidence {
  const record = {
    schema_version: 1,
    record_type: 'BLOCKER_RESOLUTION',
    repository: repo,
    issue_number: '513',
    pr_number: '514',
    exact_head: head,
    protected_base: { branch: 'main', sha: overrides.baseSha ?? liveBase },
    policy: { path: policyPath, policy_id: policyId, version: policyVersion, source_sha: overrides.policySourceSha ?? liveBase },
    source_stop_handoff: { comment_id: '5913355141', url: handoffUrl },
    blocker_id: overrides.blockerId ?? 'confirmed-blocker',
    authority: { role: 'FOUNDER', login: 'boat1994' },
  }
  return {
    id: overrides.resolutionId ?? '6000000001',
    body: `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`,
    createdAt: '2026-09-02T00:00:00Z',
    url: `${issueUrl}#issuecomment-${overrides.resolutionId ?? '6000000001'}`,
    authorLogin: 'boat1994',
    authorAssociation: 'OWNER',
  }
}

function legacy513Evidence(): NormalizedContextEvidence {
  const sourceStop = {
    id: '5913355141',
    body: renderHandoffComment({
      schema_version: 2,
      record_type: 'HANDOFF',
      objective_mode: 'implementation',
      repository: repo,
      issue_number: '513',
      objective: 'Resolve the confirmed blocker for the bounded Issue #513 objective.',
      permitted_scope: ['Issue #513 / PR #514 only.'],
      prohibited_scope: ['Do not merge or broaden scope.'],
      executing_agent: 'Execution / IDE Agent',
      provider: 'OpenAI Codex',
      branch,
      exact_head: head,
      protected_base: { branch: 'main', sha: oldBase },
      pr: { number: '514', url: prUrl, base: 'main', head: branch, head_sha: head },
      verified_evidence: [{ kind: 'story-first-characterization', value: 'The Issue #513 STOP is characterized.', url: prUrl }],
      route: 'STOP',
      next_action: { route: 'STOP', description: legacyStopDescription },
      stop_conditions: ['Do not infer authority from prose.', 'Do not mutate history.'],
      local_durability: { required: true, durable: true, reason: null },
    }),
    createdAt: '2026-09-01T00:00:00Z',
    url: handoffUrl,
  }
  const currentPolicyResolution = resolution({
    blockerId: `legacy-stop:5913355141:${legacyStopDigest}`,
    policySourceSha,
    resolutionId: '5923392741',
  })
  return {
    ...evidence([currentPolicyResolution]),
    policy: {
      ...evidence().policy,
      sourceSha: policySourceSha,
      legacyStopHandoffs: [`513:5913355141:${head}:${legacyStopDigest}`],
    },
    durableContext: {
      ...evidence([currentPolicyResolution]).durableContext,
      latestHandoff: sourceStop,
      handoffs: [sourceStop],
    },
  }
}

function postMerge513Evidence(): NormalizedContextEvidence {
  const result = legacy513Evidence()
  result.protectedBase = { ...result.protectedBase, sha: postMergeBase }
  result.evidenceErrors = [`EVIDENCE_CONFLICT: PR #514 base does not match live protected main@${postMergeBase}`]
  return result
}

function rewriteResolution(comment: RoleEvidence, mutate: (record: Record<string, unknown>) => void): RoleEvidence {
  const match = comment.body.match(/^## BLOCKER_RESOLUTION\n\n```json\n([\s\S]+)\n```\n$/)
  if (!match) throw new Error('Expected a canonical BLOCKER_RESOLUTION fixture')
  const record = JSON.parse(match[1]!) as Record<string, unknown>
  mutate(record)
  return { ...comment, body: `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n` }
}

type HistoricalResolutionProof = {
  resolutionCommentId: string
  resolutionBodySha256: string
  repository: string
  historicalBase: { branch: string; sha: string }
  currentBase: { branch: string; sha: string }
  historicalPolicy: PolicyEvidence
  historicalContractBlobs: { missionControlGuideSha: string; commandReferenceSha: string }
  currentContractBlobs: { missionControlGuideSha: string; commandReferenceSha: string }
  ancestry: { status: 'ahead'; baseSha: string; currentSha: string; mergeBaseSha: string; aheadBy: number; behindBy: number }
}

type EvidenceWithHistoricalProof = NormalizedContextEvidence & {
  historicalBlockerResolutionProofs?: HistoricalResolutionProof[]
}

function historyProof(
  source: NormalizedContextEvidence,
  overrides: Partial<HistoricalResolutionProof> = {},
): HistoricalResolutionProof {
  const resolution = source.durableContext.blockerResolutions![0]!
  return {
    resolutionCommentId: String(resolution.id),
    resolutionBodySha256: createHash('sha256').update(resolution.body, 'utf8').digest('hex'),
    repository: repo,
    historicalBase: { branch: 'main', sha: liveBase },
    currentBase: { branch: 'main', sha: postMergeBase },
    historicalPolicy: { ...source.policy, sourceSha: policySourceSha },
    historicalContractBlobs: { missionControlGuideSha: guideBlob, commandReferenceSha: commandReferenceBlob },
    currentContractBlobs: { missionControlGuideSha: guideBlob, commandReferenceSha: commandReferenceBlob },
    ancestry: { status: 'ahead', baseSha: liveBase, currentSha: postMergeBase, mergeBaseSha: liveBase, aheadBy: 2, behindBy: 0 },
    ...overrides,
  }
}

function postMerge513EvidenceWithProof(proof = historyProof(legacy513Evidence())): EvidenceWithHistoricalProof {
  return { ...postMerge513Evidence(), historicalBlockerResolutionProofs: [proof] }
}

function movedEvidenceWithResolutionMutation(
  mutate: (record: Record<string, unknown>) => void,
  mutateComment?: (comment: RoleEvidence) => RoleEvidence,
): EvidenceWithHistoricalProof {
  const historical = legacy513Evidence()
  let resolutionComment = rewriteResolution(historical.durableContext.blockerResolutions![0]!, mutate)
  if (mutateComment) resolutionComment = mutateComment(resolutionComment)
  historical.durableContext.blockerResolutions = [resolutionComment]
  const moved = postMerge513EvidenceWithProof(historyProof(historical))
  moved.durableContext.blockerResolutions = [resolutionComment]
  return moved
}

function evidence(blockerResolutions: RoleEvidence[] = [resolution()]): NormalizedContextEvidence {
  return {
    repository: { owner: 'boat1994', name: 'bemoat-web-starter', nameWithOwner: repo, url: `https://github.com/${repo}` },
    protectedBase: { branch: 'main', sha: liveBase, source: 'live GitHub ref', url: `https://github.com/${repo}/tree/main` },
    policy: {
      path: policyPath,
      policyId,
      version: policyVersion,
      sourceSha: liveBase,
      trustedFounderLogin: 'boat1994',
      url: `https://github.com/${repo}/blob/main/${policyPath}`,
    },
    issue: {
      number: '513', title: 'stale-base continuation', state: 'OPEN', url: issueUrl,
      objective: 'Resolve the bounded blocker for Issue #513.', scope: 'Issue #513 / PR #514 only.',
      acceptanceCriteria: ['Keep exact identity and fail-closed checks.'], dependencies: [],
      taskSize: 'core', missionControlMode: 'required', workflowProfile: 'STANDARD',
    },
    localGit: {
      branch, head, upstream: `origin/${branch}`, originRepository: repo,
      clean: true, detached: false, pushed: true, durable: true, reasons: [],
    },
    activePr: {
      number: '514', state: 'OPEN', draft: false, url: prUrl,
      baseBranch: 'main', baseSha: oldBase, headBranch: branch, headSha: head,
      merged: false, mergeCommitSha: null,
    },
    currentHeadVerification: {
      exactHead: head,
      checks: { status: 'SUCCESS', complete: true, failed: false, pending: false, required: true },
      reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
      protection: { available: true, requiredChecks: [], requiredApprovals: 0 },
    },
    durableContext: {
      latestHandoff: stopHandoff(),
      handoffs: [stopHandoff()],
      historicalResults: [],
      blockerResolutions,
      invalidBlockerResolutions: [],
    },
    evidenceErrors: [`EVIDENCE_CONFLICT: PR #514 base does not match live protected main@${liveBase}`],
  }
}

describe('Issue #518 stale active PR base characterization', () => {
  it('keeps ordinary Context at STOP while identifying a well-formed same-branch old SHA as stale, not malformed', () => {
    const decision = routeContext(evidence())

    expect(decision.route).toBe('STOP')
    expect(decision.reasons.some((reason) => /PR #514 base identity is missing or malformed/.test(reason))).toBe(false)
    expect(decision.reasons.some((reason) => /PR #514 base does not match live protected main@/.test(reason))).toBe(true)
  })

  it('lets sync-base evaluate the current-base BLOCKER_RESOLUTION without rebinding policy evidence to the historical base', () => {
    expect(authorizeContextSync(evidence())).toMatchObject({ allowed: true, route: 'REVIEW' })
  })

  it('preserves live protected-base and policy identities while evaluating a legacy #513 STOP resolution', () => {
    const staleEvidence = legacy513Evidence()
    const before = structuredClone(staleEvidence)
    const result = authorizeContextSync(staleEvidence)
    expect(result).toMatchObject({ allowed: true, route: 'REVIEW' })
    expect(staleEvidence).toEqual(before)
  })

  it('keeps ordinary Context at STOP for a stale base when the collector marker is absent', () => {
    const staleEvidence = evidence()
    staleEvidence.evidenceErrors = []

    expect(routeContext(staleEvidence)).toMatchObject({ route: 'STOP' })
    expect(routeContext(staleEvidence).reasons.some((reason) => /PR #514 base does not match live protected main@/.test(reason))).toBe(true)
  })

  it('does not let sync-base waive an unrelated evidence error', () => {
    const staleEvidence = evidence()
    staleEvidence.evidenceErrors.push('BLOCKED_EXTERNAL: review evidence unavailable')

    expect(authorizeContextSync(staleEvidence)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('keeps sync-base fail-closed when a stale PR base SHA is malformed', () => {
    const staleEvidence = evidence()
    staleEvidence.activePr = { ...staleEvidence.activePr as NonNullable<NormalizedContextEvidence['activePr']>, baseSha: 'malformed' } as NormalizedContextEvidence['activePr']

    expect(authorizeContextSync(staleEvidence)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it.each([
    ['unresolved historical STOP', []],
    ['wrong current protected-base binding', [resolution({ baseSha: oldBase })]],
    ['wrong blocker binding', [resolution({ blockerId: 'another-blocker' })]],
    ['wrong policy source binding', [resolution({ policySourceSha: oldBase })]],
  ])('keeps sync-base fail-closed for %s', (_story, resolutions) => {
    expect(authorizeContextSync(evidence(resolutions))).toMatchObject({ allowed: false, route: 'STOP' })
  })
})

describe('Issue #520 protected-base advancement characterization', () => {
  it('keeps an exact-current-base resolution valid before protected-base advancement', () => {
    const evidence = legacy513Evidence()
    expect(routeContext(evidence).route).toBe('STOP')
    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: true, route: 'REVIEW' })
  })

  it('keeps the publication-time-valid #513 resolution at STOP after approved main advances', () => {
    const result = routeContext(postMerge513Evidence())
    expect(result.route).toBe('STOP')
    expect(authorizeContextSync(postMerge513Evidence())).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('keeps a resolution fail-closed when the relevant policy identity changes', () => {
    const changed = legacy513Evidence()
    changed.policy = { ...changed.policy, version: '1.4.0' }
    expect(authorizeContextSync(changed)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('does not carry a prior resolution to a changed PR head', () => {
    const changed = legacy513Evidence()
    const newHead = 'c'.repeat(40)
    changed.activePr = { ...changed.activePr!, headSha: newHead }
    changed.localGit = { ...changed.localGit, head: newHead }
    changed.currentHeadVerification = { ...changed.currentHeadVerification!, exactHead: newHead }
    const withHistoricalResolution = authorizeContextSync(changed)
    changed.durableContext.blockerResolutions = []
    expect(withHistoricalResolution).toEqual(authorizeContextSync(changed))
  })

  it.each([
    ['wrong repository', (record: Record<string, unknown>) => { record.repository = 'other/repository' }],
    ['wrong Issue', (record: Record<string, unknown>) => { record.issue_number = '999' }],
    ['wrong PR', (record: Record<string, unknown>) => { record.pr_number = '999' }],
    ['wrong blocker', (record: Record<string, unknown>) => { record.blocker_id = 'other-blocker' }],
  ])('keeps a resolution fail-closed with %s binding', (_story, mutate) => {
    const changed = legacy513Evidence()
    changed.durableContext.blockerResolutions = [rewriteResolution(changed.durableContext.blockerResolutions![0]!, mutate)]
    expect(authorizeContextSync(changed)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('does not legitimize a resolution whose recorded base was never the applicable current base', () => {
    const changed = legacy513Evidence()
    changed.durableContext.blockerResolutions = [rewriteResolution(changed.durableContext.blockerResolutions![0]!, (record) => {
      record.protected_base = { branch: 'main', sha: 'a'.repeat(40) }
    })]
    expect(authorizeContextSync(changed)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('does not let a valid resolution bypass independent failed current-head checks', () => {
    const changed = legacy513Evidence()
    changed.currentHeadVerification = {
      ...changed.currentHeadVerification!,
      checks: { status: 'FAILURE', complete: true, failed: true, pending: false, required: true },
    }
    expect(authorizeContextSync(changed)).toMatchObject({ allowed: true, route: 'FIX' })
  })
})

describe('Issue #520 Founder-approved historical resolution proof characterization', () => {
  it.each([
    ['otherwise-current REVIEW route', 'SUCCESS', 'REVIEW'],
    ['independent VERIFY route', 'PENDING', 'VERIFY'],
    ['independent FIX route', 'FAILURE', 'FIX'],
  ] as const)('allows sync authorization after proven B1→B2 movement for an %s', (_story, checkStatus, route) => {
    const evidence = postMerge513EvidenceWithProof()
    if (checkStatus === 'PENDING') {
      evidence.currentHeadVerification!.checks = { status: 'PENDING', complete: false, failed: false, pending: true, required: true }
    } else if (checkStatus === 'FAILURE') {
      evidence.currentHeadVerification!.checks = { status: 'FAILURE', complete: true, failed: true, pending: false, required: true }
    }
    expect(routeContext(evidence).route).toBe('STOP')
    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: true, route })
  })

  it.each([
    ['wrong historical resolution repository', (record: Record<string, unknown>) => { record.repository = 'other/repository' }],
    ['wrong historical resolution Issue', (record: Record<string, unknown>) => { record.issue_number = '999' }],
    ['wrong historical resolution PR', (record: Record<string, unknown>) => { record.pr_number = '999' }],
    ['wrong historical resolution exact head', (record: Record<string, unknown>) => { record.exact_head = '8'.repeat(40) }],
    ['wrong historical resolution source STOP', (record: Record<string, unknown>) => {
      record.source_stop_handoff = { comment_id: '9999999999', url: `${issueUrl}#issuecomment-9999999999` }
    }],
    ['wrong historical resolution blocker', (record: Record<string, unknown>) => { record.blocker_id = 'other-blocker' }],
    ['wrong declared Founder login', (record: Record<string, unknown>) => { record.authority = { role: 'FOUNDER', login: 'other-founder' } }],
  ])('does not carry forward %s when its exact body digest is recomputed', (_story, mutate) => {
    const evidence = movedEvidenceWithResolutionMutation(mutate)
    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('keeps a native Founder author mismatch fail-closed even with a matching body proof', () => {
    const evidence = movedEvidenceWithResolutionMutation(() => {}, (comment) => ({ ...comment, authorLogin: 'other-founder' }))
    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('keeps duplicate historical proof entries fail-closed', () => {
    const evidence = postMerge513EvidenceWithProof()
    evidence.historicalBlockerResolutionProofs = [
      ...evidence.historicalBlockerResolutionProofs!,
      evidence.historicalBlockerResolutionProofs![0]!,
    ]
    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it.each([
    ['both command-reference blob identities missing', (proof: HistoricalResolutionProof) => {
      Reflect.deleteProperty(proof.historicalContractBlobs, 'commandReferenceSha')
      Reflect.deleteProperty(proof.currentContractBlobs, 'commandReferenceSha')
    }],
    ['both command-reference blob identities malformed', (proof: HistoricalResolutionProof) => {
      proof.historicalContractBlobs.commandReferenceSha = 'malformed'
      proof.currentContractBlobs.commandReferenceSha = 'malformed'
    }],
    ['historical policy missing', (proof: HistoricalResolutionProof) => {
      Reflect.deleteProperty(proof, 'historicalPolicy')
    }],
  ])('keeps malformed historical proof fail-closed: %s', (_story, mutate) => {
    const candidate = postMerge513EvidenceWithProof()
    mutate(candidate.historicalBlockerResolutionProofs![0]!)
    expect(() => authorizeContextSync(candidate)).not.toThrow()
    expect(authorizeContextSync(candidate)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('keeps competing historical resolution records fail-closed when each has a matching proof', () => {
    const historical = legacy513Evidence()
    const first = historical.durableContext.blockerResolutions![0]!
    const secondId = '6000000002'
    const second = {
      ...rewriteResolution(first, (record) => { record.blocker_id = 'competing-blocker' }),
      id: secondId,
      url: `${issueUrl}#issuecomment-${secondId}`,
    }
    historical.durableContext.blockerResolutions = [first, second]
    const secondHistoricalEvidence = { ...historical, durableContext: { ...historical.durableContext, blockerResolutions: [second] } }
    const moved = postMerge513EvidenceWithProof(historyProof(historical))
    moved.durableContext.blockerResolutions = [first, second]
    moved.historicalBlockerResolutionProofs = [historyProof(historical), historyProof(secondHistoricalEvidence)]
    expect(authorizeContextSync(moved)).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('does not mutate transient proof or durable evidence during route evaluation', () => {
    const evidence = postMerge513EvidenceWithProof()
    const before = structuredClone(evidence)
    authorizeContextSync(evidence)
    expect(evidence).toEqual(before)
  })

  it.each([
    ['no proof', null],
    ['changed guide blob', { currentContractBlobs: { missionControlGuideSha: '1'.repeat(40), commandReferenceSha: commandReferenceBlob } }],
    ['changed command-reference blob', { currentContractBlobs: { missionControlGuideSha: guideBlob, commandReferenceSha: '2'.repeat(40) } }],
    ['wrong historical policy source', { historicalPolicy: { ...legacy513Evidence().policy, sourceSha: '3'.repeat(40) } }],
    ['wrong historical policy identity', { historicalPolicy: { ...legacy513Evidence().policy, version: '9.9.9' } }],
    ['wrong current base identity', { currentBase: { branch: 'main', sha: '4'.repeat(40) } }],
    ['wrong historical base identity', { historicalBase: { branch: 'main', sha: '5'.repeat(40) } }],
    ['wrong repository identity', { repository: 'other/repository' }],
    ['wrong resolution comment ID', { resolutionCommentId: '9999999999' }],
    ['wrong resolution byte digest', { resolutionBodySha256: '6'.repeat(64) }],
    ['ancestry unavailable', { ancestry: { status: 'unavailable', baseSha: liveBase, currentSha: postMergeBase, mergeBaseSha: '', aheadBy: 0, behindBy: 0 } }],
    ['diverged ancestry', { ancestry: { status: 'diverged', baseSha: liveBase, currentSha: postMergeBase, mergeBaseSha: '7'.repeat(40), aheadBy: 2, behindBy: 1 } }],
  ] as const)('fails closed for %s', (_story, override) => {
    const current = legacy513Evidence()
    const candidate = postMerge513EvidenceWithProof(
      override === null ? historyProof(current) : historyProof(current, override as Partial<HistoricalResolutionProof>),
    )
    if (_story === 'no proof') candidate.historicalBlockerResolutionProofs = undefined
    expect(authorizeContextSync(candidate)).toMatchObject({ allowed: false, route: 'STOP' })
  })
})
