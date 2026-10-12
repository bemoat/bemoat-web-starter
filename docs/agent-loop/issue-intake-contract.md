# Issue Intake Contract

Use this contract when ChatGPT creates or updates a GitHub issue from an active
conversation. The goal is to normalize issue structure without expanding scope.

Principle: `Normalize structure, not expand scope`.

## When to use this

Use this guide when:

- a brainstorm conversation is ready to become a GitHub issue
- an existing issue needs to be rewritten into a clearer implementation slice
- an agent or human wants a canonical issue structure before coding starts

Do not use it to add requirements the user did not choose, create exhaustive
specification documents, or split one task into multiple future phases unless
the current conversation already decided that.

## Canonical issue format

Every Issue intended for Mission Control execution must also carry these two
plain-text declarations in its final body, outside fenced examples:

```text
Task size: small | medium | core
Mission Control mode: required | optional | not required | unsure
```

Use exactly one supported value for each declaration. Both declarations are
required by this intake contract, even though the production Context parser
retains conservative STANDARD defaults for partial metadata (for example, a
supported task size without an explicit mode, or a required mode without a
task size). Those defaults preserve existing behavior;
they do not satisfy the creation contract. If the Issue has no usable profile
metadata, Context stops. `not required` follows the parser's existing
optional-mode behavior; `unsure` uses STANDARD safeguards. Do not infer or
invent declarations from task prose.

This requirement applies whether the Issue is created or updated through the
GitHub form, a ChatGPT/GitHub connector, or the GitHub API. For programmatic
creation, the agent must write both declaration lines directly into the Issue
body; GitHub form validation does not run on API-created Issues.

Write the issue using these sections when they are relevant:

```md
## Objective

The result this task should produce.

## Context

The current problem and why the task matters.

## Scope

- Work required in the active slice.

## Out of Scope

- Work intentionally deferred.

## Must Not Break

- Existing behavior, contracts, data, or flows that must remain unchanged.

## Acceptance Criteria

- [ ] Observable result that can be verified.

## Verification

- Automated checks
- Manual QA when needed

## Stop Condition

The point where this issue is complete without expanding into future work.
```

Sections with no meaningful content may be omitted. Do not add filler merely to
complete the template.

### Execution objective and scope headings

For an execution Task Issue, use exactly one active `## Objective` and exactly
one active `## Scope`. The current parser also accepts `Goal` as the Objective
alias and `Scope boundaries` as the Scope alias at heading levels 2–6, so
existing issues remain readable. Those aliases are compatibility forms, not
permission to provide multiple active objectives or scopes. The parser does
not reject duplicate matching headings and its current section map retains the
later matching section; that is compatibility behavior, not authority. A
duplicate or competing Objective/Goal or Scope/Scope boundaries is therefore
ambiguous intake: Global MC must stop and obtain the accountable decision
owner's clarification instead of using heading order to select work.

The Issue Form uses `Goal` for its parser-compatible objective field and
`Scope boundaries` for its parser-compatible execution scope field. Its
separate `Repository / project scope` dropdown identifies where work lands and
must not be treated as execution scope. An API- or connector-created Issue
must write the same execution headings and declarations directly in its body;
form validation does not run for that path.

## Single Task versus Parent + Child

Global MC applies this bounded intake decision before execution. The following
table is a decision rule, not a scheduler or a new Context route.

| Keep one Single Task Issue | Use a Parent Issue plus Child Task Issues |
| --- | --- |
| There is one independently verifiable bounded outcome, with shared scope, accountable owner, and review/merge gate. | The initiative contains separately deliverable objectives, or objectives have materially distinct scope, owners, PRs, or review gates. |
| Ordinary implementation steps, checklist items, or phases still contribute to that one outcome. They do not require children by themselves. | An Execution Task would need to interpret unrelated specification/history to choose its own objective, creating context-noise or objective-selection risk. |
| The existing Task Issue can state one active Objective, one active Scope, bounded acceptance criteria, and one finish condition without referring to siblings. | The ordered child sequence and fixed prerequisites can be stated before execution, with each Child independently entering fresh Context and owning its own result. |

Global MC is the accountable decision owner for the keep/split intake decision,
using the current Issue and verified authority. The current Issue owner and
any verified Founder decision remain the authority for material scope or
authority changes. When the split, scope, ownership, or authority is
ambiguous, fail closed: keep the current Issue scope unchanged, produce a
decision-ready proposal for that owner, and do not create, select, or start a
Child. Do not invent a Context route to resolve the ambiguity.

## Parent Issue contract

A Parent is a concise coordination and verified-readback record for a
multi-objective initiative. It is not an execution Issue and its checklist,
child ordering, or status cannot authorize a worker to edit a Child or a
sibling. Use ordinary Markdown Issue links and checklists for the ordered map;
do not add a machine-readable graph, dynamic planner, scheduler, second router,
ledger, or native GitHub Sub-issue API dependency.

A Parent contains only:

- the program goal and invariants that every Child must preserve;
- short links/references to accepted decisions and source authority;
- an immutable ordered Child map with fixed prerequisite/dependency pointers;
- a current status of `DONE`, `BLOCKED`, or `DEFERRED`;
- one active Child, PR, and gate as verified pointers; and
- one next permitted action.

Keep historical transcripts, test logs, repeated policy text, detailed PR
evidence, and Child implementation notes in their owning Issues, PRs, CI
checks, or HANDOFFs. A Parent may record only verified readback of those
artifacts.

## Child Task Issue contract

Each Child is self-contained and must be safe to reconstruct without reading
unrelated siblings. It must include, outside fenced examples:

```text
Task size: small | medium | core
Mission Control mode: required | optional | not required | unsure
Parent Issue: #<parent-number>
```

