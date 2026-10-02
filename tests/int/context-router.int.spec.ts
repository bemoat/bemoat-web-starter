import { describe, expect, it } from 'vitest'

import { routeContext } from '../../scripts/context/router.ts'
import { authorizeContextSync } from '../../scripts/context/sync.ts'
import { parseRoleEvidence } from '../../scripts/context/issue-parser.ts'
import type { NativeReviewEvidence, NormalizedContextEvidence } from '../../scripts/context/model.ts'
import {
  classifyMergeReviewVerdict,
  parseProductionMergeReviewVerdict,
  resolveMergeReviewVerdictBinding,
} from '../../scripts/context/merge-review-verdict.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

const sha = 'a'.repeat(40)
const headSha = 'b'.repeat(40)

function baseEvidence(
  overrides: Partial<NormalizedContextEvidence> = {},
): NormalizedContextEvidence {
  return {
    repository: {
      owner: 'boat1994',
      name: 'bemoat-web-starter',
      nameWithOwner: 'boat1994/bemoat-web-starter',
      url: 'https://github.com/boat1994/bemoat-web-starter',
    },
    protectedBase: {
      branch: 'main',
      sha,
      source: 'live GitHub ref',
      url: 'https://github.com/boat1994/bemoat-web-starter/tree/main',
    },
    policy: {
      path: 'docs/mission-control/mission-control-guide.md',
      policyId: 'bemoat-mission-control',
      version: '1.3.0',
      sourceSha: sha,
      trustedFounderLogin: 'boat1994',
      legacyStopHandoffs: [
        '513:5913355141:f8af039bad10c0bc3c98fa69fc2c7ab9fe782180:edf8134ef9892ba7f8ada31365babb3b22bc7a085f480fa2a5a2ff99f8189ed7',
        '509:5906598686:86c0ec49311a1b356ff96be087bb335ea6dc992f:3bffd4a681a4ac1d2c5db5ddc375713565a5905c4886c9c5082eea8b250d8dd2',
      ],
      url: 'https://github.com/boat1994/bemoat-web-starter/blob/main/docs/mission-control/mission-control-guide.md',
    },
    issue: {
      number: '410',
      title: 'context protocol',
      state: 'OPEN',
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/410',
      objective: 'Implement context.',
      scope: 'Context only.',
      acceptanceCriteria: ['The command is read-only.'],
      dependencies: [],
      taskSize: 'core',
      missionControlMode: 'optional',
      workflowProfile: 'STANDARD',
    },
    localGit: {
      branch: 'feature/410-context',
      head: headSha,
      upstream: 'origin/feature/410-context',
      originRepository: 'boat1994/bemoat-web-starter',
      clean: true,
      detached: false,
      pushed: true,
      durable: true,
      reasons: [],
    },
    activePr: null,
    currentHeadVerification: null,
    durableContext: {
      latestHandoff: null,
      historicalResults: [],
    },
    evidenceErrors: [],
    ...overrides,
  }
}

function prEvidence(overrides: Record<string, unknown> = {}) {
  return {
    number: '411',
    state: 'OPEN',
    draft: false,
    url: 'https://github.com/boat1994/bemoat-web-starter/pull/411',
    baseBranch: 'main',
    baseSha: sha,
    headBranch: 'feature/410-context',
    headSha,
    merged: false,
    mergeCommitSha: null as string | null,
    ...overrides,
  }
}

function verification(overrides: Record<string, unknown> = {}) {
  return {
    exactHead: headSha,
    checks: {
      status: 'SUCCESS',
      complete: true,
      failed: false,
      pending: false,
      required: true,
    },
    reviews: {
      required: true,
      approved: false,
      exactHead: false,
      approvedCount: 0,
      exactHeadApprovedCount: 0,
    },
    protection: {
      available: true,
      requiredChecks: ['CI'],
      requiredApprovals: 1,
    },
    ...overrides,
  }
}

function nativeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 200,
    url: `https://github.com/boat1994/bemoat-web-starter/pull/411#pullrequestreview-${String(overrides.id ?? 200)}`,
    state: 'COMMENTED',
    commitId: headSha,
    body: `## REVIEW_VERDICT
**Repository:** \`boat1994/bemoat-web-starter\`
**Task / Issue:** #410
**PR / base / head:** PR #411 · \`main\` · \`${headSha}\`
**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
    ...overrides,
  }
}

function nativeBlockingReview(overrides: Record<string, unknown> = {}) {
  return nativeReview({
    body: `## REVIEW_VERDICT
**Repository:** \`boat1994/bemoat-web-starter\`
**Task / Issue:** #410
**PR / base / head:** PR #411 · \`main\` · \`${headSha}\`
**Verdict:** CORRECTION REQUIRED

### Immutable finding disposition
\`\`\`json
{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${headSha}", "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "source_thread": "https://github.com/boat1994/bemoat-web-starter/pull/411#discussion_r1", "required_evidence": ["Evidence"] }] }
\`\`\``,
    ...overrides,
  })
}

function strictHandoff(overrides: Partial<HandoffRecord> = {}) {
  const record: HandoffRecord = {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'implementation',
    repository: 'boat1994/bemoat-web-starter',
    issue_number: '410',
    objective: 'Apply the bounded current-head semantic review correction.',
    permitted_scope: ['Context routing evidence.'],
    prohibited_scope: ['Do not merge or broaden the objective.'],
    executing_agent: 'Independent reviewer',
    provider: 'OpenAI Codex',
    branch: 'feature/410-context',
    exact_head: headSha,
    protected_base: { branch: 'main', sha },
    pr: {
      number: '411',
      url: 'https://github.com/boat1994/bemoat-web-starter/pull/411',
      base: 'main',
      head: 'feature/410-context',
      head_sha: headSha,
    },
    verified_evidence: [{
      kind: 'review-verdict',
      value: 'Independent exact-head semantic review found one Important viewport defect: the bounded implementation requires correction.',
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-950',
    }],
    route: 'FIX',
    next_action: { route: 'FIX', description: 'Apply the bounded correction.' },
    stop_conditions: ['Stop on identity or exact-head drift.'],
    local_durability: { required: true, durable: true, reason: null },
    ...overrides,
  }
  return {
    id: 900,
    body: renderHandoffComment(record),
    createdAt: '2026-08-02T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-900',
  }
}

function stopHandoff(blockerIds: string[] = ['named-blocker']) {
  return strictHandoff({
    route: 'STOP',
    verified_evidence: blockerIds.map((value): HandoffRecord['verified_evidence'][number] => ({ kind: 'stop-blocker', value, url: null })),
    next_action: { route: 'STOP', description: 'Resolve the named blocker.' },
  })
}

function blockerResolutionComment(
  stop: ReturnType<typeof strictHandoff>,
  blockerId = 'named-blocker',
  overrides: {
    mutate?: (record: Record<string, unknown>) => void
    id?: number
    authorLogin?: string | null
    authorAssociation?: string | null
    nestedAuthorLogin?: string | null
    createdAt?: string
  } = {},
) {
  const handoffMatch = stop.body.match(/```json\n([\s\S]+)\n```\n$/)
  if (!handoffMatch) throw new Error('Expected a strict HANDOFF JSON body')
  const handoffRecord = JSON.parse(handoffMatch[1]!) as HandoffRecord
  if (!handoffRecord.pr) throw new Error('Expected an active PR in the STOP HANDOFF')
  const record: Record<string, unknown> = {
    schema_version: 1,
    record_type: 'BLOCKER_RESOLUTION',
    repository: handoffRecord.repository,
    issue_number: handoffRecord.issue_number,
    pr_number: handoffRecord.pr.number,
    exact_head: handoffRecord.exact_head,
    protected_base: handoffRecord.protected_base,
    policy: {
      path: 'docs/mission-control/mission-control-guide.md',
      policy_id: 'bemoat-mission-control',
      version: '1.3.0',
      source_sha: sha,
    },
    source_stop_handoff: { comment_id: String(stop.id), url: stop.url },
    blocker_id: blockerId,
    authority: { role: 'FOUNDER', login: 'boat1994' },
  }
  overrides.mutate?.(record)
  const body = `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
  return {
    id: overrides.id ?? 901,
    body,
    createdAt: overrides.createdAt ?? '2026-08-03T00:00:00Z',
    url: `https://github.com/${handoffRecord.repository}/issues/${handoffRecord.issue_number}#issuecomment-${overrides.id ?? 901}`,
    authorLogin: overrides.authorLogin === undefined ? 'boat1994' : overrides.authorLogin,
    authorAssociation: overrides.authorAssociation === undefined ? 'OWNER' : overrides.authorAssociation,
    ...(overrides.nestedAuthorLogin !== undefined ? { author: { login: overrides.nestedAuthorLogin } } : {}),
  }
}

function routeWithStop(
  handoff: ReturnType<typeof strictHandoff>,
  comments: Array<Record<string, unknown>> = [],
  overrides: Partial<NormalizedContextEvidence> = {},
) {
  const handoffMatch = handoff.body.match(/```json\n([\s\S]+)\n```\n$/)
  if (!handoffMatch) throw new Error('Expected a strict HANDOFF JSON body')
  const handoffRecord = JSON.parse(handoffMatch[1]!) as HandoffRecord
  if (!handoffRecord.pr) throw new Error('Expected an active PR in the STOP HANDOFF')
  const parsed = parseRoleEvidence([handoff, ...comments])
  return routeContext(baseEvidence({
    repository: {
      owner: handoffRecord.repository.split('/')[0]!,
      name: handoffRecord.repository.split('/')[1]!,
      nameWithOwner: handoffRecord.repository,
      url: `https://github.com/${handoffRecord.repository}`,
    },
    protectedBase: { branch: handoffRecord.protected_base.branch, sha: handoffRecord.protected_base.sha, source: 'test',
      url: `https://github.com/${handoffRecord.repository}/tree/${handoffRecord.protected_base.branch}` },
    issue: {
      ...baseEvidence().issue,
      number: handoffRecord.issue_number,
      url: `https://github.com/${handoffRecord.repository}/issues/${handoffRecord.issue_number}`,
    },
    localGit: {
      ...baseEvidence().localGit,
      branch: handoffRecord.branch,
      head: handoffRecord.exact_head,
    },
    activePr: prEvidence({
      number: handoffRecord.pr.number,
      url: handoffRecord.pr.url,
      baseBranch: handoffRecord.pr.base,
      baseSha: handoffRecord.protected_base.sha,
      headBranch: handoffRecord.pr.head,
      headSha: handoffRecord.pr.head_sha,
    }),
    currentHeadVerification: verification({
      exactHead: handoffRecord.exact_head,
      reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
    }),
    durableContext: {
      latestHandoff: handoff,
      handoffs: [handoff],
      historicalResults: parsed.historicalResults,
      blockerResolutions: parsed.blockerResolutions,
      invalidBlockerResolutions: parsed.invalidBlockerResolutions,
    },
    ...overrides,
  }))
}

function reviewHandoff(overrides: Partial<HandoffRecord> = {}) {
  return strictHandoff({
    route: 'REVIEW',
    next_action: { route: 'REVIEW', description: 'Obtain independent exact-head semantic review.' },
    verified_evidence: [{ kind: 'focused-tests', value: 'Focused tests passed.', url: null }],
    ...overrides,
  })
}

function founderGateHandoff(overrides: Partial<HandoffRecord> = {}) {
  return strictHandoff({
    route: 'FOUNDER_GATE',
    next_action: { route: 'FOUNDER_GATE', description: 'Founder reviews the independent exact-head verdict.' },
    verified_evidence: [{
      kind: 'review-verdict',
      value: 'Independent exact-head review is eligible for Founder review.',
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-951',
    }],
    ...overrides,
  })
}

function mutateHandoffIdentity(
  handoff: ReturnType<typeof strictHandoff>,
  mutate: (payload: Record<string, unknown>) => void,
) {
  const match = handoff.body.match(/```json\n([\s\S]+)\n```\n$/)
  if (!match) throw new Error('Expected canonical HANDOFF JSON envelope')
  const payload = JSON.parse(match[1]!) as Record<string, unknown>
  mutate(payload)
  return {
    ...handoff,
    body: `## HANDOFF\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`,
  }
}

