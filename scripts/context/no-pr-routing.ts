import type { ContextBranchRecovery, ContextDecision, NormalizedContextEvidence, RoleEvidence } from './model.ts'
import { hasMalformedNoPrBlockerResolutionEvidence, resolveStopBlockers } from './blocker-resolution.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { foldNoPrFounderDecision, type ApplicableNoPrHandoff } from './founder-decision-folding.ts'
import { extractHandoffPayload, isExactIssueCommentUrl } from './runtime.ts'
import { setupBaseRecoveryRoute } from './setup-base-recovery-routing.ts'
type NoPrDecision = Omit<ContextDecision, 'evidenceUrls'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasFounderGateRouteMarker(body: string): boolean {
  return /"route"\s*:\s*"FOUNDER_GATE"/.test(body)
}

function isExactCurrentNoPrFounderGate(
  source: RoleEvidence,
  record: HandoffRecord,
  evidence: NormalizedContextEvidence,
): boolean {
  return record.route === 'FOUNDER_GATE' &&
    record.objective_mode === 'read_only' && record.pr === null &&
    record.repository === evidence.repository.nameWithOwner && record.issue_number === evidence.issue.number &&
    record.branch === evidence.localGit.branch && record.exact_head === evidence.localGit.head &&
    record.protected_base.branch === evidence.protectedBase.branch &&
    record.local_durability.durable && renderHandoffComment(record) === source.body &&
    isExactIssueCommentUrl(source.url, source, evidence)
}

function hasInvalidNoPrFounderGateEvidence(evidence: NormalizedContextEvidence): boolean {
  const candidates = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])

  return candidates.some((source) => {
    const payload = extractHandoffPayload(source.body)
    const gateMarker = (isRecord(payload) && payload.route === 'FOUNDER_GATE') ||
      hasFounderGateRouteMarker(source.body)
    if (!gateMarker) return false
    if (!isRecord(payload)) return true

    try {
      const record = parseHandoffBody(JSON.stringify(payload))
      return record.pr === null && !isExactCurrentNoPrFounderGate(source, record, evidence)
    } catch {
      return true
    }
  })
}

function applicableNoPrHandoffs(evidence: NormalizedContextEvidence): ApplicableNoPrHandoff[] {
  const head = evidence.localGit.head
  if (!head) return []
  const candidates = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])
  const applicable: ApplicableNoPrHandoff[] = []

  for (const source of candidates) {
    const payload = extractHandoffPayload(source.body)
    try {
      const record = parseHandoffBody(JSON.stringify(payload))
      if (
        (record.route !== 'STOP' || record.schema_version === 3) && record.pr === null &&
        record.repository === evidence.repository.nameWithOwner && record.issue_number === evidence.issue.number &&
        record.branch === evidence.localGit.branch && record.exact_head === head &&
        record.protected_base.branch === evidence.protectedBase.branch &&
        record.local_durability.durable && renderHandoffComment(record) === source.body &&
        isExactIssueCommentUrl(source.url, source, evidence)
      ) {
        applicable.push({ source, record })
      }
    } catch {
      continue
    }
  }

  return applicable
}

function stop(reason: string, description: string, recovery?: ContextBranchRecovery): NoPrDecision {
  return {
    route: 'STOP',
    reasons: [reason],
    nextAction: { type: 'STOP', command: null, description },
    ...(recovery ? { recovery } : {}),
  }
}

