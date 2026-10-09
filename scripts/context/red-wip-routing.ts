import type { NormalizedContextEvidence } from './model.ts'
import type { ContextDecision } from './model.ts'

const DIRTY = 'LOCAL_STATE_NOT_DURABLE: working tree is dirty or has untracked files'
const DIRTY_SUMMARY = 'LOCAL_STATE_NOT_DURABLE: required local work is not clean, pushed, and attached to a durable branch'

export function redWipDurabilityCommand(
  evidence: NormalizedContextEvidence,
  baseReasons: string[],
  identityErrors: (evidence: NormalizedContextEvidence) => string[],
  routeNoPrContext: (evidence: NormalizedContextEvidence) => Pick<ContextDecision, 'route' | 'nextAction'>,
): boolean {
  const approval = evidence.redWipApproval, local = evidence.localGit, tree = evidence.redWipWorkingTree
  if (!approval || !tree || evidence.evidenceErrors.length || identityErrors(evidence).length || evidence.issue.state.toUpperCase() !== 'OPEN' || evidence.activePr !== null ||
      approval.issue_number !== evidence.issue.number || approval.repository !== evidence.repository.nameWithOwner || approval.branch !== local.branch ||
      approval.protected_base_sha.toLowerCase() !== evidence.protectedBase.sha.toLowerCase() || !/^\d+$/.test(approval.issue_number) ||
      !new RegExp(`^(fix|test)/${approval.issue_number}-[a-z0-9-]+$`).test(approval.branch) || local.originRepository !== approval.repository ||
      local.upstream !== `origin/${approval.branch}` || !local.head || !local.pushed || local.clean || local.detached || local.durable ||
      local.reasons.length !== 1 || local.reasons[0] !== DIRTY || !tree.available || !tree.approvedPathRegularFile || !tree.protectedBaseAncestor ||
      tree.stagedPaths.length || tree.untrackedPaths.length || tree.unstagedPaths.length !== 1 || tree.unstagedPaths[0] !== approval.test_path) return false
  if (baseReasons.some((reason) => reason !== DIRTY && reason !== DIRTY_SUMMARY) || !baseReasons.includes(DIRTY)) return false
  const residual = routeNoPrContext({ ...evidence, localGit: { ...local, clean: true, durable: true, reasons: [] } })
  return residual.route === 'IMPLEMENT' && residual.nextAction.type === 'COMMAND'
}
