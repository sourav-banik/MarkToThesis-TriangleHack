# Part 6: Claude claim parsing and clarification

Part 6 adds an authenticated, server-only Claude adapter and a clarification workflow on `/new`. It uses the existing Supabase migrations. It does not retrieve prices, calculate outcomes, generate investing advice, or publish a call.

## Configure and try it

Set these server variables in `.env.local`:

```dotenv
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

Never commit the key or add a `NEXT_PUBLIC_` prefix. The model setting is optional; the pinned Haiku 4.5 model above is the default. An accessible model must support Claude structured JSON outputs. See [Claude model documentation](https://platform.claude.com/docs/en/models/overview) for your account's available models.

Restart `npm run dev` after changing environment settings, sign in, and open `/new`:

1. Enter the original market call and any reasoning. **Clarify with Claude** is the default for signed-in authors; **Define manually** remains available.
2. Select **Make this call testable**. Only this explicit action sends the original call, reasoning, and any clarification answers to Anthropic. Account emails, credentials, previous private calls, and market prices are not added to the prompt.
3. Answer the questions for missing terms, then select **Update proposal**. For example, “Apple should outperform the market” needs an explicit benchmark and horizon. Unstated confidence stays empty.
4. Select **Use proposed terms** to prefill the manual workbench. It does not save or timestamp a claim. Edit the exact instrument, prediction, units, bounds, horizon, confidence, reasoning, and extracted assumptions.
5. Select **Review live claim**, inspect the original words and final terms, then **Confirm & save live claim**. The existing authenticated commitment endpoint and database supply ownership, timestamp, and immutable history.

Editing the original after applying an AI proposal returns to clarification so the old extraction is not silently reused. Editing source text during parsing cancels the request and discards late responses. API errors leave the author's text available and manual entry usable.

Clarification transcripts and model metadata are temporary UI state, not part of the database claim version in this increment. Confirmed original text, final terms, reasoning, and assumptions are persisted by the existing commitment flow. Refreshing or closing the page can discard an uncommitted conversation.

## Responsibilities

| Module                                            | Responsibility                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/features/ai/parser-contracts.ts`             | Bounded request/extraction/response schemas and a simplified provider JSON schema                         |
| `src/features/ai/prompt.ts`                       | Versioned extraction instructions and canonical catalog context                                           |
| `src/features/ai/claude.ts`                       | Messages API transport, timeout/cancellation, response limits, and safe provider errors                   |
| `src/features/ai/normalize.ts`                    | Grounding checks, canonical identities, deterministic required-field questions, and commitment validation |
| `src/features/ai/limits.ts`                       | Per-process account request limits and concurrent-request guard                                           |
| `src/features/ai/components/claude-assistant.tsx` | Clarification questions, proposal preview, cancellation, and explicit application                         |
| `src/features/claims/conventions.ts`              | Shared platform rules, independent of AI and synthetic examples                                           |
| `src/app/api/claims/parse/route.ts`               | Thin authenticated HTTP boundary                                                                          |

The transport uses `POST https://api.anthropic.com/v1/messages`, `x-api-key`, API version `2023-06-01`, and `output_config.format` with `type: json_schema`. No Gemini client, key, or fallback is used. There is no tool execution, web browsing, or price access in the model request. The implementation follows [Claude structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

## Validation and trust

Claude returns partial extracted fields, each with a source quote, rather than authoritatively declaring a call complete. Code maps IDs to canonical instruments and rejects an identity quote that names a different asset or only a vague benchmark. Populated fields require nonempty quotes that occur in the original text, the author's reasoning, or clarification **answers**; the app does not use its own questions as evidence. Rationale and assumption text must also occur verbatim in the author's input.

Source matching limits invention; it does not prove that a model interpreted the text correctly. In particular, semantic interpretation of dates, direction, units, and qualifications still needs the author's explicit review. Prompt injection remains untrusted input; the model has no secrets or persistence tools in its prompt. Final publication uses the existing deterministic schema and database validation regardless of how fields were entered.

The server supplies missing-field questions and runs the existing commitment schema. It checks instrument/benchmark compatibility, yield-versus-price units, positive tolerances, ordered bounds, date horizons, and live source bindings. Comparisons use the fixed endpoint convention; ranges and neutral holds require explicit evaluation timing. Both hold meanings remain supported. A position-only hold can use a canonical asset without a price provider and stays unscored.

The model must not silently replace an index with SPY, spot gold with GLD, oil futures with WTI spot, or invent a benchmark. Unsupported references and ambiguous horizons need clarification. Price-return conventions exclude dividends; an explicit total-return request requires agreement to price return instead. Provider source bindings still limit live measurable claims. The parser does not expand the supported instrument catalog.

The provider schema uses required nullable values and nonnullable quote strings to stay within structured-output union limits. Unsupported provider-schema constraints are removed only from the transmitted schema; Zod applies the complete constraints to the returned JSON. Refusal, truncation, malformed JSON, extra extraction fields, missing configuration, provider auth/billing errors, overload, and timeouts produce honest errors without importing partial output or exposing provider messages/credentials.

`GET /api/claims/parse` exposes only whether Claude is configured and the provider name. `POST` requires same-origin JSON, fresh verified authentication, and a bounded body. It accepts only original text, reasoning, and up to 16 bounded clarification answers. It cannot accept owner IDs, timestamps, prices, outcomes, or model selection. Responses disable caching.

The local guard allows one in-flight call and six calls per account per minute per server process. It is a best-effort MVP limit; multiple instances or process restarts do not share a durable quota. Provider output is limited to 3,000 tokens, the response body to 128 KiB, and transport time to 45 seconds. The route allows 60 seconds. There are no automatic billable retries. Deployment-wide quotas would require a shared limiter.

## Checks and limits

`npm run check` tests normalization, missing terms, source grounding, both hold meanings, range/yield units, invalid/past dates, total-return requests, provider errors, cancellation, schema complexity, rate limits, and the authenticated route boundary. Browser fixtures test the full question/proposal/edit/review path, original-word preservation, range-unit retention, assumptions, failure fallback, and stale-response rejection. They do not create real accounts or claims and explicitly clear the API key from the test server.

With credentials configured, `npm run check:claude` makes two small real API requests using synthetic calls: one explicit comparison and one vague call requiring a benchmark and horizon. It incurs normal API usage, prints only example text/model/readiness/missing fields, and creates no database records. Unit and browser suites do not call Claude. Real hosted sign-in/email confirmation and authenticated claim saving still require a signed-in project account.

The synthetic replay remains manual in this increment. Grounded AI reviews of rationale, evidence retrieval, market-data adapters, and live resolution remain later work; a parser proposal is not evidence that a thesis was correct.
