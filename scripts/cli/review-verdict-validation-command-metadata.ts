/** Read-only public REVIEW_VERDICT syntax validator command metadata. */
import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

export function reviewVerdictValidationCommands(dependencies: CommandMetadataDependencies) {
  const { contract, flag, nextAction } = dependencies
  return {
    'bemoat:review-verdict:validate': contract({
      command: 'bemoat:review-verdict:validate',
      tier: 'B',
      entrypoint: 'scripts/agent-validate-review-verdict.ts',
      purpose: 'Validate one complete REVIEW_VERDICT candidate body against the strict production parser mode.',
      operation: 'Read the caller-supplied body file and report syntax and shape PASS or FAIL. PASS does not verify reviewer independence, live freshness, ancestry, semantic correctness, submission, routing, Founder authority, or merge eligibility.',
      accepted_pre_states: ['NOT_STATEFUL'],
      required_inputs: [
        flag('body_file', '--body-file <path>', 'path', 'Path to the complete exact REVIEW_VERDICT body.', [], true),
      ],
      optional_flags: [
        flag('json', '--json', 'boolean', 'Emit canonical machine-readable result.'),
      ],
      reads: ['the caller-supplied REVIEW_VERDICT body file'],
      writes: [],
      success_classifications: ['SUCCESS'],
      stop_classifications: ['INVALID_INVOCATION', 'INTERNAL_ERROR'],
      stop_conditions: ['Return FAIL for a malformed or noncanonical body; stop on an unreadable body file.'],
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('COMPLETE', null, 'Syntax and shape validation completed; PASS conveys no live, semantic, routing, authority, or merge evidence.') },
        { classification: 'INVALID_INVOCATION', next_action: nextAction('STOP', null, 'The supplied body or invocation is invalid; correct it before retrying.') },
      ],
      examples: [{ description: 'Validate one complete candidate body.', argv: ['--body-file', './review-verdict.md', '--json'] }],
      parser_owner: 'scripts/context/merge-review-verdict.ts',
      safe_help_invocation: 'pnpm run bemoat:review-verdict:validate -- --help --json',
    }),
  }
}
