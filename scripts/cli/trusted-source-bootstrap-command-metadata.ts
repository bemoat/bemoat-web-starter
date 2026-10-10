/** Explicit setup-only acquisition contract for the exact live-main clone used by #630. */
import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

type TrustedSourceBootstrapRoute = {
  route_key: string
  observed_state: string
  evidence_case: string
  required_evidence_condition: string
  forbidden_evidence_condition: string
  permitted_operation: string
  canonical_command: string
  required_review_type: null
  expected_post_state_or_gate: string
  prohibited_commands: string[]
  decision: 'COMMAND'
  stop_condition: string
}

const COMMAND = 'bemoat:context:bootstrap-source'
const PROOF = 'bemoat:context:recover-committed-wip'
const CONTEXT = 'bemoat:context'

export function trustedSourceBootstrapCommands(dependencies: CommandMetadataDependencies) {
  const { contract, flag, nextAction } = dependencies
  return {
    [COMMAND]: contract({
      command: COMMAND,
      tier: 'A',
      entrypoint: 'scripts/agent-context-bootstrap-source.ts',
      purpose: 'Acquire or verify one explicit independent exact-live source clone for the approved #630 correction handoff.',
      operation: 'Verify the merged #630 PR and its exact merge commit on live main, verify original #627 B read-only, atomically reserve and clone live main only at one explicit absent destination or reuse that same exact-live independent clone on retry, then run registered safe help, Architecture A proof, and fresh target Context from D. No objective-edit authority is granted.',
      accepted_pre_states: [
        'The command runs after the #630 correction PR has merged, from the clean #630 topic checkout whose attached branch and exact HEAD match that merged PR head; the PR is explicitly named by the caller and links to Issue 630.',
        'The original #627 B path is explicit and proves the fixed canonical root, branch, exact B/tree, clean status, canonical origin, exact upstream, and exact live B ref. The destination is one explicit absolute path, absent for first acquisition or already a uniquely valid exact-live independent D for an identical retry.',
        'The current process can invoke the registered safe help, Architecture A proof, and target-mode Context commands from D without installing packages or running lifecycle scripts. Missing D dependencies are a stop condition.',
      ],
      required_inputs: [
        flag('pr_number', '--pr-number <positive-id>', 'positive_integer', 'Merged correction PR whose exact current branch and HEAD must match the clean #630 invocation checkout.', [], true),
        flag('target_worktree', '--target-worktree <absolute-path>', 'path', 'One explicit original #627 B root; no workspace discovery or alternate target selection is performed.', [], true),
        flag('destination', '--destination <absolute-path>', 'path', 'One explicit D path. Clone only if absent; on retry reuse only if it independently proves exact live main and a separate Git common directory.', [], true),
      ],
      optional_flags: [flag('json', '--json', 'boolean', 'Emit canonical machine-readable result.')],
      trusted_derived_values: [
        'canonical source, B, and D roots; current #630 branch and HEAD; exact merged PR head and merge commit; live GitHub and origin main SHA; D branch, HEAD, origin, upstream, clean status, tracking ref, and independent Git common directory; actual Architecture A proof and fresh Context result',
      ],
      required_evidence: [
        'The #630 command source is a canonical clean Git root on an attached branch, with canonical origin and a full HEAD. The explicitly supplied merged PR number must identify a closed merged PR linked to #630 whose base is canonical main and whose head repository, branch, and exact SHA match the current source checkout.',
        'The approved-base rule must be proven: GitHub must report dev absent and git ls-remote origin refs/heads/dev must be empty. If dev exists or either read is unavailable or ambiguous, stop; do not silently select main. GitHub main and git ls-remote origin/main must then agree on one exact live SHA. GitHub compare from the PR merge commit to that exact SHA must prove the merge commit is an ancestor (merge-base equals the PR merge SHA, behind_by is zero, and status is ahead or identical). Re-read dev absence and main and require no drift around acquisition.',
        'The explicit original #627 B root must be canonical, clean, non-overlapping with the #630 source, canonical-origin, attached to fix/627-seamless-multi-objective-continuation, at exact B 9c057c2a741d361b6138b95ff115bd3e56049fbd and tree 717a04a858b4768deddf814822e3467407606f11, tracking origin/the bound branch, with GitHub and origin live topic refs both exactly B.',
        'The explicit absolute destination must not equal, contain, or be contained by the #630 source or original #627 B root. If absent, reserve this exact path atomically with exclusive directory creation before cloning canonical main without shallow, reference, submodule, or lifecycle setup; if another process occupies it first, stop and preserve it without cloning. Verify the clone’s clean attached main branch, canonical origin, origin/main upstream and tracking SHA, HEAD equal exact captured live main, and Git common directory distinct from both source and B. If present, do not modify it and accept only the same complete exact-live independent D proof.',
        `From D, run registered safe JSON help for ${PROOF} and ${CONTEXT}; validate each reported command and required target-mode inputs. Then run ${PROOF} with the fixed #627 A/B/tree/handoff binding and explicit B path; require its successful read-only Architecture A result with route STOP, reentry false, objective_edit_authority_granted false, and next action fresh Context. Then run fresh ${CONTEXT} 627 --target-worktree B --json from D and retain its actual returned route and complete evidence in result details.`,
        'This command may create only the explicit destination by atomically reserving that absent path and cloning into it. It does not install dependencies, execute lifecycle scripts, edit either source or target, mutate GitHub, change refs in existing repositories, or grant objective-edit authority. The fresh target Context is the only authority check for subsequent work.',
      ],
      reads: [
        'the explicit #630 source root and merged pull request, GitHub dev absence and exact origin/dev absence, GitHub main and exact origin/main refs, and GitHub compare evidence from PR merge commit to live main',
        'the explicit original #627 B root, identity, cleanliness, tree, upstream, GitHub ref, and exact origin ref',
        'the explicit D path, root, status, branch, HEAD, origin, upstream, local tracking ref, Git common directory, and exact live main refs',
        'registered safe help, Architecture A proof, and fresh target-mode Context JSON outputs run from D',
      ],
      writes: [
        'Atomically reserve the explicit destination with exclusive directory creation before invoking git clone; if the destination is occupied by another process, stop and preserve it without cloning. On clone failure, partial destination contents and the reservation are preserved; never delete, reset, clean, overwrite, or replace them. Never write to the #630 source or original #627 target.',
        'No GitHub or remote mutation, no dependency installation, no lifecycle scripts, and no other local filesystem or Git mutation beyond the explicit destination reservation and normal full clone of canonical main.',
      ],
      success_classifications: ['SUCCESS'],
      stop_classifications: ['UNSUPPORTED_PRE_STATE', 'STATE_CONFLICT', 'HEAD_DRIFT', 'BLOCKED_EXTERNAL', 'EVIDENCE_CONFLICT', 'AMBIGUOUS_RESULT'],
      stop_conditions: [
        'STOP for dirty or wrong #630 source, source/PR branch or head mismatch, wrong PR/repository/Issue/base, unmerged PR, missing merge SHA, any live dev ref or unavailable/ambiguous proof that dev is absent, missing live refs, compare divergence, or main drift.',
        'STOP for any mismatch, unavailability, or ambiguity in the explicit original #627 B identity, cleanliness, tree, origin, upstream, or live refs.',
        'STOP if D overlaps either existing root, a requested path is non-absolute, the destination parent is unavailable, or the destination exists but cannot be proven as one exact-live independent clone. Preserve every existing or partial destination; never delete, reset, clean, overwrite, or select another path.',
        'STOP if either registered safe help, the Architecture A proof, or fresh target Context cannot run and return valid JSON from D, including when dependencies are missing. Do not install dependencies or run lifecycle scripts. Preserve D for an explicit retry after the caller resolves the environment blocker.',
        'The outer result route and next action remain STOP and objective_edit_authority_granted is false even when all checks run successfully. Preserve the exact Context route and evidence; only fresh Context may determine later authority.',
      ],
      retry_contract: {
        identical_retry: 'conditional',
        classification: 'SUCCESS',
        condition: 'Only the same explicit destination may be reused. It must independently prove a canonical clean exact-live main clone with origin, upstream, local tracking, HEAD, and Git common directory all exact; otherwise stop and preserve it. An absent destination may be cloned once. Partial or conflicting destinations are never cleaned or replaced.',
      },
      role_contracts: {
        controller: 'objective-edit authority is always false; a successful bootstrap is setup evidence only and does not choose or authorize an Issue objective.',
        runtime: 'may atomically reserve only the one explicit absent D path and clone into that reserved path; on occupation or failure it preserves the path and stops. All proof, help, and Context subprocesses run with D as cwd; no dependency installation or lifecycle scripts.',
      },
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('STOP', null, 'The observed target Context route and complete evidence are in details. Reconstruct fresh Context before any later work; this bootstrap grants no objective-edit authority.') },
      ],
      examples: [{
        description: 'After the #630 correction PR is merged, invoke from its clean exact-head checkout with explicit original #627 B and one approved destination.',
        argv: ['--pr-number', '777', '--target-worktree', '/worktrees/issue-627', '--destination', '/worktrees/trusted-source-D', '--json'],
      }],
      parser_owner: 'scripts/agent-context-bootstrap-source.ts',
      safe_help_invocation: `pnpm run ${COMMAND} -- --help --json`,
      last_validation_before_mutation: 'Immediately before destination reservation, re-read the clean #630 branch/HEAD, exact merged PR binding, original #627 B identity, GitHub and origin dev absence, GitHub and origin main, compare ancestry, and explicit destination absence. Atomically reserve only the explicit destination; if occupied, preserve it and stop without cloning. Clone into the reserved destination. After clone, prove exact D and re-read all fixed roots, live dev absence, and live main before and after registered help, proof, and fresh Context.',
      post_write_readback: 'If a clone was attempted, preserve its result even on failure. Require destination canonical root, clean main branch, exact HEAD and origin/main tracking, canonical origin/upstream, independent Git common directory, and exact live main. The output always reports mutation_performed accurately, actual Context route when observed, STOP next action, and objective_edit_authority_granted false.',
    }),
  }
}