function handoffIdentityObject(payload: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = payload[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected HANDOFF ${key} object`)
  }
  return value as Record<string, unknown>
}
function handoffReadyDecision(
  latestHandoff: ReturnType<typeof strictHandoff>,
  options: {
    handoffs?: Array<ReturnType<typeof strictHandoff>>
    historicalResults?: Array<{
      id: string | number
      body: string
      createdAt: string
      url: string
    }>
  } = {},
) {
  const exactHeadReview = { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 }
  return routeContext(baseEvidence({
    activePr: prEvidence(),
    currentHeadVerification: verification({ reviews: exactHeadReview }),
    durableContext: {
      latestHandoff,
      handoffs: options.handoffs ?? [latestHandoff],
      historicalResults: options.historicalResults ?? [handoffReviewVerdict()],
    },
  }))
}

describe('bemoat:context pure routing', () => {
  const validVerdict = {
    id: 100,
    body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Task:** Issue #410\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #411 · \`main\` · \`${headSha}\``,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-100',
  }
  const correctionVerdict = {
    id: 101,
    body: `## REVIEW_VERDICT\n**Verdict:** CORRECTION REQUIRED\n**PR / base / head:** PR #411 · \`main\` · \`${headSha}\``,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-101',
  }
  const staleVerdict = {
    id: 102,
    body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Task:** Issue #410\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #411 · \`main\` · \`c${'c'.repeat(39)}\``,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-102',
  }
  const malformedVerdict = {
    id: 103,
    body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-103',
  }
  const wrongIssueVerdict = {
    id: 104,
    body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**PR / base / head:** PR #999 · \`main\` · \`${headSha}\``,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-104',
  }
  const wrongBaseVerdict = {
    id: 105,
    body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Task:** Issue #410\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #411 · \`wrongbase\` · \`${headSha}\``,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-105',
  }

  const genuineWrongIssueVerdict = {
    id: 106,
    body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Task:** Issue #999\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #411 · \`main\` · \`${headSha}\``,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-106',
  }

  const genuineWrongRepoVerdict = {
    id: 107,
    body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Task:** Issue #410\n**Repository:** \`other/repository\`\n**PR / base / head:** PR #411 · \`main\` · \`${headSha}\``,
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-107',
  }

  it('routes a valid current-head blocking HANDOFF FIX to FIX', () => {
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({
        reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
      }),
      durableContext: { latestHandoff: strictHandoff(), historicalResults: [handoffReviewVerdict()] },
    }))

    expect(decision.route).toBe('FIX')
  })

  it('keeps an unresolved current-head HANDOFF STOP fail-closed', () => {
    const handoff = strictHandoff({
      route: 'STOP',
      next_action: { route: 'STOP', description: 'Resolve the current evidence blocker.' },
    })
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({
        reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
      }),
      durableContext: { latestHandoff: handoff, historicalResults: [] },
    }))

    expect(decision.route).toBe('STOP')
  })

  it('re-evaluates a current-head STOP after one exact Founder resolution record', () => {
    const handoff = stopHandoff()
    const resolutionComment = blockerResolutionComment(handoff)
    const decision = routeWithStop(handoff, [resolutionComment])

    expect(decision.route).toBe('REVIEW')
  })

  it('re-evaluates a schema-v3 STOP only through its explicit blocker ID', () => {
    const handoff = strictHandoff({
      schema_version: 3,
      route: 'STOP',
      verified_evidence: [{ kind: 'stop-blocker', value: 'new-protocol-blocker', url: null }],
      next_action: { route: 'STOP', description: 'Resolve the new protocol blocker.' },
    })
    expect(routeWithStop(handoff, [blockerResolutionComment(handoff, 'new-protocol-blocker')]).route).toBe('REVIEW')
  })

  it('does not treat a newly appended schema-v2 prose-only STOP as historical', () => {
    const handoff = strictHandoff({
      route: 'STOP',
      verified_evidence: [{ kind: 'diagnostic', value: 'new STOP with no blocker ID', url: null }],
      next_action: { route: 'STOP', description: 'Resolve all newly identified blockers.' },
    })
    const resolution = blockerResolutionComment(handoff, 'legacy-stop:900:64c3b71ef6154c417afd241dc39efd33ddf38be8dc60294c2a9cc64bcff1def9')
    expect(routeWithStop(handoff, [resolution]).route).toBe('STOP')
  })

  it.each([
    ['repository', (record: Record<string, unknown>) => { record.repository = 'other/repository' }],
    ['Issue', (record: Record<string, unknown>) => { record.issue_number = '999' }],
    ['PR', (record: Record<string, unknown>) => { record.pr_number = '999' }],
    ['exact head', (record: Record<string, unknown>) => { record.exact_head = 'c'.repeat(40) }],
    ['protected base', (record: Record<string, unknown>) => { (record.protected_base as Record<string, unknown>).sha = 'd'.repeat(40) }],
    ['protected base branch', (record: Record<string, unknown>) => { (record.protected_base as Record<string, unknown>).branch = 'release' }],
    ['policy path', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).path = 'other-policy.md' }],
    ['policy identity', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).policy_id = 'other-policy' }],
    ['policy version', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).version = '9.9.9' }],
    ['policy source', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).source_sha = 'e'.repeat(40) }],
    ['source HANDOFF', (record: Record<string, unknown>) => { (record.source_stop_handoff as Record<string, unknown>).comment_id = '902' }],
    ['source HANDOFF URL', (record: Record<string, unknown>) => { (record.source_stop_handoff as Record<string, unknown>).url = 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-902' }],
    ['blocker', (record: Record<string, unknown>) => { record.blocker_id = 'different-blocker' }],
  ])('keeps a STOP when resolution has a wrong %s binding', (_field, mutate) => {
    const handoff = stopHandoff()
    const resolution = blockerResolutionComment(handoff, 'named-blocker', { mutate })
    expect(routeWithStop(handoff, [resolution]).route).toBe('STOP')
  })

  it('ignores unrelated Founder prose when resolving a STOP', () => {
    const handoff = stopHandoff()
    const prose = {
      id: 902,
      body: '## FOUNDER_DECISION\n\nThe old STOP may proceed after this protocol decision.',
      createdAt: '2026-08-04T00:00:00Z',
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-902',
      authorLogin: 'boat1994',
      authorAssociation: 'OWNER',
    }
    expect(routeWithStop(handoff, [prose]).route).toBe('STOP')
  })

  it('keeps a STOP for duplicate or competing resolution records regardless of comment order', () => {
    const handoff = stopHandoff()
    const first = blockerResolutionComment(handoff, 'named-blocker', { createdAt: '2026-08-01T00:00:00Z' })
    const second = { ...blockerResolutionComment(handoff, 'named-blocker', { createdAt: '2026-08-05T00:00:00Z' }), id: 903,
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-903' }
    const prose = { id: 904, body: '## FOUNDER_DECISION\n\nIgnore ordering.', createdAt: '2026-08-03T00:00:00Z',
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-904', authorLogin: 'boat1994', authorAssociation: 'OWNER' }
    expect(routeWithStop(handoff, [first, prose, second]).route).toBe('STOP')
    expect(routeWithStop(handoff, [second, prose, first]).route).toBe('STOP')
  })

  it('fails closed for malformed resolution records and duplicate blocker identities', () => {
    const handoff = stopHandoff()
    const malformed = { ...blockerResolutionComment(handoff), body: '## BLOCKER_RESOLUTION\n\n```json\n{}\n```\n' }
    expect(routeWithStop(handoff, [malformed]).route).toBe('STOP')
    expect(routeWithStop(stopHandoff(['same-id', 'same-id'])).route).toBe('STOP')
  })

  it('requires independent resolutions for every explicitly named STOP blocker', () => {
    const handoff = stopHandoff(['first-blocker', 'second-blocker'])
    expect(routeWithStop(handoff, [blockerResolutionComment(handoff, 'first-blocker')]).route).toBe('STOP')
    expect(routeWithStop(handoff, [
      blockerResolutionComment(handoff, 'first-blocker'),
      { ...blockerResolutionComment(handoff, 'second-blocker'), id: 905,
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-905' },
    ]).route).toBe('REVIEW')
  })

  it('does not let a resolution grant a route that current checks do not grant', () => {
    const handoff = stopHandoff()
    const pending = routeWithStop(handoff, [blockerResolutionComment(handoff)], {
      currentHeadVerification: verification({ checks: { status: 'PENDING', complete: false, failed: false, pending: true, required: true } }),
    })
    const failed = routeWithStop(handoff, [blockerResolutionComment(handoff)], {
      currentHeadVerification: verification({ checks: { status: 'FAILURE', complete: true, failed: true, pending: false, required: true } }),
    })
    expect(pending.route).toBe('VERIFY')
    expect(failed.route).toBe('FIX')
  })

  it('requires explicit Founder authority to match the native OWNER comment author', () => {
    const handoff = stopHandoff()
    const spoofed = blockerResolutionComment(handoff, 'named-blocker', { authorLogin: 'someone-else' })
    const nonOwner = blockerResolutionComment(handoff, 'named-blocker', { authorAssociation: 'MEMBER' })
    const conflicting = blockerResolutionComment(handoff, 'named-blocker', { nestedAuthorLogin: 'someone-else' })
    const wrongRole = blockerResolutionComment(handoff, 'named-blocker', {
      mutate: (record) => { record.authority = { role: 'OWNER', login: 'boat1994' } },
    })
    const missingNativeAuthor = blockerResolutionComment(handoff, 'named-blocker', { authorLogin: null })
    const otherOwner = blockerResolutionComment(handoff, 'named-blocker', {
      authorLogin: 'another-owner',
      mutate: (record) => { record.authority = { role: 'FOUNDER', login: 'another-owner' } },
    })
    expect(routeWithStop(handoff, [spoofed]).route).toBe('STOP')
    expect(routeWithStop(handoff, [nonOwner]).route).toBe('STOP')
    expect(routeWithStop(handoff, [conflicting]).route).toBe('STOP')
    expect(routeWithStop(handoff, [wrongRole]).route).toBe('STOP')
    expect(routeWithStop(handoff, [missingNativeAuthor]).route).toBe('STOP')
    expect(routeWithStop(handoff, [otherOwner]).route).toBe('STOP')
  })

  it('fails closed when protected policy lacks a trusted Founder login', () => {
    const handoff = stopHandoff()
    const evidence = baseEvidence()
    expect(routeWithStop(handoff, [blockerResolutionComment(handoff)], {
      policy: { ...evidence.policy, trustedFounderLogin: null },
    }).route).toBe('STOP')
  })

  it('does not use resolution timestamp order to select authority', () => {
    const handoff = stopHandoff()
    const earlyResolution = blockerResolutionComment(handoff, 'named-blocker', { createdAt: '1994-01-01T00:00:00Z' })
    expect(routeWithStop(handoff, [earlyResolution]).route).toBe('REVIEW')
  })

  it('keeps the original STOP HANDOFF immutable while its named blocker is resolved', () => {
    const handoff = stopHandoff()
    const originalBody = handoff.body
    expect(routeWithStop(handoff, [blockerResolutionComment(handoff)]).route).toBe('REVIEW')
    expect(handoff.body).toBe(originalBody)
  })

  it('resolves the single legacy #513 blocker from next_action.description, not stop-condition guardrails', () => {
    const description = 'Stop production correction until a Founder/protocol decision defines a deterministic, identity-bound durable resolution record and conflict rules; then reconstruct fresh #513 Context for a separate bounded objective.'
    const handoff = {
      ...strictHandoff({
        issue_number: '513',
        branch: 'test/513-stop-resolution-characterization',
        exact_head: 'f8af039bad10c0bc3c98fa69fc2c7ab9fe782180',
        protected_base: { branch: 'main', sha: '89a88f21d73038ebff33a72600be9561e13239ed' },
        pr: {
          number: '514',
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/514',
          base: 'main',
          head: 'test/513-stop-resolution-characterization',
          head_sha: 'f8af039bad10c0bc3c98fa69fc2c7ab9fe782180',
        },
        route: 'STOP',
        verified_evidence: [{ kind: 'story-first-characterization', value: 'The #513 stop is characterized.', url: 'https://github.com/boat1994/bemoat-web-starter/pull/514' }],
        next_action: { route: 'STOP', description },
        stop_conditions: ['Do not infer authority from prose', 'Do not mutate history', 'Do not merge autonomously'],
      }),
      id: 5913355141,
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/513#issuecomment-5913355141',
    }
    const resolution = blockerResolutionComment(handoff, 'legacy-stop:5913355141:edf8134ef9892ba7f8ada31365babb3b22bc7a085f480fa2a5a2ff99f8189ed7', { id: 5913459163 })
    const founderProtocolDecision = {
      id: 5913459162,
      body: '## FOUNDER_DECISION — BLOCKER_RESOLUTION protocol contract\n\nThe Founder approves the structured contract.',
      createdAt: '2026-09-30T14:35:47Z',
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/513#issuecomment-5913459162',
      authorLogin: 'boat1994',
      authorAssociation: 'OWNER',
    }

    expect(routeWithStop(handoff, [founderProtocolDecision, resolution]).route).toBe('REVIEW')
  })

  it('recovers the #509-shaped exact-head STOP only from a separate structured resolution', () => {
    const description = 'Stop production correction until architecture/Founder authority defines deterministic historical native-review migration; then reconstruct fresh #509 Context for a separate bounded objective.'
    const handoff = {
      ...strictHandoff({
        issue_number: '509',
        branch: 'test/509-legacy-fix-lineage-characterization',
        exact_head: '86c0ec49311a1b356ff96be087bb335ea6dc992f',
        protected_base: { branch: 'main', sha: '89a88f21d73038ebff33a72600be9561e13239ed' },
        pr: {
          number: '511',
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/511',
          base: 'main',
          head: 'test/509-legacy-fix-lineage-characterization',
          head_sha: '86c0ec49311a1b356ff96be087bb335ea6dc992f',
        },
        route: 'STOP',
        verified_evidence: [{ kind: 'story-first-characterization', value: 'The #509 exact-head STOP is characterized.', url: 'https://github.com/boat1994/bemoat-web-starter/pull/511' }],
        next_action: { route: 'STOP', description },
        stop_conditions: ['Do not mutate real #504 or PR #505', 'Do not merge autonomously'],
      }),
      id: 5906598686,
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/509#issuecomment-5906598686',
    }
    const founderDecision = {
      id: 5907706574,
      body: '## FOUNDER_DECISION — legacy review migration semantics\n\nThis protocol decision does not itself resolve a STOP.',
      createdAt: '2026-09-30T08:53:39Z',
      url: 'https://github.com/boat1994/bemoat-web-starter/issues/509#issuecomment-5907706574',
      authorLogin: 'boat1994',
      authorAssociation: 'OWNER',
    }
    const legacyBlocker = 'legacy-stop:5906598686:3bffd4a681a4ac1d2c5db5ddc375713565a5905c4886c9c5082eea8b250d8dd2'
    const resolution = blockerResolutionComment(handoff, legacyBlocker, { id: 5907706575 })

    expect(routeWithStop(handoff, [founderDecision]).route).toBe('STOP')
    expect(routeWithStop(handoff, [resolution, founderDecision]).route).toBe('REVIEW')
  })

  it('re-evaluates a historical stale-head HANDOFF STOP against current evidence', () => {
    const historicalStop = strictHandoff({
      exact_head: 'c'.repeat(40),
      pr: {
        number: '411',
        url: 'https://github.com/boat1994/bemoat-web-starter/pull/411',
        base: 'main',
        head: 'feature/410-context',
        head_sha: 'c'.repeat(40),
      },
      route: 'STOP',
      next_action: { route: 'STOP', description: 'Resolve the historical blocker.' },
    })
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({
        reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
      }),
      durableContext: { latestHandoff: historicalStop, historicalResults: [validVerdict] },
    }))

    expect(decision.route).toBe('FOUNDER_GATE')
  })

  it.each<[string, Partial<HandoffRecord>]>([
    ['wrong repository', { repository: 'other/repository' }],
    ['wrong Issue', { issue_number: '999' }],
    ['wrong PR', { pr: { number: '999', url: 'https://github.com/boat1994/bemoat-web-starter/pull/999', base: 'main', head: 'feature/410-context', head_sha: headSha } }],
    ['wrong base', { protected_base: { branch: 'dev', sha } }],
    ['wrong head', { exact_head: 'c'.repeat(40), pr: { number: '411', url: 'https://github.com/boat1994/bemoat-web-starter/pull/411', base: 'main', head: 'feature/410-context', head_sha: 'c'.repeat(40) } }],
  ])('does not let a %s HANDOFF control the current route', (_story, overrides) => {
    expect(handoffReadyDecision(strictHandoff(overrides), { historicalResults: [] }).route).toBe('REVIEW')
  })

  it('fails closed for a malformed current-head HANDOFF even with valid review evidence', () => {
    const handoff = strictHandoff()
    const malformed = {
      ...handoff,
      body: handoff.body.replace('"route": "FIX"', '"route": "BROKEN"'),
    }

    expect(handoffReadyDecision(malformed, { historicalResults: [validVerdict] }).route).toBe('STOP')
  })

  it('ignores a malformed stale or wrong-identity HANDOFF during current routing', () => {
    const handoff = strictHandoff({ repository: 'other/repository' })
    const malformed = {
      ...handoff,
      body: handoff.body.replace('"route": "FIX"', '"route": "BROKEN"'),
    }

    expect(handoffReadyDecision(malformed, { historicalResults: [validVerdict] }).route).toBe('FOUNDER_GATE')
  })

  describe('malformed identity on an otherwise current HANDOFF', () => {
    const malformedIdentityCases: Array<[string, (payload: Record<string, unknown>) => void]> = [
      ['empty repository', (payload) => { payload.repository = '' }],
      ['noncanonical same-repository casing', (payload) => { payload.repository = 'Boat1994/Bemoat-Web-Starter' }],
      ['non-string Issue number', (payload) => { payload.issue_number = 410 }],
      ['missing branch', (payload) => { delete payload.branch }],
      ['short exact-head SHA', (payload) => { payload.exact_head = headSha.slice(1) }],
      ['padded exact-head SHA', (payload) => { payload.exact_head = ` ${headSha}` }],
      ['malformed protected-base branch', (payload) => { handoffIdentityObject(payload, 'protected_base').branch = null }],
      ['missing protected-base SHA', (payload) => { delete handoffIdentityObject(payload, 'protected_base').sha }],
      ['padded protected-base SHA', (payload) => { handoffIdentityObject(payload, 'protected_base').sha = `${sha} ` }],
      ['non-string PR number', (payload) => { handoffIdentityObject(payload, 'pr').number = 411 }],
      ['malformed PR URL', (payload) => { handoffIdentityObject(payload, 'pr').url = 'not-a-pull-request-url' }],
      ['noncanonical same-resource PR URL casing', (payload) => { handoffIdentityObject(payload, 'pr').url = 'https://github.com/Boat1994/Bemoat-Web-Starter/pull/411' }],
      ['missing PR identity', (payload) => { delete payload.pr }],
    ]

    it.each(malformedIdentityCases)('routes an otherwise-current %s HANDOFF to STOP despite valid review evidence', (_story, mutate) => {
      const malformed = mutateHandoffIdentity(strictHandoff(), mutate)

      expect(handoffReadyDecision(malformed, { historicalResults: [validVerdict] }).route).toBe('STOP')
    })

    it.each<[string, (payload: Record<string, unknown>) => void]>([
      ['wrong repository', (payload) => { payload.repository = 'other/repository' }],
      ['case-distinct repository', (payload) => { payload.repository = 'Other/Repository' }],
      ['wrong Issue', (payload) => { payload.issue_number = '999' }],
      ['wrong PR', (payload) => { handoffIdentityObject(payload, 'pr').number = '999' }],
      ['case-distinct PR URL for another PR', (payload) => {
        handoffIdentityObject(payload, 'pr').url = 'https://github.com/OTHER/REPOSITORY/pull/999'
      }],
      ['wrong approved base', (payload) => { handoffIdentityObject(payload, 'protected_base').branch = 'dev' }],
      ['stale exact head', (payload) => { payload.exact_head = 'c'.repeat(40) }],
    ])('keeps a valid %s mismatch historical when another identity field is malformed', (_story, setMismatch) => {
      const historical = mutateHandoffIdentity(strictHandoff(), (payload) => {
        setMismatch(payload)
        delete payload.branch
      })

      expect(handoffReadyDecision(historical, { historicalResults: [validVerdict] }).route).toBe('FOUNDER_GATE')
    })

    it('treats a case-equivalent repository as a matching anchor when other identity is missing', () => {
      const partial = mutateHandoffIdentity(strictHandoff(), (payload) => {
        payload.repository = 'Boat1994/Bemoat-Web-Starter'
        delete payload.issue_number
        delete payload.branch
        delete payload.exact_head
        delete payload.protected_base
        delete payload.pr
      })

      expect(handoffReadyDecision(partial, { historicalResults: [validVerdict] }).route).toBe('STOP')
    })

    it('does not treat a payload without identity anchors as current-malformed', () => {
      const noIdentity = mutateHandoffIdentity(strictHandoff(), (payload) => {
        delete payload.repository
        delete payload.issue_number
        delete payload.branch
        delete payload.exact_head
        delete payload.protected_base
        delete payload.pr
      })

      expect(handoffReadyDecision(noIdentity, { historicalResults: [validVerdict] }).route).toBe('FOUNDER_GATE')
    })

    it('stops a malformed FOUNDER_GATE identity before it can supersede REVIEW', () => {
      const review = { ...reviewHandoff(), id: 901 }
      const founderGate = {
        ...mutateHandoffIdentity(founderGateHandoff(), (payload) => { delete payload.branch }),
        id: 902,
      }

      expect(handoffReadyDecision(founderGate, {
        handoffs: [review, founderGate],
        historicalResults: [eligibleHandoffReviewVerdict()],
      }).route).toBe('STOP')
    })
  })


  it('fails closed for competing current-head HANDOFF FIX and STOP records', () => {
    const stop = {
      ...strictHandoff({
        route: 'STOP',
        next_action: { route: 'STOP', description: 'Resolve the current evidence blocker.' },
      }),
      id: 901,
    }

    expect(handoffReadyDecision(strictHandoff(), { handoffs: [strictHandoff(), stop] }).route).toBe('STOP')
  })

  it('keeps a current FIX and STOP pair fail-closed when FIX lacks valid review lineage', () => {
    const invalidFix = strictHandoff({
      verified_evidence: [{ kind: 'focused-tests', value: 'No blocking review verdict is linked.', url: null }],
    })
    const stop = strictHandoff({
      route: 'STOP',
      next_action: { route: 'STOP', description: 'Resolve the current evidence blocker.' },
    })

    expect(handoffReadyDecision(invalidFix, { handoffs: [invalidFix, stop] }).route).toBe('STOP')
  })

  it('fails closed for two applicable current-head HANDOFF FIX records', () => {
    const secondFix = {
      ...strictHandoff({ objective: 'Apply the same correction from another current record.' }),
      id: 901,
    }

    expect(handoffReadyDecision(strictHandoff(), { handoffs: [strictHandoff(), secondFix] }).route).toBe('STOP')
  })

  it('evaluates only the identity-bound current HANDOFF when stale and current records coexist', () => {
    const stale = strictHandoff({
      exact_head: 'c'.repeat(40),
      pr: {
        number: '411',
        url: 'https://github.com/boat1994/bemoat-web-starter/pull/411',
        base: 'main',
        head: 'feature/410-context',
        head_sha: 'c'.repeat(40),
      },
    })
    const current = strictHandoff()

    expect(handoffReadyDecision(stale, { handoffs: [stale, current] }).route).toBe('FIX')
  })

  it('does not authorize FIX from arbitrary review prose', () => {
    const arbitrary = strictHandoff({
      verified_evidence: [{ kind: 'review', value: 'not a review', url: null }],
    })

    expect(handoffReadyDecision(arbitrary).route).toBe('STOP')
  })

  it('retains the production-shaped bound blocking review-verdict evidence path', () => {
    const productionShaped = strictHandoff({
      verified_evidence: [{
        kind: 'review-verdict',
        value: 'Independent exact-head semantic review found one Important viewport defect: the shared implementation still requires a bounded correction.',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-950',
      }],
    })

    expect(handoffReadyDecision(productionShaped).route).toBe('FIX')
  })

  it('routes a REVIEW handoff followed by its exact-head blocking review verdict and derived FIX handoff to FIX', () => {
    const review = {
      ...strictHandoff({
        verified_evidence: [{ kind: 'focused-tests', value: 'Focused tests passed.', url: null }],
        route: 'REVIEW',
        next_action: { route: 'REVIEW', description: 'Obtain the independent semantic review.' },
      }),
      id: 901,
    }
    const fix = { ...strictHandoff(), id: 902 }

    expect(handoffReadyDecision(review, {
      handoffs: [review, fix],
      historicalResults: [handoffReviewVerdict()],
    }).route).toBe('FIX')
  })

  it('does not use HANDOFF timestamp or array order to decide a valid REVIEW-to-FIX lineage', () => {
    const review = {
      ...strictHandoff({
        verified_evidence: [{ kind: 'focused-tests', value: 'Focused tests passed.', url: null }],
        route: 'REVIEW',
        next_action: { route: 'REVIEW', description: 'Obtain the independent semantic review.' },
      }),
      id: 901,
      createdAt: '2026-08-03T00:00:00Z',
    }
    const fix = { ...strictHandoff(), id: 902, createdAt: '2026-08-01T00:00:00Z' }

    expect(handoffReadyDecision(fix, {
      handoffs: [fix, review],
      historicalResults: [handoffReviewVerdict({ createdAt: '2026-08-04T00:00:00Z' })],
    }).route).toBe('FIX')
  })

  it('routes a REVIEW handoff and its identity-bound eligible review verdict and FOUNDER_GATE handoff to FOUNDER_GATE regardless of order or timestamps', () => {
    const review = {
      ...reviewHandoff(),
      id: 901,
      createdAt: '2026-08-03T00:00:00Z',
    }
    const founderGate = {
      ...founderGateHandoff(),
      id: 902,
      createdAt: '2026-08-01T00:00:00Z',
    }
    const verdict = eligibleHandoffReviewVerdict({ createdAt: '2026-08-04T00:00:00Z' })

    const firstOrdering = handoffReadyDecision(founderGate, {
      handoffs: [founderGate, review],
      historicalResults: [verdict],
    })
    const secondOrdering = handoffReadyDecision(review, {
      handoffs: [
        { ...review, createdAt: '2026-08-01T00:00:00Z' },
        { ...founderGate, createdAt: '2026-08-03T00:00:00Z' },
      ],
      historicalResults: [eligibleHandoffReviewVerdict({ createdAt: '2026-08-02T00:00:00Z' })],
    })

    expect([firstOrdering.route, secondOrdering.route]).toEqual(['FOUNDER_GATE', 'FOUNDER_GATE'])
  })

  it('keeps unrelated same-head REVIEW and FOUNDER_GATE handoffs fail-closed', () => {
    const review = { ...reviewHandoff(), id: 901 }
    const unrelatedFounderGate = {
      ...founderGateHandoff({
        verified_evidence: [{ kind: 'focused-tests', value: 'A separate objective was reviewed.', url: null }],
      }),
      id: 902,
    }

    expect(handoffReadyDecision(unrelatedFounderGate, {
      handoffs: [review, unrelatedFounderGate],
      historicalResults: [eligibleHandoffReviewVerdict()],
    }).route).toBe('STOP')
  })

  it.each([
    ['malformed', '## REVIEW_VERDICT\n**Verdict** ELIGIBLE FOR FOUNDER REVIEW'],
    ['blocking', eligibleHandoffReviewVerdict().body.replace('ELIGIBLE FOR FOUNDER REVIEW', 'CORRECTION REQUIRED')],
    ['wrong repository', eligibleHandoffReviewVerdict().body.replace('boat1994/bemoat-web-starter', 'other/repository')],
    ['wrong Issue', eligibleHandoffReviewVerdict().body.replace('#410', '#999')],
    ['wrong PR', eligibleHandoffReviewVerdict().body.replace('PR #411', 'PR #999')],
    ['wrong base', eligibleHandoffReviewVerdict().body.replace('`main`', '`dev`')],
    ['wrong head', eligibleHandoffReviewVerdict().body.replace(headSha, 'c'.repeat(40))],
    ['superseded', `${eligibleHandoffReviewVerdict().body}\nThis verdict was superseded.`],
  ])('fails closed when the FOUNDER_GATE lineage has a %s review verdict', (_label, body) => {
    const review = { ...reviewHandoff(), id: 901 }
    const founderGate = { ...founderGateHandoff(), id: 902 }

    expect(handoffReadyDecision(founderGate, {
      handoffs: [review, founderGate],
      historicalResults: [eligibleHandoffReviewVerdict({ body })],
    }).route).toBe('STOP')
  })

  it('fails closed when a FOUNDER_GATE references a missing, duplicate, or different review comment', () => {
    const review = { ...reviewHandoff(), id: 901 }
    const founderGate = { ...founderGateHandoff(), id: 902 }
    const verdict = eligibleHandoffReviewVerdict()

    expect(handoffReadyDecision(founderGate, {
      handoffs: [review, founderGate],
      historicalResults: [],
    }).route).toBe('STOP')
    expect(handoffReadyDecision(founderGate, {
      handoffs: [review, founderGate],
      historicalResults: [verdict, verdict],
    }).route).toBe('STOP')

    const differentCommentFounderGate = founderGateHandoff({
      verified_evidence: [{ kind: 'review-verdict', value: 'Independent verdict.', url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-999' }],
    })
    expect(handoffReadyDecision(differentCommentFounderGate, {
      handoffs: [review, differentCommentFounderGate],
      historicalResults: [verdict],
    }).route).toBe('STOP')
  })

  it('does not let a FOUNDER_GATE HANDOFF with wrong current identity supersede REVIEW', () => {
    const review = { ...reviewHandoff(), id: 901 }
    const wrongBranch = {
      ...founderGateHandoff({ branch: 'feature/other-context' }),
      id: 902,
    }

    expect(handoffReadyDecision(wrongBranch, {
      handoffs: [review, wrongBranch],
      historicalResults: [],
    }).route).toBe('REVIEW')
  })

  it.each<[string, Partial<HandoffRecord>]>([
    ['repository', { repository: 'other/repository' }],
    ['Issue', { issue_number: '999' }],
    ['PR', { pr: { number: '999', url: 'https://github.com/boat1994/bemoat-web-starter/pull/999', base: 'main', head: 'feature/410-context', head_sha: headSha } }],
    ['approved base', { protected_base: { branch: 'dev', sha } }],
    ['branch', { branch: 'feature/other-context' }],
    ['exact head', { exact_head: 'c'.repeat(40), pr: { number: '411', url: 'https://github.com/boat1994/bemoat-web-starter/pull/411', base: 'main', head: 'feature/410-context', head_sha: 'c'.repeat(40) } }],
  ])('does not apply a FOUNDER_GATE HANDOFF with a wrong %s identity', (_label, identity) => {
    const review = { ...reviewHandoff(), id: 901 }
    const founderGate = { ...founderGateHandoff(identity), id: 902 }

    expect(handoffReadyDecision(founderGate, {
      handoffs: [review, founderGate],
      historicalResults: [],
    }).route).toBe('REVIEW')
  })

  it('does not let a lone FOUNDER_GATE HANDOFF satisfy semantic review without an applicable eligible verdict', () => {
    expect(handoffReadyDecision(founderGateHandoff(), { historicalResults: [] }).route).toBe('REVIEW')
  })

  it('keeps unrelated same-head REVIEW and FIX HANDOFFs fail-closed', () => {
    const review = {
      ...strictHandoff({
        verified_evidence: [{ kind: 'focused-tests', value: 'Focused tests passed.', url: null }],
        route: 'REVIEW',
        next_action: { route: 'REVIEW', description: 'Obtain the independent semantic review.' },
      }),
      id: 901,
    }
    const unrelatedFix = {
      ...strictHandoff({
        verified_evidence: [{ kind: 'review', value: 'not a review', url: 'https://github.com/boat1994/bemoat-web-starter/pull/411' }],
      }),
      id: 902,
    }

    expect(handoffReadyDecision(review, {
      handoffs: [review, unrelatedFix],
      historicalResults: [],
    }).route).toBe('STOP')
  })

  it('fails closed when review-verdict evidence points to a non-review Issue comment', () => {
    const fix = strictHandoff({
      verified_evidence: [{
        kind: 'review-verdict',
        value: 'Descriptive only.',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-951',
      }],
    })

    expect(handoffReadyDecision(fix, {
      historicalResults: [{
        id: 951,
        body: '## RESULT\nThe comment is not a semantic review verdict.',
        createdAt: '2026-08-02T00:00:00Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-951',
      }],
    }).route).toBe('STOP')
  })

  it.each([
    ['wrong head', handoffReviewVerdict({ body: handoffReviewVerdict().body.replace(headSha, 'c'.repeat(40)) })],
    ['wrong Issue', handoffReviewVerdict({ body: handoffReviewVerdict().body.replace('#410', '#999') })],
    ['wrong PR', handoffReviewVerdict({ body: handoffReviewVerdict().body.replace('PR #411', 'PR #999') })],
    ['wrong repository', handoffReviewVerdict({ body: handoffReviewVerdict().body.replace('boat1994/bemoat-web-starter', 'other/repository') })],
  ])('does not apply a %s review verdict to the current HANDOFF FIX', (_story, verdict) => {
    expect(handoffReadyDecision(strictHandoff(), { historicalResults: [verdict] }).route).toBe('STOP')
  })

  it('fails closed when a current-head HANDOFF FIX competes with a valid eligible review', () => {
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({
        reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
      }),
      durableContext: { latestHandoff: strictHandoff(), historicalResults: [validVerdict] },
    }))

    expect(decision.route).toBe('STOP')
  })

  function actual421ReviewVerdictBody(reviewedHead: string): string {
    return `## REVIEW_VERDICT

### Task log
- Timestamp: 2026-08-25T14:00:00+07:00
- Task / Issue: #421
- Phase: Founder-authorized post-budget Review 4
- Executing role: Reviewer

### Review identity
- Repository: \`boat1994/bemoat-web-starter\`
- Task / Issue: #421
- PR / base / head: PR #422 · \`main\` · \`${reviewedHead}\`

**Task / Issue:** #421
**Repository:** \`boat1994/bemoat-web-starter\`
**PR / base / head:** https://github.com/boat1994/bemoat-web-starter/pull/422 · \`main\` · \`${reviewedHead}\`
**Verdict:** CORRECTION REQUIRED`
  }

  it('routes clean durable work without a PR to IMPLEMENT', () => {
    expect(routeContext(baseEvidence()).route).toBe('IMPLEMENT')
  })

  it('fails closed for non-durable local work', () => {
    const decision = routeContext(baseEvidence({
      localGit: {
        ...baseEvidence().localGit,
        clean: false,
        pushed: false,
        durable: false,
        reasons: ['LOCAL_STATE_NOT_DURABLE: working tree is dirty and unpushed'],
      },
    }))

    expect(decision.route).toBe('STOP')
    expect(decision.reasons).toContain('LOCAL_STATE_NOT_DURABLE: working tree is dirty and unpushed')
  })

  it('routes failed exact-head checks to FIX', () => {
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({
        checks: {
          status: 'FAILURE',
          complete: true,
          failed: true,
          pending: false,
          required: true,
        },
      }),
    }))

    expect(decision.route).toBe('FIX')
  })

  it('routes incomplete exact-head checks to VERIFY', () => {
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({
        checks: {
          status: 'PENDING',
          complete: false,
          failed: false,
          pending: true,
          required: true,
        },
      }),
    }))

    expect(decision.route).toBe('VERIFY')
  })

  it('routes green exact-head work without approval to REVIEW', () => {
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification(),
    }))

    expect(decision.route).toBe('REVIEW')
  })

  it('routes green exact-head approved work to FOUNDER_GATE', () => {
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({
        reviews: { required: true, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
      }),
      durableContext: {
        latestHandoff: null,
        historicalResults: [validVerdict],
      },
    }))

    expect(decision.route).toBe('FOUNDER_GATE')
  })

  describe('semantic review policies', () => {
    it('routes STANDARD + zero native approvals + no semantic review to REVIEW', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        }),
      }))
      expect(decision.route).toBe('REVIEW')
      expect(decision.reasons.join(' ')).toMatch(/STANDARD semantic review is missing/i)
    })

    it('routes STANDARD + valid exact-head semantic review to FOUNDER_GATE', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [validVerdict],
        },
      }))
      expect(decision.route).toBe('FOUNDER_GATE')
    })

    it('routes a clean exact-head native COMMENTED review to FOUNDER_GATE', () => {
      const currentHeadVerification = verification({
        reviews: {
          required: false,
          approved: true,
          exactHead: true,
          approvedCount: 0,
          exactHeadApprovedCount: 0,
          nativeReviews: [nativeReview()],
        },
      })
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification,
      }))

      expect(decision.route).toBe('FOUNDER_GATE')
    })

    it('routes an exact-head native CORRECTION REQUIRED review with a usable finding to FIX', () => {
      const currentHeadVerification = verification({
        reviews: {
          required: false,
          approved: true,
          exactHead: true,
          approvedCount: 0,
          exactHeadApprovedCount: 0,
          nativeReviews: [nativeBlockingReview()],
        },
      })
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification,
      }))

      expect(decision.route).toBe('FIX')
    })

    const nativeReviewCases: Array<[string, Record<string, unknown>, string]> = [
      ['stale commit binding', { commitId: 'c'.repeat(40) }, 'REVIEW'],
      ['wrong reviewed head', { body: nativeReview().body.replace(headSha, 'c'.repeat(40)) }, 'STOP'],
      ['malformed body', { body: '## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW' }, 'STOP'],
    ]
    it.each(nativeReviewCases)('keeps native review evidence fail-closed for %s', (_label, reviewOverrides, expectedRoute) => {
      const currentHeadVerification = verification({
        reviews: {
          required: false,
          approved: true,
          exactHead: true,
          approvedCount: 0,
          exactHeadApprovedCount: 0,
          nativeReviews: [nativeReview(reviewOverrides)],
        },
      })
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification,
      }))

      expect(decision.route).toBe(expectedRoute)
    })

    it('routes multiple compatible exact-head native reviews to FOUNDER_GATE', () => {
      const currentHeadVerification = verification({
        reviews: {
          required: false,
          approved: true,
          exactHead: true,
          approvedCount: 0,
          exactHeadApprovedCount: 0,
          nativeReviews: [nativeReview(), nativeReview({ id: 201 })],
        },
      })
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification,
      }))

      expect(decision.route).toBe('FOUNDER_GATE')
    })

    it('keeps native review evidence fail-closed for genuinely competing exact-head verdicts', () => {
      const currentHeadVerification = verification({
        reviews: {
          required: false,
          approved: true,
          exactHead: true,
          approvedCount: 0,
          exactHeadApprovedCount: 0,
          nativeReviews: [nativeReview(), nativeReview({ id: 201, body: nativeBlockingReview().body })],
        },
      })
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification,
      }))

      expect(decision.route).toBe('STOP')
    })


    it('selects the live verdict from historical predecessor REVIEW_VERDICT records', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = '346c2f2817adc33757a4934aac7184e12c142ca1'
      const predecessorHeadSha = '7f4ffbcc6582ee676341abf09fb55799875833b6'
      const predecessorVerdict = {
        id: 5400718189,
        body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${predecessorHeadSha}\``,
        createdAt: '2026-08-24T20:08:50Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5400718189',
      }
      const liveVerdict = {
        id: 5406699778,
        body: `## REVIEW_VERDICT\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\``,
        createdAt: '2026-08-25T06:58:56Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5406699778',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: {
          ...baseEvidence().issue,
          number: '421',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/421',
          workflowProfile: 'STANDARD',
        },
        localGit: { ...baseEvidence().localGit, branch: 'fix/421-standard-semantic-review', head: liveHeadSha },
        activePr: prEvidence({
          number: '422',
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/422',
          headBranch: 'fix/421-standard-semantic-review',
          headSha: liveHeadSha,
          baseSha: liveBaseSha,
        }),
        currentHeadVerification: {
          ...verification({
            exactHead: liveHeadSha,
          }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: {
          latestHandoff: null,
          historicalResults: [predecessorVerdict, liveVerdict],
        },
      }))

      expect(decision.route).toBe('FOUNDER_GATE')
    })

    it('ignores malformed stale #421 predecessor evidence when a valid live-head verdict exists', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const stalePredecessorHeadSha = '346c2f2817adc33757a4934aac7184e12c142ca1'
      const liveVerdict = {
        id: 900,
        body: `## REVIEW_VERDICT\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** https://github.com/boat1994/bemoat-web-starter/pull/422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
        createdAt: '2026-08-25T15:30:00Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-900',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: {
          ...baseEvidence().issue,
          number: '421',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/421',
          workflowProfile: 'STANDARD',
        },
        localGit: { ...baseEvidence().localGit, branch: 'fix/421-standard-semantic-review', head: liveHeadSha },
        activePr: prEvidence({
          number: '422',
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/422',
          headBranch: 'fix/421-standard-semantic-review',
          headSha: liveHeadSha,
          baseSha: liveBaseSha,
        }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: {
          latestHandoff: null,
          historicalResults: [
            {
              id: 5406699778,
              body: actual421ReviewVerdictBody(stalePredecessorHeadSha),
              createdAt: '2026-08-25T06:58:56Z',
              url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5406699778',
            },
            liveVerdict,
          ],
        },
      }))

      expect(decision.route).toBe('FOUNDER_GATE')
    })

    it('reconciles malformed current-head review with a later valid same-head corrective review via exact predecessor ID', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const malformedVerdict = {
        id: 5407357001,
        body: actual421ReviewVerdictBody(liveHeadSha),
        createdAt: '2026-08-25T08:05:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357001',
      }
      const correctiveVerdict = {
        id: 5407357002,
        body: `## REVIEW_VERDICT\n**Supersedes:** 5407357001\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
        createdAt: '2026-08-25T08:15:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357002',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: { ...baseEvidence().issue, number: '421', url: 'https://github.com/boat1994/bemoat-web-starter/issues/421', workflowProfile: 'STANDARD' },
        localGit: { ...baseEvidence().localGit, head: liveHeadSha },
        activePr: prEvidence({ number: '422', url: 'https://github.com/boat1994/bemoat-web-starter/pull/422', headSha: liveHeadSha, baseSha: liveBaseSha }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: { latestHandoff: null, historicalResults: [malformedVerdict, correctiveVerdict] },
      }))

      expect(decision.route).toBe('FOUNDER_GATE')
    })

    it('keeps malformed current-head review fail-closed if corrective review omits predecessor ID', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const malformedVerdict = {
        id: 5407357001,
        body: actual421ReviewVerdictBody(liveHeadSha),
        createdAt: '2026-08-25T08:05:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357001',
      }
      const correctiveVerdict = {
        id: 5407357002,
        body: `## REVIEW_VERDICT\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
        createdAt: '2026-08-25T08:15:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357002',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: { ...baseEvidence().issue, number: '421', url: 'https://github.com/boat1994/bemoat-web-starter/issues/421', workflowProfile: 'STANDARD' },
        localGit: { ...baseEvidence().localGit, head: liveHeadSha },
        activePr: prEvidence({ number: '422', url: 'https://github.com/boat1994/bemoat-web-starter/pull/422', headSha: liveHeadSha, baseSha: liveBaseSha }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: { latestHandoff: null, historicalResults: [malformedVerdict, correctiveVerdict] },
      }))

      expect(decision.route).toBe('STOP')
    })

    it('keeps malformed current-head review fail-closed if predecessor ID does not exist', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const malformedVerdict = {
        id: 5407357001,
        body: actual421ReviewVerdictBody(liveHeadSha),
        createdAt: '2026-08-25T08:05:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357001',
      }
      const correctiveVerdict = {
        id: 5407357002,
        body: `## REVIEW_VERDICT\n**Supersedes:** 999999999\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
        createdAt: '2026-08-25T08:15:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357002',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: { ...baseEvidence().issue, number: '421', url: 'https://github.com/boat1994/bemoat-web-starter/issues/421', workflowProfile: 'STANDARD' },
        localGit: { ...baseEvidence().localGit, head: liveHeadSha },
        activePr: prEvidence({ number: '422', url: 'https://github.com/boat1994/bemoat-web-starter/pull/422', headSha: liveHeadSha, baseSha: liveBaseSha }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: { latestHandoff: null, historicalResults: [malformedVerdict, correctiveVerdict] },
      }))

      expect(decision.route).toBe('STOP')
    })

    it('keeps malformed current-head review fail-closed if there are competing valid current-head verdicts', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const malformedVerdict = {
        id: 5407357001,
        body: actual421ReviewVerdictBody(liveHeadSha),
        createdAt: '2026-08-25T08:05:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357001',
      }
      const correctiveVerdict = {
        id: 5407357002,
        body: `## REVIEW_VERDICT\n**Supersedes:** 5407357001\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
        createdAt: '2026-08-25T08:15:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357002',
      }
      const competingValidVerdict = {
        id: 5407357003,
        body: `## REVIEW_VERDICT\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** CORRECTION REQUIRED\n\n` + `\`\`\`json\n{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${liveHeadSha}", "findings": [{ "id": "CTX-123-001", "canonical_summary": "Issue", "source_thread": "link", "required_evidence": ["fix"] }] }\n\`\`\``,
        createdAt: '2026-08-25T08:25:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357003',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: { ...baseEvidence().issue, number: '421', url: 'https://github.com/boat1994/bemoat-web-starter/issues/421', workflowProfile: 'STANDARD' },
        localGit: { ...baseEvidence().localGit, head: liveHeadSha },
        activePr: prEvidence({ number: '422', url: 'https://github.com/boat1994/bemoat-web-starter/pull/422', headSha: liveHeadSha, baseSha: liveBaseSha }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: { latestHandoff: null, historicalResults: [malformedVerdict, correctiveVerdict, competingValidVerdict] },
      }))

      expect(decision.route).toBe('STOP')
    })

    it('keeps malformed current-head review fail-closed if predecessor binding does not match exactly', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const malformedVerdict = {
        id: 5407357001,
        body: `## REVIEW_VERDICT\n**Task:** Issue #421\n**Repository:** \`other/repository\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** CORRECTION REQUIRED`,
        createdAt: '2026-08-25T08:05:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357001',
      }
      const correctiveVerdict = {
        id: 5407357002,
        body: `## REVIEW_VERDICT\n**Supersedes:** 5407357001\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
        createdAt: '2026-08-25T08:15:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357002',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: { ...baseEvidence().issue, number: '421', url: 'https://github.com/boat1994/bemoat-web-starter/issues/421', workflowProfile: 'STANDARD' },
        localGit: { ...baseEvidence().localGit, head: liveHeadSha },
        activePr: prEvidence({ number: '422', url: 'https://github.com/boat1994/bemoat-web-starter/pull/422', headSha: liveHeadSha, baseSha: liveBaseSha }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: { latestHandoff: null, historicalResults: [malformedVerdict, correctiveVerdict] },
      }))

      expect(decision.route).toBe('STOP')
    })

    it('keeps malformed current-head review fail-closed if predecessor cannot be independently parsed', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const malformedVerdict = {
        id: 5407357001,
        body: `## REVIEW_VERDICT\n**Task:** Issue #421\n**Verdict:** CORRECTION REQUIRED\n\n**Exact head reviewed:** \`${liveHeadSha}\``,
        createdAt: '2026-08-25T08:05:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357001',
      }
      const correctiveVerdict = {
        id: 5407357002,
        body: `## REVIEW_VERDICT\n**Supersedes:** 5407357001\n**Task:** Issue #421\n**Repository:** \`boat1994/bemoat-web-starter\`\n**PR / base / head:** PR #422 · \`main\` · \`${liveHeadSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
        createdAt: '2026-08-25T08:15:39Z',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357002',
      }
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: { ...baseEvidence().issue, number: '421', url: 'https://github.com/boat1994/bemoat-web-starter/issues/421', workflowProfile: 'STANDARD' },
        localGit: { ...baseEvidence().localGit, head: liveHeadSha },
        activePr: prEvidence({ number: '422', url: 'https://github.com/boat1994/bemoat-web-starter/pull/422', headSha: liveHeadSha, baseSha: liveBaseSha }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: { latestHandoff: null, historicalResults: [malformedVerdict, correctiveVerdict] },
      }))

      expect(decision.route).toBe('STOP')
    })

    it('keeps malformed live-head #421 evidence fail-closed', () => {
      const liveBaseSha = '832782c585eb4c122ea05404fc1a615b865d68bb'
      const liveHeadSha = 'bbc264e9fa437c57a733f2a7f8a947001655405b'
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: liveBaseSha },
        issue: {
          ...baseEvidence().issue,
          number: '421',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/421',
          workflowProfile: 'STANDARD',
        },
        localGit: { ...baseEvidence().localGit, branch: 'fix/421-standard-semantic-review', head: liveHeadSha },
        activePr: prEvidence({
          number: '422',
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/422',
          headBranch: 'fix/421-standard-semantic-review',
          headSha: liveHeadSha,
          baseSha: liveBaseSha,
        }),
        currentHeadVerification: {
          ...verification({ exactHead: liveHeadSha }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: {
          latestHandoff: null,
          historicalResults: [{
            id: 5407357001,
            body: actual421ReviewVerdictBody(liveHeadSha),
            createdAt: '2026-08-25T08:05:39Z',
            url: 'https://github.com/boat1994/bemoat-web-starter/issues/421#issuecomment-5407357001',
          }],
        },
      }))

      expect(decision.route).toBe('STOP')
    })

    it('routes CORRECTION REQUIRED REVIEW_VERDICT to STOP (malformed blocking evidence)', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [correctionVerdict],
        },
      }))
      expect(decision.route).toBe('STOP')
    })

    it('routes durable STANDARD blocking review evidence to FIX without accepting reconciliation attempts', () => {
      const reviewedHead = '0d7c77995e92391b49e042e182b54af2d561c87c'
      const reviewBody = `## REVIEW_VERDICT

### Task log
- Phase: Independent Standard Semantic Review
- Executing role: Reviewer
- Review type: Full semantic review

**Repository:** \`boat1994/bemoat-web-starter\`
**Task / Issue:** #423
**PR / base / head:** https://github.com/boat1994/bemoat-web-starter/pull/424 · \`main\` · \`${reviewedHead}\`
**Verdict:** CORRECTION REQUIRED

### Immutable finding disposition
\`source_thread\`: https://github.com/boat1994/bemoat-web-starter/blob/${reviewedHead}/scripts/context/github.ts#L348-L352

\`\`\`json
{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${reviewedHead}", "findings": [{ "id": "CTX-423-001", "canonical_summary": "Conflicting PR state and merge-commit evidence is accepted as merged terminal evidence.", "source_thread": "https://github.com/boat1994/bemoat-web-starter/blob/${reviewedHead}/scripts/context/github.ts#L348-L352", "required_evidence": ["Require authoritative merged-state evidence to agree with mergeCommit evidence."] }] }
\`\`\``
      const reconciliationBody = reviewBody.replace(
        'Independent Standard Semantic Review',
        'Evidence reconciliation (no semantic re-review)',
      )

      const decision = routeContext(baseEvidence({
        protectedBase: {
          ...baseEvidence().protectedBase,
          sha: '6e09b0464d696dad97bf757f8a189fe81d2b74ec',
        },
        issue: {
          ...baseEvidence().issue,
          number: '423',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/423',
          workflowProfile: 'STANDARD',
        },
        localGit: {
          ...baseEvidence().localGit,
          branch: 'fix/423-post-merge-terminal-reconstruction',
          head: reviewedHead,
        },
        activePr: prEvidence({
          number: '424',
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/424',
          headBranch: 'fix/423-post-merge-terminal-reconstruction',
          headSha: reviewedHead,
          baseSha: '6e09b0464d696dad97bf757f8a189fe81d2b74ec',
        }),
        currentHeadVerification: {
          ...verification({ exactHead: reviewedHead }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: {
          latestHandoff: null,
          historicalResults: [
            { id: 5409353625, body: reviewBody, createdAt: '2026-08-25T10:54:48Z', url: 'https://github.com/boat1994/bemoat-web-starter/issues/423#issuecomment-5409353625' },
            { id: 5409520379, body: reconciliationBody, createdAt: '2026-08-25T11:11:32Z', url: 'https://github.com/boat1994/bemoat-web-starter/issues/423#issuecomment-5409520379' },
            { id: 5409533378, body: reconciliationBody, createdAt: '2026-08-25T11:12:41Z', url: 'https://github.com/boat1994/bemoat-web-starter/issues/423#issuecomment-5409533378' },
            { id: 5409552460, body: reconciliationBody, createdAt: '2026-08-25T11:14:23Z', url: 'https://github.com/boat1994/bemoat-web-starter/issues/423#issuecomment-5409552460' },
          ],
        },
      }))

      expect(decision.route).toBe('FIX')
      expect(decision.nextAction.description).toMatch(/bounded correction/i)
    })

    it('uses exact-head current-protocol evidence without role-marker prose', () => {
      const reviewedHead = headSha
      const reviewBody = `## REVIEW_VERDICT
**Repository:** \`boat1994/bemoat-web-starter\`
**Task / Issue:** #410
**PR / base / head:** PR #411 · \`main\` · \`${reviewedHead}\`
**Verdict:** CORRECTION REQUIRED

### Immutable finding disposition
\`\`\`json
{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${reviewedHead}", "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "source_thread": "https://github.com/boat1994/bemoat-web-starter/pull/411#discussion_r1", "required_evidence": ["Evidence"] }] }
\`\`\``
      const decision = routeContext(baseEvidence({
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: { latestHandoff: null, historicalResults: [{ ...correctionVerdict, body: reviewBody }] },
      }))

      expect(decision.route).toBe('FIX')
    })

    it('keeps an exact-bound CORRECTION REQUIRED verdict without a blocking finding at STOP', () => {
      const reviewedHead = '0d7c77995e92391b49e042e182b54af2d561c87c'
      const decision = routeContext(baseEvidence({
        issue: {
          ...baseEvidence().issue,
          number: '423',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/423',
          workflowProfile: 'STANDARD',
        },
        activePr: prEvidence({
          number: '424',
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/424',
          headBranch: 'fix/423-post-merge-terminal-reconstruction',
          headSha: reviewedHead,
          baseSha: sha,
        }),
        currentHeadVerification: {
          ...verification({ exactHead: reviewedHead }),
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        },
        durableContext: {
          latestHandoff: null,
          historicalResults: [{
            id: 5409353625,
            body: `## REVIEW_VERDICT\n### Task log\n- Phase: Independent Standard Semantic Review\n- Executing role: Reviewer\n- Review type: Full semantic review\n**Repository:** \`boat1994/bemoat-web-starter\`\n**Task / Issue:** #423\n**PR / base / head:** PR #424 · \`main\` · \`${reviewedHead}\`\n**Verdict:** CORRECTION REQUIRED\n### Immutable finding disposition\n\`{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${reviewedHead}", "findings": [] }\``,
            createdAt: '2026-08-25T10:54:48Z',
            url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-5409353625',
          }],
        },
      }))

      expect(decision.route).toBe('STOP')
    })

    it.each([
      ['missing schema version', (head: string) => '{ "reviewed_head": "' + head + '", "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "source_thread": "thread", "required_evidence": ["Evidence"] }] }'],
      ['missing reviewed head', () => '{ "schema_version": 1, "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "source_thread": "thread", "required_evidence": ["Evidence"] }] }'],
      ['wrong reviewed head', () => '{ "schema_version": 1, "reviewed_head": "' + 'c'.repeat(40) + '", "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "source_thread": "thread", "required_evidence": ["Evidence"] }] }'],
      ['missing source thread', (head: string) => '{ "schema_version": 1, "reviewed_head": "' + head + '", "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "required_evidence": ["Evidence"] }] }'],
    ])('keeps CORRECTION REQUIRED with %s at STOP', (_label, serializedFinding) => {
      const reviewedHead = headSha
      const reviewBody = [
        '## REVIEW_VERDICT',
        '- Phase: Independent Standard Semantic Review',
        '- Executing role: Reviewer',
        '**Repository:** \x60boat1994/bemoat-web-starter\x60',
        '**Task / Issue:** #410',
        '**PR / base / head:** PR #411 · \x60main\x60 · \x60' + reviewedHead + '\x60',
        '**Verdict:** CORRECTION REQUIRED',
        '### Immutable finding disposition',
        '\x60\x60\x60json',
        serializedFinding(reviewedHead),
        '\x60\x60\x60',
      ].join('\n')
      const decision = routeContext(baseEvidence({
        activePr: prEvidence(),
        currentHeadVerification: verification(),
        durableContext: { latestHandoff: null, historicalResults: [{ ...correctionVerdict, body: reviewBody }] },
      }))

      expect(decision.route).toBe('STOP')
    })

    it.each([
      ['duplicate finding IDs', `{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${headSha}", "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "source_thread": "thread-1", "required_evidence": ["Evidence"] }, { "id": "CTX-001", "canonical_summary": "Fix it twice", "source_thread": "thread-2", "required_evidence": ["Evidence"] }] }`],
      ['multiple fenced correction contracts', `{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${headSha}", "findings": [{ "id": "CTX-001", "canonical_summary": "Fix it", "source_thread": "thread", "required_evidence": ["Evidence"] }] }\n\n\`\`\`json\n{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${headSha}", "findings": [{ "id": "CTX-002", "canonical_summary": "Fix that", "source_thread": "thread", "required_evidence": ["Evidence"] }] }\n\`\`\``],
    ])('keeps CORRECTION REQUIRED with %s at STOP', (_label, findingBlocks) => {
      const reviewBody = [
        '## REVIEW_VERDICT',
        '**Repository:** \x60boat1994/bemoat-web-starter\x60',
        '**Task / Issue:** #410',
        '**PR / base / head:** PR #411 · \x60main\x60 · \x60' + headSha + '\x60',
        '**Verdict:** CORRECTION REQUIRED',
        '### Immutable finding disposition',
        '\x60\x60\x60json',
        findingBlocks,
        '\x60\x60\x60',
      ].join('\n')
      const decision = routeContext(baseEvidence({
        activePr: prEvidence(),
        currentHeadVerification: verification(),
        durableContext: { latestHandoff: null, historicalResults: [{ ...correctionVerdict, body: reviewBody }] },
      }))

      expect(decision.route).toBe('STOP')
    })

    it('routes STANDARD + stale/wrong-head review to REVIEW', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [staleVerdict],
        },
      }))
      expect(decision.route).toBe('REVIEW')
    })

    it('routes STANDARD + wrong PR review to STOP (fail closed)', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [wrongIssueVerdict],
        },
      }))
      expect(decision.route).toBe('STOP')
    })

    it('routes STANDARD + wrong base review to STOP (fail closed)', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [wrongBaseVerdict],
        },
      }))
      expect(decision.route).toBe('STOP')
    })

    it('routes STANDARD + genuine wrong Issue review to STOP (fail closed)', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [genuineWrongIssueVerdict],
        },
      }))
      expect(decision.route).toBe('STOP')
    })

    it('routes STANDARD + genuine wrong repository review to STOP (fail closed)', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [genuineWrongRepoVerdict],
        },
      }))
      expect(decision.route).toBe('STOP')
    })

    it('routes multiple compatible valid exact-head reviews to FOUNDER_GATE', () => {
      const decisionCompatible = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [validVerdict, validVerdict],
        },
      }))
      expect(decisionCompatible.route).toBe('FOUNDER_GATE')
    })

    it('routes genuinely conflicting, malformed, or ambiguous verdict evidence to STOP (fail closed)', () => {
      const decisionConflicting = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [validVerdict, correctionVerdict],
        },
      }))
      expect(decisionConflicting.route).toBe('STOP')

      const decisionMalformed = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'STANDARD' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: {
          latestHandoff: null,
          historicalResults: [malformedVerdict],
        },
      }))
      expect(decisionMalformed.route).toBe('REVIEW')
    })

    it('routes FAST + zero native approvals directly to FOUNDER_GATE without semantic review', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'FAST' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        }),
      }))
      expect(decision.route).toBe('FOUNDER_GATE')
    })

    it('does not let a legacy MANAGED profile bypass the STANDARD semantic-review gate', () => {
      const decision = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, workflowProfile: 'MANAGED' },
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        }),
      }))
      expect(decision.route).toBe('REVIEW')
    })
  })

  it('stops when verification is bound to a stale or different PR head', () => {
    const decision = routeContext(baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({ exactHead: 'c'.repeat(40) }),
    }))

    expect(decision.route).toBe('STOP')
    expect(decision.reasons.join(' ')).toMatch(/exact-head/i)
  })

  it('routes a merged PR to COMPLETE', () => {
    const decision = routeContext(baseEvidence({
      issue: { ...baseEvidence().issue, state: 'CLOSED' },
      activePr: prEvidence({ state: 'MERGED', merged: true, mergeCommitSha: 'd'.repeat(40) }),
      currentHeadVerification: verification({
        reviews: { required: true, approved: true, exactHead: true },
      }),
    }))

    expect(decision.route).toBe('COMPLETE')
  })



  it('fails closed when OPEN state contradicts merge-commit evidence instead of routing COMPLETE', () => {
    const decision = routeContext(baseEvidence({
      issue: { ...baseEvidence().issue, state: 'OPEN' },
      protectedBase: { ...baseEvidence().protectedBase, sha: 'a'.repeat(40) },
      activePr: prEvidence({
        state: 'OPEN',
        merged: true,
        baseSha: 'c'.repeat(40),
        mergeCommitSha: 'd'.repeat(40),
      }),
      currentHeadVerification: verification({
        reviews: { required: true, approved: true, exactHead: true },
      }),
    }))

    expect(decision.route).toBe('STOP')
    expect(decision.reasons.join(' ')).toMatch(/state and merge commit|base identity/i)
  })

  it('routes a merged PR to COMPLETE with its historical base and non-durable local checkout', () => {
    const decision = routeContext(baseEvidence({
      issue: { ...baseEvidence().issue, state: 'CLOSED' },
      protectedBase: { ...baseEvidence().protectedBase, sha: 'c'.repeat(40) },
      localGit: {
        ...baseEvidence().localGit,
        clean: true,
        detached: true,
        pushed: false,
        durable: false,
        reasons: ['LOCAL_STATE_NOT_DURABLE: repository is detached'],
      },
      activePr: prEvidence({
        state: 'MERGED',
        merged: true,
        baseSha: sha,
        mergeCommitSha: 'd'.repeat(40),
      }),
      currentHeadVerification: verification({
        reviews: { required: true, approved: true, exactHead: true },
      }),
    }))

    expect(decision.route).toBe('COMPLETE')
  })

  it('fails closed when merged PR evidence omits its merge commit', () => {
    const decision = routeContext(baseEvidence({
      issue: { ...baseEvidence().issue, state: 'CLOSED' },
      activePr: prEvidence({ state: 'MERGED', merged: true, mergeCommitSha: null }),
      currentHeadVerification: verification({
        reviews: { required: true, approved: true, exactHead: true },
      }),
    }))

    expect(decision.route).toBe('STOP')
    expect(decision.reasons.join(' ')).toMatch(/merge commit/i)
  })

  it('stops for missing required evidence and competing PRs', () => {
    const missing = routeContext(baseEvidence({
      evidenceErrors: ['EVIDENCE_CONFLICT: canonical policy source unavailable'],
    }))
    expect(missing.route).toBe('STOP')

    const competing = routeContext(baseEvidence({
      activePr: [prEvidence({ number: '411' }), prEvidence({ number: '412' })] as never,
    }))
    expect(competing.route).toBe('STOP')
    expect(competing.reasons.join(' ')).toMatch(/competing|ambiguous/i)
  })

  describe('story-first Context Story Matrix transitions', () => {
    const advancedBaseSha = 'c'.repeat(40)

    it.each([
      {
        story: 'a closed Issue without terminal PR evidence',
        evidence: baseEvidence({ issue: { ...baseEvidence().issue, state: 'CLOSED' } }),
        reason: /closed.*merged PR/i,
      },
      {
        story: 'an active PR targeting the wrong base branch',
        evidence: baseEvidence({ activePr: prEvidence({ baseBranch: 'release' }), currentHeadVerification: verification() }),
        reason: /base identity/i,
      },
      {
        story: 'a merged PR with a malformed merge commit',
        evidence: baseEvidence({
          issue: { ...baseEvidence().issue, state: 'CLOSED' },
          activePr: prEvidence({ state: 'MERGED', merged: true, mergeCommitSha: 'malformed' }),
          currentHeadVerification: verification(),
        }),
        reason: /merge commit/i,
      },
    ])('fails closed for $story', ({ evidence, reason }) => {
      const decision = routeContext(evidence)

      expect(decision.route).toBe('STOP')
      expect(decision.reasons.join(' ')).toMatch(reason)
    })

    it.each([
      {
        story: 'failed CI cannot outrank a stale active PR base',
        headVerification: verification({
          checks: { status: 'FAILURE', complete: true, failed: true, pending: false, required: true },
        }),
        durableContext: baseEvidence().durableContext,
      },
      {
        story: 'pending CI cannot outrank a stale active PR base',
        headVerification: verification({
          checks: { status: 'PENDING', complete: false, failed: false, pending: true, required: true },
        }),
        durableContext: baseEvidence().durableContext,
      },
      {
        story: 'green CI and clean review cannot outrank a stale active PR base',
        headVerification: verification({
          reviews: { required: true, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: { latestHandoff: null, historicalResults: [validVerdict] },
      },
    ])('$story', ({ headVerification, durableContext }) => {
      const decision = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: advancedBaseSha },
        activePr: prEvidence({ baseSha: sha }),
        currentHeadVerification: headVerification,
        durableContext,
      }))

      expect(decision.route).toBe('STOP')
      expect(decision.reasons.join(' ')).toMatch(/base does not match live protected/i)
    })

    it('stops when a sibling merge advances protected main under an active PR', () => {
      const beforeSiblingMerge = routeContext(baseEvidence({
        activePr: prEvidence(),
        currentHeadVerification: verification({
          checks: { status: 'PENDING', complete: false, failed: false, pending: true, required: true },
        }),
      }))
      const afterSiblingMerge = routeContext(baseEvidence({
        protectedBase: { ...baseEvidence().protectedBase, sha: advancedBaseSha },
        activePr: prEvidence({ baseSha: sha }),
        currentHeadVerification: verification({
          checks: { status: 'PENDING', complete: false, failed: false, pending: true, required: true },
        }),
      }))

      expect(beforeSiblingMerge.route).toBe('VERIFY')
      expect(afterSiblingMerge.route).toBe('STOP')
    })

    it('invalidates old CI and review evidence across a PR head transition', () => {
      const newHeadSha = 'd'.repeat(40)
      const beforeCommit = routeContext(baseEvidence({
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: true, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: { latestHandoff: null, historicalResults: [validVerdict] },
      }))
      const staleCiAfterCommit = routeContext(baseEvidence({
        localGit: { ...baseEvidence().localGit, head: newHeadSha },
        activePr: prEvidence({ headSha: newHeadSha }),
        currentHeadVerification: verification(),
        durableContext: { latestHandoff: null, historicalResults: [validVerdict] },
      }))
      const freshCiStaleReview = routeContext(baseEvidence({
        localGit: { ...baseEvidence().localGit, head: newHeadSha },
        activePr: prEvidence({ headSha: newHeadSha }),
        currentHeadVerification: verification({
          exactHead: newHeadSha,
          reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0 },
        }),
        durableContext: { latestHandoff: null, historicalResults: [validVerdict] },
      }))

      expect(beforeCommit.route).toBe('FOUNDER_GATE')
      expect(staleCiAfterCommit.route).toBe('STOP')
      expect(freshCiStaleReview.route).toBe('REVIEW')
    })

    it('reconstructs a Founder manual merge as terminal despite historical base and local checkout', () => {
      const beforeMerge = routeContext(baseEvidence({
        activePr: prEvidence(),
        currentHeadVerification: verification({
          reviews: { required: true, approved: true, exactHead: true, approvedCount: 1, exactHeadApprovedCount: 1 },
        }),
        durableContext: { latestHandoff: null, historicalResults: [validVerdict] },
      }))
      const afterManualMerge = routeContext(baseEvidence({
        issue: { ...baseEvidence().issue, state: 'CLOSED' },
        protectedBase: { ...baseEvidence().protectedBase, sha: advancedBaseSha },
        localGit: {
          ...baseEvidence().localGit,
          branch: '<detached>',
          detached: true,
          pushed: false,
          durable: false,
          reasons: ['LOCAL_STATE_NOT_DURABLE: repository is detached'],
        },
        activePr: prEvidence({
          state: 'MERGED',
          merged: true,
          baseSha: sha,
          mergeCommitSha: 'e'.repeat(40),
        }),
        currentHeadVerification: verification(),
      }))

      expect(beforeMerge.route).toBe('FOUNDER_GATE')
      expect(afterManualMerge.route).toBe('COMPLETE')
    })
  })
})

