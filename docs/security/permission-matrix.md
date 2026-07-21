# Permission matrix

| Capability               | Tenant admin     | Seller operator | Warehouse operator | Finance operator | Platform admin        |
| ------------------------ | ---------------- | --------------- | ------------------ | ---------------- | --------------------- |
| `tenant.configure`       | Allow own tenant | Deny            | Deny               | Deny             | Allow with context    |
| `inventory.read`         | Allow            | Scoped seller   | Scoped facility    | Read-only        | Allow with context    |
| `inventory.adjust`       | Policy           | Scoped + reason | Scoped + reason    | Deny             | Approval required     |
| `order.override-routing` | Policy           | Deny            | Deny               | Deny             | Approval required     |
| `refund.create`          | Policy           | Scoped request  | Deny               | Allow            | Approval by threshold |
| `payout.approve`         | Deny             | Deny            | Deny               | Dual approval    | Dual approval         |
| `audit.read`             | Scoped           | Own activity    | Own facility       | Finance scope    | Approved context      |

Every allow also requires resolved tenant context and relevant entity attributes.
