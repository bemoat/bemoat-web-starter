# Native REVIEW_VERDICT publication template

Use this template when publishing structured `## REVIEW_VERDICT` evidence in a
native GitHub PR review. Do not compose identity fields from prose. Copy the
applicable parser-valid example below, replace each complete value using the
live Issue, PR, approved base, policy, and reviewed-head evidence, then check
the final body against the production REVIEW_VERDICT parser before submitting
the review. A semantic review and its identity evidence remain independent;
this format does not grant approval or merge authority.

## Exact identity contract

- `Repository` is exactly `owner/repository`.
- `Task` is exactly `Issue #<issue-number>`; do not append a title or summary.
- `PR / base / head` is exactly:

  ```text
  PR #<number> · `<base-branch>` · `<full-head-sha>`
  ```

  Keep the base branch and complete 40-character reviewed head in backticks.
- `Approved base` identifies the exact protected base as
  `` `<base-branch>@<full-base-sha>` ``.
- Do not add alternate, duplicate, partial, or prose-bearing identity fields.

The examples are parser-tested. Their sample identities are for syntax only;
replace all values from fresh evidence before publication. Validate a complete
candidate with `pnpm run bemoat:review-verdict:validate -- --body-file
./review-verdict.md --json`. PASS establishes syntax and shape only.

## ELIGIBLE FOR FOUNDER REVIEW

<!-- review-verdict:eligible:start -->
````markdown
## REVIEW_VERDICT

Repository: `boat1994/bemoat-web-starter`
Task: Issue #535
**Verdict:** ELIGIBLE FOR FOUNDER REVIEW
**PR / base / head:** PR #9002 · `main` · `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
**Approved base:** `main@cccccccccccccccccccccccccccccccccccccccc`
````
<!-- review-verdict:eligible:end -->

## CORRECTION REQUIRED

`CORRECTION REQUIRED` uses the same exact identity fields and must include the
existing immutable finding disposition. Preserve schema version 1, the exact
reviewed head, at least one finding, unique finding IDs, a nonempty canonical
summary, a source thread, and nonempty required evidence. Do not invent a
second finding schema or replace this record with prose.

<!-- review-verdict:correction:start -->
````markdown
## REVIEW_VERDICT

Repository: `boat1994/bemoat-web-starter`
Task: Issue #535
**Verdict:** CORRECTION REQUIRED
**PR / base / head:** PR #9002 · `main` · `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`
**Approved base:** `main@dddddddddddddddddddddddddddddddddddddddd`

### Immutable finding disposition
```json
{
  "schema_version": 1,
  "mode": "implementation_pr",
  "reviewed_head": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "findings": [
    {
      "id": "REVIEW-535-001",
      "canonical_summary": "The exact-head publication example must use the parser-required identity syntax.",
      "source_thread": "https://github.com/boat1994/bemoat-web-starter/pull/9002#discussion_r9004",
      "required_evidence": ["Publish the canonical identity fields and verify them against the reviewed head."]
    }
  ]
}
```
````
<!-- review-verdict:correction:end -->

## Superseding an earlier verdict

When a new immutable review supersedes one predecessor, include one numeric
native review database ID using this exact parser-supported field. For a
cross-head predecessor, Context accepts the link only when that ID resolves to
exactly one submitted review in the same PR's native review collection, the
predecessor binds the same repository, Issue, PR, and base, and GitHub compare
evidence proves that its reviewed commit is a strict ancestor of the current
reviewed head. Missing or ambiguous ancestry evidence stops Context. The
current review must still independently bind the exact current head and meet
the ordinary reviewer-independence requirements; the predecessor never
satisfies the current-head review requirement. Same-head reconciliation keeps
its existing semantics.

<!-- review-verdict:supersession:start -->
````markdown
## REVIEW_VERDICT

**Supersedes:** 9003
Repository: `boat1994/bemoat-web-starter`
Task: Issue #535
**Verdict:** ELIGIBLE FOR FOUNDER REVIEW
**PR / base / head:** PR #9002 · `main` · `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
**Approved base:** `main@cccccccccccccccccccccccccccccccccccccccc`
````
<!-- review-verdict:supersession:end -->

The predecessor ID must identify the actual prior record in the applicable
lineage. Do not include multiple `Supersedes` fields or use timestamps, review
ordering, or "latest" selection to establish lineage. See
[command-reference.md](command-reference.md#semantic-review-evidence) for the
reader and lineage contract.
