# Context Active-PR Lineage Specification

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: "#495"
task_key: "issue-501"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#501"
branch_template: "fix/501-context-active-pr-lineage"
transition_target: "FOUNDER_GATE"
planning_base_sha: "09c45bd29fd09736a6388458032b099b27734236"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat/mission-control/context-active-pr-lineage/design.md"
paired_plan: "docs/superpowers/plans/bemoat/mission-control/context-active-pr-lineage/implementation-plan.md"
```
<!-- bemoat-task-identity:end -->

**Main Issue:** #501 — `fix(context): merged PR lineage must not become competing active PRs`

**Authority:** protected `main` at `09c45bd29fd09736a6388458032b099b27734236`, with Mission Control policy `bemoat-mission-control` v1.3.0 read from that merged base.

**Scope:** reusable starter Context PR lifecycle classification and active-candidate selection. Child product code and the child repository are outside this objective.

## Problem and classification

The protected-main baseline reproduces the defect with deterministic GitHub-shaped evidence: an open Issue with multiple historical merged PRs and no open PR returns those merged PRs through `activePrs`; normalization turns them into an `activePr` array; the router then emits `EVIDENCE_CONFLICT: competing active PRs cannot be uniquely resolved`.

The defect is an `IMPLEMENTATION_DEFECT`, not a protocol/spec gap. Commit `1deb5c7` removed the Issue-state guard from the fallback that selects merged PRs when no unmerged PR exists. The prior merged-main behavior in `7588a23` is the smallest compatible correction.

The evidence path is:

`gh pr list --state all` → authoritative Issue↔PR association → PR lifecycle normalization → active selection → `evidence.activePr` normalization → router.

Historical Issue comments continue to flow through role-evidence parsing. A merged PR remains available for the existing closed-Issue terminal reconstruction, including its validated merge commit and historical HANDOFF/REVIEW comments, without becoming current continuation evidence for an open Issue.

## Behavioral contract

| Story | Required behavior |
|---|---|
| One genuinely open PR | The PR is the unique current active candidate. |
| Multiple genuinely open PRs | All genuinely open candidates remain visible so Context fails closed as competing active PRs. |
| Merged PRs for an open Issue | Merged PRs are historical lineage only; they do not populate current active candidates. |
| Merged history plus one open PR | Only the open PR is current; merged history does not compete with it. |
| Closed-unmerged historical PR | It is excluded from active candidates and does not authorize a route. |
| Closed Issue with valid merged terminal evidence | Existing unique merged terminal reconstruction remains available and routes `COMPLETE`; ambiguous merged terminal evidence remains fail closed. |
| Historical HANDOFF/REVIEW evidence | Existing Issue-comment evidence remains readable and bound by the existing identity/lineage rules. Selection must not discard or reinterpret it. |
| Approved-base advancement after merges | Historical merged PRs do not become active again because the protected base moved. Existing merged-base handling remains intact. |
| No current active PR | Existing router semantics remain unchanged. An open Issue on a durable topic branch continues through the existing no-active-PR route; no new route is introduced. |

## Selection rule

After Issue↔PR association and lifecycle validation:

1. Retained unmerged/current PRs are the active candidates. One selects uniquely; more than one remains a competing-active conflict.
2. If no unmerged PR exists, merged PRs are retained only when the Issue is verified `CLOSED`, for the existing terminal reconstruction path.
3. If the Issue is verified `OPEN`, merged PRs are filtered from active selection and the active candidate set is empty.
4. Closed-unmerged PRs remain excluded as non-active history.

No timestamps, latest-comment authority, persistent state, counters, Issue-specific exceptions, child PR numbers, or new routing vocabulary are permitted.

## Preservation requirements

- Keep `prOwnsIssue` and exact repository/Issue/PR identity checks unchanged.
- Keep merged-state/merge-commit consistency checks unchanged.
- Keep current-HANDOFF malformed-identity behavior from #498 unchanged.
- Keep #425 and #469 review/lineage behavior unchanged.
- Keep Context read-only and child-portable.
- Do not touch `bogus-jewelry`, HeroMediaLoader, child Issue #255, or PRs #256/#257.

## Verification contract

The candidate must have focused lifecycle regression coverage, relevant Context router/correction/parser/read-only coverage, safety/structural guards, `git diff --check`, the required starter checks including final `pnpm run bemoat:check`, and exact-head CI. An independent Luna Max-class semantic review must evaluate the final branch before the canonical HANDOFF and fresh Context.
