import { createHash } from 'node:crypto'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { foldNoPrFounderDecision } from './founder-decision-folding.ts'
import type { HistoricalNoPrFounderGateReplayProof, NormalizedContextEvidence, RoleEvidence } from './model.ts'
import { parseProtectedPolicyContent } from './policy.ts'
import { extractHandoffPayload, isExactIssueCommentUrl, json, isFullSha, type ContextCommandRunner } from './runtime.ts'
import { parseFounderDecisionComment, parseFounderDecisionRepairComment } from './founder-decision.ts'
import type { ApplicableNoPrHandoff } from './founder-decision-folding.ts'
import { hasMalformedNoPrBlockerResolutionEvidence, resolveStopBlockers } from './blocker-resolution.ts'

const GUIDE_PATH = 'docs/mission-control/mission-control-guide.md'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function hasStaleTerminalHandoff(sources: RoleEvidence[], evidence: NormalizedContextEvidence): boolean {
  return sources.some((source) => {
    const payload = extractHandoffPayload(source.body)
    if (!isRecord(payload) || !['STOP', 'COMPLETE'].includes(String(payload.route)) || payload.pr !== null ||
        payload.repository !== evidence.repository.nameWithOwner || payload.issue_number !== evidence.issue.number ||
        payload.branch !== evidence.localGit.branch || typeof payload.exact_head !== 'string' ||
        !isFullSha(payload.exact_head) || payload.exact_head.toLowerCase() === evidence.localGit.head?.toLowerCase() ||
        !isRecord(payload.protected_base) || payload.protected_base.branch !== evidence.protectedBase.branch ||
        !isRecord(payload.local_durability) || payload.local_durability.durable !== true ||
        !isExactIssueCommentUrl(source.url, source, evidence)) return false
    let record: HandoffRecord
    try { record = parseHandoffBody(JSON.stringify(payload)) } catch { return true }
    return renderHandoffComment(record) === source.body
  })
}

function sha(value: unknown): value is string {
  return isFullSha(value)
}

function readGuideAtSha(repo: string, ref: string, run: ContextCommandRunner, cwd: string, env: NodeJS.ProcessEnv) {
  const result = json<{ type?: unknown; path?: unknown; sha?: unknown; content?: unknown; encoding?: unknown }>(
    run, 'gh', ['api', `repos/${repo}/contents/${GUIDE_PATH}?ref=${ref}`], { cwd, env },
  ).value
  if (result?.type !== 'file' || result.path !== GUIDE_PATH || !sha(result.sha) ||
      result.encoding !== 'base64' || typeof result.content !== 'string') return null
  const encoded = result.content.replace(/\s/g, '')
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return null
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) return null
  const content = bytes.toString('utf8')
  if (!Buffer.from(content, 'utf8').equals(bytes)) return null
  return { sha: result.sha.toLowerCase(), content }
}

function compare(
  repo: string,
  base: string,
  head: string,
  run: ContextCommandRunner,
  cwd: string,
  env: NodeJS.ProcessEnv,
  allowIdentical = false,
) {
  const facts = json<{
    status?: unknown
    ahead_by?: unknown
    behind_by?: unknown
    base_commit?: { sha?: unknown }
    head_commit?: { sha?: unknown }
    merge_base_commit?: { sha?: unknown }
  }>(run, 'gh', ['api', `repos/${repo}/compare/${base}...${head}`], { cwd, env }).value
  const isAhead = facts?.status === 'ahead' && Number.isSafeInteger(facts.ahead_by) &&
    (facts.ahead_by as number) > 0 && facts.behind_by === 0 && facts.base_commit?.sha === base &&
    facts.head_commit?.sha === head && facts.merge_base_commit?.sha === base
  const isIdentical = allowIdentical && facts?.status === 'identical' && facts.ahead_by === 0 &&
    facts.behind_by === 0 && base === head && facts.base_commit?.sha === base &&
    facts.head_commit?.sha === head && facts.merge_base_commit?.sha === base
  if (!isAhead && !isIdentical) return null
  if (isIdentical) return { status: 'identical', mergeBaseSha: base, aheadBy: 0, behindBy: 0 }
  return { status: 'ahead', mergeBaseSha: base, aheadBy: facts.ahead_by as number, behindBy: 0 }
}

