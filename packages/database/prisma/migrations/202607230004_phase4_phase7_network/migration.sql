-- CreateTable
CREATE TABLE `Facility` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `address` JSON NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXCEPTION') NOT NULL DEFAULT 'OPEN',
    `version` INTEGER NOT NULL DEFAULT 1,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Facility_tenantId_status_deletedAt_idx`(`tenantId`, `status`, `deletedAt`),
    UNIQUE INDEX `Facility_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacilityBin` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `facilityId` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `kind` VARCHAR(40) NOT NULL DEFAULT 'STORAGE',
    `capacity` INTEGER NULL,
    `status` ENUM('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXCEPTION') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FacilityBin_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `FacilityBin_tenantId_facilityId_code_key`(`tenantId`, `facilityId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdvanceShippingNotice` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `facilityId` CHAR(36) NOT NULL,
    `supplierId` CHAR(36) NULL,
    `reference` VARCHAR(120) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXCEPTION') NOT NULL DEFAULT 'OPEN',
    `expectedAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdvanceShippingNotice_tenantId_facilityId_status_idx`(`tenantId`, `facilityId`, `status`),
    UNIQUE INDEX `AdvanceShippingNotice_tenantId_reference_key`(`tenantId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AsnLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `asnId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `inventoryItemId` CHAR(36) NULL,
    `expectedQty` INTEGER NOT NULL,
    `receivedQty` INTEGER NOT NULL DEFAULT 0,
    `acceptedQty` INTEGER NOT NULL DEFAULT 0,
    `rejectedQty` INTEGER NOT NULL DEFAULT 0,
    `inspection` VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    `putawayBinId` CHAR(36) NULL,
    `putawayAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AsnLine_tenantId_asnId_idx`(`tenantId`, `asnId`),
    INDEX `AsnLine_tenantId_variantId_idx`(`tenantId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FulfillmentOrder` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderSplitId` CHAR(36) NOT NULL,
    `facilityId` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'RELEASED', 'PICKING', 'PICKED', 'PACKED', 'LABELED', 'MANIFESTED', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'EXCEPTION') NOT NULL DEFAULT 'PENDING',
    `slaDueAt` DATETIME(3) NULL,
    `exceptionCode` VARCHAR(120) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FulfillmentOrder_tenantId_facilityId_status_slaDueAt_idx`(`tenantId`, `facilityId`, `status`, `slaDueAt`),
    UNIQUE INDEX `FulfillmentOrder_tenantId_orderSplitId_key`(`tenantId`, `orderSplitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FulfillmentLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `fulfillmentOrderId` CHAR(36) NOT NULL,
    `orderLineId` CHAR(36) NOT NULL,
    `inventoryItemId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `pickedQty` INTEGER NOT NULL DEFAULT 0,
    `packedQty` INTEGER NOT NULL DEFAULT 0,
    `binId` CHAR(36) NULL,

    INDEX `FulfillmentLine_tenantId_inventoryItemId_idx`(`tenantId`, `inventoryItemId`),
    UNIQUE INDEX `FulfillmentLine_tenantId_fulfillmentOrderId_orderLineId_key`(`tenantId`, `fulfillmentOrderId`, `orderLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FulfillmentPackage` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `fulfillmentOrderId` CHAR(36) NOT NULL,
    `code` VARCHAR(120) NOT NULL,
    `weightGrams` INTEGER NOT NULL,
    `dimensions` JSON NULL,
    `packedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FulfillmentPackage_tenantId_fulfillmentOrderId_idx`(`tenantId`, `fulfillmentOrderId`),
    UNIQUE INDEX `FulfillmentPackage_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shipment` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `fulfillmentOrderId` CHAR(36) NOT NULL,
    `packageId` CHAR(36) NOT NULL,
    `carrierKey` VARCHAR(80) NOT NULL,
    `serviceLevel` VARCHAR(80) NOT NULL,
    `trackingNumber` VARCHAR(160) NOT NULL,
    `status` ENUM('PENDING', 'RELEASED', 'PICKING', 'PICKED', 'PACKED', 'LABELED', 'MANIFESTED', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'EXCEPTION') NOT NULL DEFAULT 'LABELED',
    `labelUrl` VARCHAR(1000) NOT NULL,
    `rateMinor` BIGINT NOT NULL,
    `manifestedAt` DATETIME(3) NULL,
    `dispatchedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Shipment_packageId_key`(`packageId`),
    INDEX `Shipment_tenantId_status_updatedAt_idx`(`tenantId`, `status`, `updatedAt`),
    UNIQUE INDEX `Shipment_tenantId_trackingNumber_key`(`tenantId`, `trackingNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrackingEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `shipmentId` CHAR(36) NOT NULL,
    `externalKey` VARCHAR(160) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `location` VARCHAR(240) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrackingEvent_tenantId_shipmentId_occurredAt_idx`(`tenantId`, `shipmentId`, `occurredAt`),
    UNIQUE INDEX `TrackingEvent_tenantId_shipmentId_externalKey_key`(`tenantId`, `shipmentId`, `externalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `C2CSellerProfile` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    `verificationReference` VARCHAR(160) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `C2CSellerProfile_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `C2CSellerProfile_tenantId_userId_key`(`tenantId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `C2CListing` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `sellerUserId` CHAR(36) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `conditionCode` VARCHAR(40) NOT NULL,
    `priceMinor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_MODERATION', 'ACTIVE', 'REJECTED', 'SOLD', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `moderationReason` VARCHAR(1000) NULL,
    `media` JSON NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `C2CListing_tenantId_sellerUserId_status_idx`(`tenantId`, `sellerUserId`, `status`),
    INDEX `C2CListing_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `C2COffer` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `listingId` CHAR(36) NOT NULL,
    `buyerUserId` CHAR(36) NOT NULL,
    `parentOfferId` CHAR(36) NULL,
    `amountMinor` BIGINT NOT NULL,
    `status` ENUM('OPEN', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `C2COffer_tenantId_listingId_status_idx`(`tenantId`, `listingId`, `status`),
    INDEX `C2COffer_tenantId_buyerUserId_status_idx`(`tenantId`, `buyerUserId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `C2CTransaction` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `listingId` CHAR(36) NOT NULL,
    `acceptedOfferId` CHAR(36) NOT NULL,
    `buyerUserId` CHAR(36) NOT NULL,
    `sellerUserId` CHAR(36) NOT NULL,
    `amountMinor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('PAYMENT_HELD', 'SHIPPED', 'DELIVERED', 'DISPUTED', 'PAYOUT_ELIGIBLE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PAYMENT_HELD',
    `shipmentEvidence` JSON NULL,
    `protectionEndsAt` DATETIME(3) NULL,
    `payoutEligibleAt` DATETIME(3) NULL,
    `payoutReleasedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `C2CTransaction_listingId_key`(`listingId`),
    UNIQUE INDEX `C2CTransaction_acceptedOfferId_key`(`acceptedOfferId`),
    INDEX `C2CTransaction_tenantId_buyerUserId_status_idx`(`tenantId`, `buyerUserId`, `status`),
    INDEX `C2CTransaction_tenantId_sellerUserId_status_idx`(`tenantId`, `sellerUserId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `C2CDispute` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `transactionId` CHAR(36) NOT NULL,
    `openedBy` CHAR(36) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    `resolution` VARCHAR(1000) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `C2CDispute_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `C2CReview` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `transactionId` CHAR(36) NOT NULL,
    `authorUserId` CHAR(36) NOT NULL,
    `subjectUserId` CHAR(36) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `C2CReview_tenantId_subjectUserId_idx`(`tenantId`, `subjectUserId`),
    UNIQUE INDEX `C2CReview_tenantId_transactionId_authorUserId_key`(`tenantId`, `transactionId`, `authorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessAccount` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `creditLimitMinor` BIGINT NOT NULL DEFAULT 0,
    `paymentTermsDays` INTEGER NOT NULL DEFAULT 30,
    `approvalMinor` BIGINT NOT NULL DEFAULT 0,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessAccount_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `BusinessAccount_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessMember` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `department` VARCHAR(120) NOT NULL,
    `role` VARCHAR(40) NOT NULL,
    `spendLimitMinor` BIGINT NOT NULL DEFAULT 0,

    INDEX `BusinessMember_tenantId_userId_idx`(`tenantId`, `userId`),
    UNIQUE INDEX `BusinessMember_tenantId_accountId_userId_key`(`tenantId`, `accountId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractPrice` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `minimumQuantity` INTEGER NOT NULL DEFAULT 1,
    `unitPriceMinor` BIGINT NOT NULL,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validTo` DATETIME(3) NULL,

    INDEX `ContractPrice_tenantId_variantId_validFrom_validTo_idx`(`tenantId`, `variantId`, `validFrom`, `validTo`),
    UNIQUE INDEX `ContractPrice_tenantId_accountId_variantId_minimumQuantity_key`(`tenantId`, `accountId`, `variantId`, `minimumQuantity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequestForQuote` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `requesterId` CHAR(36) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'SENT', 'PENDING_APPROVAL', 'APPROVED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'ISSUED', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RequestForQuote_tenantId_accountId_status_idx`(`tenantId`, `accountId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RfqLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `rfqId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `targetMinor` BIGINT NULL,

    UNIQUE INDEX `RfqLine_tenantId_rfqId_variantId_key`(`tenantId`, `rfqId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessQuote` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `rfqId` CHAR(36) NOT NULL,
    `sellerId` CHAR(36) NULL,
    `status` ENUM('DRAFT', 'OPEN', 'SENT', 'PENDING_APPROVAL', 'APPROVED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'ISSUED', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'SENT',
    `totalMinor` BIGINT NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `terms` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessQuote_tenantId_rfqId_status_idx`(`tenantId`, `rfqId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessQuoteLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `quoteId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPriceMinor` BIGINT NOT NULL,

    UNIQUE INDEX `BusinessQuoteLine_tenantId_quoteId_variantId_key`(`tenantId`, `quoteId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessOrder` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `quoteId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `purchaseOrderRef` VARCHAR(160) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'SENT', 'PENDING_APPROVAL', 'APPROVED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'ISSUED', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `totalMinor` BIGINT NOT NULL,
    `paymentTermsDays` INTEGER NOT NULL,
    `approvedBy` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessOrder_quoteId_key`(`quoteId`),
    INDEX `BusinessOrder_tenantId_accountId_status_idx`(`tenantId`, `accountId`, `status`),
    UNIQUE INDEX `BusinessOrder_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessOrderLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `fulfilledQty` INTEGER NOT NULL DEFAULT 0,
    `unitPriceMinor` BIGINT NOT NULL,

    UNIQUE INDEX `BusinessOrderLine_tenantId_orderId_variantId_key`(`tenantId`, `orderId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessInvoice` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'SENT', 'PENDING_APPROVAL', 'APPROVED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'ISSUED', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ISSUED',
    `totalMinor` BIGINT NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidAt` DATETIME(3) NULL,

    INDEX `BusinessInvoice_tenantId_orderId_status_idx`(`tenantId`, `orderId`, `status`),
    UNIQUE INDEX `BusinessInvoice_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerApiCredential` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `partnerKind` ENUM('SELLER', 'SUPPLIER', 'SHOP') NOT NULL,
    `partnerId` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `keyPrefix` VARCHAR(24) NOT NULL,
    `secretHash` CHAR(64) NOT NULL,
    `scopes` JSON NOT NULL,
    `ipPolicy` JSON NULL,
    `rateLimitPerMinute` INTEGER NOT NULL DEFAULT 120,
    `rotatedFromId` CHAR(36) NULL,
    `expiresAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PartnerApiCredential_keyPrefix_key`(`keyPrefix`),
    UNIQUE INDEX `PartnerApiCredential_secretHash_key`(`secretHash`),
    INDEX `PartnerApiCredential_tenantId_partnerKind_partnerId_revokedA_idx`(`tenantId`, `partnerKind`, `partnerId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShopOrder` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `partnerId` CHAR(36) NOT NULL,
    `externalKey` VARCHAR(160) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACCEPTED',
    `currency` CHAR(3) NOT NULL,
    `totalMinor` BIGINT NOT NULL,
    `shippingAddress` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShopOrder_tenantId_partnerId_status_idx`(`tenantId`, `partnerId`, `status`),
    UNIQUE INDEX `ShopOrder_tenantId_partnerId_externalKey_key`(`tenantId`, `partnerId`, `externalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShopOrderLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPriceMinor` BIGINT NOT NULL,

    UNIQUE INDEX `ShopOrderLine_tenantId_orderId_variantId_key`(`tenantId`, `orderId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEndpoint` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `partnerKind` ENUM('SELLER', 'SUPPLIER', 'SHOP') NOT NULL,
    `partnerId` CHAR(36) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `eventTypes` JSON NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `secretCiphertext` VARCHAR(1000) NOT NULL,
    `secretHash` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WebhookEndpoint_tenantId_partnerKind_partnerId_status_idx`(`tenantId`, `partnerKind`, `partnerId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookDelivery` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `endpointId` CHAR(36) NOT NULL,
    `eventId` CHAR(36) NOT NULL,
    `eventType` VARCHAR(160) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'RETRYING', 'DELIVERED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastStatusCode` INTEGER NULL,
    `lastError` VARCHAR(1000) NULL,
    `signature` CHAR(64) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `replayOfId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WebhookDelivery_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `WebhookDelivery_tenantId_endpointId_createdAt_idx`(`tenantId`, `endpointId`, `createdAt`),
    UNIQUE INDEX `WebhookDelivery_tenantId_endpointId_eventId_key`(`tenantId`, `endpointId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookReceipt` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `endpointId` CHAR(36) NOT NULL,
    `externalEventId` VARCHAR(160) NOT NULL,
    `eventType` VARCHAR(160) NOT NULL,
    `payloadHash` CHAR(64) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookReceipt_tenantId_receivedAt_idx`(`tenantId`, `receivedAt`),
    UNIQUE INDEX `WebhookReceipt_tenantId_endpointId_externalEventId_key`(`tenantId`, `endpointId`, `externalEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FacilityBin` ADD CONSTRAINT `FacilityBin_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvanceShippingNotice` ADD CONSTRAINT `AdvanceShippingNotice_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `Facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AsnLine` ADD CONSTRAINT `AsnLine_asnId_fkey` FOREIGN KEY (`asnId`) REFERENCES `AdvanceShippingNotice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FulfillmentLine` ADD CONSTRAINT `FulfillmentLine_fulfillmentOrderId_fkey` FOREIGN KEY (`fulfillmentOrderId`) REFERENCES `FulfillmentOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FulfillmentPackage` ADD CONSTRAINT `FulfillmentPackage_fulfillmentOrderId_fkey` FOREIGN KEY (`fulfillmentOrderId`) REFERENCES `FulfillmentOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_fulfillmentOrderId_fkey` FOREIGN KEY (`fulfillmentOrderId`) REFERENCES `FulfillmentOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `FulfillmentPackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrackingEvent` ADD CONSTRAINT `TrackingEvent_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `C2COffer` ADD CONSTRAINT `C2COffer_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `C2CListing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `C2CTransaction` ADD CONSTRAINT `C2CTransaction_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `C2CListing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `C2CDispute` ADD CONSTRAINT `C2CDispute_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `C2CTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `C2CReview` ADD CONSTRAINT `C2CReview_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `C2CTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMember` ADD CONSTRAINT `BusinessMember_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `BusinessAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractPrice` ADD CONSTRAINT `ContractPrice_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `BusinessAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestForQuote` ADD CONSTRAINT `RequestForQuote_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `BusinessAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RfqLine` ADD CONSTRAINT `RfqLine_rfqId_fkey` FOREIGN KEY (`rfqId`) REFERENCES `RequestForQuote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessQuote` ADD CONSTRAINT `BusinessQuote_rfqId_fkey` FOREIGN KEY (`rfqId`) REFERENCES `RequestForQuote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessQuoteLine` ADD CONSTRAINT `BusinessQuoteLine_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `BusinessQuote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessOrder` ADD CONSTRAINT `BusinessOrder_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `BusinessAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessOrder` ADD CONSTRAINT `BusinessOrder_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `BusinessQuote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessOrderLine` ADD CONSTRAINT `BusinessOrderLine_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BusinessOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessInvoice` ADD CONSTRAINT `BusinessInvoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BusinessOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShopOrderLine` ADD CONSTRAINT `ShopOrderLine_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ShopOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookDelivery` ADD CONSTRAINT `WebhookDelivery_endpointId_fkey` FOREIGN KEY (`endpointId`) REFERENCES `WebhookEndpoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookReceipt` ADD CONSTRAINT `WebhookReceipt_endpointId_fkey` FOREIGN KEY (`endpointId`) REFERENCES `WebhookEndpoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every Phase 4-7 aggregate is physically tenant-bound in addition to application scoping.
ALTER TABLE `Facility` ADD CONSTRAINT `Facility_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FacilityBin` ADD CONSTRAINT `FacilityBin_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AdvanceShippingNotice` ADD CONSTRAINT `AdvanceShippingNotice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AsnLine` ADD CONSTRAINT `AsnLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FulfillmentOrder` ADD CONSTRAINT `FulfillmentOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FulfillmentLine` ADD CONSTRAINT `FulfillmentLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FulfillmentPackage` ADD CONSTRAINT `FulfillmentPackage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TrackingEvent` ADD CONSTRAINT `TrackingEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `C2CSellerProfile` ADD CONSTRAINT `C2CSellerProfile_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `C2CListing` ADD CONSTRAINT `C2CListing_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `C2COffer` ADD CONSTRAINT `C2COffer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `C2CTransaction` ADD CONSTRAINT `C2CTransaction_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `C2CDispute` ADD CONSTRAINT `C2CDispute_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `C2CReview` ADD CONSTRAINT `C2CReview_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BusinessAccount` ADD CONSTRAINT `BusinessAccount_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BusinessMember` ADD CONSTRAINT `BusinessMember_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ContractPrice` ADD CONSTRAINT `ContractPrice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RequestForQuote` ADD CONSTRAINT `RequestForQuote_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RfqLine` ADD CONSTRAINT `RfqLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BusinessQuote` ADD CONSTRAINT `BusinessQuote_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BusinessQuoteLine` ADD CONSTRAINT `BusinessQuoteLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BusinessOrder` ADD CONSTRAINT `BusinessOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BusinessOrderLine` ADD CONSTRAINT `BusinessOrderLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BusinessInvoice` ADD CONSTRAINT `BusinessInvoice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PartnerApiCredential` ADD CONSTRAINT `PartnerApiCredential_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ShopOrder` ADD CONSTRAINT `ShopOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ShopOrderLine` ADD CONSTRAINT `ShopOrderLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WebhookEndpoint` ADD CONSTRAINT `WebhookEndpoint_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WebhookDelivery` ADD CONSTRAINT `WebhookDelivery_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WebhookReceipt` ADD CONSTRAINT `WebhookReceipt_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
