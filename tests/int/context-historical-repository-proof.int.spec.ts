import { describe, expect, it } from 'vitest'

import { readGithubEvidence, type ContextCommandResult, type ContextCommandRunner } from '../../scripts/context/evidence.ts'
import { hasCurrentHandoffReviewVerdict, hasNativeReviewLineage, publicationEraNativeReviewLineage } from '../../scripts/context/semantic-review-evidence.ts'
import type { ActivePullRequestEvidence, NativeReviewEvidence, NormalizedContextEvidence } from '../../scripts/context/model.ts'
import type { HandoffRecord } from '../../scripts/handoff/schema.ts'
import { provesHistoricalRepositoryIdentity, pullRequestUrlMatchesRepositoryClaim, repositoryClaimMatches } from '../../scripts/context/historical-repository-identity.ts'

const currentRepo = 'bemoat/bemoat-web-starter'
const historicalRepo = 'boat1994/bemoat-web-starter'
const issueNumber = '578'
const prNumber = '579'
const repositoryId = 1267006707
const headSha = '67b08e3505139da886d22b79a36a0bed31861195'
const baseSha = 'd8cf45d21829b6bde78411f07c335031701003a7'
const reviewId = 7001
const reviewUrl = `https://github.com/${currentRepo}/pull/${prNumber}#pullrequestreview-${reviewId}`
const historicalReviewUrl = `https://github.com/${historicalRepo}/pull/${prNumber}#pullrequestreview-${reviewId}`
const reviewBody = `## REVIEW_VERDICT\n**Repository:** \`${historicalRepo}\`\n**Task / Issue:** #${issueNumber}\n**PR / base / head:** PR #${prNumber} · \`main\` · \`${headSha}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`
const publicationReviewBody = `## REVIEW_VERDICT\n**Repository:** \`${historicalRepo}\`\n**Task / Issue:** #${issueNumber}\n**PR / base / head:** PR #${prNumber} · \`main\` · \`${headSha}\`\nReviewed exact head: ${headSha}\n\nVerdict: CORRECTION REQUIRED\n\nBlocking finding:\n\n- Keep the native review tied to its exact parent.`
const apiRepoUrl = `https://api.github.com/repos/${currentRepo}`
const apiPrUrl = `${apiRepoUrl}/pulls/${prNumber}`

function ok(value: unknown): ContextCommandResult {
  return { status: 0, stdout: JSON.stringify(value), stderr: '', error: null }
}

function reviewStory(body = reviewBody, listReviewState = 'COMMENTED', directReviewState = 'COMMENTED') {
  const calls: string[] = []
  const runner: ContextCommandRunner = (_command, args) => {
    const key = args.join(' ')
    calls.push(key)
    if (args[0] === 'pr' && args[1] === 'list') return ok([{
      number: Number(prNumber),
      url: `https://github.com/${currentRepo}/pull/${prNumber}`,
      headRefName: 'docs/578-execution-response-ux',
      body: '',
      title: 'Issue #578 response UX',
      closingIssuesReferences: [{ number: Number(issueNumber), repository: { nameWithOwner: currentRepo } }],
    }])
    if (args[0] === 'pr' && args[1] === 'view') return ok({
      number: Number(prNumber), state: 'OPEN', isDraft: false,
      url: `https://github.com/${currentRepo}/pull/${prNumber}`,
      baseRefName: 'main', baseRefOid: baseSha,
      headRefName: 'docs/578-execution-response-ux', headRefOid: headSha,
      mergeCommit: null, statusCheckRollup: [],
    })
    if (args[0] === 'issue' && args[1] === 'view') return ok({
      number: Number(issueNumber), title: 'Issue 578', state: 'OPEN',
      url: `https://github.com/${currentRepo}/issues/${issueNumber}`,
      body: '', comments: [],
    })
    if (args.includes(`repos/${currentRepo}/branches/main/protection`)) return ok({})
    if (args.some((arg) => arg.includes(`/pulls/${prNumber}/reviews?`))) return ok([[
      {
        id: reviewId,
        html_url: reviewUrl,
        pull_request_url: apiPrUrl,
        state: listReviewState,
        body,
        commit_id: headSha,
        user: { login: 'reviewer' },
      },
    ]])
    if (args.includes(`repos/${currentRepo}/pulls/${prNumber}/reviews/${reviewId}`)) return ok({
      id: reviewId,
      html_url: reviewUrl,
      pull_request_url: apiPrUrl,
      state: directReviewState,
      body,
      commit_id: headSha,
      user: { login: 'reviewer' },
    })
    if (args.includes(`repos/${currentRepo}/pulls/${prNumber}`)) return ok({
      id: 8001,
      number: Number(prNumber),
      url: apiPrUrl,
      html_url: `https://github.com/${currentRepo}/pull/${prNumber}`,
      base: { repo: { id: repositoryId, full_name: currentRepo, url: apiRepoUrl } },
    })
    if (args.includes(`repos/${currentRepo}`)) return ok({ id: repositoryId, full_name: currentRepo, url: apiRepoUrl })
    if (args.includes(`repos/${historicalRepo}`)) return ok({
      id: repositoryId,
      full_name: currentRepo,
      url: apiRepoUrl,
    })
    return ok('')
  }
  return {
    calls,
    evidence: readGithubEvidence({
      cwd: process.cwd(), env: { NODE_ENV: 'test', PAYLOAD_SECRET: 'test-only-secret' }, repo: currentRepo,
      issueNumber, branch: 'docs/578-execution-response-ux',
      protectedBaseBranch: 'main', protectedBaseSha: baseSha, run: runner,
    }),
  }
}

