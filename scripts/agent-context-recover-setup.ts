#!/usr/bin/env node

import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'
import { recoverSetupBase } from './context/setup-recovery.ts'
import type { SetupRecoveryResult } from './context/setup-recovery.ts'
import type { ParsedInvocation } from './cli/command-invocation-schemas.ts'

const COMMAND = 'bemoat:context:recover-setup'
const ENTRYPOINT = 'scripts/agent-context-recover-setup.ts'

function renderHelp(invocation: Extract<ParsedInvocation, { mode: 'help' }>) {
  if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(createHelpEnvelopeV1(invocation.contract))}\n`)
  else process.stdout.write(formatTextHelp(invocation.contract))
}

function renderResult({ issueNumber, format, result }: { issueNumber: string; format: 'json' | 'text'; result: SetupRecoveryResult }) {
  const success = result.classification === 'SUCCESS' || result.classification === 'NO_OP_IDENTICAL_RETRY'
  const outcome = result.classification === 'NO_OP_IDENTICAL_RETRY' ? 'NO_OP' : success ? 'SUCCESS' : 'STOP'
  const envelope = createResultEnvelopeV1({
    command: COMMAND,
    outcome,
    classification: result.classification,
    mutation_performed: result.mutationPerformed,
    issue_number: issueNumber,
    exact_head: result.currentHead,
    next_action: {
      type: result.nextAction.type,
      command: result.nextAction.command,
      reason: result.nextAction.description,
    },
    details: {
      route: result.route,
      reasons: result.reasons,
      objective_edit_authority_granted: false,
      evidence_urls: [],
    },
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
      details: { reason, objective_edit_authority_granted: false },
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

    const result = recoverSetupBase({
      binding: {
        issueNumber: String(invocation.values.issue_number),
        expectedRepository: String(invocation.values.expected_repository),
        expectedBaseBranch: String(invocation.values.expected_base_branch),
        expectedBaseSha: String(invocation.values.expected_base_sha),
        expectedLocalHead: String(invocation.values.expected_local_head),
      },
    })
    renderResult({ issueNumber: String(invocation.values.issue_number), format: invocation.format, result })
  } catch (error) {
    renderError({
      error,
      issueNumber: invocation?.mode === 'run' ? String(invocation.values.issue_number) : undefined,
      format: invocation?.format ?? (process.argv.includes('--json') ? 'json' : 'text'),
    })
  }
}

main()
