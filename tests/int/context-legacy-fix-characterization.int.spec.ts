import { describe, expect, it } from 'vitest'

import type { NormalizedContextEvidence } from '../../scripts/context/model.ts'
import { routeContext } from '../../scripts/context/router.ts'
import { authorizeContextSync } from '../../scripts/context/sync.ts'
import { parseProductionMergeReviewVerdict } from '../../scripts/context/merge-review-verdict.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

// Durable #504 / PR #505 evidence at the time of review. The live PR head has
// moved since then; this fixture deliberately binds only to the old exact head.
const repository = 'boat1994/bemoat-web-starter'
const issue = '504'
const pr = '505'
const oldBase = '46857c0fad0b1746e5a13224d97bcef67831ed71'
const liveBase = '89a88f21d73038ebff33a72600be9561e13239ed'
const reviewedHead = '41187038e7df1bba755f1a44a971f44e51bfd1f9'
const laterHead = 'e4256de811006fe27aa7bff0d1f80d9467d686db'
const branch = 'fix/504-install-git-hooks-node-typings'
const reviewId = 5353114057
const handoffId = 5891095039
const reviewUrl = `https://github.com/${repository}/pull/${pr}#pullrequestreview-${reviewId}`

const historicalReviewBody = `## REVIEW_VERDICT

Reviewed exact head: ${reviewedHead}

Verdict: CORRECTION REQUIRED

Blocking finding:

- tests/int/install-git-hooks.int.spec.ts:5-17 does not exercise the reported TypeScript 6.0.3 plus @types/node 24.13.1 boundary. It substitutes a local NodeTypedCapturedOutput shape and calls an exported helper whose parameter is unknown. That test proves String(output) runtime behavior for an object, Buffer, and string, but it does not compile the actual execFileSync encoding overload that produced TS2554. The checked-in environment remains on @types/node 24.12.3, and this test can stay green if the original inline Buffer.isBuffer(...).toString(utf8) regression returns in installGitHooks. Add durable type-level coverage using the actual Node API inference under 24.13.1, or an equivalent exact-version compile fixture, so the acceptance criterion is protected rather than asserted only by handoff evidence.

Non-blocking observations: String(Buffer) preserves the default UTF-8 behavior, strings pass through unchanged, both managed-path registries include the new test, the four-file diff is minimal, and focused validation passed 83 tests.`

function currentFormatReviewBody(head = reviewedHead): string {
  return `## REVIEW_VERDICT
**Repository:** \`${repository}\`
**Task / Issue:** #${issue}
**PR / base / head:** PR #${pr} · \`main\` · \`${head}\`
**Verdict:** CORRECTION REQUIRED

### Immutable finding disposition
\`\`\`json
{ "schema_version": 1, "reviewed_head": "${head}", "findings": [{ "id": "CTX-509-001", "canonical_summary": "Preserve a bounded historical review", "source_thread": "${reviewUrl}", "required_evidence": ["Exact head and canonical review identity"] }] }
\`\`\``
}

function handoff(overrides: Partial<HandoffRecord> = {}) {
  const record: HandoffRecord = {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'implementation',
    repository,
    issue_number: issue,
    objective: 'Independently review the exact PR head and preserve the blocking finding.',
    permitted_scope: ['Review the Node typings regression coverage.'],
    prohibited_scope: ['No implementation or merge.'],
    executing_agent: 'Independent Reviewer Mission Control',
    provider: 'OpenAI Codex',
    branch,
    exact_head: reviewedHead,
    protected_base: { branch: 'main', sha: oldBase },
    pr: { number: pr, url: `https://github.com/${repository}/pull/${pr}`, base: 'main', head: branch, head_sha: reviewedHead },
    verified_evidence: [{ kind: 'review-verdict', value: 'CORRECTION REQUIRED on the exact reviewed head.', url: reviewUrl }],
    route: 'FIX',
    next_action: { route: 'FIX', description: 'Apply the bounded correction after protected-base recovery.' },
    stop_conditions: ['Stop on identity, head, base, or review drift.'],
    local_durability: { required: true, durable: true, reason: null },
    ...overrides,
  }
  return {
    id: handoffId,
    body: renderHandoffComment(record),
    url: `https://github.com/${repository}/issues/${issue}#issuecomment-${handoffId}`,
    createdAt: '2026-09-29T13:17:32Z',
  }
}