function gateRecords(evidence: NormalizedContextEvidence) {
  const handoffs = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])
  return handoffs.flatMap((source) => {
    const payload = extractHandoffPayload(source.body)
    if (!isRecord(payload) || payload.route !== 'FOUNDER_GATE') return []
    try {
      const record = parseHandoffBody(JSON.stringify(payload))
      return record.route === 'FOUNDER_GATE' && record.pr === null ? [{ source, record }] : []
    } catch {
      return []
    }
  })
}

function applicableHistoricalHandoffs(
  evidence: NormalizedContextEvidence,
  head: string,
): ApplicableNoPrHandoff[] {
  const handoffs = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])
  const applicable: ApplicableNoPrHandoff[] = []
  for (const source of handoffs) {
    const payload = extractHandoffPayload(source.body)
    if (!isRecord(payload)) continue
    try {
      const record = parseHandoffBody(JSON.stringify(payload))
      if (record.pr === null && record.repository === evidence.repository.nameWithOwner &&
          record.issue_number === evidence.issue.number && record.branch === evidence.localGit.branch &&
          record.exact_head === head && record.protected_base.branch === evidence.protectedBase.branch &&
          record.local_durability.durable && renderHandoffComment(record) === source.body &&
          isExactIssueCommentUrl(source.url, source, evidence)) applicable.push({ source, record })
    } catch {
      continue
    }
  }
  return applicable
}

/** Fail closed unless the full exact-head handoff history at A still permits ordinary continuation. */
function historicalContextAllowsContinuation(
  evidence: NormalizedContextEvidence,
  historicalEvidence: NormalizedContextEvidence,
  head: string,
  consumedGate: RoleEvidence,
): boolean {
  const handoffs = applicableHistoricalHandoffs(evidence, head)
  if (handoffs.filter(({ record }) => record.route === 'FOUNDER_GATE').length !== 1 ||
      !handoffs.some(({ source }) => source === consumedGate) ||
      hasMalformedNoPrBlockerResolutionEvidence(historicalEvidence)) return false
  const consumed = foldNoPrFounderDecision(historicalEvidence, handoffs)
  if (consumed.conflict) return false
  for (const { source, record } of consumed.handoffs) {
    if (record.route === 'IMPLEMENT' && record.objective_mode === 'read_only') continue
    if (record.route === 'STOP' && record.schema_version === 3 &&
        resolveStopBlockers({ record, source, evidence: historicalEvidence, activePr: null }) === 'resolved') continue
    return false
  }
  const bases = new Set(consumed.handoffs.map(({ record }) => record.protected_base.sha))
  return bases.size <= 1
}

function historicalHandoffsAllowReplay(
  evidence: NormalizedContextEvidence,
  historicalPolicy: HistoricalNoPrFounderGateReplayProof['historical_policy'],
  historicalFounderLogin: string,
  historicalBase: string,
  head: string,
  consumed: RoleEvidence,
): boolean {
  const handoffs = applicableHistoricalHandoffs(evidence, head)
  if (handoffs.filter(({ record }) => record.route === 'FOUNDER_GATE').length !== 1 ||
      !handoffs.some(({ source }) => source === consumed)) return false
  const historicalEvidence: NormalizedContextEvidence = {
    ...evidence,
    policy: {
      ...evidence.policy,
      path: historicalPolicy.path,
      policyId: historicalPolicy.policy_id,
      version: historicalPolicy.version,
      sourceSha: historicalPolicy.source_sha,
      trustedFounderLogin: historicalFounderLogin,
      legacyStopHandoffs: [],
    },
    protectedBase: { ...evidence.protectedBase, sha: historicalBase },
    localGit: { ...evidence.localGit, head },
  }
  return historicalContextAllowsContinuation(evidence, historicalEvidence, head, consumed)
}

function compatibleAncestry(
  ancestry: HistoricalNoPrFounderGateReplayProof['protected_base_ancestry'] | undefined,
  base: string,
  current: string,
): boolean {
  if (!ancestry) return false
  if (base === current) return ancestry.status === 'identical' && ancestry.mergeBaseSha === base &&
    ancestry.aheadBy === 0 && ancestry.behindBy === 0
  return ancestry.status === 'ahead' && ancestry.mergeBaseSha === base &&
    Number.isSafeInteger(ancestry.aheadBy) && ancestry.aheadBy > 0 && ancestry.behindBy === 0
}

