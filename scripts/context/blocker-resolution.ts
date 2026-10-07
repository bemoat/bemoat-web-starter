import { createHash } from 'node:crypto'

import type { ActivePullRequestEvidence, HistoricalBlockerResolutionProof, NormalizedContextEvidence, PolicyEvidence, RoleEvidence } from './model.ts'
import type { HandoffRecord } from '../handoff/schema.ts'
import { repositoryClaimMatches } from './historical-repository-identity.ts'

export type BlockerResolutionRecord = {
  schema_version: 1
  record_type: 'BLOCKER_RESOLUTION'
  repository: string
  issue_number: string
  pr_number: string
  exact_head: string
  protected_base: { branch: string; sha: string }
  policy: { path: string; policy_id: string; version: string; source_sha: string }
  source_stop_handoff: { comment_id: string; url: string }
  blocker_id: string
  authority: { role: 'FOUNDER'; login: string }
}

export type NoPrBlockerResolutionRecord = {
  schema_version: 2
  record_type: 'BLOCKER_RESOLUTION'
  repository: string
  issue_number: string
  pr_number: null
  branch: string
  exact_head: string
  protected_base: { branch: string; sha: string }
  policy: { path: string; policy_id: string; version: string; source_sha: string }
  source_stop_handoff: { comment_id: string; url: string }
  blocker_id: string
  authority: { role: 'FOUNDER'; login: string }
}

type AnyBlockerResolutionRecord = BlockerResolutionRecord | NoPrBlockerResolutionRecord

type StopBlockerResolution = 'resolved' | 'unresolved' | 'conflict'

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).sort().join('\u0000') === [...keys].sort().join('\u0000')
}

function render(record: BlockerResolutionRecord): string {
  return `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
}

export function parseBlockerResolutionRecord(body: string): BlockerResolutionRecord | null {
  const match = body.match(/^## BLOCKER_RESOLUTION\n\n```json\n([\s\S]+)\n```\n$/)
  if (!match) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1]!)
  } catch {
    return null
  }
  if (!hasExactKeys(parsed, [
    'schema_version', 'record_type', 'repository', 'issue_number', 'pr_number', 'exact_head',
    'protected_base', 'policy', 'source_stop_handoff', 'blocker_id', 'authority',
  ])) return null
  if (parsed.schema_version !== 1 || parsed.record_type !== 'BLOCKER_RESOLUTION') return null
  if (typeof parsed.repository !== 'string' || !parsed.repository ||
      typeof parsed.issue_number !== 'string' || !/^[1-9]\d*$/.test(parsed.issue_number) ||
      typeof parsed.pr_number !== 'string' || !/^[1-9]\d*$/.test(parsed.pr_number) ||
      typeof parsed.exact_head !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.exact_head) ||
      typeof parsed.blocker_id !== 'string' || !ID_RE.test(parsed.blocker_id)) return null
  if (!hasExactKeys(parsed.protected_base, ['branch', 'sha']) ||
      typeof parsed.protected_base.branch !== 'string' || !parsed.protected_base.branch ||
      typeof parsed.protected_base.sha !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.protected_base.sha)) return null
  if (!hasExactKeys(parsed.policy, ['path', 'policy_id', 'version', 'source_sha']) ||
      typeof parsed.policy.path !== 'string' || !parsed.policy.path ||
      typeof parsed.policy.policy_id !== 'string' || !parsed.policy.policy_id ||
      typeof parsed.policy.version !== 'string' || !parsed.policy.version ||
      typeof parsed.policy.source_sha !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.policy.source_sha)) return null
  if (!hasExactKeys(parsed.source_stop_handoff, ['comment_id', 'url']) ||
      typeof parsed.source_stop_handoff.comment_id !== 'string' || !/^[1-9]\d*$/.test(parsed.source_stop_handoff.comment_id) ||
      typeof parsed.source_stop_handoff.url !== 'string' || !parsed.source_stop_handoff.url) return null
  if (!hasExactKeys(parsed.authority, ['role', 'login']) || parsed.authority.role !== 'FOUNDER' ||
      typeof parsed.authority.login !== 'string' || !/^[a-zA-Z0-9-]+$/.test(parsed.authority.login)) return null
  const record = parsed as BlockerResolutionRecord
  return render(record) === body ? record : null
}

function renderNoPr(record: NoPrBlockerResolutionRecord): string {
  return `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
}