function evidence(overrides: Partial<NormalizedContextEvidence> = {}): NormalizedContextEvidence {
  return {
    repository: { owner: 'boat1994', name: 'bemoat-web-starter', nameWithOwner: repository, url: `https://github.com/${repository}` },
    protectedBase: { branch: 'main', sha: liveBase, source: 'live GitHub ref', url: `https://github.com/${repository}/tree/main` },
    policy: { path: 'docs/mission-control/mission-control-guide.md', policyId: 'bemoat-mission-control', version: '1.3.0', sourceSha: '7e2e8bdcb51ac36c74a9ff729eedcc9399352d75', url: `https://github.com/${repository}/blob/${liveBase}/docs/mission-control/mission-control-guide.md` },
    issue: { number: issue, title: 'Node typings regression coverage', state: 'OPEN', url: `https://github.com/${repository}/issues/${issue}`, objective: 'Repair the regression coverage.', scope: 'Node typings harness correction only.', acceptanceCriteria: ['Protect the exact TypeScript boundary.'], dependencies: [], taskSize: 'core', missionControlMode: 'required', workflowProfile: 'STANDARD' },
    localGit: { branch, head: reviewedHead, upstream: `origin/${branch}`, originRepository: repository, clean: true, detached: false, pushed: true, durable: true, reasons: [] },
    activePr: { number: pr, state: 'OPEN', draft: false, url: `https://github.com/${repository}/pull/${pr}`, baseBranch: 'main', baseSha: oldBase, headBranch: branch, headSha: reviewedHead, merged: false, mergeCommitSha: null },
    currentHeadVerification: {
      exactHead: reviewedHead,
      checks: { status: 'SUCCESS', complete: true, failed: false, pending: false, required: true },
      reviews: { required: false, approved: true, exactHead: true, approvedCount: 0, exactHeadApprovedCount: 0,
        nativeReviews: [{ id: reviewId, url: reviewUrl, state: 'COMMENTED', commitId: reviewedHead, body: historicalReviewBody }] },
      protection: { available: true, requiredChecks: ['CI'], requiredApprovals: 0 },
    },
    durableContext: { latestHandoff: handoff(), handoffs: [handoff()], historicalResults: [] },
    evidenceErrors: [`EVIDENCE_CONFLICT: PR #${pr} base does not match live protected main@${liveBase}`],
    ...overrides,
  }
}

function preMovement(source: NormalizedContextEvidence): NormalizedContextEvidence {
  const copy = structuredClone(source)
  copy.protectedBase.sha = oldBase
  copy.evidenceErrors = []
  return copy
}

