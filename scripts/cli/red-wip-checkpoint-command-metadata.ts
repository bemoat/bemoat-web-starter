import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

export function redWipCheckpointCommands(dependencies: CommandMetadataDependencies) {
  const { contract, flag, positional, nextAction } = dependencies
  return {
    'bemoat:checkpoint:red-wip': contract({
      command: 'bemoat:checkpoint:red-wip',
      tier: 'A',
      entrypoint: 'scripts/agent-red-wip-checkpoint.ts',
      purpose: 'Preserve exactly one Issue-authorized intentionally failing integration assertion as an incomplete WIP RED checkpoint.',
      operation: 'Read exact approval from the canonical Issue, verify repository and Git identity, reject unrelated or ambiguous state, run the integration suite allowing only the exact approved assertion, stage only its path, commit, push without force, and verify the exact live remote SHA.',
      accepted_pre_states: ['clean task branch with one explicitly Issue-approved unstaged integration-test change', 'one newly pushed WIP RED commit under independent pre-push verification'],
      required_inputs: [positional('issue_number', '<issue-number>', 'positive_integer', 'Canonical task Issue that contains one exact RED WIP approval block.')],
      optional_flags: [
        flag('verify_push', '--verify-push', 'boolean', 'Read-only independent verification for the one pre-push WIP RED commit.'),
        flag('local_sha', '--local-sha <sha>', 'full_sha', 'Local commit SHA supplied by the pre-push hook.'),
        flag('remote_sha', '--remote-sha <sha>', 'full_sha', 'Remote topic SHA supplied by the pre-push hook.'),
        flag('local_ref', '--local-ref <ref>', 'string', 'Local branch ref supplied by the pre-push hook.'),
        flag('remote_ref', '--remote-ref <ref>', 'string', 'Remote branch ref supplied by the pre-push hook.'),
        flag('json', '--json', 'boolean', 'Emit machine-readable result.'),
      ],
      required_evidence: ['Canonical GitHub repository and one exact Issue approval block binding Issue, branch, protected base, test path, assertion name, and expected failure.', 'Same-Issue numbered branch; exact local/upstream/live topic SHA and live protected-base SHA; protected-base ancestry.', 'No pre-staged, untracked, forbidden, secret, unrelated, or ambiguous files; only the approved test path may be changed.', 'Full integration suite with exactly one failed assertion matching the exact approved path, name, and expected message.', 'For hook verification: exactly one new commit, exact WIP RED subject, approved path only, exact remote parent, and matching live Issue approval.'],
      reads: ['canonical GitHub Issue body', 'local Git status, branch, refs, remotes, commits, and ancestry', 'live origin topic and protected-base refs', 'integration-test results'],
      writes: ['only the Issue-approved test path is staged', 'one WIP RED commit', 'one normal non-force topic-branch push'],
      success_classifications: ['SUCCESS'],
      stop_conditions: ['Stop on missing or ambiguous Issue authorization, mismatched identity, stale/divergent refs, unrelated or unsafe content, any unexpected integration failure, commit failure, push failure, or remote SHA readback mismatch.', 'A successful WIP checkpoint is incomplete evidence only and does not grant objective-edit, Context route, review, or merge authority.'],
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('COMPLETE', null, 'The incomplete WIP RED checkpoint was verified and durably read back; this grants no objective-edit authority.') },
      ],
      examples: [{ description: 'Preserve the one explicitly approved RED test as WIP.', argv: ['617'] }],
      parser_owner: 'scripts/agent-red-wip-checkpoint.ts',
      safe_help_invocation: 'pnpm run bemoat:checkpoint:red-wip -- --help --json',
      last_validation_before_mutation: 'Re-read the live Issue approval, verify exact local/upstream/live Git identity and clean allowed-path status, and independently confirm the full integration result contains only the approved failed assertion.',
      post_write_readback: 'Read the live topic ref after normal push and require its exact SHA to equal the new local WIP RED commit.',
    }),
  }
}
