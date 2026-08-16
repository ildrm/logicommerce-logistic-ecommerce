ALTER TABLE `CreditNote`
  ADD COLUMN `idempotencyKey` VARCHAR(160) NULL;

ALTER TABLE `InvoicePaymentSchedule`
  ADD COLUMN `checkoutLockKey` VARCHAR(160) NULL,
  ADD COLUMN `checkoutLockUntil` DATETIME(3) NULL;

ALTER TABLE `ReturnAuthorization`
  ADD COLUMN `idempotencyKey` VARCHAR(160) NULL;

CREATE UNIQUE INDEX `CreditNote_tenantId_idempotencyKey_key`
  ON `CreditNote`(`tenantId`, `idempotencyKey`);

CREATE UNIQUE INDEX `ReturnAuthorization_tenantId_idempotencyKey_key`
  ON `ReturnAuthorization`(`tenantId`, `idempotencyKey`);

CREATE TABLE `AsnReceiptCommand` (
  `id` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `asnId` CHAR(36) NOT NULL,
  `idempotencyKey` VARCHAR(160) NOT NULL,
  `payloadHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `AsnReceiptCommand_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
  INDEX `AsnReceiptCommand_tenantId_asnId_createdAt_idx`(`tenantId`, `asnId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AsnReceiptCommand`
  ADD CONSTRAINT `AsnReceiptCommand_asnId_fkey`
  FOREIGN KEY (`asnId`) REFERENCES `AdvanceShippingNotice`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX `SettlementLine_tenantId_journalEntryId_idx` ON `SettlementLine`;

-- This intentionally fails if a historical journal was assigned to multiple
-- settlements. Such rows require financial review rather than silent deletion.
CREATE UNIQUE INDEX `SettlementLine_tenantId_journalEntryId_key`
  ON `SettlementLine`(`tenantId`, `journalEntryId`);