export function parseNoPrBlockerResolutionRecord(body: string): NoPrBlockerResolutionRecord | null {
  const match = body.match(/^## BLOCKER_RESOLUTION\n\n```json\n([\s\S]+)\n```\n$/)
  if (!match) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1]!)
  } catch {
    return null
  }
  if (!hasExactKeys(parsed, [
    'schema_version', 'record_type', 'repository', 'issue_number', 'pr_number', 'branch', 'exact_head',
    'protected_base', 'policy', 'source_stop_handoff', 'blocker_id', 'authority',
  ])) return null
  if (parsed.schema_version !== 2 || parsed.record_type !== 'BLOCKER_RESOLUTION') return null
  if (typeof parsed.repository !== 'string' || !parsed.repository ||
      typeof parsed.issue_number !== 'string' || !/^[1-9]\d*$/.test(parsed.issue_number) ||
      parsed.pr_number !== null ||
      typeof parsed.branch !== 'string' || !parsed.branch ||
      typeof parsed.exact_head !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.exact_head) ||
      typeof parsed.blocker_id !== 'string' || !ID_RE.test(parsed.blocker_id)) return null
  if (!hasExactKeys(parsed.protected_base, ['branch', 'sha']) ||
      typeof parsed.protected_base.branch !== 'string' || !parsed.protected_base.branch ||
      typeof parsed.protected_base.sha !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.protected_base.sha)) return null
  if (!hasExactKeys(parsed.policy, ['path', 'policy_id', 'version', 'source_sha']) ||
      typeof parsed.policy.path !== 'string' || !parsed.policy.path ||
      typeof parsed.policy.policy_id !== 'string' || !parsed.policy.policy_id ||
      typeof parsed.policy.version !== 'string' || !parsed.policy.version ||
      typeof parsed.policy.source_sha !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.policy.source_sha)) return null
  if (!hasExactKeys(parsed.source_stop_handoff, ['comment_id', 'url']) ||
      typeof parsed.source_stop_handoff.comment_id !== 'string' || !/^[1-9]\d*$/.test(parsed.source_stop_handoff.comment_id) ||
      typeof parsed.source_stop_handoff.url !== 'string' || !parsed.source_stop_handoff.url) return null
  if (!hasExactKeys(parsed.authority, ['role', 'login']) || parsed.authority.role !== 'FOUNDER' ||
      typeof parsed.authority.login !== 'string' || !/^[a-zA-Z0-9-]+$/.test(parsed.authority.login)) return null
  const record = parsed as NoPrBlockerResolutionRecord
  return renderNoPr(record) === body ? record : null
}

const parseRecord = parseBlockerResolutionRecord

export function stopBlockerIds(record: HandoffRecord, source: RoleEvidence, policy: PolicyEvidence): string[] | null {
  const explicit = record.verified_evidence.filter(({ kind }) => kind === 'stop-blocker')
  if (explicit.length > 0) {
    const ids = explicit.map(({ value }) => value)
    if (ids.some((id) => !ID_RE.test(id)) || new Set(ids).size !== ids.length) return null
    return ids
  }

  if (record.schema_version !== 2) return null

  // Schema-v2 STOPs have no blocker list. Bind the one legacy blocker to the
  // immutable action description; stop_conditions remain guardrails, not blockers.
  const description = record.next_action.description.trim()
  if (!description || source.id === '') return null
  const digest = createHash('sha256').update(description, 'utf8').digest('hex')
  const historicalIdentity = `${record.issue_number}:${String(source.id)}:${record.exact_head}:${digest}`
  if (!policy.legacyStopHandoffs?.includes(historicalIdentity)) return null
  return [`legacy-stop:${String(source.id)}:${digest}`]
}