describe('#509 legacy FIX lineage characterization on protected main', () => {
  it('1 and 12: captures the real #504-shaped old exact head and its baseline STOP', () => {
    const source = evidence()
    expect(source.activePr && !Array.isArray(source.activePr) && source.activePr.headSha).toBe(reviewedHead)
    expect(source.durableContext.latestHandoff?.id).toBe(handoffId)
    expect(parseProductionMergeReviewVerdict(historicalReviewBody, reviewId)).toMatchObject({
      verdict: null, reviewed_head: null,
      repository: null, issue: null, pr: null, base: null,
    })
    expect(historicalReviewBody).toContain(`Reviewed exact head: ${reviewedHead}`)
    expect(historicalReviewBody).toContain('Verdict: CORRECTION REQUIRED')
    expect(routeContext(preMovement(source))).toMatchObject({
      route: 'STOP', reasons: [expect.stringContaining('HANDOFF FIX lacks a valid exact-head review-verdict lineage')],
    })
    expect(authorizeContextSync(source)).toMatchObject({
      allowed: false, route: 'STOP', reasons: [expect.stringContaining('pre-movement context is not otherwise valid')],
    })
  })

  it('2: current-format exact-head FIX lineage remains valid', () => {
    const source = evidence()
    source.currentHeadVerification!.reviews.nativeReviews![0]!.body = currentFormatReviewBody()
    expect(routeContext(preMovement(source)).route).toBe('FIX')
    expect(authorizeContextSync(source)).toMatchObject({ allowed: true, route: 'FIX' })
  })

  it('3: malformed historical review evidence stays STOP', () => {
    const source = evidence()
    source.currentHeadVerification!.reviews.nativeReviews![0]!.body = '## REVIEW_VERDICT\nVerdict: CORRECTION REQUIRED'
    expect(routeContext(preMovement(source)).route).toBe('STOP')
    expect(authorizeContextSync(source).allowed).toBe(false)
  })

  it.each([
    ['repository', { repository: 'other/repository' }],
    ['Issue', { issue_number: '999' }],
    ['base', { protected_base: { branch: 'main', sha: liveBase } }],
    ['branch', { branch: 'fix/other-branch' }],
    ['head', { exact_head: laterHead }],
    ['PR', { pr: { number: '999', url: `https://github.com/${repository}/pull/999`, base: 'main', head: branch, head_sha: reviewedHead } }],
  ] as const)('4: a historical HANDOFF with wrong %s does not authorize recovery', (_label, mismatch) => {
    const record = handoff(mismatch)
    const source = evidence({ durableContext: { latestHandoff: record, handoffs: [record], historicalResults: [] } })
    expect(authorizeContextSync(source).allowed).toBe(false)
  })

  it('5: competing legacy and current FIX records remain STOP', () => {
    const source = evidence()
    source.currentHeadVerification!.reviews.nativeReviews![0]!.body = currentFormatReviewBody()
    const competitor = { ...handoff(), id: handoffId + 1, url: `https://github.com/${repository}/issues/${issue}#issuecomment-${handoffId + 1}` }
    source.durableContext.handoffs = [handoff(), competitor]
    expect(routeContext(preMovement(source)).route).toBe('STOP')
    expect(authorizeContextSync(source).allowed).toBe(false)
  })

  it('6: a current-head historical REVIEW_VERDICT comment remains recognized', () => {
    const source = evidence()
    const commentId = 5891095040
    const commentUrl = `https://github.com/${repository}/issues/${issue}#issuecomment-${commentId}`
    const record = handoff({ verified_evidence: [{ kind: 'review-verdict', value: 'Blocking review comment.', url: commentUrl }] })
    source.durableContext = {
      latestHandoff: record, handoffs: [record],
      historicalResults: [{ id: commentId, url: commentUrl, body: currentFormatReviewBody(), createdAt: '2026-09-29T13:17:33Z' }],
    }
    source.currentHeadVerification!.reviews.nativeReviews = []
    expect(routeContext(preMovement(source)).route).toBe('FIX')
  })

  it('7: routing and authorization do not rewrite append-only HANDOFF evidence', () => {
    const source = evidence()
    const before = JSON.stringify(source)
    routeContext(preMovement(source))
    authorizeContextSync(source)
    expect(JSON.stringify(source)).toBe(before)
    expect(source.durableContext.handoffs).toHaveLength(1)
  })

  it('8: the old review and HANDOFF cannot satisfy a later correction head', () => {
    const source = evidence()
    source.currentHeadVerification!.reviews.nativeReviews![0]!.body = currentFormatReviewBody()
    source.activePr = { ...source.activePr!, headSha: laterHead }
    source.localGit.head = laterHead
    source.currentHeadVerification!.exactHead = laterHead
    expect(routeContext(preMovement(source)).route).toBe('REVIEW')
  })

  it.each([
    ['durability', (source: NormalizedContextEvidence) => { source.localGit.durable = false }],
    ['repository identity', (source: NormalizedContextEvidence) => { source.localGit.originRepository = 'other/repository' }],
    ['approved base', (source: NormalizedContextEvidence) => { source.protectedBase.sha = oldBase; source.evidenceErrors = [] }],
  ])('9: %s safety gate still blocks stale-base recovery', (_label, change) => {
    const source = evidence()
    source.currentHeadVerification!.reviews.nativeReviews![0]!.body = currentFormatReviewBody()
    change(source)
    expect(authorizeContextSync(source).allowed).toBe(false)
  })

  it.each([
    ['canonical URL', (source: NormalizedContextEvidence) => { source.currentHeadVerification!.reviews.nativeReviews![0]!.url = 'https://github.com/other/repository/pull/505#pullrequestreview-5353114057' }],
    ['database ID', (source: NormalizedContextEvidence) => { source.currentHeadVerification!.reviews.nativeReviews![0]!.id = reviewId + 1 }],
    ['immutable finding', (source: NormalizedContextEvidence) => { source.currentHeadVerification!.reviews.nativeReviews![0]!.body = currentFormatReviewBody().replace(/### Immutable finding disposition[\s\S]*/, '') }],
  ])('10: current-format native review rejects wrong %s', (_label, change) => {
    const source = evidence()
    source.currentHeadVerification!.reviews.nativeReviews![0]!.body = currentFormatReviewBody()
    change(source)
    expect(routeContext(preMovement(source)).route).toBe('STOP')
  })
})
