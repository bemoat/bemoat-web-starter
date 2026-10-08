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
      accepted_pre_states: ['Without --target-worktree: open Issue with no active PR; clean attached canonical protected branch tracking origin/<base>; local HEAD and tracking ref agree and are strictly behind the exact live protected base. With --target-worktree: exact-live clean canonical protected-main command source plus one separate clean attached canonical protected-branch target tracking origin/<base>, with target HEAD and tracking ref agreeing and strictly behind the exact live protected base; additionally, only a target with HEAD 46fe5363697cb24f0db5a6d4338a5540665bb697 and tracking ref already equal to exact live main e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3 is accepted, after strict ancestry/no-local-only proof.'],
      required_inputs: [
        positional('issue_number', '<issue-number>', 'positive_integer', 'Open Issue whose target Context is re-collected internally before recovery mutation.'),
        flag('expected_repository', '--expected-repository <owner/name>', 'repository', 'Canonical repository caller-supplied from read-only target Context evidence and revalidated internally.', [], true),
        flag('expected_base_branch', '--expected-base-branch <branch>', 'string', 'Approved protected-base branch caller-supplied from read-only target Context evidence and revalidated internally.', [], true),
        flag('expected_base_sha', '--expected-base-sha <sha>', 'full_sha', 'Exact live protected-base SHA caller-supplied from read-only target Context evidence and revalidated against GitHub and origin.', [], true),
        flag('expected_local_head', '--expected-local-head <sha>', 'full_sha', 'Exact target local HEAD caller-supplied from read-only target Context evidence and revalidated internally.', [], true),
      ],
      optional_flags: [
        flag('target_worktree', '--target-worktree <absolute-path>', 'path', 'Absolute path to one separate stale protected-branch target; omit for unchanged same-worktree recovery.'),
        flag('json', '--json', 'boolean', 'Emit canonical machine-readable result.'),
      ],
      trusted_derived_values: ['canonical source and target roots/origins, approved protected base, exact GitHub base, exact ls-remote ref, Issue state, PR state, source and target worktree state, target tracking ref, and post-recovery readback'],
      required_evidence: [
        'Fresh bound open Issue, no active PR, no evidence conflicts, exact bound canonical repository and protected-base branch, matching origin, clean attached protected branch, and exact origin/<base> upstream.',
        'Before mutation, GitHub protected-base SHA equals the unique exact ls-remote origin/refs/heads/<base> SHA and the binding; local HEAD differs from live base. Ordinary recovery requires local HEAD equal its tracking ref. The explicit-target recovery also accepts only the #594 target HEAD 46fe5363697cb24f0db5a6d4338a5540665bb697 with tracking ref equal to exact live main e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3.',
        'After exact fetch, FETCH_HEAD equals the same live base and local HEAD is a strict ancestor; reverse ancestry proves there are no local-only commits.',
        'Fresh full Context must still emit the same bound recover-setup COMMAND before fetch, after fetch, and immediately before fast-forward; the latter also re-reads live GitHub and origin protected-base identity.',
        'When --target-worktree is supplied, independently verify source and target roots and canonical origins. The source must remain clean and at the exact live protected-base SHA (attached to the base branch or detached at that exact SHA); the target must remain a clean attached canonical protected branch with the exact bound head and origin/<base> upstream. Separate clone/worktree topology is allowed.',
        'After fast-forward, compare-and-swap refs/remotes/origin/<base> from the captured initial tracking SHA (the original local HEAD for ordinary recovery, or the exact live-base SHA for the #594 target state) to the exact bound SHA; fail closed if the expected old value changed.',
        'After fast-forward, clean branch/upstream/origin, local HEAD, upstream HEAD, GitHub base, and exact remote base all equal the bound SHA.',
      ],
      reads: ['GitHub Issue and protected-base evidence', 'source and target roots, branch, HEAD, status, origin, upstream, remote-tracking ref, exact remote base, and ancestry', 'fresh Context evidence before and after the operation'],
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
      stop_conditions: ['Stop on dirty/detached/wrong branch or origin, absent/multiple/moved base, source or target identity drift, local tracking mismatch, local-only or divergent history, fetch/fast-forward failure, any readback mismatch, or conflicting GitHub evidence. Never reset, rebase, stash, force, or broaden the target.'],
      examples: [
        { description: 'Run the exact setup binding emitted by Context in the current worktree.', argv: ['585', '--expected-repository', 'bemoat/bemoat-web-starter', '--expected-base-branch', 'main', '--expected-base-sha', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '--expected-local-head', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--json'] },
        { description: 'After read-only target Context supplies the exact binding values, run the current protected-main command against that separate target.', argv: ['592', '--expected-repository', 'bemoat/bemoat-web-starter', '--expected-base-branch', 'main', '--expected-base-sha', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '--expected-local-head', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--target-worktree', '/worktrees/stale-main', '--json'] },
      ],
      parser_owner: 'scripts/agent-context-recover-setup.ts',
      safe_help_invocation: 'pnpm run bemoat:context:recover-setup -- --help --json',
      last_validation_before_mutation: 'Before fetch, after fetch, immediately before merge, and before tracking-ref compare-and-swap, revalidate source and target identity. Fresh full Context must still emit the same bound recovery COMMAND before fetch, after fetch, and immediately before merge. Fetch with --refmap= into FETCH_HEAD only; prove FETCH_HEAD equals the bound SHA and ancestry using that immutable SHA; reread exact GitHub and ls-remote base immediately before git merge --ff-only <exact-verified-base-sha>.',
      post_write_readback: 'After merge, CAS refs/remotes/origin/<base> from the original tracking SHA to the bound SHA. Require clean attached same branch and canonical origin/upstream, with HEAD, upstream, exact origin ref, and GitHub protected base equal to the bound SHA; then route only to fresh bemoat:context.',
    }),
  }
}
