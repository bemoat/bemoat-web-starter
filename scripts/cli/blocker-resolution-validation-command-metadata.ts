/** Read-only public BLOCKER_RESOLUTION syntax validator command metadata. */
import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

export function blockerResolutionValidationCommands(dependencies: CommandMetadataDependencies) {
  const { contract, flag, nextAction } = dependencies
  return {
    'bemoat:blocker-resolution:validate': contract({
      command: 'bemoat:blocker-resolution:validate',
      tier: 'B',
      entrypoint: 'scripts/agent-validate-blocker-resolution.ts',
      purpose: 'Validate one complete BLOCKER_RESOLUTION body against the canonical strict schema parsers.',
      operation: 'Read the caller-supplied body file and report syntax PASS or FAIL for schema-v1 active-PR and schema-v2 no-PR records. A PASS proves syntax only; it does not verify identity, authority, evidence, publication, or a Context route.',
      accepted_pre_states: ['NOT_STATEFUL'],
      required_inputs: [
        flag('body_file', '--body-file <path>', 'path', 'Path to the complete exact BLOCKER_RESOLUTION comment body.', [], true),
      ],
      optional_flags: [
        flag('json', '--json', 'boolean', 'Emit canonical machine-readable result.'),
      ],
      reads: ['the caller-supplied BLOCKER_RESOLUTION body file'],
      writes: [],
      success_classifications: ['SUCCESS'],
      stop_classifications: ['INVALID_INVOCATION', 'INTERNAL_ERROR'],
      stop_conditions: ['Return FAIL for a body that is malformed or does not match either complete canonical schema; stop on an unreadable body file.'],
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('COMPLETE', null, 'Syntax validation completed; a PASS conveys no authority or Context route.') },
        { classification: 'INVALID_INVOCATION', next_action: nextAction('STOP', null, 'The supplied body or invocation is invalid; correct it before retrying.') },
      ],
      examples: [{ description: 'Validate one complete candidate body.', argv: ['--body-file', './blocker-resolution.md', '--json'] }],
      parser_owner: 'scripts/context/blocker-resolution.ts',
      safe_help_invocation: 'pnpm run bemoat:blocker-resolution:validate -- --help --json',
    }),
  }
}
