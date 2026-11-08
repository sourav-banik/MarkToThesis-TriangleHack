# Part 3: complete synthetic replay

## User flow

The feed and sidebar link to `/replay`. A user starts with an editable original call, adds optional reasoning and falsification evidence, and manually defines a supported forecast through the shared `ClaimWorkbench`. This is manual clarification, not an AI parser.

Review displays the original wording, exact instrument/benchmark identities, measurable condition, horizon, target date, confidence, reasoning, and measurement convention. Users may return to the form without losing reviewed terms. Confirmation makes a separate locked copy and opens `/replay/[id]`.

The detail view distinguishes browser confirmation time from simulated market time. The user explicitly runs resolution; the result is calculated by `resolveClaim` from Part 2. It shows asset/benchmark metrics, native yield units, selected dates, saved observations, individual range/hold checks, formula version, and provenance. Pending, unclear, and unscored results have their own views without invented win/loss metrics. The stated reasoning remains separate from the result; no AI evidence review is claimed.

The author link opens `/profile?record=demo`, selecting the fictional author's synthetic history even when signed in. A separate live-record tab loads the verified owner's real claims when Supabase is configured. The demo history includes all preloaded examples and newly confirmed copies, including misses, missing-data cases, unclear inputs, and position-only holds. The feed also includes tab-local replays, separately from public live calls.

## Modules and source of truth

| Module                           | Responsibility                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `dataset.ts`                     | Versioned synthetic dataset, demo author, validation, detached claim-copy construction, and resolver request assembly |
| `store.ts`                       | Cached external store using React `useSyncExternalStore`, tab storage, confirmation, and idempotent run timestamps    |
| `presentation.ts`                | Date/metric formatting and synthetic outcome counts                                                                   |
| `components/replay-workflow.tsx` | Original text, reasoning, explicit review, and confirmation                                                           |
| `components/replay-detail.tsx`   | Locked terms, timestamp context, resolution action, and author link                                                   |
| `components/replay-result.tsx`   | Resolver result and calculation evidence presentation; no financial scoring logic                                     |
| `components/replay-history.tsx`  | Complete fictional record and separate owner live-record view                                                         |

No AI/provider credentials are used. Synthetic prices are explicit fixed arrays, not random data or current quotes. No market-data API is called. The dataset includes stocks, ETFs, 5- and 10-year Treasury yields, gold, WTI, Bitcoin, Ethereum, and EUR/USD. Its fixed demonstration schedule covers January 2–10, 2024; those dates do not make the numbers actual historical prices or authoritative exchange calendars.

`evaluateReplay` assembles a request with saved terms and calls the same tested engine. The result is reconstructed from the versioned dataset and saved resolution time. Numeric scores are not stored as author-editable fields. The renderer consumes returned measurements rather than duplicating return calculations. Profile counters use resolver statuses; unclear, pending, and unscored examples are separate from met/not-met counts.

Quoted-value ranges use nominal unadjusted fixture prices; equity/ETF percentage-return tests use split-adjusted fixture inputs. Yield levels stay in percent, and changes use basis points. Fixtures deliberately include one missing required observation and one incompatible adjustment basis to exercise non-scored results.

## Temporary commitment and storage

Confirmation validates terms, copies original text and rationale, assigns a browser UUID, and records the browser clock. The claim version is private and unpublished, with fixed simulated market time stored separately. The UI labels the timestamp as browser confirmation, never server-verified logging. A synchronous guard prevents duplicate confirmation clicks, and a resolution timestamp is assigned only once per record.

`sessionStorage` uses `provenalpha:synthetic-replays:v1`. Existing replay data under the previous platform namespace is validated and copied into the new namespace when no new-format entry exists; the legacy copy is retained. Confirmed replays survive reloads and navigation in the same tab. There is no account, database, real publication, or secure immutability guarantee. Closing the tab, clearing storage, or browser recovery behavior can discard local copies. Some browsers may copy session state when duplicating a tab; there is no synchronization or public sharing service. A replay missing from a tab displays that limitation rather than pretending it is a public claim.

Stored state is schema-validated, bounded to 100 records, and tied to the dataset version and exact catalog identities. Unknown versions, altered fixture selections, public/live contexts, reused seed IDs, or unsupported instruments cannot become displayed results. Corrupted state restores the seven preloaded examples, including misses. Preloaded history is rebuilt from fixtures when restoring state, so hiding a seeded miss in storage does not silently change the sample history. Validation does not protect records from their browser owner's developer tools; all remain explicitly unverified synthetic copies.

When storage access or writes fail, the UI discloses a memory-only fallback. It does not claim persistence succeeded. Draft text before confirmation remains component state and can be lost on navigation/reload; the UI does not advertise autosave.

## Timing and pending outcomes

The simulated commitment is January 2, 2024, before the first fixture fixing. The default horizon is three calendar days. Its fabricated asset moves 100 → 110 while its benchmark moves 100 → 105, producing +10%, +5%, +5 percentage points excess, and met. Confirmation/calculation timestamps are taken when their actions occur, not backdated to January 2024. Preloaded records use clearly labeled fixed fixture timestamps.

Flexible horizons remain available. A target beyond calendar coverage stays active/awaiting data as determined by the engine. The UI never invents later observations to make a multi-year example resolve immediately. Original terms cannot be edited after confirmation through the UI; a new view starts a new replay.

## Next increment

Part 4 prepares authentication, authorization, database privacy policies, atomic server timestamps, idempotent commitment, and append-only history; see [persistence setup](persistence.md). Browser copies cannot establish when a user first forecast something and must not be promoted into verified historical claims or live performance statistics. AI clarification and grounded reasoning review remain later integrations.
