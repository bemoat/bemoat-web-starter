import { COMMITTED_WIP_BINDING } from './committed-wip-recovery.ts'
import type { ContextCommandRunner } from './runtime.ts'
import { BASE_BRANCH, CONTEXT_COMMAND, PROOF_COMMAND } from './trusted-source-bootstrap-contract.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function validHelp(payload: Record<string, unknown> | null, command: string, tier: 'A' | 'B', requiredInputs: string[], optionalInputs: string[]): boolean {
  if (!payload || payload.schema_version !== 1 || payload.command !== command || payload.mode !== 'help' ||
      payload.classification !== 'HELP' || payload.tier !== tier || !Array.isArray(payload.writes) || payload.writes.length !== 0) return false
  const names = (key: 'required_inputs' | 'optional_flags') => Array.isArray(payload[key])
    ? (payload[key] as unknown[]).filter(isRecord).map((input) => input.name).filter((name): name is string => typeof name === 'string')
    : []
  const required = names('required_inputs')
  const optional = names('optional_flags')
  return requiredInputs.every((name) => required.includes(name)) && optionalInputs.every((name) => optional.includes(name))
}

export function validateProof(payload: Record<string, unknown> | null, { sourceRoot, targetRoot, liveMain }: {
  sourceRoot: string
  targetRoot: string
  liveMain: string
}): boolean {
  if (!payload || payload.schema_version !== 1 || payload.command !== PROOF_COMMAND || payload.mode !== 'result' ||
      payload.outcome !== 'SUCCESS' || payload.classification !== 'SUCCESS' || payload.mutation_performed !== false ||
      payload.issue_number !== COMMITTED_WIP_BINDING.issueNumber) return false
  const details = payload.details
  const next = payload.next_action
  if (!isRecord(details) || details.route !== 'STOP' || details.objective_edit_authority_granted !== false ||
      details.reentry_performed !== false || details.wip_state !== 'RED_INCOMPLETE' ||
      details.immutable_A !== COMMITTED_WIP_BINDING.baseSha ||
      details.immutable_B !== COMMITTED_WIP_BINDING.wipHead ||
      details.exact_tree !== COMMITTED_WIP_BINDING.wipTree ||
      details.live_protected_main_D !== liveMain ||
      details.historical_handoff_comment_id !== COMMITTED_WIP_BINDING.handoffCommentId ||
      details.canonical_source_root !== sourceRoot || details.canonical_target_root !== targetRoot ||
      !isRecord(details.source_identity) || !isRecord(details.target_identity) ||
      !isRecord(details.historical_handoff) || !isRecord(details.retry_binding)) return false
  const sourceIdentity = details.source_identity
  const targetIdentity = details.target_identity
  const historicalHandoff = details.historical_handoff
  const retryBinding = details.retry_binding
  return sourceIdentity.repository === COMMITTED_WIP_BINDING.repository &&
    sourceIdentity.branch === COMMITTED_WIP_BINDING.baseBranch &&
    sourceIdentity.head === liveMain && sourceIdentity.live_protected_base === liveMain &&
    sourceIdentity.historical_A === COMMITTED_WIP_BINDING.baseSha && sourceIdentity.clean === true &&
    targetIdentity.repository === COMMITTED_WIP_BINDING.repository &&
    targetIdentity.branch === COMMITTED_WIP_BINDING.branch &&
    targetIdentity.upstream === `origin/${COMMITTED_WIP_BINDING.branch}` &&
    targetIdentity.head === COMMITTED_WIP_BINDING.wipHead &&
    targetIdentity.tree === COMMITTED_WIP_BINDING.wipTree &&
    targetIdentity.live_remote_head === COMMITTED_WIP_BINDING.wipHead && targetIdentity.clean === true &&
    historicalHandoff.exact_head === COMMITTED_WIP_BINDING.baseSha &&
    historicalHandoff.comment_id === COMMITTED_WIP_BINDING.handoffCommentId &&
    retryBinding.comment === COMMITTED_WIP_BINDING.handoffCommentId &&
    retryBinding.target_root === targetRoot &&
    isRecord(next) && next.type === 'COMMAND' && next.command === CONTEXT_COMMAND
}

export function validateContext(payload: Record<string, unknown> | null, { liveMain }: { liveMain: string }): payload is Record<string, unknown> & { route: string } {
  if (!payload || payload.schema_version !== 1 || payload.command !== CONTEXT_COMMAND ||
      payload.mode !== 'context' || payload.mutation_performed !== false ||
      payload.issue_number !== COMMITTED_WIP_BINDING.issueNumber ||
      !['IMPLEMENT', 'PR_READY', 'VERIFY', 'FIX', 'REVIEW', 'FOUNDER_GATE', 'COMPLETE', 'STOP'].includes(String(payload.route)) ||
      !isRecord(payload.next_action) || !isRecord(payload.issue) ||
      !isRecord(payload.repository) || !isRecord(payload.protected_base) || !isRecord(payload.local_git)) return false
  const repository = payload.repository
  const protectedBase = payload.protected_base
  const localGit = payload.local_git
  const nextAction = payload.next_action
  const issue = payload.issue
  const validActionTypes = ['COMMAND', 'OPEN_PR', 'FOUNDER_GATE', 'COMPLETE', 'STOP']
  return repository.nameWithOwner === COMMITTED_WIP_BINDING.repository &&
    protectedBase.branch === BASE_BRANCH && protectedBase.sha === liveMain &&
    issue.number === COMMITTED_WIP_BINDING.issueNumber &&
    validActionTypes.includes(String(nextAction.type)) &&
    (nextAction.command === null || (typeof nextAction.command === 'string' && nextAction.command.trim() !== '')) &&
    typeof nextAction.description === 'string' && nextAction.description.trim() !== '' &&
    localGit.branch === COMMITTED_WIP_BINDING.branch &&
    localGit.head === COMMITTED_WIP_BINDING.wipHead &&
    localGit.upstream === `origin/${COMMITTED_WIP_BINDING.branch}` &&
    localGit.originRepository === COMMITTED_WIP_BINDING.repository &&
    localGit.clean === true && localGit.detached === false
}

export function commandFailureReason(result: ReturnType<ContextCommandRunner>, command: string): string {
  return result.error?.message || result.stderr.trim() ||
    (result.status !== 0 ? `${command} exited with status ${result.status}.` : result.stdout.trim()) ||
    `${command} did not complete successfully.`
}
