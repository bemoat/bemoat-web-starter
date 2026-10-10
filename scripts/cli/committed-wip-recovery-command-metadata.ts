/** Read-only proof contract for exact committed incomplete-WIP reentry. */
import type { CommandMetadataDependencies } from './command-metadata-deps.ts'

type CommittedWipRecoveryRoute = {
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

const A = '0e99786f0b087de46a2518d5874beb999892dd6c'
const B = '9c057c2a741d361b6138b95ff115bd3e56049fbd'
const TREE = '717a04a858b4768deddf814822e3467407606f11'

export function committedWipRecoveryCommands(dependencies: CommandMetadataDependencies) {
  const { contract, positional, flag, nextAction } = dependencies
  return {
    'bemoat:context:recover-committed-wip': contract({
      command: 'bemoat:context:recover-committed-wip',
      tier: 'A',
      entrypoint: 'scripts/agent-context-recover-committed-wip.ts',
      purpose: 'Prove exact committed incomplete WIP reentry evidence without changing the target or authorizing objective work.',
      operation: 'Perform a read-only reconciliation proof for immutable historical HANDOFF head A and committed RED-WIP head B, then route only to fresh Context.',
      accepted_pre_states: [
        `A clean exact-live protected-main command source at current live SHA D, with source HEAD and origin/main tracking equal to D, attached to main or detached exactly at D; plus one explicit canonical target worktree for #627 at ${B} with tree ${TREE}. Historical A remains ${A}.`,
        'Both roots are canonicalized and distinct; the source and target are clean, identity-bound, and supported. No other target or inferred workspace is accepted.',
      ],
      required_inputs: [
        positional('issue_number', '<issue-number>', 'positive_integer', 'Issue number whose exact historical committed-WIP evidence is being proved.'),
        flag('expected_repository', '--expected-repository <owner/name>', 'repository', 'Exact canonical repository identity.', [], true),
        flag('expected_branch', '--expected-branch <branch>', 'string', 'Exact canonical topic branch identity.', [], true),
        flag('expected_base_branch', '--expected-base-branch <branch>', 'string', 'Exact protected-base branch identity.', [], true),
        flag('expected_base_sha', '--expected-base-sha <full-sha-A>', 'full_sha', `Immutable protected base and historical HANDOFF head A (${A}).`, [], true),
        flag('expected_handoff_comment_id', '--expected-handoff-comment-id <positive-id>', 'positive_integer', 'Exact native GitHub historical HANDOFF comment ID.', [], true),
        flag('expected_handoff_head', '--expected-handoff-head <full-sha-A>', 'full_sha', `Exact historical read-only Objective 1 HANDOFF head A (${A}).`, [], true),
        flag('expected_wip_head', '--expected-wip-head <full-sha-B>', 'full_sha', `Exact committed incomplete WIP head B (${B}).`, [], true),
        flag('expected_wip_tree', '--expected-wip-tree <full-tree-sha>', 'full_sha', `Exact committed WIP tree (${TREE}).`, [], true),
        flag('target_worktree', '--target-worktree <absolute-path>', 'path', 'One explicit existing target worktree; it must be distinct from the canonical command source.', [], true),
      ],
      optional_flags: [flag('json', '--json', 'boolean', 'Emit canonical machine-readable result.')],
      trusted_derived_values: ['canonical source and target roots, source and target Git identities, native comment author and URL, HANDOFF body digest, A-to-B ancestry, tree identity, and exact live GitHub and origin refs'],
      required_evidence: [
        `Bind repository bemoat/bemoat-web-starter, Issue 627, branch fix/627-seamless-multi-objective-continuation, historical HANDOFF/base A ${A}, HANDOFF comment 6088681412, WIP head B ${B}, and exact tree ${TREE}; all caller values must match these identities.`,
        'Canonicalize the source and target roots and prove they are distinct. Source must be clean, canonical-origin, attached to the expected protected-base branch or detached exactly at current live protected-main SHA D, with source HEAD and local origin/base tracking ref equal to D. Independently read GitHub protected-base ref and git ls-remote origin/base and require both to equal D. A is only the immutable historical HANDOFF/base and target ancestry binding.',
        'Target must be clean, attached to the expected topic branch, canonical-origin, upstream exactly origin/expected-branch, local HEAD exactly B, exact B tree equal expected_wip_tree, and live GitHub topic ref plus git ls-remote origin/topic ref both exactly B.',
        'Fetch the exact native GitHub comment by ID; verify its native ID, canonical URL, nonempty author identity, and unique non-competing HANDOFF evidence. Parse with extractHandoffPayload, parseHandoffBody, and renderHandoffComment; require schema-v2 HANDOFF, objective_mode read_only, route IMPLEMENT, pr null, objective beginning “Objective 1 —”, exact repository/Issue/branch/base/A, and durable true. Preserve the original comment unchanged.',
        'Prove strict A-to-B ancestry with git merge-base --is-ancestor A B succeeding and reverse B-to-A returning exactly non-ancestor. Bind exact tree and live remote readback. Preserve B as incomplete RED WIP; this proof never claims GREEN, Objective 2 completion, accepted new HANDOFF, review, or Objective N+1 authorization.',
        'Prove B is the exact preserved single-child commit of A with its bound author/subject and exact 16-path change set; any additional, missing, unrelated, unowned, or forbidden path is STOP.',
        'Any missing, malformed, forged, modified, duplicate, or competing HANDOFF; wrong Issue/repository/branch/origin/upstream/base/A/B/tree; stale, moved, divergent, or reverse ancestry; unowned, unrelated, or forbidden paths; dirty, detached, inaccessible, or unsupported target; source drift; unavailable probe; or ambiguous readback is STOP.',
        'This command is proof-only and read-only: it does not acquire or mutate a worktree, refs, files, comments, branches, Issues, or remotes, and it does not establish that #627 recovery itself has succeeded.',
        'Only after exact evidence readback, run registered CLI Discovery and then fresh bemoat:context for the bound Issue with --target-worktree set to the verified target. Successful proof routes STOP/COMMAND and grants no authority; fresh Context alone determines any later authority.',
      ],
      reads: ['GitHub protected-base ref, exact Issue comment by ID, Issue comments for competing HANDOFFs, and topic ref', 'source and target canonical roots, status, branch, HEAD, origin, upstream, commit tree, ancestry, GitHub refs, and git ls-remote refs'],
      writes: [],
      success_classifications: ['SUCCESS'],
      stop_classifications: ['UNSUPPORTED_PRE_STATE', 'STATE_CONFLICT', 'HEAD_DRIFT', 'BLOCKED_EXTERNAL', 'EVIDENCE_CONFLICT', 'AMBIGUOUS_RESULT'],
      stop_conditions: [
        'STOP on wrong Issue, repository, branch, origin, upstream, protected base, A, B, or tree; source drift; live ref movement; unavailable probes; or any contradictory readback.',
        'STOP on missing, malformed, forged, modified, duplicate, or competing HANDOFF evidence; non-strict, reverse, stale, or divergent ancestry; unowned, unrelated, or forbidden path provenance.',
        'STOP on dirty, detached, inaccessible workspace, identical-root, or unsupported source/target worktree topology. Never guess, reset, stash, overwrite, fetch into refs, or mutate GitHub/source state.',
        'STOP on any ambiguous retry or identity/readback mismatch. Never classify the RED WIP as GREEN or authorize completion, review, accepted HANDOFF, or Objective N+1.',
      ],
      retry_contract: {
        identical_retry: 'allowed',
        classification: null,
        condition: 'Because this stateless proof operation has no writes, an identical retry is allowed only as a deterministic exact re-read of the same issue, comment/body digest, A, B, tree, identity tuple, and canonical target root; each exact proof reread returns SUCCESS, while any drift or ambiguous readback is STOP.',
      },
      role_contracts: {
        controller: 'objective-edit authority is false; this proof does not grant or imply objective-edit authority.',
        runtime: 'read-only evidence proof only; fresh Context is the sole next authority check.',
      },
      next_action_rules: [
        { classification: 'SUCCESS', next_action: nextAction('COMMAND', 'bemoat:context', 'Run registered CLI Discovery, then fresh bemoat:context for the verified Issue and --target-worktree. This proof grants no objective-edit authority.') },
      ],
      examples: [{ description: 'Read-only proof of the preserved #627 committed WIP binding.', argv: ['627', '--expected-repository', 'bemoat/bemoat-web-starter', '--expected-branch', 'fix/627-seamless-multi-objective-continuation', '--expected-base-branch', 'main', '--expected-base-sha', A, '--expected-handoff-comment-id', '6088681412', '--expected-handoff-head', A, '--expected-wip-head', B, '--expected-wip-tree', TREE, '--target-worktree', '/worktrees/issue-627', '--json'] }],
      parser_owner: 'scripts/agent-context-recover-committed-wip.ts',
      safe_help_invocation: 'pnpm run bemoat:context:recover-committed-wip -- --help --json',
      post_write_readback: 'There are no writes. Re-read the exact source/target identities, native HANDOFF URL/body digest, A-to-B ancestry, tree, and GitHub plus origin refs; any mismatch, drift, unavailable probe, or ambiguous readback is STOP.',
    }),
  }
}

export function committedWipRecoveryRoutes(): CommittedWipRecoveryRoute[] {
  return [{
    route_key: 'context_recover_exact_committed_wip',
    observed_state: 'NOT_STATEFUL',
    evidence_case: 'One explicit clean #627 target at immutable WIP B with the original Objective 1 HANDOFF at A.',
    required_evidence_condition: 'From a distinct clean canonical source at current exact-live protected-main SHA D, prove target identity and upstream, exact B/tree 717a04a858b4768deddf814822e3467407606f11, native read-only HANDOFF comment 6088681412 at A 0e99786f0b087de46a2518d5874beb999892dd6c, strict A-to-B and reverse non-ancestry, exact single-child author/subject, and exact 16-path provenance manifest. Retry only by deterministic exact reread of the same binding.',
    forbidden_evidence_condition: 'Any wrong or missing Issue/repository/branch/origin/upstream/A/B/tree/comment identity; forged, modified, duplicate, or competing HANDOFF; stale/moved/divergent/reverse ancestry; dirty, detached, inaccessible, unsupported, or drifting roots; changed path/commit provenance; unavailable probe; or ambiguous readback.',
    permitted_operation: 'Run the registered Tier-A bemoat:context:recover-committed-wip command as a read-only Architecture A proof only; perform no Git, worktree, source, or GitHub mutation.',
    canonical_command: 'bemoat:context:recover-committed-wip',
    required_review_type: null,
    expected_post_state_or_gate: 'The proof result remains STOP with no objective-edit authority. Its only next action is registered CLI Discovery followed by fresh bemoat:context for Issue 627 with --target-worktree bound to the verified target; fresh Context alone can authorize later work.',
    prohibited_commands: ['bemoat:context:sync-base', 'bemoat:context:recover-setup', 'bemoat:checkpoint:red-wip', 'bemoat:handoff'],
    decision: 'COMMAND',
    stop_condition: 'STOP on every absent, conflicting, drifting, unsupported, unavailable, or ambiguous identity, provenance, ancestry, retry, or final-readback condition. Never mutate or convert RED WIP to GREEN, publish HANDOFF, or authorize Objective N+1.',
  }]
}
