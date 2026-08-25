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

- Credentials in `integration_accounts`, encrypted
- Webhooks hit `/api/v1/webhooks/:provider` — verify signature, enqueue, 200 quickly
- Timeouts and retries only in workers
- Do not mark a provider production-ready without verified sandbox/production access
- Feature flags per org: `payments.razorpay.enabled`

## Normalization

External order → internal `ONLINE` order with `source = 'qr' | 'web' | 'partner:*'`. Partner payloads never leak into `orders` JSON as the only representation; store raw copy in `integration_events` for debug.
