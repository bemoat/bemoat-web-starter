# Bemoat PStack execution contract

Issue [#562](https://github.com/bemoat/bemoat-web-starter/issues/562) defines
the project-local adaptation for the pinned PStack tree. This document binds
PStack to Bemoat as an execution/HOW layer. It does not create a second workflow
authority.

## Boundary and preconditions

The authority boundary is fixed:

```text
Bemoat decides WHETHER / WHAT is authorized.
PStack decides HOW to execute the already-authorized objective.
```

Fresh Bemoat Context authorizes each `IMPLEMENT`, `VERIFY`, `FIX`, and `REVIEW` objective. PStack HOW applies only to the current Context-authorized objective.
Context-authorized read-only `VERIFY` and `REVIEW` objectives may use PStack HOW without the one-time post-preflight first-edit trigger. The one-time post-preflight first-edit trigger remains mandatory before the first source-file mutation; it gates source mutation and grants no objective authority.

PStack may be used only while the current objective and existing Bemoat
conditions remain valid:

1. Fresh `bemoat:context` authorizes the current bounded objective and its
   route; `COMMAND` is required before objective mutation.
2. The objective is still bound to the verified Issue, branch, exact head,
   upstream, protected base, and local durability evidence.
3. The exact pinned cache has passed the registered `bemoat:pstack check`
   operation. `bemoat:pstack discover` may inventory the available official
   skills and agents, but discovery does not execute or enable them.

The approved source is `cursor/plugins@88d47514b82e7c44f00f2b2a72ff6dd12158038c`
with PStack version `0.15.29`, and the checked-in pin remains the source of
truth for the tree and manifest hashes. The utility and this adapter preserve
`automatic_routing: false`.

If the cache is missing or fails integrity checks, or if the host cannot
provide the required worker/skill capability, report the exact limitation and
stop. Do not invent a PStack runtime, simulate a worker, or let the Bemoat
controller absorb the work as a fallback.

External PStack surgery does not count as native PStack activation or runtime
acceptance and supplies no Bemoat authority.

## Cursor integration/configuration seam

The managed Cursor rule is `.cursor/rules/bemoat-pstack-execution.mdc`. It
documents the intended project-local integration/configuration seam; its
presence does not prove the PStack plugin/runtime is installed, activated,
loaded, or executable in native Cursor. The pinned PStack README defines that
`poteto-mode` runs in the receiving chat and owns generic playbook
orchestration, while `poteto-agent` is the delegate wrapper. In this project,
that behavior is HOW only after Bemoat authorization. The Bemoat controller
does not become the PStack playbook's source, test, verification, or review
worker; it delegates substantive work to distinct `poteto-agent` workers and
only synthesizes their evidence.

## Codex host mapping

On Codex hosts, load the Codex mapping in
`docs/mission-control/pstack-codex-adapter.md`. The mapping binds official
pinned PStack tool actions to the tools exposed to the accountable Bemoat
Controller. The Controller dispatches distinct workers through the verified
Host worker API. Workers do not need or receive nested dispatch authority. The
adapter does not claim that Codex natively loads the PStack plugin,
`poteto-mode`, or `poteto-agent` as Host tools.

## Model routing and capability fit

The existing `docs/mission-control/model-routing-profile.md` remains advisory.
The model/effort criterion remains advisory and deferred pending Host
configuration proof. This project does not add or claim unsupported PStack
model-routing configuration; provider or model identity never changes Bemoat
authority, route, worker ownership, or reviewer independence. If the host
cannot prove the required worker capability or configuration, stop at the host
boundary instead of substituting controller execution.

## Authority precedence

The existing Bemoat authority remains higher than every PStack default or
playbook instruction:

1. Fresh `bemoat:context` route and exact bounded recovery.
2. Merged protected-base policy and Founder authority.
3. Exact Issue, branch, head, upstream, base, and PR-or-no-PR identity.
4. Bemoat `STOP`, `FOUNDER_GATE`, and `COMPLETE` semantics.
5. Exact-head CI, independent review, `bemoat:handoff`, and fresh Context.
6. Only then, the pinned PStack skill or playbook used to execute the HOW.

PStack autonomy cannot convert `STOP` or `FOUNDER_GATE` into permission. STOP
and FOUNDER_GATE are absolute no-PStack-execution boundaries; PStack must not
execute an objective at `STOP` or `FOUNDER_GATE`. Only the exact
Bemoat-prescribed bounded recovery and setup exceptions at `STOP` under §12
and §13 of `docs/mission-control/execution-handoff-contract.md` remain
exclusively governed by that canonical contract; they do not authorize PStack
objective execution. PStack cannot select or rename a Bemoat route, add
workflow state or evidence vocabulary, consume a Founder decision, satisfy
exact-head CI or review, or authorize a future objective. `COMPLETE` remains a
Bemoat terminal result.

## Worker topology

There is exactly one accountable Bemoat controller for the bounded objective.
That controller is orchestration-only: it reconstructs authority, selects the
Context-authorized objective, assigns bounded roles, synthesizes evidence,
verifies durable state, audits acceptance criteria, publishes or verifies the
required HANDOFF, and reruns fresh Context. It does not characterize the
repository, author tests or oracles, mutate source, run focused tests, perform
deterministic verification, or correct the implementation.

PStack supplies the HOW for these worker-owned roles. The role identity and
mutation effect must be explicit before work starts.

Characterization and deterministic verification workers are distinct
`poteto-agent` workers with read-only scopes. They may inspect the repository,
run assigned read-only checks, and return cited evidence only; neither may
mutate source, tests, or verification state. `poteto-mode` remains generic HOW
orchestration in the receiving chat, not a substitute for either worker.

| Bemoat role | PStack capability used as HOW | Mutation effect |
| --- | --- | --- |
| Read-only characterization worker | Distinct `poteto-agent`; receiving-chat `poteto-mode` HOW only | No writes; returns cited repository and host evidence. |
| Test/oracle worker, when the objective changes behavior | `tdd` skill and the selected `poteto-mode` playbook | May change only the explicitly assigned test/fixture paths. |
| Implementation worker | `poteto-mode` feature/bug-fix/refactoring playbook through `poteto-agent` | Exactly one distinct worker is the sole mutation owner for the bounded source scope. |
| Deterministic verification worker | Distinct `poteto-agent`; `principle-prove-it-works` guidance | Read-only scope; reports exact command output and observed state. |
| Independent semantic/Delta reviewer | `interrogate` or the applicable review capability | No implementation mutation; reviewer identity differs from controller and implementer. |

The implementation worker is not the controller. Per `AGENTS.md` and
`.agents/skills/regression.md`, the intermediate tester must be a different
worker/session from the implementation owner. The independent reviewer is
distinct from both controller and implementer. Model or provider substitution does not change
those identities. If a worker fails, retry or reassign only that bounded role
when safe, or stop and report the execution limitation. The controller may
not silently take over, nest another Bemoat controller, or use a model name as
an identity substitute.

PStack's `poteto-mode` remains generic orchestration/HOW machinery. This
adapter does not duplicate its playbooks, add a Bemoat scheduler, or create a
second Mission Control controller. PStack worker output is evidence for the
Bemoat controller; it is not workflow authority.

## Durable Issue lineage and gates

### Campaign control plane and Issue Execution lifecycle

Keep one long-lived Global MC control plane per active campaign or work queue.
The same active Global MC session may coordinate sequential Issues; an Issue
change alone does not require a new Global MC chat/session. Start a new Global
MC session only at a real control-plane boundary, and reconstruct it from live
durable evidence. Each Issue has its own Execution lineage. Before each
objective and Issue transition, reconstruct fresh live repository, merged
policy, GitHub, and native Context authority; each new Issue requires a new
Execution handoff. Terminal completion ends that Issue's Execution session, and
its prior terminal state is not reusable authority for another Issue.
Chat/session identity is not durable authority. No autonomous background or
post-turn continuation is implied.

### Live execution handoff identity

At each authorized objective, resolve the Issue, branch, exact topic HEAD,
upstream, approved protected base and exact base HEAD, and PR state from fresh
Bemoat Context and canonical GitHub/native Git evidence. Do not reuse a prior
identity, SHA, or PR result as current authority. The current execution
handoff binds the work to this durable tuple:

- Issue: resolve from fresh Bemoat Context.
- Branch and canonical upstream: resolve from fresh Bemoat Context and native Git.
- Exact topic HEAD: resolve from fresh Bemoat Context and verify against native Git.
- Approved protected base branch and exact HEAD: resolve from live policy and GitHub.
- PR: resolve its live identity or verify that none exists.
- Merge: prohibited for this adapter.

Workers operate only inside the verified Bemoat Issue lineage. A local
checkout, clone, or worktree is disposable transport beneath the canonical
repository, Issue, remote topic branch, exact head, upstream, and durability
evidence. Same-Issue restarts reattach to that durable branch lineage. PStack
cannot invent branch/worktree ownership, bypass the exact-target recovery
contract, create a competing Issue branch, or perform destructive cleanup.

After the authorized objective reaches its durable result, the controller uses
the existing `bemoat:handoff` contract exactly once when required, reads back
the native record, and reconstructs fresh Context before selecting another
objective. PStack does not publish a substitute HANDOFF, select the next
objective, merge, deploy, migrate, or cross a secret/destructive gate.

## Terminal workspace release

Terminal workspace release remains a Bemoat workflow operation, not PStack
cleanup. A direct/single checkout may return to a clean verified protected base
only after durable exact-head readback proves sole ownership, no active writer,
and no unpushed work. A task worktree may be released or removed only after
exact branch/head durability, unique ownership, clean state, and primary
checkout preservation are proven. Missing proof is `STOP`. Bemoat's existing
workflow handles later commit, push, and PR gates outside the PStack HOW layer;
merge remains subject to the existing no-autonomous-merge policy. PStack must
not perform destructive cleanup.

## Host compatibility boundary

The official PStack tree is an Agent Skills/plugin distribution. Its README
documents Cursor subagent and Cursor-only capabilities. The Codex tool mapping
is documented separately in
[`pstack-codex-adapter.md`](pstack-codex-adapter.md). `bemoat:pstack` check and
discovery prove provenance and inventory only. They do not prove that the
active host can spawn workers or execute a Cursor-only feature.

The active Controller must verify its actual worker tools and returned worker
identities. A worker's missing nested dispatch does not disprove Controller
dispatch, and it does not permit a worker to create a second controller. When
the Controller cannot provide the worker topology required above, stop at the
execution boundary. No prompt-only wording, local shim, or controller
self-execution may claim successful PStack execution.