/** Acquire strict, read-only historical proof for the only possible consumed old gate. */
export function readHistoricalNoPrFounderGateReplayProofs({
  evidence,
  run,
  cwd = process.cwd(),
  env = process.env,
}: {
  evidence: NormalizedContextEvidence
  run: ContextCommandRunner
  cwd?: string
  env?: NodeJS.ProcessEnv
}): HistoricalNoPrFounderGateReplayProof[] {
  const repo = evidence.repository.nameWithOwner
  const base = evidence.protectedBase
  const currentHead = evidence.localGit.head
  const gates = gateRecords(evidence)
  const historicalGates = currentHead ? gates.filter(({ record }) => record.exact_head !== currentHead) : []
  const currentGates = currentHead ? gates.filter(({ record }) => record.exact_head === currentHead) : []
  if (!evidence.policy.allowHistoricalNoPrFounderGateReplay || historicalGates.length !== 1 || currentGates.length > 1 || !currentHead ||
      !evidence.localGit.durable || evidence.localGit.originRepository !== repo ||
      evidence.localGit.upstream !== `origin/${evidence.localGit.branch}` ||
      !new RegExp(`^[^/]+/${evidence.issue.number}-[^/]+$`).test(evidence.localGit.branch) ||
      (evidence.durableContext.invalidFounderDecisions ?? []).length > 0 ||
      (evidence.durableContext.invalidFounderDecisionRepairs ?? []).length > 0) return []

  const { source, record } = historicalGates[0]!
  const historicalHead = record.exact_head
  const gateBase = record.protected_base.sha
  if (!sha(historicalHead) || historicalHead === currentHead || !sha(gateBase) ||
      record.repository !== repo || record.issue_number !== evidence.issue.number ||
      record.branch !== evidence.localGit.branch || record.protected_base.branch !== base.branch ||
      record.objective_mode !== 'read_only' || renderHandoffComment(record) !== source.body ||
      !isExactIssueCommentUrl(source.url, source, evidence)) return []

  const decisions = evidence.durableContext.founderDecisions ?? []
  const repairs = evidence.durableContext.founderDecisionRepairs ?? []
  if (decisions.length !== 1 || repairs.length > 1) return []
  const decision = decisions[0]!
  const repair = repairs[0]
  const effectiveDecision = repair
    ? parseFounderDecisionRepairComment(repair.body)
    : parseFounderDecisionComment(decision.body)
  if (!effectiveDecision) return []
  const historicalBase = effectiveDecision.protected_base.sha
  if (!sha(historicalBase) || effectiveDecision.repository !== repo ||
      effectiveDecision.issue_number !== evidence.issue.number || effectiveDecision.branch !== evidence.localGit.branch ||
      effectiveDecision.exact_head !== historicalHead || effectiveDecision.protected_base.branch !== base.branch) return []

  const historicalGuide = readGuideAtSha(repo, historicalBase, run, cwd, env)
  const historicPolicy = historicalGuide && parseProtectedPolicyContent({
    repo, branch: historicalBase, sha: historicalGuide.sha, content: historicalGuide.content,
  })
  if (!historicPolicy || !historicPolicy.trustedFounderLogin || !sha(evidence.policy.sourceSha) ||
      !sha(base.sha) || historicPolicy.path !== effectiveDecision.policy.path || historicPolicy.policyId !== effectiveDecision.policy.policy_id ||
      historicPolicy.version !== effectiveDecision.policy.version || historicPolicy.sourceSha !== effectiveDecision.policy.source_sha ||
      historicPolicy.sourceSha !== historicalGuide.sha) return []

  const historicalBaseAncestry = compare(repo, historicalBase, base.sha, run, cwd, env, true)
  const gateBaseAncestry = compare(repo, gateBase, historicalBase, run, cwd, env, true)
  const headAncestry = compare(repo, historicalHead, currentHead, run, cwd, env)
  if (!historicalBaseAncestry || !gateBaseAncestry || !headAncestry) return []

  const historicalEvidence: NormalizedContextEvidence = {
    ...evidence,
    policy: historicPolicy,
    protectedBase: { ...base, sha: historicalBase },
    localGit: { ...evidence.localGit, head: historicalHead },
  }
  if (!historicalContextAllowsContinuation(evidence, historicalEvidence, historicalHead, source) ||
      !isExactIssueCommentUrl(decision.url, decision, evidence) ||
      (repair && !isExactIssueCommentUrl(repair.url, repair, evidence))) return []

  const decisionProof = {
    comment_id: String(decision.id),
    url: decision.url,
    body_sha256: createHash('sha256').update(decision.body, 'utf8').digest('hex'),
  }
  return [{
    repository: repo,
    issue_number: evidence.issue.number,
    branch: evidence.localGit.branch,
    source_gate: { comment_id: String(source.id), url: source.url },
    source_decision: decisionProof,
    ...(repair ? { source_repair: {
      comment_id: String(repair.id),
      url: repair.url,
      body_sha256: createHash('sha256').update(repair.body, 'utf8').digest('hex'),
    } } : {}),
    historical_head: historicalHead,
    current_head: currentHead,
    head_ancestry: headAncestry,
    historical_protected_base: { branch: base.branch, sha: historicalBase },
    historical_gate_protected_base: { branch: record.protected_base.branch, sha: gateBase },
    current_protected_base: { branch: base.branch, sha: base.sha },
    protected_base_ancestry: historicalBaseAncestry,
    gate_base_ancestry: gateBaseAncestry,
    historical_policy: {
      path: historicPolicy.path, policy_id: historicPolicy.policyId,
      version: historicPolicy.version, source_sha: historicPolicy.sourceSha,
    },
    current_policy: {
      path: evidence.policy.path, policy_id: evidence.policy.policyId,
      version: evidence.policy.version, source_sha: evidence.policy.sourceSha,
    },
  }]
}

