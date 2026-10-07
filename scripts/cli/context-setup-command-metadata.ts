/** Narrow clean stale-protected-base setup recovery command metadata. */
import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

export function contextSetupCommands(dependencies: CommandMetadataDependencies) {
  const { contract, positional, flag, nextAction } = dependencies
  return {
    'bemoat:context:recover-setup': contract({
      command: 'bemoat:context:recover-setup',
      tier: 'A',
      entrypoint: 'scripts/agent-context-recover-setup.ts',
      purpose: 'Recover one clean canonical protected branch that is strictly behind its exact live base, without authorizing Issue objective work.',
      operation: 'Recollect GitHub and local evidence, fetch only the bound protected ref into FETCH_HEAD, prove strict ancestry against its exact verified SHA, merge --ff-only to that immutable SHA, advance the tracking ref with compare-and-swap, and verify exact post-state.',
      accepted_pre_states: ['Open Issue with no active PR; clean attached canonical protected branch tracking origin/<base>; local HEAD and tracking ref agree and are strictly behind the exact live protected base.'],
      required_inputs: [
        positional('issue_number', '<issue-number>', 'positive_integer', 'Open Issue whose fresh Context bound this setup recovery.'),
        flag('expected_repository', '--expected-repository <owner/name>', 'repository', 'Canonical repository bound by fresh Context.', [], true),
        flag('expected_base_branch', '--expected-base-branch <branch>', 'string', 'Approved protected-base branch bound by fresh Context.', [], true),
        flag('expected_base_sha', '--expected-base-sha <sha>', 'full_sha', 'Exact live protected-base SHA bound by fresh Context.', [], true),
        flag('expected_local_head', '--expected-local-head <sha>', 'full_sha', 'Exact local HEAD bound by fresh Context.', [], true),
      ],
      optional_flags: [flag('json', '--json', 'boolean', 'Emit canonical machine-readable result.')],
      trusted_derived_values: ['canonical origin identity, approved protected base, exact GitHub base, exact ls-remote ref, Issue state, PR state, worktree state, tracking ref, and post-recovery readback'],
      required_evidence: [
        'Fresh bound open Issue, no active PR, no evidence conflicts, exact bound canonical repository and protected-base branch, matching origin, clean attached protected branch, and exact origin/<base> upstream.',
        'Before mutation, GitHub protected-base SHA equals the unique exact ls-remote origin/refs/heads/<base> SHA and the binding; local HEAD equals its tracking ref and differs from live base.',
        'After exact fetch, FETCH_HEAD equals the same live base and local HEAD is a strict ancestor; reverse ancestry proves there are no local-only commits.',
        'Fresh full Context must still emit the same bound recover-setup COMMAND before fetch, after fetch, and immediately before fast-forward; the latter also re-reads live GitHub and origin protected-base identity.',
        'After fast-forward, compare-and-swap refs/remotes/origin/<base> from the original local HEAD to the exact bound SHA; fail closed if the expected old value changed.',
        'After fast-forward, clean branch/upstream/origin, local HEAD, upstream HEAD, GitHub base, and exact remote base all equal the bound SHA.',
      ],
      reads: ['GitHub Issue and protected-base evidence', 'local branch, HEAD, status, origin, upstream, remote-tracking ref, exact remote base, and ancestry', 'fresh Context evidence before and after the operation'],
      writes: ['only for an eligible stale state: one --no-tags exact-ref fetch to FETCH_HEAD (FETCH_HEAD may change even when fetch fails), one git merge --ff-only <exact-verified-base-sha>, and one compare-and-swap update-ref of origin/<base>; no branch, Issue, PR, comment, stash, reset, rebase, force, or objective-file writes'],
      success_classifications: ['SUCCESS', 'NO_OP_IDENTICAL_RETRY'],
      retry_contract: {
        identical_retry: 'allowed',
        classification: 'NO_OP_IDENTICAL_RETRY',
        condition: 'If the exact bound protected SHA is already at HEAD, perform no Git mutation and recommend fresh bemoat:context.',
      },
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('COMMAND', 'bemoat:context', 'Run fresh CLI Discovery and Context; recovery grants no objective-edit authority.') },
        { classification: 'NO_OP_IDENTICAL_RETRY', next_action: nextAction('COMMAND', 'bemoat:context', 'Run fresh CLI Discovery and Context; recovery grants no objective-edit authority.') },
      ],
      stop_conditions: ['Stop on dirty/detached/wrong branch or origin, absent/multiple/moved base, local tracking mismatch, local-only or divergent history, fetch/fast-forward failure, any readback mismatch, or conflicting GitHub evidence. Never reset, rebase, stash, force, or broaden the target.'],
      examples: [{ description: 'Run the exact setup binding emitted by Context.', argv: ['585', '--expected-repository', 'bemoat/bemoat-web-starter', '--expected-base-branch', 'main', '--expected-base-sha', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '--expected-local-head', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--json'] }],
      parser_owner: 'scripts/agent-context-recover-setup.ts',
      safe_help_invocation: 'pnpm run bemoat:context:recover-setup -- --help --json',
      last_validation_before_mutation: 'Before fetch and immediately before merge, fresh full Context must still emit the same bound recovery COMMAND. Fetch with --refmap= into FETCH_HEAD only; prove FETCH_HEAD equals the bound SHA and ancestry using that immutable SHA; reread exact GitHub and ls-remote base immediately before git merge --ff-only <exact-verified-base-sha>.',
      post_write_readback: 'After merge, CAS refs/remotes/origin/<base> from the original tracking SHA to the bound SHA. Require clean attached same branch and canonical origin/upstream, with HEAD, upstream, exact origin ref, and GitHub protected base equal to the bound SHA; then route only to fresh bemoat:context.',
    }),
  }
}
