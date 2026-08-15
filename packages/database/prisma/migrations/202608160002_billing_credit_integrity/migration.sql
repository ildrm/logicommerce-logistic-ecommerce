ALTER TABLE `BillingInvoice`
  ADD COLUMN `creditedMinor` BIGINT NOT NULL DEFAULT 0 AFTER `paidMinor`;

ALTER TABLE `InvoicePaymentSchedule`
  ADD COLUMN `creditedMinor` BIGINT NOT NULL DEFAULT 0 AFTER `paidMinor`;