function targetsSource(record: AnyBlockerResolutionRecord | null, source: RoleEvidence): boolean {
  if (!record) return true
  return record.source_stop_handoff.comment_id === String(source.id) || record.source_stop_handoff.url === source.url
}

function exactCommentUrl(comment: RoleEvidence, evidence: NormalizedContextEvidence): boolean {
  if (comment.id === '' || !comment.url) return false
  try {
    const url = new URL(comment.url)
    return url.origin === 'https://github.com' &&
      url.pathname === `/${evidence.repository.nameWithOwner}/issues/${evidence.issue.number}` &&
      url.search === '' && url.hash === `#issuecomment-${String(comment.id)}`
  } catch {
    return false
  }
}

export function hasMalformedNoPrBlockerResolutionEvidence(evidence: NormalizedContextEvidence): boolean {
  if ((evidence.durableContext.invalidBlockerResolutions ?? []).length > 0) return true
  return (evidence.durableContext.blockerResolutions ?? []).some((comment) =>
    parseNoPrBlockerResolutionRecord(comment.body) === null || !exactCommentUrl(comment, evidence),
  )
}

function bindsCurrentStop(
  resolution: BlockerResolutionRecord,
  source: RoleEvidence,
  blockerId: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  return repositoryClaimMatches(resolution.repository, evidence.repository.nameWithOwner, source.repositoryIdentityProof, { id: source.id, url: source.url, body: source.body }) &&
    resolution.issue_number === evidence.issue.number &&
    resolution.pr_number === activePr.number &&
    resolution.exact_head === activePr.headSha &&
    resolution.protected_base.branch === evidence.protectedBase.branch &&
    resolution.protected_base.sha === evidence.protectedBase.sha &&
    resolution.policy.path === evidence.policy.path &&
    resolution.policy.policy_id === evidence.policy.policyId &&
    resolution.policy.version === evidence.policy.version &&
    resolution.policy.source_sha === evidence.policy.sourceSha &&
    resolution.source_stop_handoff.comment_id === String(source.id) &&
    resolution.source_stop_handoff.url === source.url &&
    resolution.blocker_id === blockerId &&
    exactCommentUrl(source, evidence)
}

function bindsNoPrCurrentStop(
  resolution: NoPrBlockerResolutionRecord,
  source: RoleEvidence,
  record: HandoffRecord,
  blockerId: string,
  evidence: NormalizedContextEvidence,
): boolean {
  return record.schema_version === 3 && record.route === 'STOP' && record.pr === null &&
    repositoryClaimMatches(resolution.repository, evidence.repository.nameWithOwner, source.repositoryIdentityProof, { id: source.id, url: source.url, body: source.body }) &&
    resolution.issue_number === evidence.issue.number &&
    resolution.pr_number === null &&
    resolution.branch === record.branch && resolution.branch === evidence.localGit.branch &&
    resolution.exact_head === record.exact_head && resolution.exact_head === evidence.localGit.head &&
    resolution.protected_base.branch === record.protected_base.branch &&
    resolution.protected_base.branch === evidence.protectedBase.branch &&
    resolution.protected_base.sha === evidence.protectedBase.sha &&
    resolution.policy.path === evidence.policy.path &&
    resolution.policy.policy_id === evidence.policy.policyId &&
    resolution.policy.version === evidence.policy.version &&
    resolution.policy.source_sha === evidence.policy.sourceSha &&
    resolution.source_stop_handoff.comment_id === String(source.id) &&
    resolution.source_stop_handoff.url === source.url &&
    resolution.blocker_id === blockerId &&
    exactCommentUrl(source, evidence)
}