export function trustedSourceBootstrapRoutes(): TrustedSourceBootstrapRoute[] {
  return [{
    route_key: 'context_bootstrap_trusted_independent_source',
    observed_state: 'NOT_STATEFUL',
    evidence_case: 'Explicit clean merged #630 correction checkout, immutable original #627 B, and one caller-selected destination path.',
    required_evidence_condition: 'Bind the current #630 branch and HEAD to the explicitly named merged PR; prove the approved main-only base by proving dev absent on both GitHub and origin; prove the exact merge commit is in exact live main; prove the explicit original #627 B identity; create only the explicit absent D or independently verify that same exact-live D; run registered proof and fresh Context from D.',
    forbidden_evidence_condition: 'Any dirty/wrong root, PR mismatch, unmerged correction, dev present or its absence unproven, live-main ambiguity or drift, invalid B, overlapping or occupied/conflicting D, linked/shared Git common directory, missing dependencies, failed safe help/proof/Context, or malformed output.',
    permitted_operation: 'Run the registered setup-only bemoat:context:bootstrap-source command. It may clone only the explicit absent destination and cannot mutate the source, target, GitHub, remotes, or dependencies.',
    canonical_command: COMMAND,
    required_review_type: null,
    expected_post_state_or_gate: 'Exact-live independent D is proven and the actual target-mode Context route is returned in details. The command itself remains STOP with objective-edit authority false; fresh Context is the only later authority check.',
    prohibited_commands: ['bemoat:context:sync-base', 'bemoat:context:recover-setup', 'bemoat:handoff'],
    decision: 'COMMAND',
    stop_condition: 'Stop and preserve all roots on every missing, conflicting, drifting, unavailable, or ambiguous input or readback. Never replace destination contents, install dependencies, execute lifecycle scripts, or infer an alternate workspace.',
  }]
}
