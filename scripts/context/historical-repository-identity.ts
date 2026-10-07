export const CANONICAL_REPOSITORY = 'bemoat/bemoat-web-starter'
export const HISTORICAL_REPOSITORY = 'boat1994/bemoat-web-starter'
export const CANONICAL_REPOSITORY_ID = 1267006707

export function nativeReviewReference(url: string, currentRepository: string, prNumber: string): { reviewId: number; historicalReference: boolean } | null {
  const prefix = `https://github.com/${currentRepository}/pull/${prNumber}#pullrequestreview-`
  const historicalPrefix = `https://github.com/${HISTORICAL_REPOSITORY}/pull/${prNumber}#pullrequestreview-`
  const historicalReference = currentRepository !== HISTORICAL_REPOSITORY && url.startsWith(historicalPrefix)
  const matchedPrefix = historicalReference ? historicalPrefix : prefix
  if (!url.startsWith(matchedPrefix)) return null
  const idText = url.slice(matchedPrefix.length)
  if (!/^[1-9]\d*$/.test(idText)) return null
  const reviewId = Number(idText)
  return Number.isSafeInteger(reviewId) ? { reviewId, historicalReference } : null
}

export interface HistoricalRepositoryIdentityProof {
  claim: string
  resource: { id: string | number; url: string; body?: string }
  parent: { kind: 'issue' | 'pull'; id: string | number; url: string; repositoryUrl: string }
  currentRepository: { id: string | number; fullName: string; url: string }
  historicalRepository: { id: string | number; fullName: string; url: string }
}

export function repositoryClaimMatches(
  claim: string,
  currentRepository: string,
  proof: HistoricalRepositoryIdentityProof | null | undefined,
  resource: { id: string | number; url: string; body?: string },
): boolean {
  if (claim === currentRepository) return true
  if (currentRepository !== CANONICAL_REPOSITORY) return false
  return provesHistoricalRepositoryIdentity(proof, {
    claim,
    resourceId: resource.id,
    parentId: proof?.parent.id ?? '',
    resourceUrl: resource.url,
    parentUrl: proof?.parent.url ?? '',
    repositoryUrl: proof?.parent.repositoryUrl ?? '',
    ...(resource.body === undefined ? {} : { body: resource.body }),
  })
}

export function pullRequestUrlMatchesRepositoryClaim(
  claim: string,
  currentRepository: string,
  url: unknown,
  number: string,
  proof: HistoricalRepositoryIdentityProof | null | undefined,
  resource: { id: string | number; url: string; body?: string },
): boolean {
  if (claim === currentRepository) return url === `https://github.com/${currentRepository}/pull/${number}`
  return claim === HISTORICAL_REPOSITORY && repositoryClaimMatches(claim, currentRepository, proof, resource) &&
    url === `https://github.com/${HISTORICAL_REPOSITORY}/pull/${number}`
}

function positiveId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value
  return null
}

/** A single, stateless proof check for an immutable resource linked to a transferred repository. */
export function provesHistoricalRepositoryIdentity(
  proof: HistoricalRepositoryIdentityProof | null | undefined,
  expected: { claim: string; resourceId: string | number; parentId: string | number; resourceUrl: string; parentUrl: string; repositoryUrl: string; body?: string },
): boolean {
  if (!proof || proof.claim !== expected.claim || proof.claim !== HISTORICAL_REPOSITORY) return false
  if (expected.claim === CANONICAL_REPOSITORY) return false
  const resourceId = positiveId(proof.resource.id)
  const parentId = positiveId(proof.parent.id)
  const currentId = positiveId(proof.currentRepository.id)
  const historicalId = positiveId(proof.historicalRepository.id)
  if (!resourceId || !parentId || !currentId || !historicalId || resourceId !== positiveId(expected.resourceId) || parentId !== positiveId(expected.parentId)) return false
  if (currentId !== String(CANONICAL_REPOSITORY_ID) || historicalId !== currentId) return false
  if (proof.currentRepository.fullName !== CANONICAL_REPOSITORY || proof.historicalRepository.fullName !== CANONICAL_REPOSITORY) return false
  if (proof.resource.url !== expected.resourceUrl || proof.parent.url !== expected.parentUrl || proof.parent.repositoryUrl !== expected.repositoryUrl) return false
  if (proof.parent.repositoryUrl !== `https://api.github.com/repos/${CANONICAL_REPOSITORY}`) return false
  if (expected.body !== undefined && proof.resource.body !== expected.body) return false
  if (typeof proof.currentRepository.url !== 'string' || !/^https:\/\/api\.github\.com\/repos\/bemoat\/bemoat-web-starter$/.test(proof.currentRepository.url)) return false
  if (typeof proof.historicalRepository.url !== 'string' || !/^https:\/\/api\.github\.com\/repos\/(?:boat1994|bemoat)\/bemoat-web-starter$/.test(proof.historicalRepository.url)) return false
  const issueComment = proof.resource.url.match(/^https:\/\/github\.com\/bemoat\/bemoat-web-starter\/issues\/([1-9]\d*)#issuecomment-([1-9]\d*)$/)
  const pullReview = proof.resource.url.match(/^https:\/\/github\.com\/bemoat\/bemoat-web-starter\/pull\/([1-9]\d*)#pullrequestreview-([1-9]\d*)$/)
  if (issueComment) {
    if (issueComment[2] !== resourceId) return false
    if (proof.parent.kind !== 'issue' || proof.parent.url !== `https://api.github.com/repos/${CANONICAL_REPOSITORY}/issues/${issueComment[1]}`) return false
  } else if (pullReview) {
    if (pullReview[2] !== resourceId) return false
    if (proof.parent.kind !== 'pull' || proof.parent.url !== `https://api.github.com/repos/${CANONICAL_REPOSITORY}/pulls/${pullReview[1]}`) return false
  } else return false
  return true
}
