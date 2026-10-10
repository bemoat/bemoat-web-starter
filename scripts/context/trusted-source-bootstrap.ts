import { isAbsolute } from 'node:path'

import { COMMITTED_WIP_BINDING } from './committed-wip-recovery.ts'
import type { ContextCommandRunner } from './runtime.ts'
import { runContextCommand } from './runtime.ts'
import { BASE_BRANCH, CONTEXT_COMMAND, PROOF_COMMAND, REPOSITORY, TRUSTED_SOURCE_BOOTSTRAP_COMMAND } from './trusted-source-bootstrap-contract.ts'
import { canonicalDestination, canonicalExistingDirectory, parseJsonLine, pathsOverlap, readPullRequest, rootsOverlap, validateDestination, verifyIssue627Target, verifyMainOnlyApprovedBase, verifyMergeOnLiveMain, verifySource } from './trusted-source-bootstrap-preflight.ts'
import { commandFailureReason, validHelp, validateContext, validateProof } from './trusted-source-bootstrap-validation.ts'

export { TRUSTED_SOURCE_BOOTSTRAP_COMMAND }

type BootstrapClassification =
  | 'SUCCESS'
  | 'UNSUPPORTED_PRE_STATE'
  | 'STATE_CONFLICT'
  | 'HEAD_DRIFT'
  | 'BLOCKED_EXTERNAL'
  | 'EVIDENCE_CONFLICT'
  | 'AMBIGUOUS_RESULT'

export interface TrustedSourceBootstrapResult {
  classification: BootstrapClassification
  mutationPerformed: boolean
  route: 'STOP'
  currentHead: string | null
  reasons: string[]
  nextAction: { type: 'STOP'; command: null; description: string }
  details: Record<string, unknown>
}

function result({
  classification,
  reason,
  currentHead = null,
  mutationPerformed = false,
  details = {},
}: {
  classification: BootstrapClassification
  reason: string
  currentHead?: string | null
  mutationPerformed?: boolean
  details?: Record<string, unknown>
}): TrustedSourceBootstrapResult {
  return {
    classification,
    mutationPerformed,
    route: 'STOP',
    currentHead,
    reasons: [reason],
    nextAction: {
      type: 'STOP',
      command: null,
      description: 'Stop. This setup-only command grants no objective-edit authority; reconstruct fresh target Context before continuing.',
    },
    details: { objective_edit_authority_granted: false, ...details },
  }
}

function stopped(classification: BootstrapClassification, reason: string, options: {
  currentHead?: string | null
  mutationPerformed?: boolean
  details?: Record<string, unknown>
} = {}): TrustedSourceBootstrapResult {
  return result({ classification, reason, ...options })
}

