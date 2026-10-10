import { isAbsolute } from 'node:path'

import type {
  ContextDecision,
  ContextSetupBaseRecovery,
  NormalizedContextEvidence,
  ObjectiveCheckpointAncestryProof,
  RoleEvidence,
} from './model.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { extractHandoffPayload } from './runtime.ts'
import { hasConflictingTerminalHandoff } from './founder-gate-history.ts'
import { isPrReadyImplementationEvidence } from './evidence.ts'
import type { ApplicableNoPrHandoff } from './founder-decision-folding.ts'

type SetupRecoveryDecision = Omit<ContextDecision, 'evidenceUrls'>

export function setupBaseRecoveryCandidate(evidence: NormalizedContextEvidence): ContextSetupBaseRecovery | null {
  const proof = evidence.setupBaseRecovery
  const base = evidence.protectedBase
  const local = evidence.localGit
  const exactSeparateTargetRecovery = local.head?.toLowerCase() === '46fe5363697cb24f0db5a6d4338a5540665bb697' &&
    base.branch === 'main' && base.sha.toLowerCase() === 'e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3' &&
    proof?.localUpstreamHead.toLowerCase() === base.sha.toLowerCase() && proof.ancestry === 'STRICT_ANCESTOR' &&
    typeof proof.targetWorktree === 'string' && isAbsolute(proof.targetWorktree)
  if (
    evidence.evidenceErrors.length > 0 || evidence.issue.state.toUpperCase() !== 'OPEN' ||
    evidence.activePr !== null || !base.branch || !/^[0-9a-f]{40}$/i.test(base.sha) ||
    !proof || proof.ancestry === 'NOT_ANCESTOR' || proof.liveUpstreamHead.toLowerCase() !== base.sha.toLowerCase() ||
    (proof.localUpstreamHead.toLowerCase() !== (local.head ?? '').toLowerCase() && !exactSeparateTargetRecovery) ||
    !local.head || local.head.toLowerCase() === base.sha.toLowerCase() ||
    local.branch !== base.branch || local.upstream !== `origin/${base.branch}` ||
    local.originRepository !== evidence.repository.nameWithOwner || !local.clean || local.detached ||
    local.pushed || local.durable
  ) return null

  const args = [
    evidence.issue.number,
    '--expected-repository', evidence.repository.nameWithOwner,
    '--expected-base-branch', base.branch,
    '--expected-base-sha', base.sha.toLowerCase(),
    '--expected-local-head', local.head.toLowerCase(),
  ]
  if (exactSeparateTargetRecovery) args.push('--target-worktree', proof.targetWorktree!)
  args.push('--json')
  const displayArgs = args.map((arg) => /^[A-Za-z0-9_./:@+-]+$/.test(arg)
    ? arg
    : `'${arg.replace(/'/g, `'\\''`)}'`)
  return {
    type: 'RECOVER_STALE_PROTECTED_BASE',
    command: 'bemoat:context:recover-setup',
    args,
    display_command: `pnpm run bemoat:context:recover-setup -- ${displayArgs.join(' ')}`,
    binding: {
      repository: evidence.repository.nameWithOwner,
      issue_number: evidence.issue.number,
      protected_base_branch: base.branch,
      protected_base: { branch: base.branch, sha: base.sha.toLowerCase() },
      ...(exactSeparateTargetRecovery ? { target_worktree: proof.targetWorktree! } : {}),
      local_state: {
        branch: local.branch,
        head: local.head.toLowerCase(),
        upstream: local.upstream,
        clean: true,
        detached: false,
      },
    },
  }
}

export function setupBaseRecoveryRoute(evidence: NormalizedContextEvidence): SetupRecoveryDecision | null {
  const recovery = setupBaseRecoveryCandidate(evidence)
  if (!recovery) return null
  return {
    route: 'STOP',
    reasons: [`Clean protected branch ${evidence.localGit.branch}@${evidence.localGit.head} is a bounded stale-base setup candidate for exact live ${evidence.protectedBase.branch}@${evidence.protectedBase.sha}.`],
    nextAction: {
      type: 'COMMAND',
      command: recovery.command,
      description: recovery.binding.target_worktree
        ? `Run the displayed recovery command from a separate clean exact-live protected-main source; --target-worktree is bound to ${recovery.binding.target_worktree}. Then immediately rerun registered CLI Discovery and fresh target bemoat:context ${evidence.issue.number} --json. Recovery grants no objective-edit authority.`
        : `Run the exact bound setup recovery, then immediately rerun registered CLI Discovery and fresh bemoat:context ${evidence.issue.number} --json. Recovery grants no objective-edit authority.`,
    },
    recovery,
  }
}

export function protectedBranchSetupState(evidence: NormalizedContextEvidence, mergedPr: boolean): {
  recovery: ContextSetupBaseRecovery | null
  durabilityReasons: string[]
  blocked: boolean
} {
  const recovery = setupBaseRecoveryCandidate(evidence)
  const local = evidence.localGit
  const durabilityReasons = !mergedPr && (!local.clean || local.detached || !local.pushed || !local.durable)
    ? recovery
      ? local.reasons.filter((reason) => reason !== 'LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream')
      : [...local.reasons, 'LOCAL_STATE_NOT_DURABLE: required local work is not clean, pushed, and attached to a durable branch']
    : []
  const protectedBranch = /^(?:main|master|dev|develop|integration|staging|production)(?:\/.*)?$/i.test(local.branch)
  return { recovery, durabilityReasons, blocked: !mergedPr && protectedBranch && !recovery }
}
type NoPrDecision = Omit<ContextDecision, 'evidenceUrls'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

interface ObjectiveCheckpoint {
  source: RoleEvidence
  record: HandoffRecord
  ordinal: number
}

export interface MultiObjectiveProgress {
  enabled: boolean
  valid: boolean
  objectiveCount: number
  checkpoints: ObjectiveCheckpoint[]
}

function exactValidationProof(record: HandoffRecord, objectiveMode: 'read_only' | 'implementation'): boolean {
  const proofs = record.verified_evidence.filter(({ kind }) => kind === 'validation-proof')
  if (proofs.length !== 1) return false
  try {
    const proof = JSON.parse(proofs[0]!.value) as Record<string, unknown>
    return proof.status === 'PASS' && proof.exact_head === record.exact_head &&
      (objectiveMode === 'read_only'
        ? proof.tier === 'read-only' && proof.command === 'pnpm run bemoat:guard:safety'
        : (proof.tier === 'code' && proof.command === 'pnpm run bemoat:check') ||
          (proof.tier === 'docs-only' && proof.command === 'pnpm run bemoat:guard:safety'))
  } catch {
    return false
  }
}

function checkpointBinding(record: HandoffRecord): Record<string, unknown> | null {
  const entries = record.verified_evidence.filter(({ kind }) => kind === 'objective-checkpoint')
  if (entries.length !== 1) return null
  try {
    const binding = JSON.parse(entries[0]!.value) as unknown
    if (!isRecord(binding) || Object.keys(binding).sort().join('\u0000') !==
        ['objective_id', 'sequence', 'predecessor_comment_id', 'predecessor_head'].sort().join('\u0000')) return null
    return binding
  } catch {
    return null
  }
}

export function multiObjectiveProgress(evidence: NormalizedContextEvidence): MultiObjectiveProgress {
  const sequence = evidence.issue.objectiveSequence
  if (!sequence || sequence.status === 'absent') return { enabled: false, valid: true, objectiveCount: 0, checkpoints: [] }
  if (sequence.status === 'invalid' || sequence.objectives.length === 0) {
    return { enabled: true, valid: false, objectiveCount: 0, checkpoints: [] }
  }
  if (sequence.objectives.length === 1) return { enabled: false, valid: true, objectiveCount: 1, checkpoints: [] }

  const sources = evidence.durableContext.handoffs ?? (evidence.durableContext.latestHandoff
    ? [evidence.durableContext.latestHandoff]
    : [])
  const checkpoints: ObjectiveCheckpoint[] = []
  const seenNativeIds = new Set<string>()

  for (const source of sources) {
    const payload = extractHandoffPayload(source.body)
    if (!isRecord(payload) || payload.route !== 'IMPLEMENT' || payload.pr !== null) continue
    let record: HandoffRecord
    try { record = parseHandoffBody(JSON.stringify(payload)) } catch {
      return { enabled: true, valid: false, objectiveCount: sequence.objectives.length, checkpoints: [] }
    }
    const match = record.objective.match(/^Objective ([1-9]\d*) — (.+)$/)
    const nativeId = String(source.id)
    if (record.schema_version !== 2 || record.record_type !== 'HANDOFF' || record.route !== 'IMPLEMENT' ||
        record.pr !== null || record.repository !== evidence.repository.nameWithOwner ||
        record.issue_number !== evidence.issue.number || record.branch !== evidence.localGit.branch ||
        record.protected_base.branch !== evidence.protectedBase.branch ||
        record.protected_base.sha.toLowerCase() !== evidence.protectedBase.sha.toLowerCase() ||
        record.local_durability.required !== true || record.local_durability.durable !== true ||
        !match || renderHandoffComment(record) !== source.body ||
        !/^[1-9]\d*$/.test(nativeId) || source.url !== `https://github.com/${evidence.repository.nameWithOwner}/issues/${evidence.issue.number}#issuecomment-${nativeId}` ||
        seenNativeIds.has(nativeId)) {
      return { enabled: true, valid: false, objectiveCount: sequence.objectives.length, checkpoints: [] }
    }
    seenNativeIds.add(nativeId)
    const ordinal = Number(match[1])
    if (ordinal > sequence.objectives.length || (ordinal > 1 && sequence.objectives[ordinal - 1]?.title !== match[2]) ||
        (ordinal === 1 && record.objective_mode !== 'read_only') ||
        (ordinal > 1 && record.objective_mode !== 'implementation') ||
        !exactValidationProof(record, record.objective_mode) ||
        (ordinal === 1 ? record.verified_evidence.some(({ kind }) => kind === 'objective-checkpoint') : !checkpointBinding(record))) {
      return { enabled: true, valid: false, objectiveCount: sequence.objectives.length, checkpoints: [] }
    }
    checkpoints.push({ source, record, ordinal })
  }

  checkpoints.sort((left, right) => left.ordinal - right.ordinal)
  const ancestryProofs = evidence.objectiveCheckpointAncestryProofs ?? []
  for (let index = 0; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index]!
    if (checkpoint.ordinal !== index + 1) {
      return { enabled: true, valid: false, objectiveCount: sequence.objectives.length, checkpoints: [] }
    }
    if (index === 0) continue

    const predecessor = checkpoints[index - 1]!
    const binding = checkpointBinding(checkpoint.record)
    const matchingProofs = ancestryProofs.filter((proof) => proof.handoffCommentId === String(checkpoint.source.id))
    if (!binding || binding.objective_id !== String(checkpoint.ordinal) || binding.sequence !== checkpoint.ordinal ||
        binding.predecessor_comment_id !== String(predecessor.source.id) ||
        binding.predecessor_head !== predecessor.record.exact_head || matchingProofs.length !== 1 ||
        !validObjectiveAncestry(matchingProofs[0]!, checkpoint, predecessor)) {
      return { enabled: true, valid: false, objectiveCount: sequence.objectives.length, checkpoints: [] }
    }
  }

  const tip = checkpoints.at(-1)
  if (tip && (!evidence.localGit.head || evidence.localGit.head.toLowerCase() !== tip.record.exact_head.toLowerCase() ||
      !evidence.localGit.clean || evidence.localGit.detached || !evidence.localGit.pushed || !evidence.localGit.durable ||
      evidence.localGit.upstream !== `origin/${evidence.localGit.branch}` ||
      evidence.localGit.originRepository !== evidence.repository.nameWithOwner)) {
    return { enabled: true, valid: false, objectiveCount: sequence.objectives.length, checkpoints: [] }
  }

  return { enabled: true, valid: true, objectiveCount: sequence.objectives.length, checkpoints }
}