describe('retained REVIEW_VERDICT Issue identity compatibility', () => {
  const head = 'a'.repeat(40)
  const valid = (issueFields: string) => `## REVIEW_VERDICT
**Repository:** \`boat1994/bemoat-web-starter\`
${issueFields}
**PR / base / head:** PR #435 · \`main\` · \`${head}\`
**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`

  it('A: retains one valid Task / Issue field', () => {
    expect(resolveMergeReviewVerdictBinding(valid('**Task / Issue:** #434')).issue).toBe('434')
  })

  it('B: normalizes identical valid duplicate Task / Issue fields', () => {
    expect(resolveMergeReviewVerdictBinding(valid('**Task / Issue:** #434\n- Task / Issue: #434')).issue).toBe('434')
  })

  it('C: rejects conflicting valid Issue identities', () => {
    expect(() => resolveMergeReviewVerdictBinding(valid('**Task / Issue:** #434\n- Task / Issue: #999'))).toThrow(/duplicated or ambiguous/)
  })

  it('D: rejects a malformed recognized duplicate beside valid evidence', () => {
    expect(() => resolveMergeReviewVerdictBinding(valid('**Task / Issue:** #434\n- Task / Issue: not-an-issue'))).toThrow(/malformed|ambiguous/)
  })

  it('E: reconstructs the durable repeated-identity shape of comment 5426416809', () => {
    const body = valid(`### Review identity\n- Task / Issue: #434\n\n**Task / Issue:** #434`)
    expect(parseProductionMergeReviewVerdict(body, '5426416809').issue).toBe('434')
  })

  it('F: rejects a parsed Issue that differs from the caller expected Issue', () => {
    const parsed = parseProductionMergeReviewVerdict(valid('**Task / Issue:** #434'), '5426416809')
    expect(classifyMergeReviewVerdict({
      reviewVerdict: parsed,
      expected: {
        commentId: '5426416809',
        exactHead: head,
        pr: '435',
        base: 'main',
        repository: 'boat1994/bemoat-web-starter',
        issue: '436',
      },
    }).valid).toBe(false)
  })
})
function handoffReviewVerdict(overrides: Partial<{
  id: string | number
  body: string
  createdAt: string
  url: string
}> = {}) {
  return {
    id: 950,
    body: `## REVIEW_VERDICT
**Task / Issue:** #410
**Repository:** \`boat1994/bemoat-web-starter\`
**PR / base / head:** PR #411 · \`main\` · \`${headSha}\`
**Verdict:** CORRECTION REQUIRED`,
    createdAt: '2026-08-02T00:00:00Z',
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-950',
    ...overrides,
  }
}

