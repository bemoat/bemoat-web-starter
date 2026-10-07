#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseFounderDecisionRepairComment } from './context/founder-decision.ts'
import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'
import type { ParsedInvocation } from './cli/command-invocation-schemas.ts'

const COMMAND = 'bemoat:founder-decision-repair:validate'
const ENTRYPOINT = 'scripts/agent-validate-founder-decision-repair.ts'

function main() {
  let invocation: ParsedInvocation | null = null
  let command = COMMAND
  try {
    command = resolveCommandIdentity({ fallback: COMMAND, env: process.env, entrypoint: ENTRYPOINT })
    invocation = parseCommandInvocation(command, process.argv.slice(2))
    if (invocation.mode === 'help') {
      process.stdout.write(invocation.format === 'json'
        ? `${JSON.stringify(createHelpEnvelopeV1(invocation.contract))}\n`
        : formatTextHelp(invocation.contract))
      return
    }
    if (invocation.mode !== 'run') throw new Error('run invocation required')
    let body: string
    try {
      body = readFileSync(String(invocation.values.body_file), 'utf8')
    } catch (error) {
      throw new CliInvocationError('--body-file', error instanceof Error ? error.message : String(error))
    }
    if (!parseFounderDecisionRepairComment(body)) {
      throw new CliInvocationError('--body-file', 'body does not match the canonical FOUNDER_DECISION_REPAIR schema')
    }
    const result = createResultEnvelopeV1({
      command, outcome: 'SUCCESS', classification: 'SUCCESS', mutation_performed: false,
      next_action: {
        type: 'COMPLETE', command: null,
        reason: 'Repair syntax is valid; no live identity, authority, evidence, publication, or Context route was evaluated.',
      },
      details: { validation_status: 'PASS', record_schema_version: 1, authority_verified: false, context_route_created: false },
    })
    process.stdout.write(invocation.format === 'json'
      ? `${JSON.stringify(result)}\n` : 'PASS: FOUNDER_DECISION_REPAIR schema-v1 syntax is valid.\n')
  } catch (error) {
    const classification = error instanceof CliInvocationError ? error.classification : 'INTERNAL_ERROR'
    const reason = error instanceof Error ? error.message : String(error)
    if ((invocation?.format ?? (process.argv.includes('--json') ? 'json' : 'text')) === 'json') {
      process.stdout.write(`${JSON.stringify(createResultEnvelopeV1({
        command, outcome: 'ERROR', classification, mutation_performed: false,
        next_action: { type: 'STOP', command: null, reason },
        details: { validation_status: 'FAIL', reason },
      }))}\n`)
    } else process.stderr.write(`ERROR: ${classification}: ${reason}\n`)
    process.exitCode = classificationExitCode(classification)
  }
}

main()