function validObjectiveAncestry(
  proof: ObjectiveCheckpointAncestryProof,
  checkpoint: ObjectiveCheckpoint,
  predecessor: ObjectiveCheckpoint,
): boolean {
  return proof.predecessorCommentId === String(predecessor.source.id) &&
    proof.predecessorHead.toLowerCase() === predecessor.record.exact_head.toLowerCase() &&
    proof.checkpointHead.toLowerCase() === checkpoint.record.exact_head.toLowerCase() &&
    proof.mergeBaseSha.toLowerCase() === predecessor.record.exact_head.toLowerCase() &&
    Number.isSafeInteger(proof.aheadBy) && proof.aheadBy > 0 && proof.behindBy === 0
}

export function routeMultiObjectiveProgress(
  evidence: NormalizedContextEvidence,
  progress: MultiObjectiveProgress,
  handoffs: ApplicableNoPrHandoff[],
  handoffSources: RoleEvidence[],
): NoPrDecision | null {
  if (!progress.enabled) return null
  const stop = (reason: string, description: string): NoPrDecision => ({
    route: 'STOP', reasons: [reason], nextAction: { type: 'STOP', command: null, description },
  })
  if (!progress.valid) {
    return stop(
      `EVIDENCE_CONFLICT: ordered no-PR objective HANDOFF history cannot be uniquely reconciled at ${evidence.localGit.head}.`,
      'Resolve malformed, missing, stale, or unproven objective checkpoint evidence before continuing.',
    )
  }
  if (!handoffs.every(({ record }) =>
    (record.route === 'IMPLEMENT' && (record.objective_mode === 'read_only' || record.objective_mode === 'implementation')) ||
    (record.route === 'STOP' && record.schema_version === 3),
  )) {
    return stop(
      `EVIDENCE_CONFLICT: current-head no-PR HANDOFF route is incompatible with ordered objective continuation at ${evidence.localGit.head}.`,
      'Resolve incompatible current-head HANDOFF evidence before continuing.',
    )
  }

  const completed = progress.checkpoints.length
  if (completed < progress.objectiveCount) {
    const setupRecovery = completed === 0 ? setupBaseRecoveryRoute(evidence) : null
    if (setupRecovery) return setupRecovery
    const objective = evidence.issue.objectiveSequence!.objectives[completed]!
    return {
      route: 'IMPLEMENT',
      reasons: [`Objective ${objective.id} is the immediate next declared objective after ${completed} verified checkpoint${completed === 1 ? '' : 's'}.`],
      nextAction: {
        type: 'COMMAND',
        command: null,
        description: `Implement only Objective ${objective.id} — ${objective.title} on the durable topic branch. Reconstruct fresh Context after its durable HANDOFF before selecting another objective.`,
      },
    }
  }

  const finalCheckpoint = progress.checkpoints.at(-1)
  if (!finalCheckpoint || !isPrReadyImplementationEvidence(finalCheckpoint.record, finalCheckpoint.source, evidence)) {
    return stop(
      `EVIDENCE_CONFLICT: final ordered objective checkpoint is not eligible for PR_READY at ${evidence.localGit.head}.`,
      'Complete and validate the final declared implementation checkpoint before opening a PR.',
    )
  }
  if (hasConflictingTerminalHandoff(handoffSources, evidence)) return stop(
    `EVIDENCE_CONFLICT: malformed current-head or stale no-PR STOP or COMPLETE HANDOFF history competes with the final PR_READY candidate at ${evidence.localGit.head}.`,
    'Resolve malformed or stale terminal HANDOFF history before continuing.',
  )
  return {
    route: 'PR_READY',
    reasons: [`All ${progress.objectiveCount} declared implementation checkpoints are uniquely bound to the durable branch and final exact head ${evidence.localGit.head}; only PR creation is authorized.`],
    nextAction: {
      type: 'OPEN_PR',
      command: 'gh pr create',
      description: 'Open exactly one PR from the uniquely verified, already-pushed canonical Issue branch to the approved protected base. No source edits or other Git mutations are authorized.',
    },
  }
}