describe('Issue #582 historical native review parent-chain acquisition', () => {
  // Issue #582 accepts immutable historical review evidence only after exact
  // review ID/URL/body/commit -> exact parent PR -> same-ID repository proof.
  it('attaches exact repository continuity evidence to a historical native review', () => {
    const { evidence, calls } = reviewStory()
    const review = evidence.exactHead?.reviews.nativeReviews?.[0]
    expect(review).toMatchObject({ id: reviewId, url: reviewUrl, body: reviewBody, commitId: headSha })
    expect(review?.repositoryIdentityProof).toMatchObject({
      claim: historicalRepo,
      resource: { id: reviewId, url: reviewUrl, body: reviewBody },
      parent: { kind: 'pull', id: 8001, url: apiPrUrl, repositoryUrl: apiRepoUrl },
      currentRepository: { id: repositoryId, fullName: currentRepo },
      historicalRepository: { id: repositoryId, fullName: currentRepo },
    })
    expect(calls).toContain(`api repos/${currentRepo}/pulls/${prNumber}`)
    expect(calls).toContain(`api repos/${currentRepo}`)
    expect(calls).toContain(`api repos/${historicalRepo}`)
  })

  it('does not attach proof when paginated and exact native review states conflict', () => {
    const { evidence } = reviewStory(reviewBody, 'APPROVED', 'CHANGES_REQUESTED')
    expect(evidence.exactHead?.reviews.nativeReviews?.[0]?.repositoryIdentityProof).toBeUndefined()
  })

  it('consumes a historical native verdict only when its exact review has same-repository proof', () => {
    const { evidence } = reviewStory()
    const review = evidence.exactHead?.reviews.nativeReviews?.[0]
    expect(review?.repositoryIdentityProof).toBeDefined()
    if (!review) return

    const context = {
      repository: {
        owner: 'bemoat', name: 'bemoat-web-starter', nameWithOwner: currentRepo,
        url: `https://github.com/${currentRepo}`,
      },
      issue: { number: issueNumber },
      currentHeadVerification: {
        exactHead: headSha,
        checks: { status: 'SUCCESS', complete: true, failed: false, pending: false, required: false },
        reviews: { required: false, approved: true, exactHead: true, nativeReviews: [review] },
        protection: { available: true, requiredChecks: [], requiredApprovals: 0 },
      },
    } as unknown as NormalizedContextEvidence
    const activePr = {
      number: prNumber, baseBranch: 'main', headSha,
    } as ActivePullRequestEvidence

    expect(hasNativeReviewLineage(reviewUrl, context, activePr, 'ELIGIBLE FOR FOUNDER REVIEW')).toBe(true)
    expect(hasNativeReviewLineage(reviewUrl, {
      ...context,
      currentHeadVerification: {
        exactHead: headSha,
        checks: { status: 'SUCCESS', complete: true, failed: false, pending: false, required: false },
        reviews: { required: false, approved: true, exactHead: true, nativeReviews: [{ ...review, repositoryIdentityProof: undefined }] },
        protection: { available: true, requiredChecks: [], requiredApprovals: 0 },
      },
    }, activePr, 'ELIGIBLE FOR FOUNDER REVIEW')).toBe(false)
  })

  it('accepts a historical HANDOFF review reference only through the exact live native review proof', () => {
    const { evidence } = reviewStory()
    const review = evidence.exactHead?.reviews.nativeReviews?.[0]
    expect(review?.repositoryIdentityProof).toBeDefined()
    if (!review) return
    const context = reviewContext(review)
    const activePr = activePullRequest()
    const handoff = handoffFor(historicalReviewUrl)

    expect(hasCurrentHandoffReviewVerdict(handoff, context, activePr, 'FOUNDER_GATE', 'ELIGIBLE FOR FOUNDER REVIEW')).toBe(true)
    const withoutProof: NativeReviewEvidence = { ...review, repositoryIdentityProof: undefined }
    expect(hasCurrentHandoffReviewVerdict(handoff, reviewContext(withoutProof), activePr, 'FOUNDER_GATE', 'ELIGIBLE FOR FOUNDER REVIEW')).toBe(false)
    expect(hasCurrentHandoffReviewVerdict(handoff, reviewContext({ ...review, repositoryIdentityProof: {
      ...review.repositoryIdentityProof!, historicalRepository: { ...review.repositoryIdentityProof!.historicalRepository, id: 99 },
    } }), activePr, 'FOUNDER_GATE', 'ELIGIBLE FOR FOUNDER REVIEW')).toBe(false)
    expect(hasCurrentHandoffReviewVerdict(handoffFor(historicalReviewUrl.replace(String(reviewId), '7002')), context, activePr, 'FOUNDER_GATE', 'ELIGIBLE FOR FOUNDER REVIEW')).toBe(false)
    expect(hasCurrentHandoffReviewVerdict(handoffFor(`${historicalReviewUrl}x`), context, activePr, 'FOUNDER_GATE', 'ELIGIBLE FOR FOUNDER REVIEW')).toBe(false)
  })

  it('accepts historical publication-era review lineage only with the exact live review proof', () => {
    const { evidence } = reviewStory(publicationReviewBody)
    const review = evidence.exactHead?.reviews.nativeReviews?.[0]
    expect(review?.repositoryIdentityProof).toBeDefined()
    if (!review) return
    const context = reviewContext(review)
    const activePr = activePullRequest()

    expect(publicationEraNativeReviewLineage(historicalReviewUrl, 'CORRECTION REQUIRED', context, activePr)).toMatchObject({ reviewId, reviewUrl: historicalReviewUrl })
    expect(publicationEraNativeReviewLineage(historicalReviewUrl, 'CORRECTION REQUIRED', reviewContext({ ...review, repositoryIdentityProof: undefined }), activePr)).toBeNull()
    expect(publicationEraNativeReviewLineage(`${historicalReviewUrl}x`, 'CORRECTION REQUIRED', context, activePr)).toBeNull()
    expect(publicationEraNativeReviewLineage(historicalReviewUrl, 'CORRECTION REQUIRED', reviewContext({ ...review, repositoryIdentityProof: {
      ...review.repositoryIdentityProof!, historicalRepository: { ...review.repositoryIdentityProof!.historicalRepository, id: 99 },
    } }), activePr)).toBeNull()
  })

  it('rejects central proofs with a noncanonical parent repository URL or resource URL ID suffix', () => {
    const { evidence } = reviewStory()
    const review = evidence.exactHead?.reviews.nativeReviews?.[0]
    const proof = review?.repositoryIdentityProof
    expect(proof).toBeDefined()
    if (!proof || !review) return
    const expected = { claim: historicalRepo, resourceId: reviewId, parentId: 8001, resourceUrl: reviewUrl, parentUrl: apiPrUrl, repositoryUrl: apiRepoUrl, body: reviewBody }
    expect(provesHistoricalRepositoryIdentity(proof, expected)).toBe(true)
    const wrongResourceSuffix = { ...proof, resource: { ...proof.resource, url: reviewUrl.replace(String(reviewId), '7002') } }
    expect(provesHistoricalRepositoryIdentity(wrongResourceSuffix, { ...expected, resourceUrl: wrongResourceSuffix.resource.url })).toBe(false)
    const wrongParentRepository = { ...proof, parent: { ...proof.parent, repositoryUrl: 'https://api.github.com/repos/attacker/other' } }
    expect(repositoryClaimMatches(historicalRepo, currentRepo, wrongParentRepository, { id: reviewId, url: reviewUrl, body: reviewBody })).toBe(false)
  })

  it('binds historical proof to the caller repository for both resource and PR URL claims', () => {
    const { evidence } = reviewStory()
    const review = evidence.exactHead?.reviews.nativeReviews?.[0]
    const proof = review?.repositoryIdentityProof
    expect(proof).toBeDefined()
    if (!proof) return
    expect(repositoryClaimMatches(historicalRepo, 'other/repo', proof, { id: reviewId, url: reviewUrl, body: reviewBody })).toBe(false)
    expect(pullRequestUrlMatchesRepositoryClaim(historicalRepo, 'other/repo', `https://github.com/${historicalRepo}/pull/${prNumber}`, prNumber, proof, { id: reviewId, url: reviewUrl, body: reviewBody })).toBe(false)
  })

})

