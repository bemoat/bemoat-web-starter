#!/usr/bin/env node
import { readFileSync } from 'node:fs'

import { validateReviewVerdictBody } from './context/review-verdict-validation.ts'
import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'
import type { ParsedInvocation } from './cli/command-invocation-schemas.ts'

const COMMAND = 'bemoat:review-verdict:validate'
const ENTRYPOINT = 'scripts/agent-validate-review-verdict.ts'

class ReviewVerdictValidationError extends CliInvocationError {
  constructor() {
    super('--body-file', 'body does not match the canonical REVIEW_VERDICT schema')
  }
}

function readBody(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new CliInvocationError(path, error instanceof Error ? error.message : String(error))
  }
}

function renderHelp(invocation: Extract<ParsedInvocation, { mode: 'help' }>) {
  if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(createHelpEnvelopeV1(invocation.contract))}\n`)
  else process.stdout.write(formatTextHelp(invocation.contract))
}

function renderError({ command, format, error }: { command: string; format: 'json' | 'text'; error: unknown }) {
  const classification = error instanceof CliInvocationError ? error.classification : 'INTERNAL_ERROR'
  const reason = error instanceof Error ? error.message : String(error)
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(createResultEnvelopeV1({
      command,
      outcome: 'ERROR',
      classification,
      mutation_performed: false,
      next_action: { type: 'STOP', command: null, reason },
      details: {
        argument: error instanceof CliInvocationError ? error.details.argument : null,
        reason,
        ...(error instanceof ReviewVerdictValidationError ? { validation_status: 'FAIL' } : {}),
      },
    }))}\n`)
  } else {
    process.stderr.write(`ERROR: ${classification}: ${reason}\n`)
  }
  process.exitCode = classificationExitCode(classification)
}

function main() {
  let invocation: ParsedInvocation | null = null
  let command = COMMAND
  try {
    command = resolveCommandIdentity({ fallback: COMMAND, env: process.env, entrypoint: ENTRYPOINT })
    invocation = parseCommandInvocation(command, process.argv.slice(2))
    if (invocation.mode === 'help') return renderHelp(invocation)
    if (invocation.mode !== 'run') throw new Error('run invocation required')

    const validation = validateReviewVerdictBody(readBody(String(invocation.values.body_file)))
    if (validation.status === 'FAIL') throw new ReviewVerdictValidationError()

    const reason = 'REVIEW_VERDICT syntax is valid; reviewer independence, live freshness, ancestry, semantic correctness, submission, routing, Founder authority, and merge eligibility were not evaluated.'
    const result = createResultEnvelopeV1({
      command,
      outcome: 'SUCCESS',
      classification: 'SUCCESS',
      mutation_performed: false,
      next_action: { type: 'COMPLETE', command: null, reason },
      details: {
        validation_status: validation.status,
        reviewer_independence_verified: false,
        live_freshness_verified: false,
        ancestry_verified: false,
        semantic_correctness_verified: false,
        submission_performed: false,
        context_route_created: false,
        founder_authority_verified: false,
        merge_eligibility_verified: false,
      },
    })
    if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(result)}\n`)
    else process.stdout.write('PASS: REVIEW_VERDICT syntax and shape are valid.\n')
    process.exitCode = 0
  } catch (error) {
    renderError({
      command,
      format: invocation?.format ?? (process.argv.includes('--json') ? 'json' : 'text'),
      error,
    })
  }
}

main()
