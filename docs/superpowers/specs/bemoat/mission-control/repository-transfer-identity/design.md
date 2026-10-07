# Repository transfer identity compatibility

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: "#582"
task_key: "issue-582-repository-transfer-identity"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#582"
branch_template: "fix/582-repository-transfer-identity"
transition_target: "FOUNDER_GATE"
planning_base_sha: "46fe5363697cb24f0db5a6d4338a5540665bb697"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat/mission-control/repository-transfer-identity/design.md"
paired_plan: "docs/superpowers/plans/bemoat/mission-control/repository-transfer-identity/implementation-plan.md"
```
<!-- bemoat-task-identity:end -->

## Decision

Issue #582 uses the stable GitHub repository database ID as the continuity proof for pre-transfer evidence. The live repository is `bemoat/bemoat-web-starter`, ID `1267006707`. Historical records that name `boat1994/bemoat-web-starter` may be accepted only when fresh GitHub evidence binds both the exact native resource and the historical repository claim to that same ID.

This is a stateless compatibility check inside Context. It does not create a repository alias registry, rewrite comments, or change the canonical repository used for current work.

## Bounded design comparison

| Option | Behavior | Assessment |
| --- | --- | --- |
| A. Stable repository ID plus live native-resource parent chain | Re-read the exact native resource, follow its live parent to the current repository object, and compare the historical-name lookup's numeric ID with `1267006707`. Keep all new writes and current presentation canonical. | **Selected.** It proves continuity from live GitHub evidence, works when a child resource omits a repository-ID field, and does not create mutable alias state. |
| B. Historical-name allowlist or alias registry | Treat `boat1994/bemoat-web-starter` as an accepted alias in a table or shared service. | Rejected. A string mapping cannot prove that a particular native Issue, PR, comment, review, or policy belongs to the same immutable repository. It adds general alias behavior that the Founder direction excludes. |
| C. One-time compatibility for selected immutable pre-transfer records | Add a narrow migration mapping or resource-specific exceptions for the #578 HANDOFF and old policy metadata, without a reusable alias service. | Rejected as the implementation shape. It is narrower than B, but it leaves other durable historical readers with separate rules and does not provide a reusable resource-to-repository proof. Rewriting comments is not an acceptable variant because native evidence is immutable. |

The selected design requires a deterministic live GitHub evidence chain for each resource type, not a direct repository-ID field on every child resource. A resource's exact native ID and URL may bind it to a parent Issue or PR; that parent may expose `repository_url`, which binds to the current repository object and ID. A redirect, similar owner/name, account identity, or string alias on its own is never proof.

## Authority and characterization

- The selected Founder direction on [Issue #582, comment 6019146779](https://github.com/bemoat/bemoat-web-starter/issues/582#issuecomment-6019146779) selects stable repository ID continuity and rejects redirects, name similarity, account identity, or string aliases as sufficient proof.
- The accepted execution direction on Issue #582 keeps the exact current repository identity for writes, local origin, active PR ownership, and live repository ownership.
- Protected Mission Control policy v1.6.0 is read from `docs/mission-control/mission-control-guide.md` at `main@46fe5363697cb24f0db5a6d4338a5540665bb697`; its current canonical identity and trusted Founder remain exact.
- The story oracle follows `docs/agent-loop/context-story-matrix.md`: assert a positive route only where the selected direction and existing #565 recovery contract uniquely establish it; otherwise assert exclusion and preserve fail-closed behavior.

## Proof chain

For a historical Issue-comment record, compatibility requires all of these live facts to agree:

1. `GET /repos/bemoat/bemoat-web-starter` returns one valid positive repository ID and exact `full_name: bemoat/bemoat-web-starter`.
2. `GET /repos/bemoat/bemoat-web-starter/issues/{issueNumber}` returns the exact parent Issue number, an immutable Issue ID, and the exact current `repository_url`.
3. The paginated comments collection for that exact current Issue contains exactly one matching native comment ID. Its `issue_url`, `html_url`, and body match the source comment being interpreted.
4. A live lookup for the historical repository name in the immutable record returns a repository object whose ID equals the current repository ID and whose live canonical `full_name` is `bemoat/bemoat-web-starter`.
5. One central compatibility primitive accepts the historical claim only when the proof is uniquely keyed to the exact source comment and parent Issue and all repository IDs agree.

The historical-name lookup is corroborating evidence only. Its redirected response, owner/name similarity, or canonical full name without a matching numeric ID never proves continuity. The native Issue-comment API need not expose a repository-ID field itself: its native comment ID and `issue_url` bind it to the exact parent Issue; that Issue's `repository_url` binds it to the live repository object and ID.

Historical policy content is read only from an exact protected-base commit through the current repository API. The blob path/SHA and parent commit stay bound to that current repository. A historical `canonical_repository` value is compatible only through the same central ID proof. Current protected policy identity and current Founder author checks remain exact; repository continuity does not infer account continuity.

The GitHub REST field contract used by this chain is documented in the [repository](https://docs.github.com/en/rest/repos/repos), [issue](https://docs.github.com/en/rest/issues/issues), and [issue-comment](https://docs.github.com/en/rest/issues/comments) endpoints.

## Required behavior

- New HANDOFFs, repairs, decisions, and other durable writes use `bemoat/bemoat-web-starter` and current canonical URLs.
- Behavior-affecting current identities in the starter remain canonical: the strict CI guard, boilerplate-sync manifest, and boilerplate/source defaults identify `bemoat/bemoat-web-starter`; new-publication templates and current operator links/instructions use the current repository. Correct only directly coupled docs such as the deploy links, boilerplate source instructions, CI target notes, review-verdict template, and starter-source links. Historical evidence, examples, and fixtures retain the historical name where it accurately describes past events.
- Protected Mission Control policy keeps `canonical_repository: bemoat/bemoat-web-starter` and `trusted_founder_login: bemoat`. Those values are already correct on the approved current base; implementation must not replace the merged policy with the historical target's older copy. A copied child policy must not inherit starter Founder authority.
- Current local origin, configured repository, Issue URL, active PR URL/ownership, PR head/base, branch, review IDs/URLs/commit binding, and durable local-state checks remain exact and current.
- Historical repository compatibility is applied only while reading immutable records and only through the central primitive plus a resource-specific live proof.
- Exact Issue number, PR number, comment ID and URL, branch, head, protected base, policy blob, review identity, native author, and durability bindings remain independently required.
- Historical comment bodies and URLs are read-only. No historical evidence is rewritten or deleted.
- Missing, malformed, duplicated, ambiguous, conflicting, unavailable, or different-ID proof fails closed. An unrelated child repository or copied starter policy cannot gain starter Founder authority.
- Same-ID proof does not relax any independent #565 stale-base eligibility or synchronization gate.
- Same-ID proof does not weaken the #580 competing-HANDOFF overlay: exact cardinality and identity checks remain in force, and blocker resolution remains per-blocker.
- There is no general alias service or persistent alias map.

## Fresh #578 state and historical baseline

A fresh current-main Context run on 2026-10-07 at `main@46fe5363697cb24f0db5a6d4338a5540665bb697`, against the exact #579 head, now returns `COMPLETE`: Issue #578 is closed and PR #579 is merged. The prior pre-merge stale-base `STOP` is preserved in native #582 HANDOFF comment [6014391169](https://github.com/bemoat/bemoat-web-starter/issues/582#issuecomment-6014391169). Characterization must not claim the live #578 route is still `STOP`. Reconstruct the pre-merge active stale-base snapshot from immutable native comments 6010840947 (VERIFY) and 6010924707 (schema-v3 STOP), the historical issue state/body, and PR #579's exact head/base. Treat the old API state as a historical production-shaped fixture evaluated by current-main code; retain the exact native HANDOFF record fields and distinguish any isolated single-comment proof fixture from the full chronology.

## Bounded semantic stories

| Story | Authority and invariant | Expected behavior |
| --- | --- | --- |
| Reconstructed pre-merge #578 has its exact historical Issue body and both immutable native HANDOFFs; the exact comment-to-Issue-to-current-repository chain and historical-name lookup prove ID `1267006707`; all other #565 bindings are exact. | #582 selected direction plus the existing #565 stale-base continuation contract in `context-story-matrix.md`. | Historical scope can bind only through the proven same repository. The existing bounded sync recovery remains gated by all ordinary eligibility checks; the schema-v3 STOP still follows the exact #580 overlay. New presentation uses the current canonical repository. |
| An isolated fixture contains the exact immutable #578 VERIFY comment 6010840947 and its exact issue/PR/head/base bindings, without the later STOP record. | #582 proof boundary and the existing #565 continuation contract. | Test repository identity compatibility without inventing or editing native record fields. |
| The historical name matches but ID proof is absent, malformed, duplicated, conflicting, or different. | #582 explicitly rejects name/redirect-only proof and requires fail-closed behavior. | Exclude the recovery; retain the existing STOP outcome. Do not choose a fallback route. |
| The old-name endpoint resolves to the current full name but supplies no ID, or its ID differs from the current repository ID. | #582 stable-ID requirement. | Exclude compatibility and fail closed. |
| The comment ID is absent or duplicated, comment body/URL differs, parent Issue number or repository URL differs, or the parent resource is unavailable. | #410 exact native-evidence contract and #582 exact-resource binding. | Exclude compatibility and fail closed. |
| A copied policy is evaluated in an unrelated child repository. | Protected Mission Control v1.6.0 child-isolation rule and #582 acceptance criteria. | Do not grant trusted Founder identity or historical compatibility. |
| The starter strict CI guard or behavior-affecting boilerplate/source defaults name the historical repository. | Founder direction comment 6019146779 explicitly requires current behavior-affecting identities to be repaired in this bounded objective. | Target the current canonical repository; retain old names only in historical examples and fixtures. |
| Protected policy on the approved current base already names the current repository and Founder. | Live protected policy v1.6.0 at the approved exact base. | Preserve it as-is; do not roll policy back while implementing historical reads. |
| Current origin, active PR ownership, new writes, or a current Issue/PR binding names the historical or another repository. | #410 current identity contract and #582 current-write/current-ownership requirements. | Keep the existing exact-current rejection. |
| A same-ID historical HANDOFF has an independent #565 failure, or participates in a competing #580 pair. | #565 and #580 canonical story-matrix invariants. | Keep all existing gates and competing-record STOP behavior. |

## Out of scope

- A general repository-alias or migration service.
- Changing current origin, live repository, current writes, active PR ownership, or current presentation to a historical name.
- Rewriting, deleting, or republishing historical Issue comments.
- Changing #565 stale-base eligibility or its synchronization command.
- Weakening #580 competing-HANDOFF identity or blocker rules.
- Child-project policy inheritance, deployments, migrations, or production mutation.
