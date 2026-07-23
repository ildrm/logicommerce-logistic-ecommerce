-- CreateTable
CREATE TABLE `ReturnAuthorization` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `reasonCode` VARCHAR(80) NOT NULL,
    `requestedOutcome` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'REQUESTED',
    `labelUrl` VARCHAR(1000) NULL,
    `trackingNumber` VARCHAR(160) NULL,
    `carrierKey` VARCHAR(80) NULL,
    `approvedBy` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReturnAuthorization_tenantId_orderId_status_idx`(`tenantId`, `orderId`, `status`),
    INDEX `ReturnAuthorization_tenantId_customerId_status_idx`(`tenantId`, `customerId`, `status`),
    UNIQUE INDEX `ReturnAuthorization_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReturnLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `returnAuthorizationId` CHAR(36) NOT NULL,
    `orderLineId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `receivedQuantity` INTEGER NOT NULL DEFAULT 0,
    `disposition` VARCHAR(40) NULL,
    `resolution` VARCHAR(40) NULL,
    `refundMinor` BIGINT NOT NULL DEFAULT 0,

    INDEX `ReturnLine_tenantId_orderLineId_idx`(`tenantId`, `orderLineId`),
    UNIQUE INDEX `ReturnLine_tenantId_returnAuthorizationId_orderLineId_key`(`tenantId`, `returnAuthorizationId`, `orderLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReturnInspection` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `returnAuthorizationId` CHAR(36) NOT NULL,
    `inspectorId` CHAR(36) NOT NULL,
    `conditionCode` VARCHAR(40) NOT NULL,
    `evidence` JSON NULL,
    `note` VARCHAR(1000) NULL,
    `inspectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReturnInspection_tenantId_returnAuthorizationId_inspectedAt_idx`(`tenantId`, `returnAuthorizationId`, `inspectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReturnDispute` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `returnAuthorizationId` CHAR(36) NOT NULL,
    `openedBy` CHAR(36) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    `resolution` VARCHAR(1000) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReturnDispute_returnAuthorizationId_key`(`returnAuthorizationId`),
    INDEX `ReturnDispute_tenantId_status_idx`(`tenantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinancialAccount` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FinancialAccount_tenantId_type_active_idx`(`tenantId`, `type`, `active`),
    UNIQUE INDEX `FinancialAccount_tenantId_code_currency_key`(`tenantId`, `code`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntry` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `sourceType` VARCHAR(80) NOT NULL,
    `sourceId` CHAR(36) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'POSTED',
    `currency` CHAR(3) NOT NULL,
    `idempotencyKey` VARCHAR(160) NOT NULL,
    `reversalOfId` CHAR(36) NULL,
    `postedBy` CHAR(36) NOT NULL,
    `postedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JournalEntry_tenantId_sourceType_sourceId_idx`(`tenantId`, `sourceType`, `sourceId`),
    INDEX `JournalEntry_tenantId_reversalOfId_idx`(`tenantId`, `reversalOfId`),
    UNIQUE INDEX `JournalEntry_tenantId_number_key`(`tenantId`, `number`),
    UNIQUE INDEX `JournalEntry_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `journalEntryId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `debitMinor` BIGINT NOT NULL DEFAULT 0,
    `creditMinor` BIGINT NOT NULL DEFAULT 0,
    `memo` VARCHAR(500) NULL,

    INDEX `JournalLine_tenantId_journalEntryId_idx`(`tenantId`, `journalEntryId`),
    INDEX `JournalLine_tenantId_accountId_idx`(`tenantId`, `accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settlement` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `partnerKind` VARCHAR(40) NOT NULL,
    `partnerId` CHAR(36) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'CALCULATED',
    `grossMinor` BIGINT NOT NULL DEFAULT 0,
    `feesMinor` BIGINT NOT NULL DEFAULT 0,
    `reserveMinor` BIGINT NOT NULL DEFAULT 0,
    `adjustmentMinor` BIGINT NOT NULL DEFAULT 0,
    `netMinor` BIGINT NOT NULL DEFAULT 0,
    `approvedBy` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Settlement_tenantId_partnerKind_partnerId_status_idx`(`tenantId`, `partnerKind`, `partnerId`, `status`),
    INDEX `Settlement_tenantId_periodStart_periodEnd_idx`(`tenantId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettlementLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `settlementId` CHAR(36) NOT NULL,
    `journalEntryId` CHAR(36) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `amountMinor` BIGINT NOT NULL,

    INDEX `SettlementLine_tenantId_journalEntryId_idx`(`tenantId`, `journalEntryId`),
    UNIQUE INDEX `SettlementLine_tenantId_settlementId_journalEntryId_kind_key`(`tenantId`, `settlementId`, `journalEntryId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReconciliationRun` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `providerKey` VARCHAR(80) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `expectedMinor` BIGINT NOT NULL,
    `providerMinor` BIGINT NOT NULL,
    `differenceMinor` BIGINT NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `evidence` JSON NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReconciliationRun_tenantId_providerKey_status_createdAt_idx`(`tenantId`, `providerKey`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogisticsClient` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LogisticsClient_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `LogisticsClient_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogisticsContract` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `serviceCatalog` JSON NOT NULL,
    `rateCard` JSON NOT NULL,
    `sla` JSON NOT NULL,
    `effectiveAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LogisticsContract_tenantId_clientId_status_idx`(`tenantId`, `clientId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientInventory` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `inventoryItemId` CHAR(36) NOT NULL,
    `facilityId` CHAR(36) NOT NULL,
    `allocatedQty` BIGINT NOT NULL DEFAULT 0,

    INDEX `ClientInventory_tenantId_facilityId_clientId_idx`(`tenantId`, `facilityId`, `clientId`),
    UNIQUE INDEX `ClientInventory_tenantId_clientId_inventoryItemId_key`(`tenantId`, `clientId`, `inventoryItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillableEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `contractId` CHAR(36) NOT NULL,
    `eventType` VARCHAR(80) NOT NULL,
    `sourceType` VARCHAR(80) NOT NULL,
    `sourceId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPriceMinor` BIGINT NOT NULL,
    `totalMinor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'UNBILLED',
    `occurredAt` DATETIME(3) NOT NULL,
    `invoiceId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BillableEvent_tenantId_clientId_status_occurredAt_idx`(`tenantId`, `clientId`, `status`, `occurredAt`),
    UNIQUE INDEX `BillableEvent_tenantId_contractId_sourceType_sourceId_eventT_key`(`tenantId`, `contractId`, `sourceType`, `sourceId`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogisticsInvoice` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `contractId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `totalMinor` BIGINT NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ISSUED',
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NOT NULL,

    INDEX `LogisticsInvoice_tenantId_clientId_status_idx`(`tenantId`, `clientId`, `status`),
    UNIQUE INDEX `LogisticsInvoice_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ControlTowerException` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `fulfillmentOrderId` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `severity` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    `context` JSON NOT NULL,
    `openedBy` CHAR(36) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ControlTowerException_tenantId_fulfillmentOrderId_status_idx`(`tenantId`, `fulfillmentOrderId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoutingRecommendation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `exceptionId` CHAR(36) NOT NULL,
    `facilityId` CHAR(36) NOT NULL,
    `providerKey` VARCHAR(80) NOT NULL,
    `costMinor` BIGINT NOT NULL,
    `slaHours` INTEGER NOT NULL,
    `carbonGrams` INTEGER NOT NULL,
    `rationale` JSON NOT NULL,
    `inputHash` CHAR(64) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PROPOSED',
    `approvedBy` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `executedAt` DATETIME(3) NULL,
    `rollbackOfId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoutingRecommendation_tenantId_exceptionId_status_idx`(`tenantId`, `exceptionId`, `status`),
    UNIQUE INDEX `RoutingRecommendation_tenantId_exceptionId_inputHash_key`(`tenantId`, `exceptionId`, `inputHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NetworkModel` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `version` INTEGER NOT NULL,
    `nodes` JSON NOT NULL,
    `lanes` JSON NOT NULL,
    `carriers` JSON NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NetworkModel_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `NetworkModel_tenantId_key_version_key`(`tenantId`, `key`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OptimizationRun` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `networkModelId` CHAR(36) NOT NULL,
    `objectiveVersion` VARCHAR(80) NOT NULL,
    `algorithmVersion` VARCHAR(80) NOT NULL,
    `inputSnapshot` JSON NOT NULL,
    `constraints` JSON NOT NULL,
    `inputHash` CHAR(64) NOT NULL,
    `outputHash` CHAR(64) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'COMPLETED',
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OptimizationRun_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    UNIQUE INDEX `OptimizationRun_tenantId_networkModelId_objectiveVersion_alg_key`(`tenantId`, `networkModelId`, `objectiveVersion`, `algorithmVersion`, `inputHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OptimizationRecommendation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `runId` CHAR(36) NOT NULL,
    `rank` INTEGER NOT NULL,
    `plan` JSON NOT NULL,
    `score` INTEGER NOT NULL,
    `forecast` JSON NOT NULL,
    `explanation` JSON NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PROPOSED',
    `approvedBy` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `executedAt` DATETIME(3) NULL,
    `rolledBackAt` DATETIME(3) NULL,

    INDEX `OptimizationRecommendation_tenantId_runId_status_idx`(`tenantId`, `runId`, `status`),
    UNIQUE INDEX `OptimizationRecommendation_tenantId_runId_rank_key`(`tenantId`, `runId`, `rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OptimizationOutcome` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `recommendationId` CHAR(36) NOT NULL,
    `actual` JSON NOT NULL,
    `variance` JSON NOT NULL,
    `measuredBy` CHAR(36) NOT NULL,
    `measuredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OptimizationOutcome_recommendationId_key`(`recommendationId`),
    INDEX `OptimizationOutcome_tenantId_measuredAt_idx`(`tenantId`, `measuredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceLevelObjective` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `target` DOUBLE NOT NULL,
    `windowDays` INTEGER NOT NULL,
    `indicatorQuery` VARCHAR(1000) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceLevelObjective_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `ServiceLevelObjective_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SloObservation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `objectiveId` CHAR(36) NOT NULL,
    `value` DOUBLE NOT NULL,
    `sampleSize` INTEGER NOT NULL,
    `windowStart` DATETIME(3) NOT NULL,
    `windowEnd` DATETIME(3) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SloObservation_tenantId_objectiveId_windowEnd_idx`(`tenantId`, `objectiveId`, `windowEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecoveryExercise` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `backupReference` VARCHAR(240) NOT NULL,
    `environment` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `measuredRpoMinutes` INTEGER NULL,
    `measuredRtoMinutes` INTEGER NULL,
    `evidence` JSON NULL,
    `executedBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RecoveryExercise_tenantId_kind_status_startedAt_idx`(`tenantId`, `kind`, `status`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataRetentionPolicy` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `dataClass` VARCHAR(120) NOT NULL,
    `retentionDays` INTEGER NOT NULL,
    `legalHold` BOOLEAN NOT NULL DEFAULT false,
    `action` VARCHAR(40) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `approvedBy` CHAR(36) NOT NULL,
    `approvedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DataRetentionPolicy_tenantId_dataClass_key`(`tenantId`, `dataClass`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrivacyRequest` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `subjectRef` CHAR(64) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'RECEIVED',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `evidence` JSON NULL,
    `handledBy` CHAR(36) NULL,

    INDEX `PrivacyRequest_tenantId_status_dueAt_idx`(`tenantId`, `status`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReturnLine` ADD CONSTRAINT `ReturnLine_returnAuthorizationId_fkey` FOREIGN KEY (`returnAuthorizationId`) REFERENCES `ReturnAuthorization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnInspection` ADD CONSTRAINT `ReturnInspection_returnAuthorizationId_fkey` FOREIGN KEY (`returnAuthorizationId`) REFERENCES `ReturnAuthorization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnDispute` ADD CONSTRAINT `ReturnDispute_returnAuthorizationId_fkey` FOREIGN KEY (`returnAuthorizationId`) REFERENCES `ReturnAuthorization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `JournalEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `FinancialAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementLine` ADD CONSTRAINT `SettlementLine_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementLine` ADD CONSTRAINT `SettlementLine_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `JournalEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogisticsContract` ADD CONSTRAINT `LogisticsContract_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `LogisticsClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientInventory` ADD CONSTRAINT `ClientInventory_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `LogisticsClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillableEvent` ADD CONSTRAINT `BillableEvent_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `LogisticsClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillableEvent` ADD CONSTRAINT `BillableEvent_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `LogisticsContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillableEvent` ADD CONSTRAINT `BillableEvent_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `LogisticsInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogisticsInvoice` ADD CONSTRAINT `LogisticsInvoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `LogisticsClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogisticsInvoice` ADD CONSTRAINT `LogisticsInvoice_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `LogisticsContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingRecommendation` ADD CONSTRAINT `RoutingRecommendation_exceptionId_fkey` FOREIGN KEY (`exceptionId`) REFERENCES `ControlTowerException`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptimizationRun` ADD CONSTRAINT `OptimizationRun_networkModelId_fkey` FOREIGN KEY (`networkModelId`) REFERENCES `NetworkModel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptimizationRecommendation` ADD CONSTRAINT `OptimizationRecommendation_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `OptimizationRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptimizationOutcome` ADD CONSTRAINT `OptimizationOutcome_recommendationId_fkey` FOREIGN KEY (`recommendationId`) REFERENCES `OptimizationRecommendation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SloObservation` ADD CONSTRAINT `SloObservation_objectiveId_fkey` FOREIGN KEY (`objectiveId`) REFERENCES `ServiceLevelObjective`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the database-level tenant boundary used by earlier phase migrations.
ALTER TABLE `ReturnAuthorization` ADD CONSTRAINT `ReturnAuthorization_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ReturnLine` ADD CONSTRAINT `ReturnLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ReturnInspection` ADD CONSTRAINT `ReturnInspection_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ReturnDispute` ADD CONSTRAINT `ReturnDispute_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FinancialAccount` ADD CONSTRAINT `FinancialAccount_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SettlementLine` ADD CONSTRAINT `SettlementLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ReconciliationRun` ADD CONSTRAINT `ReconciliationRun_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LogisticsClient` ADD CONSTRAINT `LogisticsClient_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LogisticsContract` ADD CONSTRAINT `LogisticsContract_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ClientInventory` ADD CONSTRAINT `ClientInventory_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BillableEvent` ADD CONSTRAINT `BillableEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LogisticsInvoice` ADD CONSTRAINT `LogisticsInvoice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ControlTowerException` ADD CONSTRAINT `ControlTowerException_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RoutingRecommendation` ADD CONSTRAINT `RoutingRecommendation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NetworkModel` ADD CONSTRAINT `NetworkModel_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OptimizationRun` ADD CONSTRAINT `OptimizationRun_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OptimizationRecommendation` ADD CONSTRAINT `OptimizationRecommendation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OptimizationOutcome` ADD CONSTRAINT `OptimizationOutcome_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ServiceLevelObjective` ADD CONSTRAINT `ServiceLevelObjective_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SloObservation` ADD CONSTRAINT `SloObservation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RecoveryExercise` ADD CONSTRAINT `RecoveryExercise_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DataRetentionPolicy` ADD CONSTRAINT `DataRetentionPolicy_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PrivacyRequest` ADD CONSTRAINT `PrivacyRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