function validProofForSource(
  source: RoleEvidence,
  evidence: NormalizedContextEvidence,
): HistoricalNoPrFounderGateReplayProof | null {
  if (!evidence.policy.allowHistoricalNoPrFounderGateReplay) return null
  const proofs = evidence.historicalNoPrFounderGateReplayProofs ?? []
  const matching = proofs.filter((proof) => proof?.source_gate?.comment_id === String(source.id))
  if (proofs.length !== 1 || matching.length !== 1) return null
  const proof = matching[0]!
  const payload = extractHandoffPayload(source.body)
  if (!isRecord(payload)) return null
  let record
  try { record = parseHandoffBody(JSON.stringify(payload)) } catch { return null }
  const decision = evidence.durableContext.founderDecisions ?? []
  const repairs = evidence.durableContext.founderDecisionRepairs ?? []
  const sourceDecision = decision.filter((comment) =>
    String(comment.id) === proof.source_decision?.comment_id && comment.url === proof.source_decision?.url)
  const sourceRepair = repairs.filter((comment) =>
    String(comment.id) === proof.source_repair?.comment_id && comment.url === proof.source_repair?.url)
  const hashesMatch = sourceDecision.length === 1 &&
    /^[0-9a-f]{64}$/.test(proof.source_decision.body_sha256) &&
    createHash('sha256').update(sourceDecision[0]!.body, 'utf8').digest('hex') === proof.source_decision.body_sha256 &&
    (proof.source_repair
      ? sourceRepair.length === 1 && repairs.length === 1 && /^[0-9a-f]{64}$/.test(proof.source_repair.body_sha256) &&
        createHash('sha256').update(sourceRepair[0]!.body, 'utf8').digest('hex') === proof.source_repair.body_sha256
      : repairs.length === 0)
  const repairedDecisionBinds = !proof.source_repair || (() => {
    const repair = parseFounderDecisionRepairComment(sourceRepair[0]?.body ?? '')
    return repair?.source_founder_decision.comment_id === String(sourceDecision[0]?.id) &&
      repair.source_founder_decision.url === sourceDecision[0]?.url &&
      repair.source_founder_decision.body_sha256 === createHash('sha256').update(sourceDecision[0]?.body ?? '', 'utf8').digest('hex')
  })()
  const effectiveDecision = proof.source_repair
    ? parseFounderDecisionRepairComment(sourceRepair[0]?.body ?? '')
    : parseFounderDecisionComment(sourceDecision[0]?.body ?? '')
  if (!effectiveDecision) return null
  const headHistory = proof.head_ancestry
  const baseHistory = proof.protected_base_ancestry
  const gateBaseHistory = proof.gate_base_ancestry
  const shaFields = [proof.historical_head, proof.current_head, proof.historical_protected_base?.sha,
    proof.historical_gate_protected_base?.sha, proof.current_protected_base?.sha,
    proof.historical_policy?.source_sha, proof.current_policy?.source_sha]
  return record.route === 'FOUNDER_GATE' && record.objective_mode === 'read_only' && record.pr === null &&
    record.repository === evidence.repository.nameWithOwner && record.issue_number === evidence.issue.number &&
    record.branch === evidence.localGit.branch && record.exact_head === proof.historical_head &&
    proof.repository === evidence.repository.nameWithOwner && proof.issue_number === evidence.issue.number &&
    proof.branch === evidence.localGit.branch && proof.current_head === evidence.localGit.head &&
    proof.historical_head !== proof.current_head &&
    proof.source_gate.comment_id === String(source.id) && proof.source_gate.url === source.url &&
    record.protected_base.branch === evidence.protectedBase.branch &&
    proof.historical_protected_base.branch === evidence.protectedBase.branch &&
    proof.historical_protected_base.sha === effectiveDecision.protected_base.sha &&
    proof.historical_gate_protected_base.branch === record.protected_base.branch &&
    proof.historical_gate_protected_base.sha === record.protected_base.sha &&
    proof.current_protected_base.branch === evidence.protectedBase.branch &&
    proof.current_protected_base.sha === evidence.protectedBase.sha &&
    proof.historical_policy.path === effectiveDecision.policy.path && proof.historical_policy.policy_id === effectiveDecision.policy.policy_id &&
    proof.historical_policy.version === effectiveDecision.policy.version && proof.historical_policy.source_sha === effectiveDecision.policy.source_sha &&
    proof.current_policy.path === evidence.policy.path && proof.current_policy.policy_id === evidence.policy.policyId &&
    proof.current_policy.version === evidence.policy.version && proof.current_policy.source_sha === evidence.policy.sourceSha &&
    shaFields.every(sha) && headHistory?.status === 'ahead' && headHistory.mergeBaseSha === proof.historical_head &&
    Number.isSafeInteger(headHistory.aheadBy) && headHistory.aheadBy > 0 && headHistory.behindBy === 0 &&
    compatibleAncestry(baseHistory, proof.historical_protected_base.sha, proof.current_protected_base.sha) &&
    compatibleAncestry(gateBaseHistory, proof.historical_gate_protected_base.sha, proof.historical_protected_base.sha) &&
    historicalHandoffsAllowReplay(evidence, proof.historical_policy, effectiveDecision.authority.login,
      proof.historical_protected_base.sha, proof.historical_head, source) &&
    hashesMatch && repairedDecisionBinds && renderHandoffComment(record) === source.body &&
    isExactIssueCommentUrl(source.url, source, evidence) && isExactIssueCommentUrl(sourceDecision[0]!.url, sourceDecision[0]!, evidence) &&
    (!proof.source_repair || isExactIssueCommentUrl(sourceRepair[0]!.url, sourceRepair[0]!, evidence))
    ? proof : null
}

/** Return only the uniquely proven consumed historical bundle for narrow exclusion during fresh routing. */
export function consumedHistoricalNoPrFounderGate(
  evidence: NormalizedContextEvidence,
): { gate: RoleEvidence; decision: RoleEvidence; repair?: RoleEvidence } | null {
  const gates = gateRecords(evidence)
  const currentHead = evidence.localGit.head
  const historical = currentHead ? gates.filter(({ record }) => record.exact_head !== currentHead) : []
  const current = currentHead ? gates.filter(({ record }) => record.exact_head === currentHead) : []
  if (historical.length !== 1 || current.length > 1) return null
  const { source } = historical[0]!
  const proof = validProofForSource(source, evidence)
  if (!proof) return null
  const decision = (evidence.durableContext.founderDecisions ?? []).find((item) =>
    String(item.id) === proof.source_decision.comment_id && item.url === proof.source_decision.url)
  const repair = proof.source_repair && (evidence.durableContext.founderDecisionRepairs ?? []).find((item) =>
    String(item.id) === proof.source_repair!.comment_id && item.url === proof.source_repair!.url)
  return decision ? { gate: source, decision, ...(repair ? { repair } : {}) } : null
}