function reviewContext(review: NonNullable<NonNullable<NormalizedContextEvidence['currentHeadVerification']>['reviews']['nativeReviews']>[number]): NormalizedContextEvidence {
  return {
    repository: { owner: 'bemoat', name: 'bemoat-web-starter', nameWithOwner: currentRepo, url: `https://github.com/${currentRepo}` },
    issue: { number: issueNumber },
    currentHeadVerification: {
      exactHead: headSha,
      checks: { status: 'SUCCESS', complete: true, failed: false, pending: false, required: false },
      reviews: { required: false, approved: true, exactHead: true, nativeReviews: [review] },
      protection: { available: true, requiredChecks: [], requiredApprovals: 0 },
    },
    durableContext: { latestHandoff: null, historicalResults: [] },
  } as unknown as NormalizedContextEvidence
}

function activePullRequest(): ActivePullRequestEvidence {
  return {
    number: prNumber, baseBranch: 'main', baseSha, headBranch: 'docs/578-execution-response-ux',
    headSha, url: `https://github.com/${currentRepo}/pull/${prNumber}`,
  } as ActivePullRequestEvidence
}

function handoffFor(url: string): HandoffRecord {
  return {
    schema_version: 2, record_type: 'HANDOFF', objective_mode: 'implementation', repository: historicalRepo,
    issue_number: issueNumber, objective: 'Review exact historical verdict', permitted_scope: ['review'], prohibited_scope: ['merge'],
    executing_agent: 'agent', provider: 'codex', branch: 'docs/578-execution-response-ux', exact_head: headSha,
    protected_base: { branch: 'main', sha: baseSha },
    pr: { number: prNumber, url: `https://github.com/${currentRepo}/pull/${prNumber}`, base: 'main', head: 'docs/578-execution-response-ux', head_sha: headSha },
    verified_evidence: [{ kind: 'review-verdict', value: 'ELIGIBLE FOR FOUNDER REVIEW', url }],
    route: 'FOUNDER_GATE', next_action: { route: 'FOUNDER_GATE', description: 'Review founder decision' },
    stop_conditions: [], local_durability: { required: true, durable: true, reason: null },
  }
}
