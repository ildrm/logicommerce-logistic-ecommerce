# Permission matrix

| Capability                    | Tenant admin     | Seller operator | Warehouse operator | Finance operator  | Platform admin        |
| ----------------------------- | ---------------- | --------------- | ------------------ | ----------------- | --------------------- |
| `tenant.configure`            | Allow own tenant | Deny            | Deny               | Deny              | Allow with context    |
| `inventory.read`              | Allow            | Scoped seller   | Scoped facility    | Read-only         | Allow with context    |
| `inventory.adjust`            | Policy           | Scoped + reason | Scoped + reason    | Deny              | Approval required     |
| `order.override-routing`      | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `refund.create`               | Policy           | Scoped request  | Deny               | Allow             | Approval by threshold |
| `payout.approve`              | Deny             | Deny            | Deny               | Dual approval     | Dual approval         |
| `audit.read`                  | Scoped           | Own activity    | Own facility       | Finance scope     | Approved context      |
| `facility.manage`             | Allow            | Deny            | Scoped facility    | Deny              | Allow with context    |
| `receiving.manage`            | Allow            | Deny            | Scoped facility    | Deny              | Allow with context    |
| `fulfillment.manage`          | Allow            | Scoped orders   | Scoped facility    | Deny              | Allow with context    |
| `shipment.manage`             | Allow            | Scoped orders   | Scoped facility    | Deny              | Allow with context    |
| `tracking.ingest`             | Allow            | Deny            | Scoped carrier     | Deny              | Allow with context    |
| `c2c.trade`                   | Allow            | Own activity    | Deny               | Deny              | Allow with context    |
| `c2c.moderate`                | Allow            | Deny            | Deny               | Payout review     | Allow with context    |
| `b2b.manage`                  | Allow            | Deny            | Deny               | Read-only         | Allow with context    |
| `b2b.buy`                     | Allow            | Deny            | Deny               | Read-only         | Allow with context    |
| `b2b.sell`                    | Allow            | Scoped seller   | Deny               | Deny              | Allow with context    |
| `b2b.approve`                 | Allow            | Deny            | Deny               | Policy            | Allow with context    |
| `partner.manage`              | Allow            | Deny            | Deny               | Deny              | Allow with context    |
| `webhook.manage`              | Allow            | Scoped partner  | Deny               | Deny              | Allow with context    |
| `return.use`                  | Allow            | Own orders      | Deny               | Read-only         | Allow with context    |
| `return.manage`               | Allow            | Scoped request  | Receive/inspect    | Read-only         | Allow with context    |
| `finance.manage`              | Allow            | Deny            | Deny               | Allow             | Approval required     |
| `settlement.manage`           | Allow            | Own statements  | Deny               | Allow             | Approval required     |
| `settlement.approve`          | Policy           | Deny            | Deny               | Allow             | Dual approval         |
| `settlement.pay`              | Policy           | Deny            | Deny               | Policy            | Dual approval         |
| `3pl.manage`                  | Allow            | Scoped client   | Read assigned      | Read-only         | Allow with context    |
| `3pl.operate`                 | Allow            | Scoped client   | Scoped client      | Deny              | Allow with context    |
| `3pl.bill`                    | Allow            | Scoped client   | Record events      | Allow             | Allow with context    |
| `4pl.control`                 | Allow            | Deny            | Propose            | Read-only         | Allow with context    |
| `4pl.approve`                 | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `optimization.manage`         | Allow            | Deny            | Read-only          | Read-only         | Allow with context    |
| `optimization.approve`        | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `optimization.execute`        | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `operability.read`            | Allow            | Deny            | Scoped dashboards  | Scoped dashboards | Allow with context    |
| `operability.manage`          | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `privacy.manage`              | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `transport.request.use`       | Allow            | Own requests    | Deny               | Read-only         | Allow with context    |
| `transport.request.manage`    | Allow            | Deny            | Read queue         | Read-only         | Allow with context    |
| `transport.quote.manage`      | Allow            | Deny            | Deny               | Read-only         | Allow with context    |
| `transport.carrier.manage`    | Allow            | Deny            | Scoped carriers    | Deny              | Allow with context    |
| `transport.dispatch.read`     | Allow            | Deny            | Scoped dispatch    | Read-only         | Allow with context    |
| `transport.assignment.manage` | Allow            | Deny            | Scoped dispatch    | Deny              | Allow with context    |
| `transport.checkin.write`     | Allow            | Deny            | Driver coordinator | Deny              | Allow with context    |
| `transport.exception.manage`  | Allow            | Deny            | Driver coordinator | Read-only         | Allow with context    |
| `billing.invoice.read`        | Allow            | Own invoices    | Deny               | Allow             | Allow with context    |
| `billing.manage`              | Allow            | Deny            | Deny               | Allow             | Approval required     |
| `payment.use`                 | Allow            | Own invoices    | Deny               | Policy            | Allow with context    |

Every allow also requires resolved tenant context and relevant entity attributes.

The seeded `driver-coordinator` role receives only
`transport.dispatch.read`, `transport.assignment.manage`,
`transport.checkin.write`, and `transport.exception.manage`. It receives no
quotation, carrier-administration, billing, payment, tenant, identity, or
platform permission.
