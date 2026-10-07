import type { ActivePullRequestEvidence, NormalizedContextEvidence, RoleEvidence } from './model.ts'
import { pullRequestUrlMatchesRepositoryClaim, repositoryClaimMatches } from './historical-repository-identity.ts'

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function isIdentityString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }

function compareIdentityValue(
  payload: Record<string, unknown>, key: string, expected: string,
  valid: (value: unknown) => boolean = isIdentityString, normalizeSha = false, caseFoldMalformed = false,
): { recognized: boolean; malformed: boolean; mismatch: boolean; matched: boolean } {
  if (!(key in payload)) return { recognized: false, malformed: true, mismatch: false, matched: false }
  const value = payload[key]
  if (typeof value !== 'string' || !valid(value)) return { recognized: true, malformed: true, mismatch: false, matched: false }
  const actual = normalizeSha ? value.toLowerCase() : value
  const wanted = normalizeSha ? expected.toLowerCase() : expected
  const mismatch = actual !== wanted
  const noncanonicalSameIdentity = caseFoldMalformed && mismatch && actual.toLowerCase() === wanted.toLowerCase()
  return { recognized: true, malformed: noncanonicalSameIdentity, mismatch: mismatch && !noncanonicalSameIdentity, matched: !mismatch || noncanonicalSameIdentity }
}

export function handoffIdentityStatus(
  payload: unknown, evidence: NormalizedContextEvidence, activePr: ActivePullRequestEvidence, nativeComment: RoleEvidence,
): 'current' | 'stale' | 'unknown' | 'malformed-current' {
  if (!isRecord(payload)) return 'unknown'
  const positiveIntegerString = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value)
  const fullShaString = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value)
  const repositoryString = (value: unknown) => isIdentityString(value) && /^[^/\s:]+\/[^/\s:]+$/.test(value)
  const pullRequestUrl = (value: unknown) => isIdentityString(value) && /^https:\/\/github\.com\/[^/?#\s:]+\/[^/?#\s:]+\/pull\/[1-9]\d*$/.test(value)
  let recognized = false
  let matched = false
  let malformed = false
  let mismatch = false
  const compare = (result: { recognized: boolean; malformed: boolean; mismatch: boolean; matched: boolean }) => {
    recognized ||= result.recognized
    matched ||= result.matched
    malformed ||= result.malformed
    mismatch ||= result.mismatch
  }
  const claimedRepository = payload.repository
  const repositoryValid = repositoryString(claimedRepository)
  const repositoryMatches = typeof claimedRepository === 'string' && repositoryValid && repositoryClaimMatches(
    claimedRepository, evidence.repository.nameWithOwner, nativeComment.repositoryIdentityProof,
    { id: nativeComment.id, url: nativeComment.url, body: nativeComment.body },
  )
  if (claimedRepository === evidence.repository.nameWithOwner) {
    compare(compareIdentityValue(payload, 'repository', evidence.repository.nameWithOwner, repositoryString, false, true))
  } else if (repositoryMatches) {
    recognized = true
    matched = true
  } else {
    compare(compareIdentityValue(payload, 'repository', evidence.repository.nameWithOwner, repositoryString, false, true))
  }
  compare(compareIdentityValue(payload, 'issue_number', evidence.issue.number, positiveIntegerString))
  compare(compareIdentityValue(payload, 'branch', activePr.headBranch))
  compare(compareIdentityValue(payload, 'exact_head', activePr.headSha, fullShaString, true))
  if (isRecord(payload.protected_base)) {
    compare(compareIdentityValue(payload.protected_base, 'branch', activePr.baseBranch))
    compare(compareIdentityValue(payload.protected_base, 'sha', activePr.baseSha, fullShaString, true))
  } else {
    recognized ||= 'protected_base' in payload
    malformed = true
  }
  if (isRecord(payload.pr)) {
    compare(compareIdentityValue(payload.pr, 'number', activePr.number, positiveIntegerString))
    const claimedPrUrl = payload.pr.url
    if (claimedRepository === evidence.repository.nameWithOwner) {
      compare(compareIdentityValue(payload.pr, 'url', activePr.url, pullRequestUrl, false, true))
    } else if (pullRequestUrlMatchesRepositoryClaim(
      String(claimedRepository), evidence.repository.nameWithOwner, claimedPrUrl, activePr.number,
      nativeComment.repositoryIdentityProof, { id: nativeComment.id, url: nativeComment.url, body: nativeComment.body },
    )) {
      recognized = true
      matched = true
    } else {
      compare(compareIdentityValue(payload.pr, 'url', activePr.url, pullRequestUrl, false, true))
    }
    compare(compareIdentityValue(payload.pr, 'base', activePr.baseBranch))
    compare(compareIdentityValue(payload.pr, 'head', activePr.headBranch))
    compare(compareIdentityValue(payload.pr, 'head_sha', activePr.headSha, fullShaString, true))
  } else {
    recognized ||= 'pr' in payload
    malformed = true
  }
  if (mismatch) return 'stale'
  if (recognized && matched && malformed) return 'malformed-current'
  if (recognized && matched) return 'current'
  return 'unknown'
}
