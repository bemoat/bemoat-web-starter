#!/usr/bin/env node

import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'
import { recoverCommittedWip } from './context/committed-wip-recovery.ts'
import type { CommittedWipRecoveryResult } from './context/committed-wip-recovery.ts'
import type { ParsedInvocation } from './cli/command-invocation-schemas.ts'

const COMMAND = 'bemoat:context:recover-committed-wip'
const ENTRYPOINT = 'scripts/agent-context-recover-committed-wip.ts'

function renderHelp(invocation: Extract<ParsedInvocation, { mode: 'help' }>) {
  if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(createHelpEnvelopeV1(invocation.contract))}\n`)
  else process.stdout.write(formatTextHelp(invocation.contract))
}

function renderResult({ issueNumber, format, result }: { issueNumber: string; format: 'json' | 'text'; result: CommittedWipRecoveryResult }) {
  const successful = result.classification === 'SUCCESS' || result.classification === 'NO_OP_IDENTICAL_RETRY'
  const outcome = result.classification === 'NO_OP_IDENTICAL_RETRY' ? 'NO_OP' : successful ? 'SUCCESS' : 'STOP'
  const envelope = createResultEnvelopeV1({
    command: COMMAND,
    outcome,
    classification: result.classification,
    mutation_performed: false,
    issue_number: issueNumber,
    exact_head: result.currentHead,
    next_action: { type: result.nextAction.type, command: result.nextAction.command, reason: result.nextAction.description },
    details: { route: result.route, reasons: result.reasons, ...result.details },
  })
  if (format === 'json') process.stdout.write(`${JSON.stringify(envelope)}\n`)
  else process.stdout.write(`${outcome}: ${result.reasons.join('; ')}\n`)
  process.exitCode = classificationExitCode(result.classification)
}

function renderError({ error, issueNumber, format }: { error: unknown; issueNumber?: string; format: 'json' | 'text' }) {
  const classification = error instanceof CliInvocationError ? error.classification : 'INTERNAL_ERROR'
  const reason = error instanceof Error ? error.message : String(error)
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(createResultEnvelopeV1({
      command: COMMAND,
      outcome: 'ERROR',
      classification,
      mutation_performed: false,
      issue_number: issueNumber ?? null,
      next_action: { type: 'STOP', command: null, reason },
      details: { reason, objective_edit_authority_granted: false, reentry_performed: false },
    }))}\n`)
  } else process.stderr.write(`ERROR: ${classification}: ${reason}\n`)
  process.exitCode = classificationExitCode(classification)
}

function main() {
  let invocation: ParsedInvocation | null = null
  try {
    const command = resolveCommandIdentity({ fallback: COMMAND, env: process.env, entrypoint: ENTRYPOINT })
    invocation = parseCommandInvocation(command, process.argv.slice(2))
    if (invocation.mode === 'help') return renderHelp(invocation)
    if (invocation.mode !== 'run') throw new Error('run invocation required')
    const value = (name: string) => String(invocation!.mode === 'run' ? invocation!.values[name] : '')
    const result = recoverCommittedWip({
      sourceCwd: process.cwd(),
      binding: {
        issueNumber: value('issue_number'),
        expectedRepository: value('expected_repository'),
        expectedBranch: value('expected_branch'),
        expectedBaseBranch: value('expected_base_branch'),
        expectedBaseSha: value('expected_base_sha'),
        expectedHandoffCommentId: value('expected_handoff_comment_id'),
        expectedHandoffHead: value('expected_handoff_head'),
        expectedWipHead: value('expected_wip_head'),
        expectedWipTree: value('expected_wip_tree'),
        targetWorktree: value('target_worktree'),
      },
    })
    renderResult({ issueNumber: value('issue_number'), format: invocation.format, result })
  } catch (error) {
    renderError({
      error,
      issueNumber: invocation?.mode === 'run' ? String(invocation.values.issue_number) : undefined,
      format: invocation?.format ?? (process.argv.includes('--json') ? 'json' : 'text'),
    })
  }
}

main()
