-- Production release hardening: provider evidence, scoped sellers, durable processing, and uploads.

ALTER TABLE `MfaCredential`
  ADD COLUMN `pendingSecretCiphertext` VARCHAR(512) NULL,
  ADD COLUMN `pendingCreatedAt` DATETIME(3) NULL;

CREATE TABLE `SellerMember` (
  `id` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `sellerId` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SellerMember_tenantId_sellerId_userId_key`(`tenantId`, `sellerId`, `userId`),
  INDEX `SellerMember_tenantId_userId_sellerId_idx`(`tenantId`, `userId`, `sellerId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SellerMember_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `Seller`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SellerMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `C2COffer`
  ADD COLUMN `paymentProvider` VARCHAR(40) NULL,
  ADD COLUMN `paymentReference` VARCHAR(240) NULL,
  ADD COLUMN `paymentIdempotencyKey` VARCHAR(160) NULL;

UPDATE `C2COffer`
SET `paymentProvider` = 'LEGACY_UNVERIFIED',
    `paymentReference` = CONCAT('legacy:', `id`),
    `paymentIdempotencyKey` = CONCAT('legacy:', `id`)
WHERE `paymentProvider` IS NULL;

ALTER TABLE `C2COffer`
  MODIFY `paymentProvider` VARCHAR(40) NOT NULL,
  MODIFY `paymentReference` VARCHAR(240) NOT NULL,
  MODIFY `paymentIdempotencyKey` VARCHAR(160) NOT NULL,
  ADD UNIQUE INDEX `C2COffer_tenantId_paymentIdempotencyKey_key`(`tenantId`, `paymentIdempotencyKey`),
  ADD UNIQUE INDEX `C2COffer_paymentProvider_paymentReference_key`(`paymentProvider`, `paymentReference`);

ALTER TABLE `C2CTransaction`
  ADD COLUMN `paymentProvider` VARCHAR(40) NULL,
  ADD COLUMN `paymentReference` VARCHAR(240) NULL;

UPDATE `C2CTransaction`
SET `paymentProvider` = 'LEGACY_UNVERIFIED',
    `paymentReference` = CONCAT('legacy:', `id`)
WHERE `paymentProvider` IS NULL;

ALTER TABLE `C2CTransaction`
  MODIFY `paymentProvider` VARCHAR(40) NOT NULL,
  MODIFY `paymentReference` VARCHAR(240) NOT NULL,
  MODIFY `status` ENUM('AWAITING_PAYMENT', 'PAYMENT_HELD', 'SHIPPED', 'DELIVERED', 'DISPUTED', 'PAYOUT_ELIGIBLE', 'COMPLETED', 'CANCELLED') NOT NULL;

UPDATE `C2CTransaction`
SET `status` = 'AWAITING_PAYMENT'
WHERE `paymentProvider` = 'LEGACY_UNVERIFIED' AND `status` = 'PAYMENT_HELD';

ALTER TABLE `WebhookDelivery`
  MODIFY `status` ENUM('PENDING', 'PROCESSING', 'RETRYING', 'DELIVERED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `PaymentRefund`
  ADD COLUMN `idempotencyKey` VARCHAR(160) NULL,
  ADD COLUMN `appliedAt` DATETIME(3) NULL,
  ADD COLUMN `lastError` VARCHAR(1000) NULL;

UPDATE `PaymentRefund`
SET `idempotencyKey` = CONCAT('legacy-refund:', `id`),
    `appliedAt` = CASE WHEN `status` = 'COMPLETED' THEN COALESCE(`completedAt`, `createdAt`) ELSE NULL END
WHERE `idempotencyKey` IS NULL;

ALTER TABLE `PaymentRefund`
  MODIFY `idempotencyKey` VARCHAR(160) NOT NULL,
  ADD UNIQUE INDEX `PaymentRefund_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`);

ALTER TABLE `FreightDocument`
  ADD COLUMN `scanReference` VARCHAR(240) NULL,
  ADD COLUMN `uploadedAt` DATETIME(3) NULL,
  ADD COLUMN `verifiedAt` DATETIME(3) NULL;

CREATE TABLE `C2CPaymentRelease` (
  `id` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `offerId` CHAR(36) NOT NULL,
  `paymentProvider` VARCHAR(40) NOT NULL,
  `paymentReference` VARCHAR(240) NOT NULL,
  `paymentIdempotencyKey` VARCHAR(160) NOT NULL,
  `status` ENUM('PENDING', 'PROCESSING', 'RETRYING', 'RELEASED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lockedUntil` DATETIME(3) NULL,
  `releasedAt` DATETIME(3) NULL,
  `lastError` VARCHAR(1000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `C2CPaymentRelease_offerId_key`(`offerId`),
  UNIQUE INDEX `C2CPaymentRelease_paymentProvider_paymentReference_key`(`paymentProvider`, `paymentReference`),
  INDEX `C2CPaymentRelease_status_availableAt_lockedUntil_idx`(`status`, `availableAt`, `lockedUntil`),
  INDEX `C2CPaymentRelease_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
