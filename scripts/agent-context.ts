#!/usr/bin/env node

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ContextInvocationError, parseContextInvocation, renderContextHelp } from './context/cli.ts'
import { collectContextEvidence } from './context/evidence.ts'
import { routeContext } from './context/router.ts'
import { authorizeContextSync } from './context/sync.ts'
import { resolveContextBootstrapRoots, verifyContextBootstrap } from './context/bootstrap-worktree.ts'
import { ContextSyncWorktreeError } from './context/sync-worktree.ts'
import { COMMITTED_WIP_BINDING } from './context/committed-wip-recovery.ts'
import { collectCommittedWipContextProof } from './context/committed-wip-context-proof.ts'
import type { NormalizedContextEvidence, ContextDecision } from './context/model.ts'

function handleInvocationError(error: unknown): boolean {
  if (!(error instanceof ContextInvocationError)) return false

  process.stderr.write(`INVALID_INVOCATION: ${error.message}\n`)
  process.exitCode = error.exit_code
  return true
}

export function createContextOutput(evidence: NormalizedContextEvidence, decision: ContextDecision, issueNumber: string) {
  const staleBaseSync = decision.route === 'STOP' && decision.nextAction.type === 'STOP' && decision.nextAction.command === null
    ? authorizeContextSync(evidence)
    : null
  const nextAction = {
    type: decision.nextAction.type,
    command: decision.nextAction.command,
    description: decision.nextAction.description,
  } as {
    type: ContextDecision['nextAction']['type']
    command: ContextDecision['nextAction']['command']
    description: string
    reason: string
  }
  Object.defineProperty(nextAction, 'reason', { value: decision.nextAction.description, enumerable: false })
  return {
    schema_version: 1,
    command: 'bemoat:context',
    mode: 'context',
    mutation_performed: false,
    repository: evidence.repository,
    protected_base: evidence.protectedBase,
    policy: evidence.policy,
    issue: evidence.issue,
    local_git: evidence.localGit,
    active_pr: evidence.activePr,
    current_head_verification: evidence.currentHeadVerification,
    durable_context: evidence.durableContext,
    ...(evidence.historicalBlockerResolutionProofs?.length
      ? { historical_blocker_resolution_proofs: evidence.historicalBlockerResolutionProofs }
      : {}),
    route: decision.route,
    reasons: decision.reasons,
    ...(staleBaseSync?.allowed && staleBaseSync.recovery
      ? { recovery: staleBaseSync.recovery }
      : decision.recovery
        ? { recovery: decision.recovery }
        : {}),
    next_action: nextAction,
    evidence_urls: decision.evidenceUrls,
    issue_number: issueNumber,
  }
}

function renderText(output: ReturnType<typeof createContextOutput>) {
  const lines = [
    `bemoat:context — Issue #${output.issue_number}`,
    `Repository: ${output.repository.nameWithOwner}`,
    `Protected base: ${output.protected_base.branch}@${output.protected_base.sha || '<unavailable>'}`,
    `Policy: ${output.policy.path} ${output.policy.version || '<unavailable>'}`,
    `Local: ${output.local_git.branch} ${output.local_git.head || '<unavailable>'} (${output.local_git.durable ? 'durable' : 'not durable'})`,
    `Route: ${output.route}`,
    `Next: ${output.next_action.description}`,
  ]
  if (output.reasons.length > 0) {
    lines.push('Reasons:', ...output.reasons.map((reason) => `- ${reason}`))
  }
  process.stdout.write(`${lines.join('\n')}\n`)
}

function main() {
  let invocation

  try {
    invocation = parseContextInvocation(process.argv.slice(2))
  } catch (error) {
    if (handleInvocationError(error)) return
    throw error
  }

  if (invocation.mode === 'help') {
    process.stdout.write(renderContextHelp(invocation.format))
    return
  }

  const issueNumber = invocation.issueNumber
  let cwd = process.cwd()
  let bootstrapRoots = null
  let bootstrapError: string | null = null
  if (invocation.targetWorktree) {
    try {
      bootstrapRoots = resolveContextBootstrapRoots({
        sourceCwd: process.cwd(),
        targetWorktree: invocation.targetWorktree,
        entrypointPath: fileURLToPath(import.meta.url),
      })
      cwd = bootstrapRoots.targetCwd
    } catch (error) {
      if (!(error instanceof ContextSyncWorktreeError)) throw error
      bootstrapError = `EVIDENCE_CONFLICT: ${error.message}`
    }
  }
  const evidence = collectContextEvidence({ cwd, issueNumber })
  if (bootstrapRoots) {
    const bootstrapErrors = verifyContextBootstrap({ roots: bootstrapRoots, evidence })
    evidence.evidenceErrors.push(...bootstrapErrors)
    if (bootstrapErrors.length === 0 && issueNumber === COMMITTED_WIP_BINDING.issueNumber &&
        evidence.localGit.branch === COMMITTED_WIP_BINDING.branch &&
        evidence.localGit.head?.toLowerCase() === COMMITTED_WIP_BINDING.wipHead) {
      const proof = collectCommittedWipContextProof({
        sourceCwd: bootstrapRoots.sourceCwd,
        targetWorktree: bootstrapRoots.targetCwd,
      })
      if (proof.proof) evidence.committedWipProof = proof.proof
      else evidence.evidenceErrors.push(`EVIDENCE_CONFLICT: exact committed-WIP proof failed: ${proof.error}`)
    }
  }
  if (bootstrapError) evidence.evidenceErrors.push(bootstrapError)
  const decision = routeContext(evidence)
  const output = createContextOutput(evidence, decision, issueNumber)
  if (invocation.format === 'json') {
    process.stdout.write(`${JSON.stringify(output)}\n`)
  } else {
    renderText(output)
  }
}

if (
  process.argv[1] &&
  (resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
    process.argv[1].endsWith('/agent-context.ts'))
) {
  main()
}
