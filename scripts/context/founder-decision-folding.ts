import { createHash } from 'node:crypto'
import type { NormalizedContextEvidence, RoleEvidence } from './model.ts'
import type { HandoffRecord } from '../handoff/schema.ts'
import { parseFounderDecisionComment, parseFounderDecisionRepairComment } from './founder-decision.ts'
import { isExactIssueCommentUrl } from './runtime.ts'
import { repositoryClaimMatches } from './historical-repository-identity.ts'

export type ApplicableNoPrHandoff = { source: RoleEvidence; record: HandoffRecord }
type FoldResult = {
  handoffs: ApplicableNoPrHandoff[]
  conflict?: { reason: string; description: string }
}

/** Consume only one exact gate; the caller must evaluate all remaining evidence. */
export function foldNoPrFounderDecision(
  evidence: NormalizedContextEvidence,
  handoffs: ApplicableNoPrHandoff[],
): FoldResult {
  const conflict = (reason: string, description: string): FoldResult => ({ handoffs, conflict: { reason, description } })
  const decisions = evidence.durableContext.founderDecisions ?? []
  if (decisions.length > 1) {
    return conflict(
      `EVIDENCE_CONFLICT: multiple no-PR FOUNDER_DECISION records compete at ${evidence.localGit.head}.`,
      'Resolve competing FOUNDER_DECISION evidence before continuing; timestamps and comment order do not select authority.',
    )
  }

  const repairs = evidence.durableContext.founderDecisionRepairs ?? []
  if (repairs.length > 1 || (repairs.length === 1 && decisions.length !== 1)) {
    return conflict(
      `EVIDENCE_CONFLICT: no-PR FOUNDER_DECISION_REPAIR requires exactly one repair and one malformed predecessor at ${evidence.localGit.head}.`,
      'Resolve orphan or competing Founder decision repair evidence; timestamps and order do not select authority.',
    )
  }
  if (decisions.length === 0) return { handoffs }

  const source = repairs[0] ?? decisions[0]!
  const record = repairs.length === 1
    ? parseFounderDecisionRepairComment(source.body)
    : parseFounderDecisionComment(source.body)
  const gates = handoffs.filter(({ record: handoffRecord }) => handoffRecord.route === 'FOUNDER_GATE')
  const trustedFounderLogin = evidence.policy.trustedFounderLogin
  const gate = gates.length === 1 ? gates[0]! : null
  if (repairs.length === 1) {
    const predecessor = decisions[0]!
    if (!record || record.record_type !== 'FOUNDER_DECISION_REPAIR' || !trustedFounderLogin ||
      parseFounderDecisionComment(predecessor.body) !== null ||
      predecessor.authorIdentityConflict || !predecessor.authorLogin ||
      predecessor.authorLogin.toLowerCase() !== trustedFounderLogin.toLowerCase() ||
      !isExactIssueCommentUrl(predecessor.url, predecessor, evidence) ||
      record.source_founder_decision.comment_id !== String(predecessor.id) ||
      record.source_founder_decision.url !== predecessor.url ||
      record.source_founder_decision.body_sha256 !== createHash('sha256').update(predecessor.body, 'utf8').digest('hex') ||
      String(predecessor.id) === String(source.id) || predecessor.url === source.url ||
      String(predecessor.id) === String(gate?.source.id) || predecessor.url === gate?.source.url ||
      String(source.id) === String(gate?.source.id) || source.url === gate?.source.url
    ) {
      return conflict(
        `EVIDENCE_CONFLICT: no-PR FOUNDER_DECISION_REPAIR is not uniquely bound to one immutable malformed trusted-Founder predecessor at ${evidence.localGit.head}.`,
        'Resolve the exact repair and malformed predecessor bindings before continuing.',
      )
    }
  }
  if (
    !record || !gate || !trustedFounderLogin || source.authorIdentityConflict || !source.authorLogin ||
    source.authorLogin.toLowerCase() !== trustedFounderLogin.toLowerCase() ||
    record.authority.login.toLowerCase() !== trustedFounderLogin.toLowerCase() ||
    !repositoryClaimMatches(record.repository, evidence.repository.nameWithOwner, source.repositoryIdentityProof, { id: source.id, url: source.url, body: source.body }) || record.issue_number !== evidence.issue.number ||
    record.pr_number !== null || record.branch !== evidence.localGit.branch ||
    record.exact_head !== evidence.localGit.head ||
    record.protected_base.branch !== evidence.protectedBase.branch ||
    record.protected_base.sha !== evidence.protectedBase.sha ||
    record.policy.path !== evidence.policy.path || record.policy.policy_id !== evidence.policy.policyId ||
    record.policy.version !== evidence.policy.version || record.policy.source_sha !== evidence.policy.sourceSha ||
    record.source_founder_gate.comment_id !== String(gate.source.id) ||
    record.source_founder_gate.url !== gate.source.url ||
    !isExactIssueCommentUrl(source.url, source, evidence)
  ) {
    return conflict(
      `EVIDENCE_CONFLICT: no-PR FOUNDER_DECISION is malformed, stale, wrong-author, or not uniquely bound to the current exact FOUNDER_GATE at ${evidence.localGit.head}.`,
      'Resolve the exact native Founder decision and source-gate identity before continuing.',
    )
  }

  // Every native comment stays intact, including the malformed predecessor.
  return { handoffs: handoffs.filter(({ source: handoffSource }) => handoffSource !== gate.source) }
}
