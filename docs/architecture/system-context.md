# System context

```mermaid
flowchart LR
  buyers[Consumers and business buyers] --> web[Next.js web]
  coordinators[Freight operators and driver coordinators] --> web
  operators[Sellers, suppliers, warehouse, carrier and platform operators] --> web
  partners[External shops and providers] --> api[NestJS REST API]
  web --> api
  api --> mysql[(MySQL)]
  api --> redis[(Redis)]
  api --> objects[(S3-compatible storage)]
  worker[Worker] --> mysql
  worker --> redis
  worker --> objects
  worker --> providers[Payment, tax, carrier, email and verification adapters]
  api --> payments[Stripe Checkout / Coinbase Business Checkout]
```

The reverse proxy is the public ingress. Tenant context is resolved from a
verified host, authenticated principal, or scoped credential—not a normal body field.

Authenticated consumers and business users submit freight requests and follow
quotes, invoices, hosted payment, and booking milestones. Road coordinators
record reported locations manually; sea, air, and rail events are
operator/provider milestones. No driver application or live GPS provider is
part of the current context.
