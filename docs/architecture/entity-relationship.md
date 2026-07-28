# Core entity relationship diagram

```mermaid
erDiagram
  Tenant ||--o{ TenantDomain : owns
  Tenant ||--o{ User : scopes
  User ||--o{ UserIdentity : authenticates
  User ||--o{ UserSession : opens
  UserSession ||--o{ RefreshToken : rotates
  Tenant ||--o{ Role : defines
  Role ||--o{ RolePermission : grants
  Permission ||--o{ RolePermission : includes
  User ||--o{ UserRole : assigned
  Role ||--o{ UserRole : assigned
  Tenant ||--o{ InventoryItem : owns
  InventoryItem ||--o{ InventoryBalance : derives
  InventoryItem ||--o{ StockLedgerEntry : records
  InventoryItem ||--o{ InventoryReservation : reserves
  Tenant ||--o{ AuditEvent : audits
  Tenant ||--o{ OutboxEvent : publishes
  Tenant ||--o{ IdempotencyRecord : deduplicates
  User ||--o{ FreightRequest : submits
  FreightRequest ||--o{ FreightStop : defines
  FreightRequest ||--o{ CargoItem : carries
  FreightRequest ||--o{ FreightQuote : receives
  FreightQuote ||--o{ FreightQuoteLine : prices
  FreightQuote ||--o| FreightBooking : accepts
  FreightBooking ||--o{ TransportLeg : plans
  FreightBooking ||--o{ TransportMilestone : records
  TransportLeg ||--o| DispatchAssignment : dispatches
  DispatchAssignment ||--o{ DriverCheckIn : reports
  FreightBooking ||--o{ FreightException : raises
  FreightBooking ||--o| ProofOfDelivery : proves
  FreightBooking ||--o| Invoice : bills
  Invoice ||--o{ InvoicePaymentSchedule : schedules
  InvoicePaymentSchedule ||--o{ PaymentSession : opens
  PaymentSession ||--o{ PaymentEvent : receives
  Invoice ||--o{ PaymentAllocation : allocates
  PaymentSession ||--o{ Refund : refunds
  FreightBooking ||--o{ TransportConsignment : contains
  TransportConsignment ||--o{ TransportDocument : evidences
  TransportConsignment ||--o{ CustomsFiling : declares
  FreightRequest ||--o{ CargoInsuranceQuote : insures
  CargoInsuranceQuote ||--o| CargoInsurancePolicy : binds
  CargoInsurancePolicy ||--o{ CargoInsuranceClaim : receives
  LogisticsHub ||--o{ HandlingUnit : holds
  HandlingUnit ||--o{ HandlingEvent : records
  ConsolidationPlan ||--o{ ConsolidationMember : groups
  ConsolidationPlan ||--o{ ConsolidationLoad : loads
  InternationalLinehaul ||--o{ InternationalLinehaulAllocation : shares
  PostalOperator ||--o{ PostalItem : accepts
  PostalReceptacle ||--o{ PostalReceptacleItem : contains
  PostalDispatch ||--o{ PostalDispatchReceptacle : groups
  PostalConsignment ||--o{ PostalConsignmentReceptacle : transports
  PostalItem ||--o{ PostalEvent : tracks
```

This is a deliberately compact relationship map. The Prisma schema is
authoritative for optionality, indexes, revision links, legacy invoice
compatibility, carrier/driver/vehicle ownership, document metadata, journal
postings, and every other implemented domain.