function proofPolicyMatches(proof: HistoricalBlockerResolutionProof, current: PolicyEvidence): boolean {
  const historical = proof.historicalPolicy
  return Boolean(historical) && historical.path === current.path && historical.policyId === current.policyId &&
    historical.version === current.version && historical.sourceSha === current.sourceSha &&
    historical.trustedFounderLogin === current.trustedFounderLogin &&
    JSON.stringify(historical.legacyStopHandoffs ?? []) === JSON.stringify(current.legacyStopHandoffs ?? [])
}

function bindsHistoricalStop(
  resolution: BlockerResolutionRecord,
  source: RoleEvidence,
  blockerId: string,
  comment: RoleEvidence,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  proof: HistoricalBlockerResolutionProof,
): boolean {
  const historicalSha = resolution.protected_base.sha
  const currentSha = evidence.protectedBase.sha
  const blobsMatch = proof.historicalContractBlobs?.missionControlGuideSha === evidence.policy.sourceSha &&
    proof.currentContractBlobs?.missionControlGuideSha === evidence.policy.sourceSha &&
    proof.historicalContractBlobs?.commandReferenceSha === proof.currentContractBlobs?.commandReferenceSha
  const ancestry = proof.ancestry
  const historicalPolicy = proof.historicalPolicy
  const policyBinds = Boolean(historicalPolicy) && resolution.policy.path === historicalPolicy.path &&
    resolution.policy.policy_id === historicalPolicy?.policyId &&
    resolution.policy.version === historicalPolicy?.version &&
    resolution.policy.source_sha === historicalPolicy?.sourceSha && proofPolicyMatches(proof, evidence.policy)
  const ancestryBinds = ancestry?.status === 'ahead' && ancestry.baseSha === historicalSha &&
    ancestry.currentSha === currentSha && ancestry.mergeBaseSha === historicalSha &&
    Number.isSafeInteger(ancestry.aheadBy) && ancestry.aheadBy > 0 &&
    Number.isSafeInteger(ancestry.behindBy) && ancestry.behindBy === 0
  return proof.resolutionCommentId === String(comment.id) &&
    /^[0-9a-f]{64}$/.test(proof.resolutionBodySha256) &&
    proof.resolutionBodySha256 === createHash('sha256').update(comment.body, 'utf8').digest('hex') &&
    proof.repository === evidence.repository.nameWithOwner &&
    /^[0-9a-f]{40}$/.test(proof.historicalBase?.sha ?? '') &&
    proof.historicalBase?.branch === evidence.protectedBase.branch && proof.historicalBase?.sha === historicalSha &&
    /^[0-9a-f]{40}$/.test(proof.currentBase?.sha ?? '') &&
    proof.currentBase?.branch === evidence.protectedBase.branch && proof.currentBase?.sha === currentSha &&
    repositoryClaimMatches(resolution.repository, evidence.repository.nameWithOwner, comment.repositoryIdentityProof, { id: comment.id, url: comment.url, body: comment.body }) && resolution.issue_number === evidence.issue.number &&
    resolution.pr_number === activePr.number && resolution.exact_head === activePr.headSha &&
    resolution.protected_base.branch === evidence.protectedBase.branch && historicalSha !== currentSha &&
    resolution.source_stop_handoff.comment_id === String(source.id) &&
    resolution.source_stop_handoff.url === source.url && resolution.blocker_id === blockerId &&
    exactCommentUrl(source, evidence) && exactCommentUrl(comment, evidence) &&
    /^[0-9a-f]{40}$/.test(proof.historicalContractBlobs?.missionControlGuideSha ?? '') &&
    /^[0-9a-f]{40}$/.test(proof.currentContractBlobs?.missionControlGuideSha ?? '') &&
    /^[0-9a-f]{40}$/.test(proof.historicalContractBlobs?.commandReferenceSha ?? '') &&
    /^[0-9a-f]{40}$/.test(proof.currentContractBlobs?.commandReferenceSha ?? '') &&
    blobsMatch && policyBinds && ancestryBinds
}

