# Integration architecture

Core services depend on **interfaces**, never on Stripe/Razorpay/WhatsApp SDKs directly.

```text
Provider SDK/HTTP
    → Adapter (integrations/<category>/<provider>)
    → Normalizer (internal DTO)
    → Port interface (packages/types)
    → Domain service
```

## Ports (Phase 12 implements adapters; Phase 0 may stub)

| Port | Methods (illustrative) | Mock |
| --- | --- | --- |
| `PaymentGateway` | createIntent, capture, refund, parseWebhook | `MockPaymentGateway` succeeds in dev |
| `SmsProvider` | send | logs in dev |
| `EmailProvider` | sendTemplate | logs in dev |
| `WhatsAppProvider` | sendSessionMessage | mock |
| `MapsProvider` | geocode, distance, staticUrl | mock |
| `AccountingExport` | exportJournal | file mock |
| `FoodDeliveryChannel` | ingestOrder, pushStatus, menuSync | mock until partner keys exist |

## Rules

- Credentials in `integration_accounts`, encrypted (AES-256-GCM, `INTEGRATION_KEK` or JWT secret fallback)
- GET `/integration-accounts` returns `credentialsMasked` booleans only — never ciphertext or plaintext
- Webhooks hit `/api/v1/webhooks/:provider` — mock adapter parses, stores `integration_events`, 200 quickly
- Timeouts and retries only in workers
- Do not mark a provider production-ready without verified sandbox/production access
- Feature flags per org: `payments.razorpay.enabled` (not enabled)

## T-1204 Payment provider (skipped)

No Razorpay (or other PSP) sandbox keys were available in this environment, so **no live adapter is implemented**. `createPaymentGateway()` always returns `MockPaymentGateway`. That mock is for local/dev/tests only and is **not** a production payment processor.

When verified sandbox keys exist: add `integrations/src/payment/razorpay.ts` that implements `PaymentGateway`, call Razorpay Orders/Payments APIs, verify webhook signatures, and select it from `createPaymentGateway` only if `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set. Do not ship a stub that claims to be live.

## Normalization

External order → internal `ONLINE` order with `source = 'qr' | 'web' | 'partner:*'`. Partner payloads never leak into `orders` JSON as the only representation; store raw copy in `integration_events` for debug.
