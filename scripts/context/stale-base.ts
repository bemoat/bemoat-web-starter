import type { ActivePullRequestEvidence, NormalizedContextEvidence } from './model.ts'
import { isFullSha } from './runtime.ts'

export function staleBaseError(evidence: NormalizedContextEvidence, prNumber: string): string {
  return `EVIDENCE_CONFLICT: PR #${prNumber} base does not match live protected ${evidence.protectedBase.branch}@${evidence.protectedBase.sha}`
}

export function prBaseIdentityErrors(
  evidence: NormalizedContextEvidence,
  pr: ActivePullRequestEvidence | null,
  number: string,
  merged: boolean,
  allowWellFormedStaleBase: boolean,
): string[] {
  if (!pr || typeof pr.baseBranch !== 'string' || !pr.baseBranch.trim() || typeof pr.baseSha !== 'string' || !isFullSha(pr.baseSha)) {
    return [`EVIDENCE_CONFLICT: PR #${number} base identity is missing or malformed`]
  }
  if (pr.baseBranch !== evidence.protectedBase.branch) {
    return [`EVIDENCE_CONFLICT: PR #${number} base identity does not match the protected branch`]
  }
  if (!merged && pr.baseSha.toLowerCase() !== evidence.protectedBase.sha.toLowerCase() && !allowWellFormedStaleBase) {
    return [staleBaseError(evidence, number)]
  }
  return []
}

function isWellFormedStaleBase(evidence: NormalizedContextEvidence, activePr: ActivePullRequestEvidence): boolean {
  return evidence.issue.state.toUpperCase() === 'OPEN' &&
    activePr.state.toUpperCase() === 'OPEN' &&
    !activePr.merged &&
    typeof evidence.protectedBase.branch === 'string' && Boolean(evidence.protectedBase.branch.trim()) &&
    isFullSha(evidence.protectedBase.sha) &&
    activePr.baseBranch === evidence.protectedBase.branch &&
    isFullSha(activePr.baseSha) &&
    activePr.baseSha.toLowerCase() !== evidence.protectedBase.sha.toLowerCase()
}

export function staleBaseSyncDiagnostic(evidence: NormalizedContextEvidence): string | null {
  const activePr = evidence.activePr
  if (Array.isArray(activePr) || !activePr || !isWellFormedStaleBase(evidence, activePr)) return null

  const expected = staleBaseError(evidence, activePr.number)
  return evidence.evidenceErrors.length === 1 && evidence.evidenceErrors[0] === expected ? expected : null
}
