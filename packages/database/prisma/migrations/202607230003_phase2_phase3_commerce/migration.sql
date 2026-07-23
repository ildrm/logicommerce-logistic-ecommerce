-- DropForeignKey
ALTER TABLE `AuditEvent` DROP FOREIGN KEY `Audit_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `IdempotencyRecord` DROP FOREIGN KEY `Idempotency_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `InventoryBalance` DROP FOREIGN KEY `InventoryBalance_item_fkey`;

-- DropForeignKey
ALTER TABLE `InventoryReservation` DROP FOREIGN KEY `Reservation_item_fkey`;

-- DropForeignKey
ALTER TABLE `OutboxEvent` DROP FOREIGN KEY `Outbox_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `StockLedgerEntry` DROP FOREIGN KEY `StockLedger_item_fkey`;

-- AlterTable
ALTER TABLE `InventoryReservation` ADD COLUMN `allocatedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Store` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `defaultLocale` VARCHAR(20) NOT NULL DEFAULT 'en',
    `defaultCurrency` CHAR(3) NOT NULL DEFAULT 'USD',
    `branding` JSON NULL,
    `seo` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Store_tenantId_status_deletedAt_idx`(`tenantId`, `status`, `deletedAt`),
    UNIQUE INDEX `Store_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoreDomain` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `hostname` VARCHAR(253) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StoreDomain_hostname_key`(`hostname`),
    INDEX `StoreDomain_tenantId_storeId_idx`(`tenantId`, `storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `parentId` CHAR(36) NULL,
    `slug` VARCHAR(160) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Category_tenantId_storeId_parentId_deletedAt_idx`(`tenantId`, `storeId`, `parentId`, `deletedAt`),
    UNIQUE INDEX `Category_tenantId_storeId_slug_key`(`tenantId`, `storeId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttributeDefinition` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `kind` ENUM('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT') NOT NULL,
    `isVariant` BOOLEAN NOT NULL DEFAULT false,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttributeDefinition_tenantId_storeId_isVariant_idx`(`tenantId`, `storeId`, `isVariant`),
    UNIQUE INDEX `AttributeDefinition_tenantId_storeId_key_key`(`tenantId`, `storeId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttributeOption` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `attributeId` CHAR(36) NOT NULL,
    `value` VARCHAR(160) NOT NULL,
    `label` VARCHAR(160) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttributeOption_tenantId_attributeId_sortOrder_idx`(`tenantId`, `attributeId`, `sortOrder`),
    UNIQUE INDEX `AttributeOption_tenantId_attributeId_value_key`(`tenantId`, `attributeId`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `metadata` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Supplier_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `Supplier_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Seller` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `metadata` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Seller_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `Seller_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSubmission` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `supplierId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `locale` VARCHAR(20) NOT NULL DEFAULT 'en',
    `seo` JSON NULL,
    `media` JSON NULL,
    `attributes` JSON NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` CHAR(36) NULL,
    `reviewNote` VARCHAR(1000) NULL,
    `productId` CHAR(36) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductSubmission_productId_key`(`productId`),
    INDEX `ProductSubmission_tenantId_storeId_status_createdAt_idx`(`tenantId`, `storeId`, `status`, `createdAt`),
    INDEX `ProductSubmission_tenantId_supplierId_status_idx`(`tenantId`, `supplierId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSubmissionVariant` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `submissionId` CHAR(36) NOT NULL,
    `sku` VARCHAR(120) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `attributes` JSON NULL,
    `barcode` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductSubmissionVariant_tenantId_submissionId_idx`(`tenantId`, `submissionId`),
    UNIQUE INDEX `ProductSubmissionVariant_tenantId_submissionId_sku_key`(`tenantId`, `submissionId`, `sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NULL,
    `supplierId` CHAR(36) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `seo` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Product_tenantId_storeId_status_deletedAt_idx`(`tenantId`, `storeId`, `status`, `deletedAt`),
    INDEX `Product_tenantId_categoryId_status_idx`(`tenantId`, `categoryId`, `status`),
    UNIQUE INDEX `Product_tenantId_storeId_slug_key`(`tenantId`, `storeId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductTranslation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `locale` VARCHAR(20) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `seo` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductTranslation_tenantId_locale_productId_idx`(`tenantId`, `locale`, `productId`),
    UNIQUE INDEX `ProductTranslation_tenantId_productId_locale_key`(`tenantId`, `productId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductMedia` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `altText` VARCHAR(500) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductMedia_tenantId_productId_sortOrder_idx`(`tenantId`, `productId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductAttributeValue` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `attributeId` CHAR(36) NOT NULL,
    `optionId` CHAR(36) NULL,
    `value` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductAttributeValue_tenantId_attributeId_optionId_idx`(`tenantId`, `attributeId`, `optionId`),
    UNIQUE INDEX `ProductAttributeValue_tenantId_productId_attributeId_key`(`tenantId`, `productId`, `attributeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariant` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `sku` VARCHAR(120) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `barcode` VARCHAR(80) NULL,
    `attributes` JSON NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 1,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductVariant_tenantId_productId_status_deletedAt_idx`(`tenantId`, `productId`, `status`, `deletedAt`),
    UNIQUE INDEX `ProductVariant_tenantId_sku_key`(`tenantId`, `sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Offer` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `sellerId` CHAR(36) NOT NULL,
    `supplierId` CHAR(36) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `priceMinor` BIGINT NOT NULL,
    `compareAtMinor` BIGINT NULL,
    `minimumQuantity` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `availableFrom` DATETIME(3) NULL,
    `availableTo` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Offer_tenantId_storeId_status_priceMinor_idx`(`tenantId`, `storeId`, `status`, `priceMinor`),
    INDEX `Offer_tenantId_supplierId_status_idx`(`tenantId`, `supplierId`, `status`),
    UNIQUE INDEX `Offer_tenantId_storeId_variantId_sellerId_key`(`tenantId`, `storeId`, `variantId`, `sellerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Promotion` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `kind` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` INTEGER NOT NULL,
    `minimumMinor` BIGINT NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Promotion_tenantId_storeId_isActive_startsAt_endsAt_idx`(`tenantId`, `storeId`, `isActive`, `startsAt`, `endsAt`),
    UNIQUE INDEX `Promotion_tenantId_storeId_code_key`(`tenantId`, `storeId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryFeed` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `inventoryItemId` CHAR(36) NOT NULL,
    `source` VARCHAR(120) NOT NULL,
    `externalKey` VARCHAR(160) NOT NULL,
    `quantity` BIGINT NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryFeed_tenantId_inventoryItemId_processedAt_idx`(`tenantId`, `inventoryItemId`, `processedAt`),
    UNIQUE INDEX `InventoryFeed_tenantId_source_externalKey_key`(`tenantId`, `source`, `externalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cart` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'CHECKED_OUT', 'ABANDONED') NOT NULL DEFAULT 'ACTIVE',
    `currency` CHAR(3) NOT NULL,
    `promotionCode` VARCHAR(80) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Cart_tenantId_userId_storeId_status_idx`(`tenantId`, `userId`, `storeId`, `status`),
    INDEX `Cart_tenantId_expiresAt_status_idx`(`tenantId`, `expiresAt`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `cartId` CHAR(36) NOT NULL,
    `offerId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPriceMinor` BIGINT NOT NULL,
    `offerVersion` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CartLine_tenantId_cartId_idx`(`tenantId`, `cartId`),
    UNIQUE INDEX `CartLine_tenantId_cartId_offerId_key`(`tenantId`, `cartId`, `offerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerAddress` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `recipient` VARCHAR(160) NOT NULL,
    `line1` VARCHAR(240) NOT NULL,
    `line2` VARCHAR(240) NULL,
    `city` VARCHAR(120) NOT NULL,
    `region` VARCHAR(120) NULL,
    `postalCode` VARCHAR(40) NOT NULL,
    `countryCode` CHAR(2) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerAddress_tenantId_userId_idx`(`tenantId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `cartId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentStatus` ENUM('AUTHORIZED', 'FAILED', 'VOIDED') NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotalMinor` BIGINT NOT NULL,
    `discountMinor` BIGINT NOT NULL,
    `taxMinor` BIGINT NOT NULL,
    `shippingMinor` BIGINT NOT NULL,
    `totalMinor` BIGINT NOT NULL,
    `addressSnapshot` JSON NOT NULL,
    `paymentReference` VARCHAR(160) NOT NULL,
    `fraudDecision` VARCHAR(40) NOT NULL,
    `idempotencyKey` VARCHAR(160) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_cartId_key`(`cartId`),
    INDEX `Order_tenantId_userId_createdAt_idx`(`tenantId`, `userId`, `createdAt`),
    INDEX `Order_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    UNIQUE INDEX `Order_tenantId_number_key`(`tenantId`, `number`),
    UNIQUE INDEX `Order_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `offerId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `sellerId` CHAR(36) NOT NULL,
    `supplierId` CHAR(36) NOT NULL,
    `sku` VARCHAR(120) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPriceMinor` BIGINT NOT NULL,
    `lineTotalMinor` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderLine_tenantId_orderId_idx`(`tenantId`, `orderId`),
    INDEX `OrderLine_tenantId_supplierId_sellerId_idx`(`tenantId`, `supplierId`, `sellerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderSplit` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `sellerId` CHAR(36) NOT NULL,
    `supplierId` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `subtotalMinor` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderSplit_tenantId_supplierId_status_idx`(`tenantId`, `supplierId`, `status`),
    UNIQUE INDEX `OrderSplit_tenantId_orderId_sellerId_supplierId_key`(`tenantId`, `orderId`, `sellerId`, `supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DropshipPurchaseOrder` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderSplitId` CHAR(36) NOT NULL,
    `supplierId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `currency` CHAR(3) NOT NULL,
    `totalMinor` BIGINT NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DropshipPurchaseOrder_orderSplitId_key`(`orderSplitId`),
    INDEX `DropshipPurchaseOrder_tenantId_supplierId_status_idx`(`tenantId`, `supplierId`, `status`),
    UNIQUE INDEX `DropshipPurchaseOrder_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DropshipPurchaseOrderLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `purchaseOrderId` CHAR(36) NOT NULL,
    `orderLineId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitCostMinor` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DropshipPurchaseOrderLine_tenantId_orderLineId_idx`(`tenantId`, `orderLineId`),
    UNIQUE INDEX `DropshipPurchaseOrderLine_tenantId_purchaseOrderId_orderLine_key`(`tenantId`, `purchaseOrderId`, `orderLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreDomain` ADD CONSTRAINT `StoreDomain_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttributeDefinition` ADD CONSTRAINT `AttributeDefinition_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttributeDefinition` ADD CONSTRAINT `AttributeDefinition_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttributeOption` ADD CONSTRAINT `AttributeOption_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `AttributeDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Seller` ADD CONSTRAINT `Seller_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSubmission` ADD CONSTRAINT `ProductSubmission_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSubmission` ADD CONSTRAINT `ProductSubmission_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSubmission` ADD CONSTRAINT `ProductSubmission_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSubmission` ADD CONSTRAINT `ProductSubmission_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSubmission` ADD CONSTRAINT `ProductSubmission_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSubmissionVariant` ADD CONSTRAINT `ProductSubmissionVariant_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `ProductSubmission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductTranslation` ADD CONSTRAINT `ProductTranslation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductMedia` ADD CONSTRAINT `ProductMedia_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductAttributeValue` ADD CONSTRAINT `ProductAttributeValue_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductAttributeValue` ADD CONSTRAINT `ProductAttributeValue_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `AttributeDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductAttributeValue` ADD CONSTRAINT `ProductAttributeValue_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `AttributeOption`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `Seller`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Promotion` ADD CONSTRAINT `Promotion_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Promotion` ADD CONSTRAINT `Promotion_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryFeed` ADD CONSTRAINT `InventoryFeed_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryFeed` ADD CONSTRAINT `InventoryFeed_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryBalance` ADD CONSTRAINT `InventoryBalance_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockLedgerEntry` ADD CONSTRAINT `StockLedgerEntry_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryReservation` ADD CONSTRAINT `InventoryReservation_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartLine` ADD CONSTRAINT `CartLine_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartLine` ADD CONSTRAINT `CartLine_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderLine` ADD CONSTRAINT `OrderLine_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderSplit` ADD CONSTRAINT `OrderSplit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderSplit` ADD CONSTRAINT `OrderSplit_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderSplit` ADD CONSTRAINT `OrderSplit_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `Seller`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderSplit` ADD CONSTRAINT `OrderSplit_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DropshipPurchaseOrder` ADD CONSTRAINT `DropshipPurchaseOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DropshipPurchaseOrder` ADD CONSTRAINT `DropshipPurchaseOrder_orderSplitId_fkey` FOREIGN KEY (`orderSplitId`) REFERENCES `OrderSplit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DropshipPurchaseOrder` ADD CONSTRAINT `DropshipPurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DropshipPurchaseOrderLine` ADD CONSTRAINT `DropshipPurchaseOrderLine_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `DropshipPurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DropshipPurchaseOrderLine` ADD CONSTRAINT `DropshipPurchaseOrderLine_orderLineId_fkey` FOREIGN KEY (`orderLineId`) REFERENCES `OrderLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutboxEvent` ADD CONSTRAINT `OutboxEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IdempotencyRecord` ADD CONSTRAINT `IdempotencyRecord_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `ApiCredential` RENAME INDEX `ApiCredential_tenant_revoked_expires_idx` TO `ApiCredential_tenantId_revokedAt_expiresAt_idx`;

-- RenameIndex
ALTER TABLE `AuditEvent` RENAME INDEX `Audit_tenant_actor_time_idx` TO `AuditEvent_tenantId_actorId_occurredAt_idx`;

-- RenameIndex
ALTER TABLE `AuditEvent` RENAME INDEX `Audit_tenant_entity_time_idx` TO `AuditEvent_tenantId_entityType_entityId_occurredAt_idx`;

-- RenameIndex
ALTER TABLE `IdempotencyRecord` RENAME INDEX `Idempotency_expires_idx` TO `IdempotencyRecord_expiresAt_idx`;

-- RenameIndex
ALTER TABLE `IdempotencyRecord` RENAME INDEX `Idempotency_tenant_scope_key_key` TO `IdempotencyRecord_tenantId_scope_keyHash_key`;

-- RenameIndex
ALTER TABLE `IdentityToken` RENAME INDEX `IdentityToken_expires_idx` TO `IdentityToken_expiresAt_idx`;

-- RenameIndex
ALTER TABLE `IdentityToken` RENAME INDEX `IdentityToken_tenant_email_purpose_consumed_idx` TO `IdentityToken_tenantId_email_purpose_consumedAt_idx`;

-- RenameIndex
ALTER TABLE `InventoryBalance` RENAME INDEX `InventoryBalance_tenant_item_state_key` TO `InventoryBalance_tenantId_inventoryItemId_state_key`;

-- RenameIndex
ALTER TABLE `InventoryBalance` RENAME INDEX `InventoryBalance_tenant_state_idx` TO `InventoryBalance_tenantId_state_idx`;

-- RenameIndex
ALTER TABLE `InventoryItem` RENAME INDEX `InventoryItem_tenant_facility_sku_key` TO `InventoryItem_tenantId_facilityId_sku_key`;

-- RenameIndex
ALTER TABLE `InventoryItem` RENAME INDEX `InventoryItem_tenant_product_idx` TO `InventoryItem_tenantId_productRef_idx`;

-- RenameIndex
ALTER TABLE `InventoryReservation` RENAME INDEX `Reservation_tenant_demand_idx` TO `InventoryReservation_tenantId_demandType_demandId_idx`;

-- RenameIndex
ALTER TABLE `InventoryReservation` RENAME INDEX `Reservation_tenant_item_expiry_idx` TO `InventoryReservation_tenantId_inventoryItemId_expiresAt_idx`;

-- RenameIndex
ALTER TABLE `MfaCredential` RENAME INDEX `MfaCredential_tenant_confirmed_idx` TO `MfaCredential_tenantId_confirmedAt_idx`;

-- RenameIndex
ALTER TABLE `MfaCredential` RENAME INDEX `MfaCredential_tenant_user_kind_key` TO `MfaCredential_tenantId_userId_kind_key`;

-- RenameIndex
ALTER TABLE `MfaRecoveryCode` RENAME INDEX `MfaRecoveryCode_tenant_credential_consumed_idx` TO `MfaRecoveryCode_tenantId_credentialId_consumedAt_idx`;

-- RenameIndex
ALTER TABLE `OutboxEvent` RENAME INDEX `Outbox_status_available_idx` TO `OutboxEvent_status_availableAt_idx`;

-- RenameIndex
ALTER TABLE `OutboxEvent` RENAME INDEX `Outbox_tenant_type_created_idx` TO `OutboxEvent_tenantId_type_createdAt_idx`;

-- RenameIndex
ALTER TABLE `RefreshToken` RENAME INDEX `RefreshToken_tenant_family_idx` TO `RefreshToken_tenantId_familyId_idx`;

-- RenameIndex
ALTER TABLE `StockLedgerEntry` RENAME INDEX `StockLedger_tenant_idempotency_key` TO `StockLedgerEntry_tenantId_idempotencyKey_key`;

-- RenameIndex
ALTER TABLE `StockLedgerEntry` RENAME INDEX `StockLedger_tenant_item_time_idx` TO `StockLedgerEntry_tenantId_inventoryItemId_occurredAt_idx`;

-- RenameIndex
ALTER TABLE `UserIdentity` RENAME INDEX `UserIdentity_tenant_provider_user_key` TO `UserIdentity_tenantId_provider_providerUserId_key`;

-- RenameIndex
ALTER TABLE `UserIdentity` RENAME INDEX `UserIdentity_tenant_user_idx` TO `UserIdentity_tenantId_userId_idx`;

-- RenameIndex
ALTER TABLE `UserRole` RENAME INDEX `UserRole_tenant_role_idx` TO `UserRole_tenantId_roleId_idx`;

-- RenameIndex
ALTER TABLE `UserSession` RENAME INDEX `UserSession_tenant_user_revoked_idx` TO `UserSession_tenantId_userId_revokedAt_idx`;
