import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

export function founderDecisionRepairValidationCommands(dependencies: CommandMetadataDependencies) {
  const { contract, flag, nextAction } = dependencies
  return {
    'bemoat:founder-decision-repair:validate': contract({
      command: 'bemoat:founder-decision-repair:validate',
      tier: 'B',
      entrypoint: 'scripts/agent-validate-founder-decision-repair.ts',
      purpose: 'Validate one complete strict FOUNDER_DECISION_REPAIR body.',
      operation: 'Read the caller-supplied body file and report schema-v1 syntax PASS or FAIL. PASS establishes syntax only; it does not verify live identity, authority, predecessor body, evidence, publication, or a Context route.',
      accepted_pre_states: ['NOT_STATEFUL'],
      required_inputs: [flag('body_file', '--body-file <path>', 'path', 'Path to the exact complete repair comment body.', [], true)],
      optional_flags: [flag('json', '--json', 'boolean', 'Emit the canonical machine-readable result.')],
      reads: ['the caller-supplied FOUNDER_DECISION_REPAIR body file'],
      writes: [],
      success_classifications: ['SUCCESS'],
      stop_classifications: ['INVALID_INVOCATION', 'INTERNAL_ERROR'],
      stop_conditions: ['Reject noncanonical or schema-invalid bodies and unreadable files.'],
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('COMPLETE', null, 'Syntax validation completed; PASS grants no authority or Context route.') },
        { classification: 'INVALID_INVOCATION', next_action: nextAction('STOP', null, 'Correct the body or invocation before retrying.') },
      ],
      examples: [{ description: 'Validate a candidate repair body.', argv: ['--body-file', './founder-decision-repair.md', '--json'] }],
      parser_owner: 'scripts/context/founder-decision.ts',
      safe_help_invocation: 'pnpm run bemoat:founder-decision-repair:validate -- --help --json',
    }),
  }
}
