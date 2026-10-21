# Context Story Matrix

Issue [#427](https://github.com/boat1994/bemoat-web-starter/issues/427)
commissions story-first semantic coverage for the stateless `bemoat:context`
router before the Issue #410 cutover continues. This matrix is a bounded test
map, not a new state machine, routing configuration, or test DSL.

## Canonical invariants

Derive each semantic test oracle from canonical authority, never from the
candidate implementation. Record the authority and the behavior it establishes
before writing the assertion.

- Assert a specific expected route/state/outcome only when canonical authority
  uniquely determines it.
- If authority only forbids an outcome, assert that exclusion; do not invent a
  fallback outcome.
- If multiple outcomes remain plausible from canonical authority, classify the
  case as a protocol/spec gap and stop before encoding one as expected behavior.
  An authority-backed exclusion remains valid; it does not resolve the gap or
  authorize choosing a fallback.

For example, authority that malformed COMPLETE evidence must not terminalize
as `COMPLETE` supports an exclusion assertion. It does not establish
`IMPLEMENT` as the expected route without separate, uniquely determining
authority. Existing exact-route stories still apply when their cited authority
uniquely establishes the outcome. Keep the A/B/C classification below intact.

| Invariant | Authority | Protected behavior |
| --- | --- | --- |
| Routing is a pure function of current native GitHub/Git evidence. | Issue #410 deterministic route contract | No prior legacy workflow state, receipt, counter, or session memory selects a route. |
| In the no-PR path, an explicitly numbered topic branch must belong to the queried Issue. | Issue #525 bounded branch-ownership decision | A `<type>/<issue>-<slug>` branch whose Issue number differs from the queried Issue routes `STOP` with `EVIDENCE_CONFLICT`; matching branches continue, legacy unnumbered behavior is preserved only, and PR ownership remains a separate evidence path. |
| Pre-Context dependency preparation is setup-only and restricted to a verified development Issue checkout. | Issue #632 Objective A criteria; Founder-approved Issue #655 P1/P2/P3, comment 6271228440; existing-controller-after-merge ancestry requirement | Preserve canonical repo/Issue/branch/upstream/live-head/base identity and ordinary or historical-base ancestry. Node must satisfy `engines.node` and the supported major, without requiring CI patch equality; pnpm must satisfy `engines.pnpm`, CI-supported major, and lockfile format together. P1 permits only fully proven read-only reuse. P2 permits one exact frozen/ignore-scripts install for a fresh checkout with one initially empty, uniquely owned task-local store. P3 requires complete exact incident identity and orders read-only R1 before isolated same-Issue R2. Source D remains excluded; setup permits only Discovery then fresh Context and grants no route or first-edit authority. |
| The sole post-STOP SIGINT-after-meaningful-install exception is the already-recorded #562 incident, after a separately merged §12/§13 amendment and fresh proof of complete incident identity. | Issue #659 criteria 1–4; #562 readback comment 6285952179; merged §12/§13 policy | Require the original checkout/store and failure evidence to remain unchanged; one clean, uniquely owned physical replacement at the same canonical Issue branch and exact live head; its own initially empty task-local store; exact runtime, manifest, lock, command and store identity; no competing writer; and verified Host scope. Exit 130 alone, any drift/mismatch, missing evidence, dirty/nonempty replacement, destructive cleanup, or second attempt remains `STOP`. Existing P1/P2/P3 and R1/R2 cases remain intact; setup grants no Context route or first-edit authority. |
| An unmerged active PR cannot authorize PR-gated work from a numbered local branch owned by another Issue unless local branch and `HEAD` exactly match that PR's head; a uniquely proven exact PR target may receive only a bounded switch recovery. | Issue #573, Founder direction comment 6008320328; Issue #410 exact PR-head identity | Mismatched workspace remains `STOP`; only the active PR's exact live canonical branch with matching local origin-tracking ref may be selected. A branch-number mismatch remains ordinary PR ownership when local branch/head match the PR. Valid merged PR evidence remains terminal despite an irrelevant local checkout. |
| An explicit protected-main Context source may be either attached to the live protected branch or detached at the exact live protected-base SHA; source repository, origin, cleanliness, and target durability checks remain independent. | Founder-approved Issue #571 Option A; Issue #430 protected-main stale-branch bootstrap design, Source-command identity | Detached status alone does not block an exact-SHA canonical clean command source. A wrong source SHA/repository or dirty source remains `STOP`, and target failures remain `STOP`. This does not permit a detached target or a named non-protected source branch. |
| Explicit target-mode Context independently verifies two distinct canonical Git roots; the target may be an independent clone or linked worktree, without source-side worktree-list membership. | Issue #630 Objective 4; Founder-approved independent-clone topology; Issue #628 committed-WIP proof contract requires independently bound source/target identity and durability | Source must remain clean at the exact live protected-base SHA and canonical origin. Target must independently prove canonical root and origin, exact queried Issue branch/head, non-detached branch, clean status, canonical upstream, and live push durability. Same-root aliases, wrong identity, drift, dirty, detached, unpushed, missing, or ambiguous evidence remains `STOP`. |
| Required evidence is exact and fail-closed. | Issue #410 generic safety contract | Missing, malformed, stale, conflicting, unavailable, or ambiguous evidence routes `STOP` or keeps an unsatisfied review gate. |
| An active-PR current-head `VERIFY` + schema-v3 `STOP` pair may fold only when exactly two applicable HANDOFFs have distinct native comment identities and all repository / Issue / PR / branch / head / protected-base values match. | Founder-approved Issue #580 contract; merged Mission Control policy v1.4.0 blocker-resolution rules | The schema-v3 `STOP` supplies the effective route and its explicit blockers. Resolve every blocker independently through canonical `BLOCKER_RESOLUTION`, then recompute from durable evidence; the resolved pair alone no longer conflicts. Do not use timestamps or comment order. Unsupported pairs, duplicate comments, same-head identity mismatches, malformed evidence, and additional records remain fail-closed. |
| Non-terminal continuation requires durable local work. | Issue #410 portability contract | Dirty, detached, unpushed, local-only, or wrong-repository work routes `STOP`. |
| First-time issue-branch identity is durable before non-terminal Context continuation. | Merged policy v1.3.0 durability rule plus Issue #410 portability contract | Branch setup publishes and reads back an exact zero-delta topic ref before Context can route `IMPLEMENT`; Context does not perform the mutation. |
| Same-checkout Issue-A release permits ordinary serialized Issue-B bootstrap only from a terminal source or a verified durable parked non-`COMMAND` boundary. | Live Issue #605 preliminary objective and acceptance criteria; existing execution-handoff contract §12 exact-target `SWITCH_BRANCH` and zero-delta bootstrap contracts | A clean attached durable source, terminal completion evidence or required parked HANDOFF/readback with no active writer, unique absent Issue-B target, exact current approved-base identity, host write-scope proof, and safe readback are required. A live `COMMAND`, unresolved/dirty source, ambiguous or colliding target, stale source/base, active controller, or missing host proof remains fail-closed. The target starts at exact live `main` in the same checkout and carries no Issue-A code/history. This adds no Context route/evidence schema and leaves exact-target `SWITCH_BRANCH` unchanged. | `mission-control-loader-router.int.spec.ts`: bounded release/denial contract assertions; `issue-branch-bootstrap.int.spec.ts`: real temporary-Git same-checkout lifecycle oracle |
| Terminal merge evidence is authoritative. | Issue #410 plus merged Issue #423 / PR #424 behavior | A valid `MERGED` PR with a valid merge commit can route `COMPLETE` despite a historical base or irrelevant local checkout. |
| Active PR evidence uses the live protected base and exact head. | Issue #410 exact-identity contract | An open PR with a stale/wrong base or stale head evidence cannot continue silently. |
| A stale active PR may receive one bounded deterministic continuation without a per-incident Founder gate. | Founder decision on Issue #427 comment 5414458566 | `bemoat:context:sync-base` may synchronize protected `main` into the same PR branch only when live identity, ancestry, scope, and local durability remain exact; every ambiguity remains `STOP`. |
| CI and semantic review bind to the exact current PR head. | Issue #410 verification contract and merged policy v1.3.0 | A new commit invalidates old CI/review satisfaction. |
| Native evidence must agree with itself. | Issue #427 and CTX-423-001 | `OPEN` plus a merge commit, malformed merge identity, or competing PR/review evidence fails closed. |

## Invariant and pairwise stories

| Story | Risk interaction | Expected route | Baseline class | Coverage |
| --- | --- | --- | --- | --- |
| Open Issue, no PR, durable topic branch | PR absence × local durability | `IMPLEMENT` | B | `context-router.int.spec.ts`: clean durable work without a PR |
| Verified clean development Issue checkout based on the exact live approved-base SHA, with durable canonical upstream equal to live topic `HEAD`, supported Node/pnpm, and unchanged manifests → frozen-lockfile dependency preparation with scripts disabled | pre-Context tooling requirement × origin/base/branch durability × bounded side effects | Permit only `pnpm install --frozen-lockfile --ignore-scripts --store-dir <task-local-store>` with writes bounded to checkout `node_modules` and that task-local package store; verify unchanged HEAD/branch/upstream/manifests and tracked cleanliness, then permit only registered CLI Discovery and fresh Context. Unsupported or conflicting evidence remains `STOP`; Source D remains excluded by its no-install contract. | Issue #632 Objective A criteria; no Context route asserted | `mission-control-loader-router.int.spec.ts`: positive development-checkout story and Source D exclusion |
| Node `24.18.0` satisfies `engines.node >=24.15.0` and the supported Node 24 major while CI remains pinned to `24.15.0`; pnpm `10.34.5` satisfies the manifest engine, CI major 10, and lockfile format 9 together | local runtime patch × manifest minimum/supported major × CI runtime pin; pnpm engine × CI major × lockfile format | Permit compatibility evaluation without requiring Node patch equality. Deny setup for Node below the manifest minimum or outside the supported major, and for unsupported pnpm or lockfile format; do not invent a route. | Founder-approved Issue #655 acceptance criteria 1–2 and comment 6271228440 | `startup-compatibility.int.spec.ts`: runtime compatibility assertions |
| Existing dependency tree has matching manifests but incomplete or conflicting virtual-store, `.modules.yaml`, actual store, symlink/realpath, or registered CLI-resolution proof | P1 artifact identity × store ownership × non-mutating CLI resolution | Reuse is denied unless every read-only predicate is proven, including canonical identity, lock equivalence, metadata, actual store, approved read-only realpaths, and CLI dependency resolution. `node_modules` existence, clean status, lock match alone, or pnpm metadata alone does not establish readiness. | Founder-approved Issue #655 P1 and comment 6271228440 | `startup-compatibility.int.spec.ts`: full P1 proof and denial predicates |
| Eligible development checkout has no prior `node_modules` or virtual-store metadata; selected task-local store is initially empty, stable, uniquely checkout-owned, and inside proven Host write scope | fresh preparation × store selection × bounded writes | Permit at most the exact frozen-lockfile/ignore-scripts install; verify unchanged identity and tracked/ignored artifacts. If existing module metadata binds another store, do not switch, re-home, reconcile, remove, or rebuild it; use P1 or exact P3 evidence, otherwise remain `STOP`. | Founder-approved Issue #655 P2 and comment 6271228440 | `startup-compatibility.int.spec.ts`: fresh store and existing-store protection |
| Failed setup has exact incident identity and failure class; compare eligible no-TTY abort or pre-install store mismatch with arbitrary pnpm failure or missing/stale evidence | P3 incident identity × failure class × before/after artifact fingerprints × writer ownership | Only `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` or fully characterized store mismatch before meaningful installation is eligible under the existing P3 authority. Issue #562 comment 6285952179 is the sole additional failure class, eligible only after merged §12/§13 policy and fresh exact evidence. Require all repository/Issue/branch/head/base/path/runtime/manifest/command/store/stderr/fingerprint/ownership bindings; otherwise deny recovery and preserve `STOP`. | Founder-approved Issue #655 P3 and comment 6271228440; Issue #659 and #562 comment 6285952179 | `startup-compatibility.int.spec.ts`: exact failure identity and exclusion predicates |
| Exact P3 incident first receives a read-only P1 recheck; if reuse is not proven, a new isolated checkout is bound to the existing canonical remote topic branch and exact live head | R1/R2 order × failed-checkout preservation × unique target and store ownership | R1 may only reuse without writes, then Discovery and fresh Context. R2 preserves the failed physical checkout byte-for-byte and allows one exact install in the new checkout only. A second failed setup is `STOP`; no in-place retry or loop. Recovery requires the separately merged §12/§13 authority and fresh predicates. | Founder-approved Issue #655 P3, R1/R2 decision and comment 6271228440 | `startup-compatibility.int.spec.ts`: recovery order, byte-for-byte preservation, and no-retry assertions |
| Recorded #562 SIGINT after meaningful install passes complete fresh P3 binding after merged policy; separately vary evidence completeness, drift, concurrency, replacement cleanliness, identity, cleanup, and replay | Issue #659 criteria 1–4; #562 readback comment 6285952179 | Permit only one isolated replacement at the same existing canonical branch/head, with an initially empty owned store, while preserving the original checkout/store byte-for-byte. Incomplete evidence, exit 130 alone, any drift or mismatch, competing writer, dirty/nonempty replacement, destructive cleanup, or another attempt remains `STOP`. Do not infer an alternative route. | Issue #659 acceptance criteria; exact incident evidence in #562 comment 6285952179 | `startup-compatibility.int.spec.ts`: exact incident eligibility and denial predicates |
| Post-merge zero-delta case for the existing #632 Execution controller | historical base age × exact topic-tip identity × current-base ancestry | Permit only the setup command when the clean, attached, durable branch `HEAD`, upstream, and exact live remote topic ref equal the recorded historical approved-base SHA, and that SHA is an ancestor of the current live approved-base SHA; then only CLI Discovery and fresh Context. No branch synchronization or Context route/outcome is authorized. | Issue #632 Objective A criteria and explicit existing-controller-after-merge task requirement; the post-merge zero-delta case requires the historical approved-base SHA to be an ancestor of the current live approved-base SHA | `mission-control-loader-router.int.spec.ts`: bounded historical-base startup story; no Context outcome asserted |
| Exact live protected-base command source is detached; explicit target is a clean, canonical, exact-Issue, durably pushed independent clone or linked worktree | source attachment × source SHA/repository/cleanliness × target root, identity, and durability | Exclude the source-attachment blocker and source-side worktree-list relationship; preserve ordinary target routing. Any independent source or target failure remains `STOP`. | A fixed by Founder-approved #571 Option A and #630 target topology | `context-bootstrap.int.spec.ts`: detached exact-SHA source, independent-clone target, source-negative siblings, wrong-target siblings, and linked-worktree compatibility |
| No PR, durable topic branch explicitly names a different Issue, including one-digit and historical mismatches | queried Issue identity × branch Issue identity | `STOP` with `EVIDENCE_CONFLICT`; matching branch continues; unnumbered behavior is preservation coverage only and policy is out of scope | A fixed by Issue #525 | `context-evidence.int.spec.ts`: real temporary Git through evidence collection and routing; separate PR-owned and merged-terminal controls |
| Open unmerged PR, local topic branch belongs to another Issue and does not match PR branch/head; one exact PR head is live and locally tracked | local Issue owner × active PR identity × exact target ref/head | `STOP` with exact `SWITCH_BRANCH` recovery, then immediate Discovery + fresh Context; missing/stale/conflicting target stays `STOP` | A fixed by Issue #573 | `context-evidence.int.spec.ts`: exact PR target recovery and unavailable-target exclusion; PR-owned same-branch and merged-terminal controls |
| Clean starter `main` or child integration `dev` → absent topic ref → zero-delta publish/readback → Context | base identity × branch absence × remote durability | `IMPLEMENT` only after exact durable readback; otherwise `STOP` | B (`MISSING_COVERAGE`) | `issue-branch-bootstrap.int.spec.ts`: starter/child lifecycle, non-durable siblings, mutation-free readback |
| Durable terminal Issue A → absent Issue B at exact live `main` in the same checkout | terminal source release × exact base × target absence × same-checkout history isolation | Permit only the ordinary zero-delta Issue-B bootstrap after release eligibility and fresh identity/readback checks; no Issue-A commit or file enters B. No new Context route is asserted. | Issue #605 preliminary objective/positive acceptance criterion; exact target setup remains governed by existing §12 bootstrap authority | `issue-branch-bootstrap.int.spec.ts`: temporary bare-remote lifecycle with actual Git |
| Incomplete Issue A at a durable non-`COMMAND` boundary with required HANDOFF/readback and no active writer | parked release evidence × source durability × writer exclusion | Permit the same bounded setup eligibility as terminal release; do not select a Context route or enumerate parked routes. | Issue #605 positive parked-source acceptance criterion | `mission-control-loader-router.int.spec.ts`: release contract predicates |
| Issue A has live same-Issue `COMMAND`, dirty/unresolved work, stale or wrong identity, active writer/controller, moving base, competing/colliding target, or unproven host isolation | release eligibility × source/target concurrency × host capability | Exclude same-checkout release/bootstrap; do not invent a fallback route. Preserve existing exact-target `SWITCH_BRANCH` recovery semantics. | Issue #605 negative acceptance criteria and Must Not Break clauses; existing §12 recovery authority | `mission-control-loader-router.int.spec.ts`: bounded exclusion assertions; existing `context-evidence.int.spec.ts` exact `SWITCH_BRANCH` stories unchanged |
| Open active PR, pending exact-head CI | current base/head × CI pending | `VERIFY` | B | `context-router.int.spec.ts`: incomplete exact-head checks |
| Active PR has exactly two same-identity current-head HANDOFFs, one `VERIFY` and one valid schema-v3 `STOP` with explicit blockers | Issue #580 safety overlay × blocker lifecycle × exact-head gates | `STOP` while any named blocker remains unresolved; after all are resolved, recompute ordinary exact-head routing (pending CI yields `VERIFY`). Unsupported pairs, duplicate identities, same-head identity mismatches, or additional records remain `STOP`. | A fixed by Issue #580 | `context-router.int.spec.ts`: production-shaped #578 pair, ordering, blocker-by-blocker resolution, duplicates, identity mismatches, unsupported pairs/cardinality, resolution-alone negative |
| Open active PR, failed exact-head CI | current base/head × CI failure | `FIX` | B | `context-router.int.spec.ts`: failed exact-head checks |
| Open active PR, green CI, missing semantic review | STANDARD profile × review absence | `REVIEW` | B | semantic review policy cases |
| Exact-head blocking semantic review with usable immutable finding | current head × blocking review | `FIX` | B | native `CORRECTION REQUIRED` case |
| Publication-era native `FIX` review predates #503 and the PR base is stale | same old head × unique durable HANDOFF × exact native review ID/URL | `FIX` only through the stale-base sync continuation; ordinary Context stays `STOP` | A fixed by #509; now B regression coverage | `context-router.int.spec.ts`: `#509 publication-era native review lineage during stale-base recovery` |
| Exact-head clean semantic review and satisfied native requirements | current head × clean review | `FOUNDER_GATE` | B | clean native review case |
| Stale active PR base with failed, pending, or fully satisfied downstream gates | base drift × CI/review state | `STOP` before downstream routing | B | story-first stale-base precedence table |
| Otherwise-valid stale active PR with exact same-scope identity and durable local state | stale-base `STOP` × live identity × native ancestry | one bounded `bemoat:context:sync-base` continuation, then `VERIFY` on the new head | B | `context-sync.int.spec.ts`: authorized continuation and fail-closed siblings |
| Stale PR branch predates the sync command, with an exact protected-main command source and one explicit durable target worktree | source-command identity × target canonicalization × stale-base eligibility | the protected-main registered command may run the existing bounded synchronization against only that target; every source/target ambiguity remains `STOP` | B | `context-sync.int.spec.ts`: protected-main bootstrap lifecycle and source/target drift cases |
| New PR head with old CI verification | head movement × stale CI | `STOP` | B | head-transition story and stale verification case |
| New PR head with fresh CI but old semantic review | head movement × stale review | `REVIEW` | B | head-transition story and stale-review cases |
| Valid merged PR with historical base and detached checkout | terminal merge × stale base × local non-durability | `COMPLETE` | B | terminal reconstruction transition |
| `OPEN` PR plus valid-looking merge commit | native state × merge evidence conflict | `STOP` | A fixed by PR #424; now B regression coverage | evidence and router contradiction cases |
| Claimed merged PR with missing/malformed merge commit | terminal state × malformed merge evidence | `STOP` | B | merged-PR negative cases |
| Multiple active PRs or ambiguous/competing exact-head reviews | candidate cardinality × evidence ambiguity | `STOP` or unsatisfied `REVIEW` gate | B | competing PR/review cases |
| Closed Issue without a uniquely resolved merged PR | terminal Issue × absent terminal PR evidence | `STOP` | B | pure-router closed-Issue guard |

`A`, `B`, and `C` mean implementation defect, missing coverage, and
protocol/spec gap respectively. A B-class row may be a passing
characterization: it protects already-correct behavior and requires no
production change.

## Lifecycle transitions

1. No PR → durable topic work → `IMPLEMENT`. For a first-time branch,
   “durable topic work” begins only after the zero-delta branch ref is
   published and exact local/upstream/remote/base identity is read back.
   Creating a local-only branch remains `STOP`.
2. Active current-base PR → pending CI `VERIFY` → failed CI `FIX`, or green CI
   with missing review `REVIEW` → clean exact-head review `FOUNDER_GATE`.
3. Exact-head blocking review → bounded `FIX`.
4. PR head changes → old CI is rejected with `STOP`; after fresh CI, old review
   remains stale and the route is `REVIEW`.
5. Sibling/dependency merge advances protected `main` while the active PR
   still records the old base → `STOP` before CI/review routing. File overlap
   does not authorize a different route because the normalized context model
   has no authoritative dependency/overlap evidence. The Founder decision
   recorded on Issue #427 authorizes the separate `bemoat:context:sync-base`
   command to perform one ancestry- and
   conflict-preflighted synchronization; the resulting head requires fresh
   exact-head CI and semantic review.
6. If the stale PR branch predates the registered sync implementation, invoke
   that implementation from the exact protected-main checkout against one
   explicit target:

   ```bash
   pnpm --dir <protected-main-worktree> run bemoat:context:sync-base -- \
     <issue-number> --target-worktree <absolute-path> --json
   ```

   The command canonicalizes both roots, proves the source is clean and at the
   live protected-main SHA, and collects all mutable-worktree evidence from the
   target. It does not create or remove worktrees, copy command files, or mutate
   Issue/PR metadata. PR #420 remains unchanged until the independent Issue #430
   correction is Founder-manually merged and freshly reconstructed.
7. Founder manually merges the active PR → fresh reconstruction accepts valid
   native `MERGED` plus merge-commit evidence → `COMPLETE`, even though the PR
   retains its historical base and the local checkout is detached or irrelevant.
8. Contradictory, malformed, missing, or competing native evidence interrupts
   the transition and fails closed.
9. In the narrow Issue #580 pair, the identity-bound schema-v3 `STOP` overlays
   `VERIFY` until every explicit blocker has exactly one valid resolution.
   Context then recomputes from immutable HANDOFF and resolution history;
   every other competing or ambiguous combination remains `STOP`.

## Resolved continuation decision

The active stale-base route remains canonically `STOP`: Issue #410 requires
stale protected-base evidence to fail closed. Founder authority in Issue #427
comment 5414458566 resolves the post-`STOP` continuation contract for one
narrow case without imposing a new per-incident Founder gate. Live evidence
must uniquely bind the same Issue, PR, protected branch, old base, current head,
and scope, and native Git must prove that protected `main` advanced from the old
base and that the PR head contains it. Only then may the separate
`bemoat:context:sync-base` command perform one deterministic fetch, conflict
preflight, merge, push, and remote readback. Wrong identity, missing or
ambiguous evidence, non-durable local state, ancestry failure, conflict, head
drift, external failure, or uncertain post-mutation state remains fail-closed
with a canonical result classification and `STOP` routing. The synchronized
head invalidates CI and semantic review and routes back through read-only
`bemoat:context` for verification.
