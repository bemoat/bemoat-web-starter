#!/usr/bin/env node
import { readFileSync } from 'node:fs'

import { validateBlockerResolutionBody } from './context/blocker-resolution-validation.ts'
import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'
import type { ParsedInvocation } from './cli/command-invocation-schemas.ts'

const COMMAND = 'bemoat:blocker-resolution:validate'
const ENTRYPOINT = 'scripts/agent-validate-blocker-resolution.ts'

class BlockerResolutionValidationError extends CliInvocationError {
  constructor() {
    super('--body-file', 'body does not match either canonical BLOCKER_RESOLUTION schema')
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
        ...(error instanceof BlockerResolutionValidationError ? { validation_status: 'FAIL' } : {}),
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

    const body = readBody(String(invocation.values.body_file))
    const validation = validateBlockerResolutionBody(body)
    if (validation.status === 'FAIL') throw new BlockerResolutionValidationError()

    const reason = 'BLOCKER_RESOLUTION syntax is valid; no identity, authority, evidence, publication, or Context route was evaluated.'
    const result = createResultEnvelopeV1({
      command,
      outcome: 'SUCCESS',
      classification: 'SUCCESS',
      mutation_performed: false,
      next_action: { type: 'COMPLETE', command: null, reason },
      details: {
        validation_status: validation.status,
        record_schema_version: validation.recordSchemaVersion,
        authority_verified: false,
        context_route_created: false,
      },
    })
    if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(result)}\n`)
    else process.stdout.write(`PASS: BLOCKER_RESOLUTION schema-v${validation.recordSchemaVersion} syntax is valid.\n`)
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