function hasConsistentHistoricalBase(handoffs: ApplicableNoPrHandoff[]): boolean {
  return new Set(handoffs.map(({ record }) => record.protected_base.sha)).size <= 1
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function uniqueWrongIssueBranchRecovery(evidence: NormalizedContextEvidence): ContextBranchRecovery | null {
  const candidates = evidence.issueBranchRecoveryCandidates ?? []
  if (candidates.length !== 1) return null

  const candidate = candidates[0]!
  const ownerIssue = candidate.branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
  const activePr = !Array.isArray(evidence.activePr) && evidence.activePr &&
    !evidence.activePr.merged && evidence.activePr.state.toUpperCase() !== 'MERGED'
    ? evidence.activePr
    : null
  const localGit = evidence.localGit
  if (
    (activePr
      ? candidate.branch !== activePr.headBranch || candidate.liveHead.toLowerCase() !== activePr.headSha.toLowerCase() ||
        activePr.baseBranch !== evidence.protectedBase.branch || activePr.baseSha.toLowerCase() !== evidence.protectedBase.sha.toLowerCase()
      : ownerIssue !== evidence.issue.number) ||
    !candidate.eligible ||
    candidate.checkedOutElsewhere ||
    !/^[0-9a-f]{40}$/i.test(candidate.liveHead) ||
    candidate.remoteTrackingHead !== candidate.liveHead ||
    !localGit.head ||
    localGit.upstream !== `origin/${localGit.branch}` ||
    localGit.originRepository !== evidence.repository.nameWithOwner ||
    !evidence.protectedBase.branch ||
    !/^[0-9a-f]{40}$/i.test(evidence.protectedBase.sha) ||
    !localGit.clean ||
    localGit.detached ||
    !localGit.pushed ||
    !localGit.durable
  ) return null

  let args: string[]
  if (candidate.localHead) {
    if (candidate.localHead !== candidate.liveHead || candidate.upstream !== `origin/${candidate.branch}`) return null
    args = ['switch', '--', candidate.branch]
  } else {
    args = ['switch', '--track', `origin/${candidate.branch}`]
  }

  return {
    type: 'SWITCH_BRANCH',
    command: 'git',
    args,
    display_command: `git ${args.slice(0, -1).join(' ')} ${shellQuote(args.at(-1)!)}`,
    binding: {
      repository: evidence.repository.nameWithOwner,
      issue_number: evidence.issue.number,
      protected_base: {
        branch: evidence.protectedBase.branch,
        sha: evidence.protectedBase.sha,
      },
      source: {
        branch: localGit.branch,
        head: localGit.head,
        upstream: localGit.upstream,
        clean: localGit.clean,
        detached: localGit.detached,
        pushed: localGit.pushed,
        durable: localGit.durable,
      },
      target: { branch: candidate.branch, head: candidate.liveHead },
      ...(activePr ? {
        active_pr: {
          number: activePr.number,
          url: activePr.url,
          base_branch: activePr.baseBranch,
          base_sha: activePr.baseSha,
          head_branch: activePr.headBranch,
          head: activePr.headSha,
        },
      } : {}),
    },
  }
}

export function routeWrongIssueActivePrContext(evidence: NormalizedContextEvidence): NoPrDecision | null {
  const activePr = !Array.isArray(evidence.activePr) ? evidence.activePr : null
  const sourceIssue = evidence.localGit.branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
  if (
    !activePr || activePr.merged || activePr.state.toUpperCase() === 'MERGED' ||
    !sourceIssue || sourceIssue === evidence.issue.number ||
    (evidence.localGit.branch === activePr.headBranch && evidence.localGit.head?.toLowerCase() === activePr.headSha.toLowerCase())
  ) return null

  const recovery = uniqueWrongIssueBranchRecovery(evidence)
  return stop(
    `EVIDENCE_CONFLICT: local branch ${evidence.localGit.branch}@${evidence.localGit.head} belongs to a different Issue and does not match active PR #${activePr.number} ${activePr.headBranch}@${activePr.headSha}`,
    recovery
      ? `Next Action: run \`${recovery.display_command}\` to switch to the exact live branch for active PR #${activePr.number}, then immediately rerun registered CLI Discovery and fresh \`bemoat:context ${evidence.issue.number} --json\`. Do not perform PR or objective work until fresh Context authorizes it.`
      : 'Resolve the wrong-Issue workspace mismatch through the canonical acquisition rule before continuing.',
    recovery ?? undefined,
  )
}

export function routeNoPrContext(evidence: NormalizedContextEvidence): NoPrDecision {
  if (hasMalformedNoPrBlockerResolutionEvidence(evidence)) {
    return stop(
      `EVIDENCE_CONFLICT: malformed no-PR BLOCKER_RESOLUTION evidence at ${evidence.localGit.head}.`,
      'Resolve malformed no-PR blocker-resolution evidence before continuing.',
    )
  }

  if ((evidence.durableContext.invalidFounderDecisions ?? []).length > 0) {
    return stop(
      `EVIDENCE_CONFLICT: malformed no-PR FOUNDER_DECISION native comment identity at ${evidence.localGit.head}.`,
      'Resolve malformed FOUNDER_DECISION evidence before continuing.',
    )
  }

  if ((evidence.durableContext.invalidFounderDecisionRepairs ?? []).length > 0) {
    return stop(
      `EVIDENCE_CONFLICT: malformed no-PR FOUNDER_DECISION_REPAIR native comment identity at ${evidence.localGit.head}.`,
      'Resolve malformed Founder decision repair evidence before continuing.',
    )
  }

  if (hasInvalidNoPrFounderGateEvidence(evidence)) {
    return stop(
      `EVIDENCE_CONFLICT: no-PR FOUNDER_GATE HANDOFF evidence is malformed, stale, or bound to a different identity at ${evidence.localGit.head}.`,
      'Resolve malformed or mismatched current-head no-PR FOUNDER_GATE evidence before continuing.',
    )
  }

  let handoffs = applicableNoPrHandoffs(evidence)

  const commentIds = handoffs.map(({ source }) => String(source.id))
  const commentUrls = handoffs.map(({ source }) => source.url)
  if (new Set(commentIds).size !== commentIds.length || new Set(commentUrls).size !== commentUrls.length) {
    return stop(
      `EVIDENCE_CONFLICT: duplicate applicable current-head HANDOFF comment identity at ${evidence.localGit.head}.`,
      'Resolve duplicate current-head HANDOFF identity evidence before continuing.',
    )
  }

  const folded = foldNoPrFounderDecision(evidence, handoffs)
  if (folded.conflict) return stop(folded.conflict.reason, folded.conflict.description)
  handoffs = folded.handoffs

  const stops = handoffs.filter(({ record }) => record.route === 'STOP')
  for (const { source, record } of stops) {
    const resolution = resolveStopBlockers({ record, source, evidence, activePr: null })
    if (resolution !== 'resolved') {
      return stop(
        resolution === 'conflict'
          ? `EVIDENCE_CONFLICT: current-head no-PR HANDOFF STOP has malformed, competing, or wrong-identity blocker-resolution evidence at ${evidence.localGit.head}.`
          : `Current-head no-PR schema-v3 HANDOFF STOP remains unresolved at ${evidence.localGit.head}.`,
        'Resolve every current-head HANDOFF STOP blocker through unique exact no-PR Founder evidence before continuing.',
      )
    }
  }

  if (evidence.issue.state.toUpperCase() === 'CLOSED') {
    return stop(
      'EVIDENCE_CONFLICT: Issue is closed without a uniquely resolved merged PR',
      'Resolve the closed Issue and PR evidence before continuing.',
    )
  }

  const branchIssueNumber = evidence.localGit.branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
  if (branchIssueNumber && branchIssueNumber !== evidence.issue.number) {
    const recovery = uniqueWrongIssueBranchRecovery(evidence)
    const recoveryDescription = recovery
      ? `Next Action: run \`${recovery.display_command}\` to switch to the unique live Issue #${evidence.issue.number} branch, then immediately rerun registered CLI Discovery and \`pnpm run bemoat:context ${evidence.issue.number} --json\`. No Founder/Global MC return is needed for this deterministic recovery. Do not begin objective work until fresh Context authorizes it.`
      : 'Switch to a topic branch owned by the queried Issue before continuing.'
    return stop(
      `EVIDENCE_CONFLICT: local topic branch ${evidence.localGit.branch} belongs to Issue #${branchIssueNumber}, not queried Issue #${evidence.issue.number}`,
      recoveryDescription,
      recovery ?? undefined,
    )
  }

  const completes = handoffs.filter(({ record }) => record.route === 'COMPLETE')
  if (completes.length > 1) {
    return stop(
      `EVIDENCE_CONFLICT: multiple applicable current-head COMPLETE HANDOFF records at ${evidence.localGit.head}.`,
      'Resolve competing current-head COMPLETE records before continuing.',
    )
  }

  if (completes.length === 1) {
    const complete = completes[0]!
    if (complete.record.protected_base.sha !== evidence.protectedBase.sha) {
      return stop(
        `EVIDENCE_CONFLICT: no-PR COMPLETE HANDOFF is bound to a stale protected-base SHA at ${evidence.localGit.head}.`,
        'Publish a terminal HANDOFF bound to the current protected base before completing this Issue.',
      )
    }
    const competing = handoffs.filter(({ source }) => String(source.id) !== String(complete.source.id))
    const allowedCompeting = competing.every(({ record }) =>
      (record.route === 'IMPLEMENT' && record.objective_mode === 'read_only') ||
      (record.route === 'STOP' && record.schema_version === 3),
    )
    if (!allowedCompeting) {
      return stop(
        `EVIDENCE_CONFLICT: no-PR COMPLETE competes with current-head HANDOFF evidence that cannot be uniquely reconciled at ${evidence.localGit.head}.`,
        'Resolve competing current-head HANDOFF evidence before terminalizing this Issue.',
      )
    }
    if (!hasConsistentHistoricalBase(competing)) {
      return stop(
        `EVIDENCE_CONFLICT: historical current-head HANDOFFs disagree on their protected-base SHA at ${evidence.localGit.head}.`,
        'Resolve historical protected-base identity conflicts before terminalizing this Issue.',
      )
    }

    return {
      route: 'COMPLETE',
      reasons: [`Current-head no-PR HANDOFF COMPLETE is applicable at ${evidence.localGit.head}.`],
      nextAction: {
        type: 'COMPLETE',
        command: null,
        description: 'No further implementation action is permitted for this bounded objective.',
      },
    }
  }

  const founderGates = handoffs.filter(({ record }) => record.route === 'FOUNDER_GATE')
  if (founderGates.length > 1) {
    return stop(
      `EVIDENCE_CONFLICT: multiple applicable current-head FOUNDER_GATE HANDOFF records at ${evidence.localGit.head}.`,
      'Resolve competing current-head FOUNDER_GATE records before continuing.',
    )
  }

  if (founderGates.length === 1) {
    const gate = founderGates[0]!
    const history = handoffs.filter(({ source }) => String(source.id) !== String(gate.source.id))
    const onlyRecomputableHistory = history.every(({ record }) =>
      (record.route === 'IMPLEMENT' && record.objective_mode === 'read_only') ||
      (record.route === 'STOP' && record.schema_version === 3),
    )
    if (!onlyRecomputableHistory || !hasConsistentHistoricalBase(handoffs)) {
      return stop(
        `EVIDENCE_CONFLICT: current-head no-PR FOUNDER_GATE competes with HANDOFF history that cannot be uniquely recomputed at ${evidence.localGit.head}.`,
        'Resolve competing current-head HANDOFF evidence and historical protected-base identities before continuing.',
      )
    }

    return {
      route: 'FOUNDER_GATE',
      reasons: [`Current-head no-PR read-only FOUNDER_GATE is applicable at ${evidence.localGit.head}.`],
      nextAction: {
        type: 'FOUNDER_GATE',
        command: null,
        description: 'Founder authorization is required before the next objective action.',
      },
    }
  }

  const onlyRecomputableHistory = handoffs.every(({ record }) =>
    (record.route === 'IMPLEMENT' && record.objective_mode === 'read_only') ||
    (record.route === 'STOP' && record.schema_version === 3),
  )
  if (!onlyRecomputableHistory || !hasConsistentHistoricalBase(handoffs)) {
    return stop(
      `EVIDENCE_CONFLICT: current-head no-PR HANDOFF evidence cannot be uniquely reconciled at ${evidence.localGit.head}.`,
      'Resolve conflicting current-head no-PR HANDOFF evidence and protected-base identities before continuing.',
    )
  }

  const setupRecovery = setupBaseRecoveryRoute(evidence)
  if (setupRecovery) return setupRecovery

  return {
    route: 'IMPLEMENT',
    reasons: ['No active PR is present and the local topic branch is durable.'],
    nextAction: {
      type: 'COMMAND',
      command: null,
      description: 'Implement the bounded Issue objective on the durable topic branch.',
    },
  }
}