Use exactly one supported value for each metadata declaration. A form-created
Child supplies the Parent link through the parser-compatible `Main Issue /
Parent Issue` form field; an API- or connector-created Child writes the
`Parent Issue: #...` line directly. `Parent Issue` is already an alias of the
current parser's Main Issue declaration; this contract does not add a new
parser field.

The Child body then contains exactly one active Objective and one active Scope,
followed by:

- fixed prerequisite Issue IDs, or an explicit `None`;
- bounded, observable acceptance criteria;
- allowed effects and forbidden effects/paths;
- the oracle and verification commands/evidence, with expected behavior derived
  from canonical authority;
- a finish condition for this Child only; and
- specific decision, policy, Issue, PR, or other source links.

The Child owns its Objective, Scope, acceptance result, PR, exact-head CI, and
applicable HANDOFF. The Parent stores only verified pointers and status. Child
completion never grants a sibling COMMAND or advances another Child. A
different Issue always requires fresh Global MC reconstruction and a
destination-specific Execution handoff. Preserve #627's existing same-Issue
continuation rule: it applies only to the same Issue/session/workspace and
freshly valid authority, not to Parent-to-sibling movement.

## API and connector-created Issues

The API path must emit the same declarations and execution structure as the
form path. A programmatically created execution Issue body maps the form's
semantic fields to plain text: `## Context`, one `## Objective` (the form's
`Goal` compatibility label is also accepted), `## Acceptance Criteria`, one
`## Scope` containing allowed work and forbidden effects/paths (the form's
`Scope boundaries` compatibility label is also accepted), the repository /
project landing choice (for example, the plain-text line
`Repository / project scope: bemoat-web-starter`), required verification
commands, and risks or must-not-break constraints. It must also include the
exact top-level lines

```text
Task size: <small | medium | core>
Mission Control mode: <required | optional | not required | unsure>
```

and, when it is a Child, `Parent Issue: #<parent-number>` plus fixed
prerequisite links or an explicit `None`. Do not rely on form field IDs, labels,
defaults, or an unverified native Sub-issue relation. These body declarations
describe intake; they do not grant workflow authority.

## Non-mutating #637 illustration

The following is a human-readable proposal only. It uses ordinary Issue
references and checklist items, does not create or rewrite #637 or any other
Issue, and does not authorize execution. The owning Global MC must separately
reconstruct authority and lawfully create/normalize each Child before any work
starts.

Parent: [#637](https://github.com/bemoat/bemoat-web-starter/issues/637) — planned Parent/readback record only.

- [ ] Proposed Child A — read-only blueprint, current authority inventory, and testability specification. Prerequisite: none.
- [ ] Proposed Child B — source-linked Blueprint publication. Prerequisite: Child A's verified result.
- [ ] Proposed Child C — bounded verification-skill pilot and scenario evidence. Prerequisite: Child B's verified result.
- [ ] Proposed Child D — evidence-first minimization recommendation. Prerequisite: Child C's verified result.

The A → B → C → D ordering is a fixed proposal, not a dynamic graph or
automatic route. The existing #637 body, its active Objective/Scope, and its
current owner remain unchanged by this documentation example.

For Core or multi-stage work, also follow
[project-progress-tracking.md](./project-progress-tracking.md) and use the
`agent-task` template optional Main Issue / Implementation Plan fields or the
equivalent `Main Issue:` / `### Main Issue` declarations.

## Normalization rules

When converting a conversation into an issue, ChatGPT must:

1. Use only decisions supported by the current conversation and repository context.
2. Preserve the owner's latest decision when earlier discussion conflicts with it.
3. Separate the active slice from future ideas and rejected alternatives.
4. Remove conversational noise that does not affect implementation.
5. Never invent requirements to fill a section.
6. Normalize structure without expanding scope.
7. Keep acceptance criteria observable and testable.
8. Stop when the issue is clear enough to begin work; do not make it exhaustive.
9. Use the self red-team scope gate from [self-red-team-scope-gate.md](./self-red-team-scope-gate.md) when material planning or specification expansion is involved.

## ChatGPT Project Instructions

Copy and paste this into ChatGPT Project Instructions when the owner wants
conversation-to-issue output to follow this contract:

```text
When the user asks to create or update a GitHub issue from the current conversation:

1. Read `docs/agent-loop/issue-intake-contract.md` from the target repository when available.
2. For every Issue intended for Mission Control execution, put both required workflow declarations as plain text in the final body, outside code fences and examples:

   `Task size: <small | medium | core>`

   `Mission Control mode: <required | optional | not required | unsure>`

   Select values only from explicit conversation/repository evidence. Do not omit these declarations for API/connector-created Issues, and do not guess when the evidence is unclear; mark the mode `unsure` so Context applies STANDARD safeguards.
3. Summarize only decisions the user has actually made.
4. Do not add features, expand scope, or invent missing requirements.
5. Separate the active slice from future ideas and rejected alternatives.
6. Write the issue using this structure when relevant:

## Objective
## Context
## Scope
## Out of Scope
## Must Not Break
## Acceptance Criteria
## Verification
## Stop Condition

7. Omit sections that have no meaningful content. Do not add filler.
8. Before creating or updating the issue, check that:
   - the scope is clear,
   - acceptance criteria are observable,
   - future work is not mixed into the active slice,
   - the issue is not more detailed than needed to begin implementation.
9. Create or update the issue in the repository specified by the user.
10. After the action, report the issue title, number, and URL.

Principle: Normalize structure, not expand scope.
```

## Child sync impact

This file lives under `docs/agent-loop`, which is a harness-managed path in
`bemoat-web-starter`. After this starter change merges, child projects should
receive it through:

```bash
pnpm run bemoat:boilerplate:sync -- --harness-only
```

No new sync path is required.
