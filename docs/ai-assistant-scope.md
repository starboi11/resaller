# Resaller AI assistant scope

The MVP assistant is a clearly labelled, read-only guidance layer.

## Included now

- Product discovery and comparison use active public catalog records only.
- Order guidance requires an authenticated buyer or an authorized member of the order's store.
- Seller-form guidance requires access to the selected store.
- Every request is rate limited and audited without storing the raw user prompt.
- Common prompt-injection and secret-extraction attempts are refused.
- The assistant cannot mutate orders, inventory, roles, moderation decisions, or payment state.

## Provider decision

The current implementation is deterministic and provider-neutral. It provides a working, grounded safety baseline without sending user data to a third party.

A production generative-model provider remains a launch gate. The owner must approve:

- per-request and monthly cost budget;
- data-processing region and retention period;
- whether provider training on submitted data is disabled;
- contract/DPA and incident-response terms;
- model quality in Uzbek and Russian;
- fallback behavior and a hard spend limit.

Adding a provider must preserve server-side authorization, source grounding, refusal rules, audit records, and read-only behavior.
