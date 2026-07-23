# Permission matrix

| Capability               | Tenant admin     | Seller operator | Warehouse operator | Finance operator  | Platform admin        |
| ------------------------ | ---------------- | --------------- | ------------------ | ----------------- | --------------------- |
| `tenant.configure`       | Allow own tenant | Deny            | Deny               | Deny              | Allow with context    |
| `inventory.read`         | Allow            | Scoped seller   | Scoped facility    | Read-only         | Allow with context    |
| `inventory.adjust`       | Policy           | Scoped + reason | Scoped + reason    | Deny              | Approval required     |
| `order.override-routing` | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `refund.create`          | Policy           | Scoped request  | Deny               | Allow             | Approval by threshold |
| `payout.approve`         | Deny             | Deny            | Deny               | Dual approval     | Dual approval         |
| `audit.read`             | Scoped           | Own activity    | Own facility       | Finance scope     | Approved context      |
| `facility.manage`        | Allow            | Deny            | Scoped facility    | Deny              | Allow with context    |
| `receiving.manage`       | Allow            | Deny            | Scoped facility    | Deny              | Allow with context    |
| `fulfillment.manage`     | Allow            | Scoped orders   | Scoped facility    | Deny              | Allow with context    |
| `shipment.manage`        | Allow            | Scoped orders   | Scoped facility    | Deny              | Allow with context    |
| `tracking.ingest`        | Allow            | Deny            | Scoped carrier     | Deny              | Allow with context    |
| `c2c.trade`              | Allow            | Own activity    | Deny               | Deny              | Allow with context    |
| `c2c.moderate`           | Allow            | Deny            | Deny               | Payout review     | Allow with context    |
| `b2b.manage`             | Allow            | Deny            | Deny               | Read-only         | Allow with context    |
| `b2b.buy`                | Allow            | Deny            | Deny               | Read-only         | Allow with context    |
| `b2b.sell`               | Allow            | Scoped seller   | Deny               | Deny              | Allow with context    |
| `b2b.approve`            | Allow            | Deny            | Deny               | Policy            | Allow with context    |
| `partner.manage`         | Allow            | Deny            | Deny               | Deny              | Allow with context    |
| `webhook.manage`         | Allow            | Scoped partner  | Deny               | Deny              | Allow with context    |
| `return.use`             | Allow            | Own orders      | Deny               | Read-only         | Allow with context    |
| `return.manage`          | Allow            | Scoped request  | Receive/inspect    | Read-only         | Allow with context    |
| `finance.manage`         | Allow            | Deny            | Deny               | Allow             | Approval required     |
| `settlement.manage`      | Allow            | Own statements  | Deny               | Allow             | Approval required     |
| `settlement.approve`     | Policy           | Deny            | Deny               | Allow             | Dual approval         |
| `settlement.pay`         | Policy           | Deny            | Deny               | Policy            | Dual approval         |
| `3pl.manage`             | Allow            | Scoped client   | Read assigned      | Read-only         | Allow with context    |
| `3pl.operate`            | Allow            | Scoped client   | Scoped client      | Deny              | Allow with context    |
| `3pl.bill`               | Allow            | Scoped client   | Record events      | Allow             | Allow with context    |
| `4pl.control`            | Allow            | Deny            | Propose            | Read-only         | Allow with context    |
| `4pl.approve`            | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `optimization.manage`    | Allow            | Deny            | Read-only          | Read-only         | Allow with context    |
| `optimization.approve`   | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `optimization.execute`   | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `operability.read`       | Allow            | Deny            | Scoped dashboards  | Scoped dashboards | Allow with context    |
| `operability.manage`     | Policy           | Deny            | Deny               | Deny              | Approval required     |
| `privacy.manage`         | Policy           | Deny            | Deny               | Deny              | Approval required     |

Every allow also requires resolved tenant context and relevant entity attributes.
