import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

export function redWipCheckpointCommands(dependencies: CommandMetadataDependencies) {
  const { contract, flag, positional, nextAction } = dependencies
  return {
    'bemoat:checkpoint:red-wip': contract({
      command: 'bemoat:checkpoint:red-wip',
      tier: 'A',
      entrypoint: 'scripts/agent-red-wip-checkpoint.ts',
      purpose: 'Preserve an explicitly Issue-approved finite set of intentionally failing integration assertions as an incomplete WIP RED checkpoint.',
      operation: 'Require fresh Context to authorize this exact durability-only command, read the explicit approval set from the canonical Issue, verify repository and Git identity, reject unrelated or ambiguous state, run the integration suite allowing only the exact approved failures, stage only its path, commit, push without force, verify the exact live remote SHA, then rerun registered CLI Discovery and fresh Context.',
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
      required_evidence: ['Fresh Context next_action.type is COMMAND and next_action.command is exactly bemoat:checkpoint:red-wip.', 'The open canonical Issue body contains exactly one approval block with schema_version=1, issue_number, repository, branch, protected_base_sha, test_path, and a nonempty expected_failures array of unique test_name/expected_message pairs.', 'Same-Issue numbered branch; exact local/upstream/live topic SHA and live protected-base SHA; protected-base ancestry.', 'No pre-staged, untracked, forbidden, secret, unrelated, or ambiguous files; only the approved test path may be changed.', 'Full integration suite with exact set equality against the explicitly approved failure identities/outcomes; missing, extra, duplicate, malformed, or ambiguous failures are rejected.', 'For hook verification: exactly one new commit, exact WIP RED subject, approved path only, exact remote parent/ref, canonical origin, and matching live Issue approval.'],
      reads: ['canonical GitHub Issue body', 'local Git status, branch, refs, remotes, commits, and ancestry', 'live origin topic and protected-base refs', 'integration-test results'],
      writes: ['only the Issue-approved test path is staged', 'one WIP RED commit', 'one normal non-force topic-branch push'],
      success_classifications: ['SUCCESS'],
      stop_conditions: ['Stop on missing or ambiguous Issue authorization, mismatched identity, stale/divergent refs, unrelated or unsafe content, any unexpected integration failure, commit failure, push failure, or remote SHA readback mismatch.', 'A successful WIP checkpoint is incomplete evidence only and does not grant objective-edit, Context route, review, or merge authority.'],
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('STOP', null, 'The WIP RED checkpoint remains incomplete; use the actual fresh Context route returned after exact remote readback.') },
      ],
      examples: [{ description: 'Preserve the one explicitly approved RED test as WIP.', argv: ['617'] }],
      parser_owner: 'scripts/agent-red-wip-checkpoint.ts',
      safe_help_invocation: 'pnpm run bemoat:checkpoint:red-wip -- --help --json',
      last_validation_before_mutation: 'Re-read live Issue approval and require fresh Context authorization for this exact registered command; verify exact local/upstream/live Git identity and clean allowed-path status; independently confirm exact set equality for the full integration failure report.',
      post_write_readback: 'Read the live topic ref after normal push and require its exact SHA to equal the new local WIP RED commit, then run registered CLI Discovery and fresh Context and return the actual route with WIP-incomplete status.',
    }),
  }
}