export function bootstrapTrustedSource({
  sourceCwd,
  prNumber,
  targetWorktree,
  destination,
  run = runContextCommand,
}: {
  sourceCwd: string
  prNumber: string | number
  targetWorktree: string
  destination: string
  run?: ContextCommandRunner
}): TrustedSourceBootstrapResult {
  let mutationPerformed = false
  let details: Record<string, unknown> = { objective_edit_authority_granted: false, destination_preserved_on_stop: false }
  try {
    const normalizedPr = String(prNumber)
    if (!/^[1-9]\d*$/.test(normalizedPr)) return stopped('UNSUPPORTED_PRE_STATE', '--pr-number must be a positive integer.')
    if (!isAbsolute(targetWorktree)) return stopped('UNSUPPORTED_PRE_STATE', '--target-worktree must be an absolute path.')
    if (!isAbsolute(destination)) return stopped('UNSUPPORTED_PRE_STATE', '--destination must be an absolute path.')
    const sourceRoot = canonicalExistingDirectory(sourceCwd)
    const targetRoot = canonicalExistingDirectory(targetWorktree)
    if (!sourceRoot || !targetRoot) return stopped('UNSUPPORTED_PRE_STATE', 'The #630 source and explicit #627 target must both be existing canonical directories.')
    if (rootsOverlap(sourceRoot, targetRoot)) return stopped('STATE_CONFLICT', 'The #630 source and explicit #627 target must be distinct, non-overlapping roots.')

    const sourceCheck = verifySource({ sourceCwd: sourceRoot, run })
    if (!sourceCheck.source) return stopped('STATE_CONFLICT', sourceCheck.reason ?? 'The #630 source state could not be proven.')
    const source = sourceCheck.source
    const prEvidence = readPullRequest({ cwd: sourceRoot, prNumber: normalizedPr, source, run })
    if (!prEvidence.pr || !prEvidence.mergeCommit) return stopped('BLOCKED_EXTERNAL', prEvidence.reason ?? 'The merged #630 PR could not be proven.', { currentHead: source.head })
    if (prEvidence.reason) return stopped('EVIDENCE_CONFLICT', prEvidence.reason, { currentHead: source.head })

    const targetReason = verifyIssue627Target({ targetCwd: targetRoot, sourceCwd: sourceRoot, run })
    if (targetReason) return stopped('EVIDENCE_CONFLICT', targetReason, { currentHead: source.head })

    const approvedBaseReason = verifyMainOnlyApprovedBase({ cwd: sourceRoot, run })
    if (approvedBaseReason) return stopped('EVIDENCE_CONFLICT', approvedBaseReason, { currentHead: source.head })

    const initialMain = verifyMergeOnLiveMain({ cwd: sourceRoot, mergeCommit: prEvidence.mergeCommit, run })
    if (!initialMain.liveMain) return stopped('EVIDENCE_CONFLICT', initialMain.reason ?? 'The #630 merge is not proven on exact live main.', { currentHead: source.head })
    const liveMain = initialMain.liveMain
    const destinationState = canonicalDestination(destination)
    if (destinationState.reason) return stopped('STATE_CONFLICT', destinationState.reason, { currentHead: source.head })
    if (pathsOverlap(destinationState.canonical, sourceRoot) || pathsOverlap(destinationState.canonical, targetRoot)) {
      return stopped('STATE_CONFLICT', 'Destination must be a distinct, non-overlapping root from both #630 and original #627.', { currentHead: source.head })
    }

    let destinationMode: 'CREATED' | 'REUSED'
    if (destinationState.exists) {
      destinationMode = 'REUSED'
      details = { ...details, destination: destinationState.canonical, destination_preserved_on_stop: true, destination_state: destinationMode }
    } else {
      const sourceBeforeClone = verifySource({ sourceCwd: sourceRoot, run, expectedBranch: source.branch, expectedHead: source.head })
      if (!sourceBeforeClone.source) return stopped('HEAD_DRIFT', sourceBeforeClone.reason ?? 'The #630 source changed before clone.', { currentHead: source.head })
      const prBeforeClone = readPullRequest({ cwd: sourceRoot, prNumber: normalizedPr, source: source, run })
      if (!prBeforeClone.pr || !prBeforeClone.mergeCommit) return stopped('BLOCKED_EXTERNAL', prBeforeClone.reason ?? 'Merged #630 PR could not be re-read before clone.', { currentHead: source.head })
      if (prBeforeClone.reason || prBeforeClone.mergeCommit !== prEvidence.mergeCommit) {
        return stopped('HEAD_DRIFT', 'The explicit merged #630 PR binding changed before clone.', { currentHead: source.head })
      }
      const targetBeforeClone = verifyIssue627Target({ targetCwd: targetRoot, sourceCwd: sourceRoot, run })
      if (targetBeforeClone) return stopped('HEAD_DRIFT', targetBeforeClone, { currentHead: source.head })
      const approvedBaseBeforeClone = verifyMainOnlyApprovedBase({ cwd: sourceRoot, run })
      if (approvedBaseBeforeClone) return stopped('HEAD_DRIFT', approvedBaseBeforeClone, { currentHead: source.head })
      const mainBeforeClone = verifyMergeOnLiveMain({ cwd: sourceRoot, mergeCommit: prEvidence.mergeCommit, run })
      if (!mainBeforeClone.liveMain || mainBeforeClone.liveMain !== liveMain) {
        return stopped('HEAD_DRIFT', mainBeforeClone.reason ?? 'Live main changed before clone; no destination was created.', { currentHead: source.head })
      }
      const destinationBeforeClone = canonicalDestination(destination)
      if (destinationBeforeClone.reason || destinationBeforeClone.exists || destinationBeforeClone.canonical !== destinationState.canonical) {
        return stopped('STATE_CONFLICT', destinationBeforeClone.reason ?? 'The explicit destination changed after its absence check; preserve it and stop.', { currentHead: source.head })
      }
      const clone = run('git', [
        'clone', '--branch', BASE_BRANCH, '--single-branch', '--no-tags', '--no-recurse-submodules',
        `https://github.com/${REPOSITORY}.git`, destinationState.canonical,
      ], { cwd: sourceRoot })
      mutationPerformed = true
      details = { ...details, destination: destinationState.canonical, destination_preserved_on_stop: true, destination_state: 'CLONE_ATTEMPTED' }
      if (clone.status !== 0 || clone.error) {
        return stopped('BLOCKED_EXTERNAL', `Exact-live main clone failed; any partial destination was preserved: ${commandFailureReason(clone, 'git clone')}`, {
          currentHead: source.head, mutationPerformed, details,
        })
      }
      destinationMode = 'CREATED'
      details = { ...details, destination_state: destinationMode }
    }

    const verifiedDestination = validateDestination({
      destination: destinationState.canonical,
      sourceCwd: sourceRoot,
      targetCwd: targetRoot,
      expectedLiveMain: liveMain,
      run,
    })
    if (!verifiedDestination.identity) {
      return stopped('EVIDENCE_CONFLICT', verifiedDestination.reason ?? 'Destination D is not an exact-live independent clone.', {
        currentHead: source.head, mutationPerformed, details,
      })
    }
    details = { ...details, destination_root: verifiedDestination.identity.root, destination_head: verifiedDestination.identity.head }

    const sourceAfterAcquisition = verifySource({ sourceCwd: sourceRoot, run, expectedBranch: source.branch, expectedHead: source.head })
    if (!sourceAfterAcquisition.source) return stopped('HEAD_DRIFT', sourceAfterAcquisition.reason ?? 'The #630 source changed during acquisition.', { currentHead: source.head, mutationPerformed, details })
    const targetAfterAcquisition = verifyIssue627Target({ targetCwd: targetRoot, sourceCwd: sourceRoot, run })
    if (targetAfterAcquisition) return stopped('HEAD_DRIFT', targetAfterAcquisition, { currentHead: source.head, mutationPerformed, details })
    const approvedBaseAfterAcquisition = verifyMainOnlyApprovedBase({ cwd: sourceRoot, run })
    if (approvedBaseAfterAcquisition) return stopped('HEAD_DRIFT', approvedBaseAfterAcquisition, { currentHead: source.head, mutationPerformed, details })
    const mainAfterAcquisition = verifyMergeOnLiveMain({ cwd: sourceRoot, mergeCommit: prEvidence.mergeCommit, run })
    if (!mainAfterAcquisition.liveMain || mainAfterAcquisition.liveMain !== liveMain) {
      return stopped('HEAD_DRIFT', mainAfterAcquisition.reason ?? 'Live main moved during acquisition; preserve D and retry only after fresh verification.', { currentHead: source.head, mutationPerformed, details })
    }

    const proofHelp = run('pnpm', ['run', PROOF_COMMAND, '--', '--help', '--json'], { cwd: verifiedDestination.identity.root })
    const proofHelpPayload = parseJsonLine(proofHelp.stdout)
    if (proofHelp.status !== 0 || proofHelp.error) {
      return stopped('BLOCKED_EXTERNAL', `The registered Architecture A proof safe help cannot run from D; preserve D and stop: ${commandFailureReason(proofHelp, PROOF_COMMAND)}`, {
        currentHead: source.head, mutationPerformed, details,
      })
    }
    if (!validHelp(proofHelpPayload, PROOF_COMMAND, 'A', ['issue_number', 'expected_repository', 'expected_branch', 'expected_base_branch', 'expected_base_sha', 'expected_handoff_comment_id', 'expected_handoff_head', 'expected_wip_head', 'expected_wip_tree', 'target_worktree'], [])) {
      return stopped('EVIDENCE_CONFLICT', 'D did not return the registered Architecture A proof JSON help contract; preserve D and stop.', { currentHead: source.head, mutationPerformed, details })
    }

    const contextHelp = run('pnpm', ['run', CONTEXT_COMMAND, '--', '--help', '--json'], { cwd: verifiedDestination.identity.root })
    const contextHelpPayload = parseJsonLine(contextHelp.stdout)
    if (contextHelp.status !== 0 || contextHelp.error) {
      return stopped('BLOCKED_EXTERNAL', `Registered Context safe help cannot run from D; preserve D and stop: ${commandFailureReason(contextHelp, CONTEXT_COMMAND)}`, {
        currentHead: source.head, mutationPerformed, details,
      })
    }
    if (!validHelp(contextHelpPayload, CONTEXT_COMMAND, 'B', ['issue_number'], ['target_worktree'])) {
      return stopped('EVIDENCE_CONFLICT', 'D did not return the registered target-mode Context JSON help contract; preserve D and stop.', { currentHead: source.head, mutationPerformed, details })
    }

    const binding = COMMITTED_WIP_BINDING
    const proofArgs = [
      'run', PROOF_COMMAND, '--', binding.issueNumber,
      '--expected-repository', binding.repository,
      '--expected-branch', binding.branch,
      '--expected-base-branch', binding.baseBranch,
      '--expected-base-sha', binding.baseSha,
      '--expected-handoff-comment-id', binding.handoffCommentId,
      '--expected-handoff-head', binding.baseSha,
      '--expected-wip-head', binding.wipHead,
      '--expected-wip-tree', binding.wipTree,
      '--target-worktree', targetRoot,
      '--json',
    ]
    const proofRun = run('pnpm', proofArgs, { cwd: verifiedDestination.identity.root })
    const proofPayload = parseJsonLine(proofRun.stdout)
    if (proofRun.status !== 0 || proofRun.error) {
      return stopped('BLOCKED_EXTERNAL', `The registered Architecture A proof could not run successfully from D; preserve D and stop: ${commandFailureReason(proofRun, PROOF_COMMAND)}`, {
        currentHead: source.head, mutationPerformed, details,
      })
    }
    if (!validateProof(proofPayload, { sourceRoot: verifiedDestination.identity.root, targetRoot, liveMain })) {
      return stopped('EVIDENCE_CONFLICT', 'The registered Architecture A proof did not return its exact successful read-only result; preserve D and stop.', {
        currentHead: source.head, mutationPerformed, details,
      })
    }

    const contextRun = run('pnpm', ['run', CONTEXT_COMMAND, '--', binding.issueNumber, '--target-worktree', targetRoot, '--json'], { cwd: verifiedDestination.identity.root })
    const contextPayload = parseJsonLine(contextRun.stdout)
    if (contextRun.status !== 0 || contextRun.error || !contextPayload) {
      return stopped('BLOCKED_EXTERNAL', `Fresh target-mode Context could not run from D or return JSON; preserve D and stop: ${commandFailureReason(contextRun, CONTEXT_COMMAND)}`, {
        currentHead: source.head, mutationPerformed, details: { ...details, architecture_a_proof: proofPayload },
      })
    }
    if (!validateContext(contextPayload, { liveMain })) {
      return stopped('EVIDENCE_CONFLICT', 'Fresh Context returned malformed or wrong-Issue target-mode evidence; preserve D and stop.', {
        currentHead: source.head, mutationPerformed, details: { ...details, architecture_a_proof: proofPayload, fresh_context: contextPayload },
      })
    }

    const finalDestination = validateDestination({
      destination: destinationState.canonical,
      sourceCwd: sourceRoot,
      targetCwd: targetRoot,
      expectedLiveMain: liveMain,
      run,
    })
    const sourceFinal = verifySource({ sourceCwd: sourceRoot, run, expectedBranch: source.branch, expectedHead: source.head })
    const targetFinal = verifyIssue627Target({ targetCwd: targetRoot, sourceCwd: sourceRoot, run })
    const approvedBaseFinal = verifyMainOnlyApprovedBase({ cwd: sourceRoot, run })
    const mainFinal = verifyMergeOnLiveMain({ cwd: sourceRoot, mergeCommit: prEvidence.mergeCommit, run })
    if (!finalDestination.identity || !sourceFinal.source || targetFinal || approvedBaseFinal || !mainFinal.liveMain || mainFinal.liveMain !== liveMain) {
      return stopped('AMBIGUOUS_RESULT', finalDestination.reason ?? sourceFinal.reason ?? targetFinal ?? approvedBaseFinal ?? mainFinal.reason ?? 'Final bootstrap readback changed; preserve all roots and stop.', {
        currentHead: source.head,
        mutationPerformed,
        details: { ...details, architecture_a_proof: proofPayload, actual_context_route: contextPayload.route, fresh_context: contextPayload },
      })
    }

    return result({
      classification: 'SUCCESS',
      reason: 'Exact-live independent D is verified; registered safe help and Architecture A proof ran from D; fresh #627 target Context returned its observed route. Objective edit authority remains false.',
      currentHead: source.head,
      mutationPerformed,
      details: {
        ...details,
        destination_state: destinationMode,
        pr_number: normalizedPr,
        pr_merge_commit: prEvidence.mergeCommit,
        live_main: liveMain,
        target_worktree: targetRoot,
        actual_context_route: contextPayload.route,
        architecture_a_proof: proofPayload,
        fresh_context: contextPayload,
        objective_edit_authority_granted: false,
        target_mutation_performed: false,
        github_mutation_performed: false,
      },
    })
  } catch (error) {
    return stopped('EVIDENCE_CONFLICT', error instanceof Error ? error.message : String(error), { mutationPerformed, details })
  }
}