function historicalProofFor(
  comment: RoleEvidence,
  evidence: NormalizedContextEvidence,
): HistoricalBlockerResolutionProof | null {
  const proofs = Array.isArray(evidence.historicalBlockerResolutionProofs)
    ? evidence.historicalBlockerResolutionProofs
    : []
  const matching = proofs.filter((proof) => Boolean(proof) && typeof proof === 'object' && proof.resolutionCommentId === String(comment.id))
  return matching.length === 1 ? matching[0]! : null
}

export function resolveStopBlockers({
  record,
  source,
  evidence,
  activePr,
}: {
  record: HandoffRecord
  source: RoleEvidence
  evidence: NormalizedContextEvidence
  activePr: ActivePullRequestEvidence | null
}): StopBlockerResolution {
  const blockers = stopBlockerIds(record, source, evidence.policy)
  if (!blockers) return 'conflict'
  const resolutions = evidence.durableContext.blockerResolutions ?? []
  const invalid = evidence.durableContext.invalidBlockerResolutions ?? []
  if (invalid.length > 0) return 'conflict'

  const relevant = resolutions.filter((comment) => {
    const parsed = parseRecord(comment.body) ?? parseNoPrBlockerResolutionRecord(comment.body)
    return targetsSource(parsed, source)
  })
  if (relevant.length === 0) return 'unresolved'

  const parsedRelevant = relevant.map((comment) => ({
    comment,
    parsed: parseRecord(comment.body) ?? parseNoPrBlockerResolutionRecord(comment.body),
  }))
  if (parsedRelevant.some(({ parsed }) => parsed === null)) return 'conflict'
  const records = parsedRelevant as Array<{ comment: RoleEvidence; parsed: AnyBlockerResolutionRecord }>
  const expectedVersion = activePr ? 1 : 2
  if (records.some(({ parsed }) => parsed.schema_version !== expectedVersion)) return 'conflict'
  if (records.some(({ parsed }) => !blockers.includes(parsed.blocker_id))) return 'conflict'

  for (const blockerId of blockers) {
    const matches = records.filter(({ parsed }) => parsed.blocker_id === blockerId)
    if (matches.length === 0) return 'unresolved'
    if (matches.length !== 1) return 'conflict'
    const { comment, parsed } = matches[0]!
    const currentBound = activePr && parsed.schema_version === 1
      ? bindsCurrentStop(parsed, source, blockerId, evidence, activePr) && exactCommentUrl(comment, evidence)
      : !activePr && parsed.schema_version === 2
        ? bindsNoPrCurrentStop(parsed, source, record, blockerId, evidence) && exactCommentUrl(comment, evidence)
        : false
    let trustedFounderLogin = evidence.policy.trustedFounderLogin
    if (!currentBound) {
      if (!activePr || parsed.schema_version !== 1) return 'conflict'
      const proof = historicalProofFor(comment, evidence)
      if (!proof || !bindsHistoricalStop(parsed, source, blockerId, comment, evidence, activePr, proof)) return 'conflict'
      const historicalBlockers = stopBlockerIds(record, source, proof.historicalPolicy)
      if (!historicalBlockers || JSON.stringify(historicalBlockers) !== JSON.stringify(blockers)) return 'conflict'
      trustedFounderLogin = proof.historicalPolicy.trustedFounderLogin
    }
    if (!trustedFounderLogin || !/^[A-Za-z0-9-]+$/.test(trustedFounderLogin) ||
        comment.authorIdentityConflict || !comment.authorLogin ||
        comment.authorLogin.toLowerCase() !== trustedFounderLogin.toLowerCase() ||
        parsed.authority.login.toLowerCase() !== trustedFounderLogin.toLowerCase() ||
        comment.authorAssociation?.toUpperCase() !== 'OWNER') return 'conflict'
  }
  return 'resolved'
}
