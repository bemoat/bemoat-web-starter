#!/usr/bin/env node

import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'
import { TRUSTED_SOURCE_BOOTSTRAP_COMMAND, bootstrapTrustedSource, type TrustedSourceBootstrapResult } from './context/trusted-source-bootstrap.ts'
import type { ParsedInvocation } from './cli/command-invocation-schemas.ts'

const COMMAND = 'bemoat:context:bootstrap-source'
const ENTRYPOINT = 'scripts/agent-context-bootstrap-source.ts'

function renderHelp(invocation: Extract<ParsedInvocation, { mode: 'help' }>) {
  if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(createHelpEnvelopeV1(invocation.contract))}\n`)
  else process.stdout.write(formatTextHelp(invocation.contract))
}

function renderResult({ prNumber, format, result }: {
  prNumber: string
  format: 'json' | 'text'
  result: TrustedSourceBootstrapResult
}) {
  const successful = result.classification === 'SUCCESS'
  const envelope = createResultEnvelopeV1({
    command: COMMAND,
    outcome: successful ? 'SUCCESS' : 'STOP',
    classification: result.classification,
    mutation_performed: result.mutationPerformed,
    repository: 'bemoat/bemoat-web-starter',
    issue_number: '630',
    pr_number: prNumber,
    exact_head: result.currentHead,
    next_action: { type: 'STOP', command: null, reason: result.nextAction.description },
    details: { route: result.route, reasons: result.reasons, ...result.details },
  })
  if (format === 'json') process.stdout.write(`${JSON.stringify(envelope)}\n`)
  else process.stdout.write(`${successful ? 'SUCCESS' : 'STOP'}: ${result.reasons.join('; ')}\n`)
  process.exitCode = classificationExitCode(result.classification)
}

function renderError({ error, prNumber, format }: { error: unknown; prNumber?: string; format: 'json' | 'text' }) {
  const classification = error instanceof CliInvocationError ? error.classification : 'INTERNAL_ERROR'
  const reason = error instanceof Error ? error.message : String(error)
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(createResultEnvelopeV1({
      command: COMMAND,
      outcome: 'ERROR',
      classification,
      mutation_performed: false,
      repository: 'bemoat/bemoat-web-starter',
      issue_number: '630',
      pr_number: prNumber ?? null,
      next_action: { type: 'STOP', command: null, reason },
      details: { reason, objective_edit_authority_granted: false, destination_preserved_on_stop: true },
    }))}\n`)
  } else process.stderr.write(`ERROR: ${classification}: ${reason}\n`)
  process.exitCode = classificationExitCode(classification)
}

function main() {
  let invocation: ParsedInvocation | null = null
  try {
    const command = resolveCommandIdentity({ fallback: COMMAND, env: process.env, entrypoint: ENTRYPOINT })
    if (command !== TRUSTED_SOURCE_BOOTSTRAP_COMMAND) throw new Error('registered bootstrap command identity mismatch')
    invocation = parseCommandInvocation(command, process.argv.slice(2))
    if (invocation.mode === 'help') return renderHelp(invocation)
    if (invocation.mode !== 'run') throw new Error('run invocation required')
    const value = (name: string) => String(invocation!.mode === 'run' ? invocation!.values[name] : '')
    const prNumber = value('pr_number')
    const result = bootstrapTrustedSource({
      sourceCwd: process.cwd(),
      prNumber,
      targetWorktree: value('target_worktree'),
      destination: value('destination'),
    })
    renderResult({ prNumber, format: invocation.format, result })
  } catch (error) {
    renderError({
      error,
      prNumber: invocation?.mode === 'run' ? String(invocation.values.pr_number) : undefined,
      format: invocation?.format ?? (process.argv.includes('--json') ? 'json' : 'text'),
    })
  }
}

main()