function eligibleHandoffReviewVerdict(overrides: Partial<{
  id: string | number
  body: string
  createdAt: string
  url: string
}> = {}) {
  return handoffReviewVerdict({
    body: `## REVIEW_VERDICT
**Task / Issue:** #410
**Repository:** \`boat1994/bemoat-web-starter\`
**PR / base / head:** PR #411 · \`main\` · \`${headSha}\`
**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
    id: 951,
    url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-951',
    ...overrides,
  })
}

// #503: these stories protect HANDOFF-only transport, exact native review
// lineage, immutable blocking evidence, and the correction-head review boundary.
describe('#503 supported native review lineage', () => {
  const reviewUrl = 'https://github.com/boat1994/bemoat-web-starter/pull/411#pullrequestreview-200'
  function evidenceFor(
    reviews = [nativeBlockingReview()],
    handoffs = [strictHandoff({ verified_evidence: [{ kind: 'review-verdict', value: 'Independent native review.', url: reviewUrl }] })],
  ) {
    return baseEvidence({
      activePr: prEvidence(),
      currentHeadVerification: verification({ reviews: {
        required: false, approved: true, exactHead: true,
        approvedCount: 0, exactHeadApprovedCount: 0, nativeReviews: reviews,
      } }),
      durableContext: { latestHandoff: handoffs[0] ?? null, handoffs, historicalResults: [] },
    })
  }

  it.each([
    ['blocking', 'FIX', nativeBlockingReview(), 'FIX'],
    ['eligible', 'FOUNDER_GATE', nativeReview(), 'FOUNDER_GATE'],
  ] as const)('appends a %s outcome after REVIEW without legacy Issue comments or rewriting HANDOFF', (_label, route, review, expected) => {
    const initial = reviewHandoff()
    const outcome = strictHandoff({ route, next_action: { route, description: 'Follow independently reviewed outcome.' },
      verified_evidence: [{ kind: 'review-verdict', value: 'Independent native review.', url: reviewUrl }] })
    const initialBody = initial.body
    for (const order of [[initial, outcome], [outcome, initial]]) {
      const evidence = evidenceFor([review], order)
      const before = JSON.stringify(evidence)
      expect(routeContext(evidence).route).toBe(expected)
      expect(JSON.stringify(evidence)).toBe(before)
      expect(initial.body).toBe(initialBody)
    }
  })

  function verifyPredecessor() {
    const handoff = strictHandoff({
      route: 'VERIFY',
      next_action: { route: 'VERIFY', description: 'Verify the pushed exact head.' },
      verified_evidence: [{ kind: 'focused-tests', value: 'Implementation validation passed.', url: null }],
    })
    return { ...handoff, id: 901, url: 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-901' }
  }

  function nativeReviewOutcome(route: 'FIX' | 'FOUNDER_GATE', reviewId = 200, commentId = 900) {
    const handoff = strictHandoff({
      route,
      next_action: { route, description: `Follow the exact-head ${route} outcome.` },
      verified_evidence: [{
        kind: 'review-verdict',
        value: 'Independent exact-head native review outcome.',
        url: `https://github.com/boat1994/bemoat-web-starter/pull/411#pullrequestreview-${reviewId}`,
      }],
    })
    return {
      ...handoff,
      id: commentId,
      url: `https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-${commentId}`,
    }
  }

  it.each([
    ['blocking review, predecessor first', 'FIX', nativeBlockingReview(), 'FIX', false],
    ['blocking review, outcome first', 'FIX', nativeBlockingReview(), 'FIX', true],
    ['eligible review, predecessor first', 'FOUNDER_GATE', nativeReview(), 'FOUNDER_GATE', false],
    ['eligible review, outcome first', 'FOUNDER_GATE', nativeReview(), 'FOUNDER_GATE', true],
  ] as const)('accepts a VERIFY predecessor with a valid %s outcome', (_label, route, review, expected, outcomeFirst) => {
    const predecessor = verifyPredecessor()
    const outcome = nativeReviewOutcome(route)
    const order = outcomeFirst ? [outcome, predecessor] : [predecessor, outcome]
    const evidence = evidenceFor([review], order)
    const before = JSON.stringify(evidence)
    const originalBodies = order.map(({ body }) => body)
    expect(routeContext(evidence).route).toBe(expected)
    expect(JSON.stringify(evidence)).toBe(before)
    expect(order.map(({ body }) => body)).toEqual(originalBodies)
  })

  it('keeps an unrelated exact-head outcome beside VERIFY at STOP', () => {
    const unrelated = strictHandoff({
      route: 'COMPLETE',
      next_action: { route: 'COMPLETE', description: 'Mark the unrelated objective complete.' },
      verified_evidence: [{ kind: 'focused-tests', value: 'Validation evidence.', url: null }],
    })
    expect(routeContext(evidenceFor([], [verifyPredecessor(), { ...unrelated, id: 902 }])).route).toBe('STOP')
  })

  it('keeps competing FIX and FOUNDER_GATE outcomes beside VERIFY at STOP', () => {
    const evidence = evidenceFor(
      [nativeBlockingReview(), nativeReview({ id: 201 })],
      [verifyPredecessor(), nativeReviewOutcome('FIX'), nativeReviewOutcome('FOUNDER_GATE', 201, 902)],
    )
    expect(routeContext(evidence).route).toBe('STOP')
  })

  it('keeps a malformed exact-head outcome beside VERIFY at STOP', () => {
    const malformed = mutateHandoffIdentity(nativeReviewOutcome('FIX'), (payload) => {
      const pr = payload.pr as Record<string, unknown>
      pr.head_sha = 'not-a-full-commit-sha'
    })
    expect(routeContext(evidenceFor([nativeBlockingReview()], [verifyPredecessor(), malformed])).route).toBe('STOP')
  })

  it('resolves an exact database-ID review reference to its unique canonical native review', () => {
    const databaseId = 5355572368
    const canonicalUrl = `https://github.com/boat1994/bemoat-web-starter/pull/411#pullrequestreview-${databaseId}`
    const review = nativeBlockingReview({ id: databaseId, url: canonicalUrl })
    const outcome = nativeReviewOutcome('FIX', databaseId)
    expect(routeContext(evidenceFor([review], [outcome])).route).toBe('FIX')
  })

  it('rejects a canonical review reference when the acquired review URL binds elsewhere', () => {
    const review = nativeBlockingReview({
      url: 'https://github.com/other/repo/pull/999#pullrequestreview-200',
    })
    expect(routeContext(evidenceFor([review], [nativeReviewOutcome('FIX')])).route).toBe('STOP')
  })

  it('rejects a review reference with a different numeric database ID', () => {
    const outcome = nativeReviewOutcome('FIX', 201)
    expect(routeContext(evidenceFor([nativeBlockingReview()], [outcome])).route).toBe('STOP')
  })

  it('rejects duplicate database IDs even when only one acquired URL is canonical', () => {
    const duplicate = nativeBlockingReview({
      url: 'https://github.com/other/repo/pull/999#pullrequestreview-200',
    })
    expect(routeContext(evidenceFor([nativeBlockingReview(), duplicate])).route).toBe('STOP')
  })

  it('accepts a lone FIX with native lineage and immutable findings', () => {
    expect(routeContext(evidenceFor()).route).toBe('FIX')
  })

  it.each([
    ['missing', []],
    ['stale', [nativeBlockingReview({ commitId: 'c'.repeat(40) })]],
    ['wrong repository', [nativeBlockingReview({ body: nativeBlockingReview().body.replace('boat1994/bemoat-web-starter', 'other/repo') })]],
    ['wrong Issue', [nativeBlockingReview({ body: nativeBlockingReview().body.replace('#410', '#999') })]],
    ['wrong PR', [nativeBlockingReview({ body: nativeBlockingReview().body.replace('PR #411', 'PR #999') })]],
    ['wrong base', [nativeBlockingReview({ body: nativeBlockingReview().body.replace('`main`', '`dev`') })]],
    ['wrong body head', [nativeBlockingReview({ body: nativeBlockingReview().body.replaceAll(headSha, 'c'.repeat(40)) })]],
    ['missing commit', [nativeBlockingReview({ commitId: null })]],
    ['duplicate ID', [nativeBlockingReview(), nativeBlockingReview()]],
    ['malformed', [nativeBlockingReview({ body: '## REVIEW_VERDICT\n**Verdict:** CORRECTION REQUIRED' })]],
    ['no immutable finding', [nativeReview({ body: nativeReview().body.replace('ELIGIBLE FOR FOUNDER REVIEW', 'CORRECTION REQUIRED') })]],
    ['empty findings', [nativeBlockingReview({ body: nativeBlockingReview().body.replace(/"findings": \[.*\]/, '"findings": []') })]],
    ['stale finding head', [nativeBlockingReview({ body: nativeBlockingReview().body.replace(/"reviewed_head": "[^"]+"/, `"reviewed_head": "${'c'.repeat(40)}"`) })]],
    ['dismissed', [nativeBlockingReview({ state: 'DISMISSED' })]],
    ['conflicting verdict', [nativeBlockingReview(), nativeReview({ id: 201 })]],
  ])('keeps %s referenced review evidence at STOP', (_label, reviews) => {
    expect(routeContext(evidenceFor(reviews)).route).toBe('STOP')
  })

  it.each([
    ['malformed', nativeBlockingReview({ body: '## REVIEW_VERDICT\n**Verdict:** CORRECTION REQUIRED' })],
    ['dismissed', nativeBlockingReview({ state: 'DISMISSED' })],
    ['missing finding', nativeReview({ body: nativeReview().body.replace('ELIGIBLE FOR FOUNDER REVIEW', 'CORRECTION REQUIRED') })],
  ])('keeps %s current native evidence at STOP even without a HANDOFF', (_label, review) => {
    expect(routeContext(evidenceFor([review], [])).route).toBe('STOP')
  })

  it.each([
    'https://github.com/other/repo/pull/411#pullrequestreview-200',
    'https://github.com/boat1994/bemoat-web-starter/pull/999#pullrequestreview-200',
    `${reviewUrl}?query=1`,
    reviewUrl.replace('https:', 'http:'),
    reviewUrl.replace('-200', '-999'),
    reviewUrl.replace('pullrequestreview', 'discussion_r'),
  ])('rejects a non-exact native review reference %s', (url) => {
    expect(routeContext(evidenceFor([nativeBlockingReview()], [strictHandoff({
      verified_evidence: [{ kind: 'review-verdict', value: 'Review.', url }],
    })])).route).toBe('STOP')
  })

  it('does not let native lineage bypass malformed-current HANDOFF (#498)', () => {
    const current = strictHandoff({ verified_evidence: [{ kind: 'review-verdict', value: 'Native review.', url: reviewUrl }] })
    const evidence = evidenceFor([nativeBlockingReview()], [current])
    evidence.durableContext.handoffs!.push(mutateHandoffIdentity(current, (payload) => { payload.issue_number = 410 }))
    expect(routeContext(evidence).route).toBe('STOP')
  })

  it('requires a new exact-head Delta Review after correction', () => {
    const evidence = evidenceFor()
    expect(routeContext(evidence).route).toBe('FIX')
    const correctionHead = 'd'.repeat(40)
    evidence.activePr = prEvidence({ headSha: correctionHead })
    evidence.localGit.head = correctionHead
    evidence.currentHeadVerification!.exactHead = correctionHead
    expect(routeContext(evidence).route).toBe('REVIEW')
    evidence.currentHeadVerification!.reviews.nativeReviews = [nativeReview({
      id: 201, commitId: correctionHead, body: nativeReview().body.replace(headSha, correctionHead),
    })]
    expect(routeContext(evidence).route).toBe('FOUNDER_GATE')
  })

  it('fails closed for conflicting exact-head native verdicts even without a HANDOFF', () => {
    expect(routeContext(evidenceFor([nativeBlockingReview(), nativeReview({ id: 201 })], [])).route).toBe('STOP')
  })
})

describe('#509 publication-era native review lineage during stale-base recovery', () => {
  const repository = 'boat1994/bemoat-web-starter'
  const issueNumber = '504'
  const prNumber = '505'
  const branch = 'fix/504-install-git-hooks-node-typings'
  const oldBase = '46857c0fad0b1746e5a13224d97bcef67831ed71'
  const currentBase = 'a726b5348ec06b6f7e7ec3bcb5cc4dba1f09de9f'
  const reviewedHead = '41187038e7df1bba755f1a44a971f44e51bfd1f9'
  const reviewId = 5353114057
  const handoffId = 5891095039
  const summaryId = 5891525105
  const prUrl = `https://github.com/${repository}/pull/${prNumber}`
  const reviewUrl = `${prUrl}#pullrequestreview-${reviewId}`
  const issueUrl = `https://github.com/${repository}/issues/${issueNumber}`

  function publicationReview(body = `## REVIEW_VERDICT

Reviewed exact head: ${reviewedHead}

Verdict: CORRECTION REQUIRED

Blocking finding:

- tests/int/install-git-hooks.int.spec.ts:5-17 does not exercise the reported TypeScript 6.0.3 plus @types/node 24.13.1 boundary. It substitutes a local NodeTypedCapturedOutput shape and calls an exported helper whose parameter is unknown. That test proves String(output) runtime behavior for an object, Buffer, and string, but it does not compile the actual execFileSync encoding overload that produced TS2554. The checked-in environment remains on @types/node 24.12.3, and this test can stay green if the original inline Buffer.isBuffer(...).toString(utf8) regression returns in installGitHooks. Add durable type-level coverage using the actual Node API inference under 24.13.1, or an equivalent exact-version compile fixture, so the acceptance criterion is protected rather than asserted only by handoff evidence.

Non-blocking observations: String(Buffer) preserves the default UTF-8 behavior, strings pass through unchanged, both managed-path registries include the new test, the four-file diff is minimal, and focused validation passed 83 tests.`, overrides: Partial<NativeReviewEvidence> = {}) {
    return {
      id: reviewId,
      url: reviewUrl,
      state: 'COMMENTED',
      commitId: reviewedHead,
      body,
      ...overrides,
    }
  }

  function publicationSummary(body = `## REVIEW_VERDICT
**Task / Issue:** #${issueNumber}
**Repository:** \`${repository}\`
**PR / base / head:** PR #${prNumber} · \`main\` · \`${reviewedHead}\`
**Verdict:** CORRECTION REQUIRED

Blocking finding:

\`tests/int/install-git-hooks.int.spec.ts\` uses a synthetic \`{ toString(): string }\` shape. It verifies runtime conversion but does not durably compile the actual \`execFileSync(..., { encoding: 'utf8' })\` Node API typing boundary under TypeScript 6.0.3 and \`@types/node\` 24.13.1.

Required correction:

Add durable type-level regression coverage using the actual Node API inference under TypeScript 6.0.3 and \`@types/node\` 24.13.1, or an equivalent exact-version compile fixture. Do not broaden beyond Issue #504.

Source semantic review:
${reviewUrl}`) {
    return {
      id: summaryId,
      body,
      createdAt: '2026-09-29T13:42:52Z',
      url: `${issueUrl}#issuecomment-${summaryId}`,
    }
  }

  function publicationHandoff(overrides: Partial<HandoffRecord> = {}) {
    return {
      ...strictHandoff({
        schema_version: 2,
        repository,
        issue_number: issueNumber,
        branch,
        exact_head: reviewedHead,
        protected_base: { branch: 'main', sha: oldBase },
        pr: { number: prNumber, url: prUrl, base: 'main', head: branch, head_sha: reviewedHead },
        verified_evidence: [{ kind: 'review-verdict', value: 'CORRECTION REQUIRED: the regression test uses a synthetic zero-argument toString shape and does not compile the actual execFileSync encoding return-type boundary under TypeScript 6.0.3 plus @types/node 24.13.1, so the explicit boundary acceptance criterion is not durably protected.', url: reviewUrl }],
        route: 'FIX',
        next_action: { route: 'FIX', description: 'Apply the bounded correction after protected-base recovery.' },
      }),
      id: handoffId,
      createdAt: '2026-09-29T13:17:32Z',
      url: `${issueUrl}#issuecomment-${handoffId}`,
      ...overrides,
    }
  }

  function publicationEvidence({
    handoff = publicationHandoff(),
    handoffs = [handoff],
    reviews = [publicationReview()],
    historicalResults = [publicationSummary()],
  }: {
    handoff?: ReturnType<typeof publicationHandoff>
    handoffs?: Array<ReturnType<typeof publicationHandoff>>
    reviews?: NativeReviewEvidence[]
    historicalResults?: Array<{ id: string | number; body: string; createdAt: string; url: string }>
  } = {}): NormalizedContextEvidence {
    return baseEvidence({
      repository: { owner: 'boat1994', name: 'bemoat-web-starter', nameWithOwner: repository, url: `https://github.com/${repository}` },
      protectedBase: { branch: 'main', sha: currentBase, source: 'live GitHub ref', url: `https://github.com/${repository}/tree/main` },
      policy: { ...baseEvidence().policy, sourceSha: currentBase },
      issue: { ...baseEvidence().issue, number: issueNumber, url: issueUrl, workflowProfile: 'STANDARD' },
      localGit: { ...baseEvidence().localGit, branch, head: reviewedHead, upstream: `origin/${branch}`, originRepository: repository },
      activePr: {
        number: prNumber, state: 'OPEN', draft: false, url: prUrl,
        baseBranch: 'main', baseSha: oldBase, headBranch: branch, headSha: reviewedHead,
        merged: false, mergeCommitSha: null,
      },
      currentHeadVerification: {
        exactHead: reviewedHead,
        checks: { status: 'SUCCESS', complete: true, failed: false, pending: false, required: true },
        reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0, nativeReviews: reviews },
        protection: { available: true, requiredChecks: ['ci'], requiredApprovals: 0 },
      },
      durableContext: { latestHandoff: handoff, handoffs, historicalResults },
      evidenceErrors: [`EVIDENCE_CONFLICT: PR #${prNumber} base does not match live protected main@${currentBase}`],
    })
  }

  it('authorizes the exact publication-era native FIX lineage only for stale-base synchronization', () => {
    const evidence = publicationEvidence()
    const before = structuredClone(evidence)
    const ordinary = structuredClone(evidence)
    ordinary.protectedBase = { ...ordinary.protectedBase, sha: oldBase }
    ordinary.evidenceErrors = []

    expect(routeContext(ordinary).route).toBe('STOP')
    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: true, route: 'FIX' })
    expect(evidence).toEqual(before)
  })

  it('does not require an Issue REVIEW_VERDICT summary to supply native review identity', () => {
    expect(authorizeContextSync(publicationEvidence({ historicalResults: [] }))).toMatchObject({ allowed: true, route: 'FIX' })
  })

  it('accepts agreeing structured identity fields embedded in the publication-era native review', () => {
    const body = publicationReview().body.replace(
      '## REVIEW_VERDICT\n\n',
      `## REVIEW_VERDICT\n**Repository:** \`${repository}\`\n**Task / Issue:** #${issueNumber}\n**PR / base / head:** PR #${prNumber} · \`main\` · \`${reviewedHead}\`\n\n`,
    )
    expect(authorizeContextSync(publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })))
      .toMatchObject({ allowed: true, route: 'FIX' })
  })

  it('accepts a matching explicit branch only for stale-base synchronization', () => {
    const body = publicationReview().body.replace(
      '## REVIEW_VERDICT\n\n',
      `## REVIEW_VERDICT\n**Branch:** \`${branch}\`\n\n`,
    )
    const evidence = publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })
    const ordinary = structuredClone(evidence)
    ordinary.protectedBase = { ...ordinary.protectedBase, sha: oldBase }
    ordinary.evidenceErrors = []

    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: true, route: 'FIX' })
    expect(routeContext(ordinary).route).toBe('STOP')
  })

  it.each([
    ['different branch', 'fix/other-branch'],
    ['malformed branch', `${branch} trailing-text`],
    ['duplicate branch fields', `**Branch:** \`${branch}\`\n**Branch:** \`${branch}\``],
  ])('keeps an explicit %s in the publication-era review at STOP', (_label, branchField) => {
    const body = publicationReview().body.replace(
      '## REVIEW_VERDICT\n\n',
      `## REVIEW_VERDICT\n**Branch:** ${branchField}\n\n`,
    )

    expect(authorizeContextSync(publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })))
      .toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('keeps old review evidence from satisfying a changed PR head', () => {
    const evidence = publicationEvidence()
    const correctionHead = 'c'.repeat(40)
    evidence.activePr = { ...evidence.activePr as NonNullable<NormalizedContextEvidence['activePr']>, headSha: correctionHead } as NormalizedContextEvidence['activePr']
    evidence.localGit = { ...evidence.localGit, head: correctionHead }
    evidence.currentHeadVerification = { ...evidence.currentHeadVerification!, exactHead: correctionHead }

    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: true, route: 'REVIEW' })
  })

  it.each([
    ['plain colon prose', 'TypeScript error: the actual code path still fails.'],
    ['bold label prose', '**Root cause**: the actual code path still fails.'],
  ])('accepts a substantive finding with %s', (_label, finding) => {
    const body = publicationReview().body.replace(
      /Blocking finding:[\s\S]*?(?=\nNon-blocking observations:)/,
      `Blocking finding:\n\n${finding}`,
    )
    expect(authorizeContextSync(publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })))
      .toMatchObject({ allowed: true, route: 'FIX' })
  })

  it.each([
    ['plain', 'Non-blocking observations: the implementation is otherwise sound.'],
    ['bold', '**Non-blocking observations:** the implementation is otherwise sound.'],
    ['bold colon outside', '**Non-blocking observations**: the implementation is otherwise sound.'],
    ['bulleted', '- Non-blocking observations: the implementation is otherwise sound.'],
    ['quoted', '> Non-blocking observations: the implementation is otherwise sound.'],
  ])('does not treat following %s observations as an empty legacy finding', (_label, section) => {
    const body = publicationReview().body.replace(
      /Blocking finding:[\s\S]*$/,
      `Blocking finding:\n\n${section}`,
    )
    expect(authorizeContextSync(publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })))
      .toMatchObject({ allowed: false, route: 'STOP' })
  })

  it.each([
    ['repository', (payload: Record<string, unknown>) => { payload.repository = 'other/repository' }],
    ['Issue', (payload: Record<string, unknown>) => { payload.issue_number = '999' }],
    ['PR', (payload: Record<string, unknown>) => { (payload.pr as Record<string, unknown>).number = '999' }],
    ['branch', (payload: Record<string, unknown>) => { payload.branch = 'fix/other-branch' }],
    ['base', (payload: Record<string, unknown>) => { (payload.protected_base as Record<string, unknown>).sha = currentBase }],
    ['head', (payload: Record<string, unknown>) => { payload.exact_head = 'd'.repeat(40) }],
  ])('keeps a legacy review with a wrong HANDOFF %s at STOP', (_label, mutate) => {
    const original = publicationHandoff()
    const handoff = mutateHandoffIdentity(original, mutate)
    expect(authorizeContextSync(publicationEvidence({ handoff, handoffs: [handoff] }))).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it.each([
    ['review URL', (handoff: ReturnType<typeof publicationHandoff>) => mutateHandoffIdentity(handoff, (payload) => {
      const reference = (payload.verified_evidence as Array<Record<string, unknown>>)[0]!
      reference.url = `${prUrl}#pullrequestreview-${reviewId + 1}`
    })],
  ])('keeps a legacy review with a mismatched HANDOFF %s at STOP', (_label, mutate) => {
    const handoff = mutate(publicationHandoff())
    expect(authorizeContextSync(publicationEvidence({ handoff, handoffs: [handoff] }))).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('keeps a native review with a wrong URL, ID, or commit binding at STOP', () => {
    const review = publicationReview()
    for (const badReview of [
      { ...review, id: reviewId + 1, url: review.url },
      { ...review, url: `${prUrl}#pullrequestreview-${reviewId + 1}` },
      { ...review, commitId: 'e'.repeat(40) },
      { ...review, body: review.body.replace(reviewedHead, 'e'.repeat(40)) },
      { ...review, body: review.body.replace('CORRECTION REQUIRED', 'ELIGIBLE FOR FOUNDER REVIEW') },
      { ...review, body: review.body.replace('Blocking finding:', 'No blocking finding:') },
    ]) {
      expect(authorizeContextSync(publicationEvidence({ reviews: [badReview] }))).toMatchObject({ allowed: false, route: 'STOP' })
    }
  })

  it('rejects a publication-era review when an overlapping structured identity conflicts', () => {
    const identityPrefix = `**Repository:** \`${repository}\`\n**Task / Issue:** #${issueNumber}\n**PR / base / head:** PR #${prNumber} · \`main\` · \`${reviewedHead}\`\n`
    const conflictingBodies = [
      publicationReview().body.replace('## REVIEW_VERDICT\n\n', `## REVIEW_VERDICT\n${identityPrefix.replace(repository, 'other/repository')}\n`),
      publicationReview().body.replace('## REVIEW_VERDICT\n\n', `## REVIEW_VERDICT\n${identityPrefix.replace(`#${issueNumber}`, '#999')}\n`),
      publicationReview().body.replace('## REVIEW_VERDICT\n\n', `## REVIEW_VERDICT\n${identityPrefix.replace(`PR #${prNumber}`, 'PR #999')}\n`),
      publicationReview().body.replace('## REVIEW_VERDICT\n\n', `## REVIEW_VERDICT\n${identityPrefix.replace('`main`', '`staging`')}\n`),
      publicationReview().body.replace('## REVIEW_VERDICT\n\n', `## REVIEW_VERDICT\n${identityPrefix.replace(reviewedHead, 'f'.repeat(40))}\n`),
    ]
    for (const body of conflictingBodies) {
      expect(authorizeContextSync(publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })))
        .toMatchObject({ allowed: false, route: 'STOP' })
    }
  })

  it.each([
    ['different protected-base SHA', currentBase],
    ['malformed protected-base SHA', 'not-a-full-sha'],
  ])('keeps a publication-era review with an explicit %s at STOP', (_label, baseSha) => {
    const body = publicationReview().body.replace(
      '## REVIEW_VERDICT\n\n',
      `## REVIEW_VERDICT\n**Approved base:** main@${baseSha}\n\n`,
    )

    expect(authorizeContextSync(publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })))
      .toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('accepts a publication-era review whose explicit protected-base SHA matches the bound HANDOFF', () => {
    const body = publicationReview().body.replace(
      '## REVIEW_VERDICT\n\n',
      `## REVIEW_VERDICT\n**Approved base:** main@${oldBase}\n\n`,
    )

    expect(authorizeContextSync(publicationEvidence({ reviews: [publicationReview(body)], historicalResults: [] })))
      .toMatchObject({ allowed: true, route: 'FIX' })
  })

  it('requires an existing historical summary to agree with the native review lineage', () => {
    const summary = publicationSummary()
    const conflictingBodies = [
      summary.body.replace(`\`${repository}\``, '`other/repository`'),
      summary.body.replace(`#${issueNumber}`, '#999'),
      summary.body.replace(`PR #${prNumber}`, 'PR #999'),
      summary.body.replace('`main`', '`staging`'),
      summary.body.replace(reviewedHead, 'f'.repeat(40)),
      summary.body.replace('CORRECTION REQUIRED', 'ELIGIBLE FOR FOUNDER REVIEW'),
      summary.body.replace(reviewUrl, `${prUrl}#pullrequestreview-${reviewId + 1}`),
    ]
    for (const body of conflictingBodies) {
      expect(authorizeContextSync(publicationEvidence({ historicalResults: [{ ...summary, body }] })))
        .toMatchObject({ allowed: false, route: 'STOP' })
    }
    for (const candidate of [
      { ...summary, id: summaryId + 1 },
      { ...summary, url: `${issueUrl}#issuecomment-${summaryId + 1}` },
      { ...summary, url: `${issueUrl}?view=1#issuecomment-${summaryId}` },
    ]) {
      expect(authorizeContextSync(publicationEvidence({ historicalResults: [candidate] })))
        .toMatchObject({ allowed: false, route: 'STOP' })
    }
  })

  it('requires the Handoff review reference value to state one unambiguous blocking outcome', () => {
    for (const value of [
      'Implementation checks passed.',
      'CORRECTION REQUIRED and ELIGIBLE FOR FOUNDER REVIEW',
    ]) {
      const handoff = mutateHandoffIdentity(publicationHandoff(), (payload) => {
        (payload.verified_evidence as Array<Record<string, unknown>>)[0]!.value = value
      })
      expect(authorizeContextSync(publicationEvidence({ handoff, handoffs: [handoff] })))
        .toMatchObject({ allowed: false, route: 'STOP' })
    }
  })

  it('requires the append-only Handoff to remain bound to its exact Issue comment ID and URL', () => {
    const handoff = publicationHandoff()
    for (const candidate of [
      { ...handoff, id: handoffId + 1 },
      { ...handoff, url: `${issueUrl}#issuecomment-${handoffId + 1}` },
      { ...handoff, url: `${issueUrl}?view=1#issuecomment-${handoffId}` },
    ]) {
      expect(authorizeContextSync(publicationEvidence({ handoff: candidate, handoffs: [candidate] })))
        .toMatchObject({ allowed: false, route: 'STOP' })
    }
  })

  it('keeps duplicate HANDOFFs, duplicate review IDs, and competing review summaries at STOP', () => {
    const handoff = publicationHandoff()
    const duplicateHandoff = { ...handoff, id: handoffId + 1, url: `${issueUrl}#issuecomment-${handoffId + 1}` }
    const review = publicationReview()
    const duplicateSummary = { ...publicationSummary(), id: summaryId + 1, url: `${issueUrl}#issuecomment-${summaryId + 1}` }

    expect(authorizeContextSync(publicationEvidence({ handoffs: [handoff, duplicateHandoff] }))).toMatchObject({ allowed: false, route: 'STOP' })
    expect(authorizeContextSync(publicationEvidence({ reviews: [review, review] }))).toMatchObject({ allowed: false, route: 'STOP' })
    expect(authorizeContextSync(publicationEvidence({ reviews: [
      review,
      { ...review, id: reviewId + 1, url: `${prUrl}#pullrequestreview-${reviewId + 1}` },
    ] }))).toMatchObject({ allowed: false, route: 'STOP' })
    expect(authorizeContextSync(publicationEvidence({ historicalResults: [publicationSummary(), duplicateSummary] }))).toMatchObject({ allowed: false, route: 'STOP' })
  })

  it('retains strict #503 immutable-finding validation for current-format native reviews', () => {
    const currentBody = `## REVIEW_VERDICT
**Repository:** \`${repository}\`
**Task / Issue:** #${issueNumber}
**PR / base / head:** PR #${prNumber} · \`main\` · \`${reviewedHead}\`
**Verdict:** CORRECTION REQUIRED

### Immutable finding disposition
\`\`\`json
{ "schema_version": 1, "reviewed_head": "${reviewedHead}", "findings": [{ "id": "CTX-509-001", "canonical_summary": "Preserve bounded historical review recovery", "source_thread": "${reviewUrl}", "required_evidence": ["Exact native review identity"] }] }
\`\`\``
    const modernHandoff = publicationHandoff()
    const modernEvidence = publicationEvidence({
      handoff: mutateHandoffIdentity(modernHandoff, (payload) => {
        (payload.verified_evidence as Array<Record<string, unknown>>)[0]!.value = 'CORRECTION REQUIRED on the exact reviewed head.'
      }),
      reviews: [publicationReview(currentBody)],
      historicalResults: [],
    })
    expect(authorizeContextSync(modernEvidence)).toMatchObject({ allowed: true, route: 'FIX' })

    const missingFinding = publicationEvidence({
      reviews: [publicationReview(currentBody.replace(/### Immutable finding disposition[\s\S]*/, ''))],
      historicalResults: [],
    })
    expect(authorizeContextSync(missingFinding)).toMatchObject({ allowed: false, route: 'STOP' })
  })
})

describe('advisory model preferences cannot supply workflow evidence', () => {
  // A model recommendation or worker report is not native CI, review, Founder,
  // STOP-resolution, or next-objective authorization evidence.
  const workerReport = {
    role: 'independent_semantic_delta_review', model_class: 'Sol', effort: 'High',
    rationale: 'Worker reports completion.', escalation_trigger: 'Conflicting evidence',
    completed: true, recommended_next_route: 'COMPLETE', next_objective: 'Start dependent work',
  }

  it.each([
    ['no PR', {}, 'IMPLEMENT'],
    ['conflicting evidence', { evidenceErrors: ['EVIDENCE_CONFLICT: unresolved authority'] }, 'STOP'],
    ['pending CI', {
      activePr: prEvidence(),
      currentHeadVerification: verification({
        checks: { status: 'PENDING', complete: false, failed: false, pending: true, required: true },
      }),
    }, 'VERIFY'],
    ['failed CI', {
      activePr: prEvidence(),
      currentHeadVerification: verification({
        checks: { status: 'FAILURE', complete: true, failed: true, pending: false, required: true },
      }),
    }, 'FIX'],
    ['missing independent review', {
      activePr: prEvidence(), currentHeadVerification: verification(),
    }, 'REVIEW'],
    ['independent review present, Founder approval still required', {
      activePr: prEvidence(),
      currentHeadVerification: verification({
        reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0, nativeReviews: [nativeReview()] },
      }),
    }, 'FOUNDER_GATE'],
  ] satisfies Array<[string, Partial<NormalizedContextEvidence>, string]>)('preserves %s despite a completed worker and a recommendation to continue', (_label, overrides, expected) => {
    const evidence = baseEvidence(overrides)
    const withAdvisoryReport = { ...evidence, modelRecommendation: workerReport }
    const result = routeContext(withAdvisoryReport)
    expect(result.route).toBe(expected)
    expect(result).toEqual(routeContext(evidence))
  })

  it('cannot turn a model recommendation into a HANDOFF schema extension or next-objective route', () => {
    const envelope = strictHandoff().body.match(/```json\n([\s\S]+)\n```\n$/)!
    const record = JSON.parse(envelope[1]!)
    expect(() => parseHandoffBody(JSON.stringify({ ...record, modelRecommendation: workerReport }))).toThrow()
    expect(() => parseHandoffBody(JSON.stringify({
      ...record, next_action: { route: 'START_NEXT_OBJECTIVE', description: 'Worker completed.' },
    }))).toThrow()
  })
})
