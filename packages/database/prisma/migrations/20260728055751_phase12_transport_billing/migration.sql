-- CreateTable
CREATE TABLE `FreightRequest` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `requesterId` CHAR(36) NOT NULL,
    `businessAccountId` CHAR(36) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    `serviceLevel` VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    `preferredModes` JSON NOT NULL,
    `incoterm` VARCHAR(20) NULL,
    `insuranceRequired` BOOLEAN NOT NULL DEFAULT false,
    `customsRequired` BOOLEAN NOT NULL DEFAULT false,
    `specialInstructions` VARCHAR(2000) NULL,
    `submittedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FreightRequest_tenantId_requesterId_status_createdAt_idx`(`tenantId`, `requesterId`, `status`, `createdAt`),
    INDEX `FreightRequest_tenantId_businessAccountId_status_idx`(`tenantId`, `businessAccountId`, `status`),
    UNIQUE INDEX `FreightRequest_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightStop` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `locationType` VARCHAR(40) NOT NULL DEFAULT 'ADDRESS',
    `name` VARCHAR(160) NOT NULL,
    `line1` VARCHAR(240) NULL,
    `line2` VARCHAR(240) NULL,
    `city` VARCHAR(120) NOT NULL,
    `region` VARCHAR(120) NULL,
    `postalCode` VARCHAR(40) NULL,
    `countryCode` CHAR(2) NOT NULL,
    `locationCode` VARCHAR(40) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `timeZone` VARCHAR(80) NULL,
    `windowStart` DATETIME(3) NULL,
    `windowEnd` DATETIME(3) NULL,
    `contactName` VARCHAR(160) NULL,
    `contactPhone` VARCHAR(500) NULL,
    `instructions` VARCHAR(1000) NULL,

    INDEX `FreightStop_tenantId_countryCode_locationCode_idx`(`tenantId`, `countryCode`, `locationCode`),
    UNIQUE INDEX `FreightStop_tenantId_requestId_sequence_key`(`tenantId`, `requestId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoItem` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `commodityCode` VARCHAR(40) NULL,
    `packageType` VARCHAR(40) NOT NULL,
    `packageCount` INTEGER NOT NULL,
    `weightGrams` BIGINT NOT NULL,
    `volumeCubicCm` BIGINT NULL,
    `dimensions` JSON NULL,
    `declaredValueMinor` BIGINT NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL,
    `hazardous` BOOLEAN NOT NULL DEFAULT false,
    `hazardousDetails` JSON NULL,
    `temperatureMinC` DOUBLE NULL,
    `temperatureMaxC` DOUBLE NULL,
    `stackable` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CargoItem_tenantId_requestId_idx`(`tenantId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightDocument` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NULL,
    `kind` VARCHAR(60) NOT NULL,
    `fileName` VARCHAR(240) NOT NULL,
    `contentType` VARCHAR(120) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `objectKey` VARCHAR(500) NOT NULL,
    `scanStatus` VARCHAR(40) NOT NULL DEFAULT 'QUARANTINED',
    `uploadedBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FreightDocument_tenantId_requestId_kind_idx`(`tenantId`, `requestId`, `kind`),
    INDEX `FreightDocument_tenantId_bookingId_kind_idx`(`tenantId`, `bookingId`, `kind`),
    UNIQUE INDEX `FreightDocument_tenantId_objectKey_key`(`tenantId`, `objectKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportRateCard` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `effectiveAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TransportRateCard_tenantId_status_effectiveAt_expiresAt_idx`(`tenantId`, `status`, `effectiveAt`, `expiresAt`),
    UNIQUE INDEX `TransportRateCard_tenantId_key_version_key`(`tenantId`, `key`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportRateRule` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `rateCardId` CHAR(36) NOT NULL,
    `mode` VARCHAR(20) NOT NULL,
    `originCountryCode` CHAR(2) NULL,
    `destinationCountryCode` CHAR(2) NULL,
    `originLocationCode` VARCHAR(40) NULL,
    `destinationLocationCode` VARCHAR(40) NULL,
    `equipmentType` VARCHAR(60) NULL,
    `baseMinor` BIGINT NOT NULL DEFAULT 0,
    `perKgMinor` BIGINT NOT NULL DEFAULT 0,
    `perCubicMeterMinor` BIGINT NOT NULL DEFAULT 0,
    `minimumMinor` BIGINT NOT NULL DEFAULT 0,
    `accessorials` JSON NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,

    INDEX `TransportRateRule_tenantId_mode_originCountryCode_destinatio_idx`(`tenantId`, `mode`, `originCountryCode`, `destinationCountryCode`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightEstimate` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `rateCardId` CHAR(36) NULL,
    `status` VARCHAR(40) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotalMinor` BIGINT NOT NULL,
    `taxMinor` BIGINT NOT NULL DEFAULT 0,
    `totalMinor` BIGINT NOT NULL,
    `calculation` JSON NOT NULL,
    `inputHash` CHAR(64) NOT NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FreightEstimate_tenantId_requestId_createdAt_idx`(`tenantId`, `requestId`, `createdAt`),
    UNIQUE INDEX `FreightEstimate_tenantId_requestId_inputHash_key`(`tenantId`, `requestId`, `inputHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightQuote` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `revision` INTEGER NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    `currency` CHAR(3) NOT NULL,
    `subtotalMinor` BIGINT NOT NULL,
    `taxMinor` BIGINT NOT NULL DEFAULT 0,
    `totalMinor` BIGINT NOT NULL,
    `paymentPolicy` VARCHAR(40) NOT NULL DEFAULT 'PREPAY',
    `depositPercent` INTEGER NULL,
    `paymentTermsDays` INTEGER NOT NULL DEFAULT 0,
    `terms` JSON NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `supersedesId` CHAR(36) NULL,
    `createdBy` CHAR(36) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `declinedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FreightQuote_tenantId_requestId_status_validUntil_idx`(`tenantId`, `requestId`, `status`, `validUntil`),
    UNIQUE INDEX `FreightQuote_tenantId_number_key`(`tenantId`, `number`),
    UNIQUE INDEX `FreightQuote_tenantId_requestId_revision_key`(`tenantId`, `requestId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightQuoteLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `quoteId` CHAR(36) NOT NULL,
    `kind` VARCHAR(60) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitMinor` BIGINT NOT NULL,
    `totalMinor` BIGINT NOT NULL,
    `taxable` BOOLEAN NOT NULL DEFAULT true,
    `metadata` JSON NULL,

    INDEX `FreightQuoteLine_tenantId_quoteId_idx`(`tenantId`, `quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightBooking` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `quoteId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'AWAITING_PAYMENT',
    `customerId` CHAR(36) NOT NULL,
    `businessAccountId` CHAR(36) NULL,
    `invoiceId` CHAR(36) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `dispatchedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FreightBooking_requestId_key`(`requestId`),
    UNIQUE INDEX `FreightBooking_quoteId_key`(`quoteId`),
    UNIQUE INDEX `FreightBooking_invoiceId_key`(`invoiceId`),
    INDEX `FreightBooking_tenantId_customerId_status_createdAt_idx`(`tenantId`, `customerId`, `status`, `createdAt`),
    INDEX `FreightBooking_tenantId_businessAccountId_status_idx`(`tenantId`, `businessAccountId`, `status`),
    UNIQUE INDEX `FreightBooking_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportCarrier` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `kind` VARCHAR(40) NOT NULL DEFAULT 'SUBCONTRACTED',
    `modes` JSON NOT NULL,
    `contactName` VARCHAR(160) NULL,
    `contactEmail` VARCHAR(320) NULL,
    `contactPhone` VARCHAR(500) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportCarrier_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `TransportCarrier_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportDriver` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `carrierId` CHAR(36) NULL,
    `employeeRef` VARCHAR(100) NULL,
    `displayName` VARCHAR(160) NOT NULL,
    `phoneCiphertext` VARCHAR(500) NOT NULL,
    `licenseNumber` VARCHAR(120) NULL,
    `licenseExpiresAt` DATETIME(3) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportDriver_tenantId_carrierId_status_idx`(`tenantId`, `carrierId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportVehicle` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `carrierId` CHAR(36) NULL,
    `registration` VARCHAR(120) NOT NULL,
    `equipmentType` VARCHAR(60) NOT NULL,
    `capacityKg` INTEGER NULL,
    `capacityCubicM` DOUBLE NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportVehicle_tenantId_carrierId_status_idx`(`tenantId`, `carrierId`, `status`),
    UNIQUE INDEX `TransportVehicle_tenantId_registration_key`(`tenantId`, `registration`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportLeg` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `mode` VARCHAR(20) NOT NULL,
    `originStopId` CHAR(36) NOT NULL,
    `destinationStopId` CHAR(36) NOT NULL,
    `carrierId` CHAR(36) NULL,
    `providerReference` VARCHAR(160) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PLANNED',
    `plannedDepartureAt` DATETIME(3) NULL,
    `plannedArrivalAt` DATETIME(3) NULL,
    `actualDepartureAt` DATETIME(3) NULL,
    `actualArrivalAt` DATETIME(3) NULL,
    `equipment` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportLeg_tenantId_mode_status_plannedArrivalAt_idx`(`tenantId`, `mode`, `status`, `plannedArrivalAt`),
    UNIQUE INDEX `TransportLeg_tenantId_bookingId_sequence_key`(`tenantId`, `bookingId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportMilestone` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NOT NULL,
    `legId` CHAR(36) NULL,
    `code` VARCHAR(80) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `location` VARCHAR(240) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(40) NOT NULL,
    `recordedBy` CHAR(36) NULL,
    `externalKey` VARCHAR(160) NOT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TransportMilestone_tenantId_bookingId_occurredAt_idx`(`tenantId`, `bookingId`, `occurredAt`),
    UNIQUE INDEX `TransportMilestone_tenantId_bookingId_externalKey_key`(`tenantId`, `bookingId`, `externalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightException` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NOT NULL,
    `assignmentId` CHAR(36) NULL,
    `code` VARCHAR(80) NOT NULL,
    `severity` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    `description` VARCHAR(1000) NOT NULL,
    `openedBy` CHAR(36) NULL,
    `resolvedBy` CHAR(36) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FreightException_tenantId_bookingId_status_severity_idx`(`tenantId`, `bookingId`, `status`, `severity`),
    INDEX `FreightException_tenantId_assignmentId_status_idx`(`tenantId`, `assignmentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DispatchAssignment` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `legId` CHAR(36) NOT NULL,
    `carrierId` CHAR(36) NULL,
    `driverId` CHAR(36) NOT NULL,
    `vehicleId` CHAR(36) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ASSIGNED',
    `checkInIntervalMinutes` INTEGER NOT NULL DEFAULT 240,
    `nextCheckInAt` DATETIME(3) NULL,
    `assignedBy` CHAR(36) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `DispatchAssignment_legId_key`(`legId`),
    INDEX `DispatchAssignment_tenantId_status_nextCheckInAt_idx`(`tenantId`, `status`, `nextCheckInAt`),
    INDEX `DispatchAssignment_tenantId_driverId_status_idx`(`tenantId`, `driverId`, `status`),
    INDEX `DispatchAssignment_tenantId_vehicleId_status_idx`(`tenantId`, `vehicleId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriverCheckIn` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `assignmentId` CHAR(36) NOT NULL,
    `coordinatorId` CHAR(36) NOT NULL,
    `source` VARCHAR(40) NOT NULL,
    `outcome` VARCHAR(40) NOT NULL,
    `locationText` VARCHAR(240) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `reportedAt` DATETIME(3) NOT NULL,
    `contactedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `estimatedArrivalAt` DATETIME(3) NULL,
    `note` VARCHAR(1000) NULL,
    `exceptionCode` VARCHAR(80) NULL,
    `nextCheckInAt` DATETIME(3) NULL,
    `externalKey` VARCHAR(160) NOT NULL,

    INDEX `DriverCheckIn_tenantId_assignmentId_reportedAt_idx`(`tenantId`, `assignmentId`, `reportedAt`),
    UNIQUE INDEX `DriverCheckIn_tenantId_assignmentId_externalKey_key`(`tenantId`, `assignmentId`, `externalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProofOfDelivery` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NOT NULL,
    `documentId` CHAR(36) NULL,
    `recipient` VARCHAR(160) NOT NULL,
    `deliveredAt` DATETIME(3) NOT NULL,
    `note` VARCHAR(1000) NULL,
    `recordedBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProofOfDelivery_bookingId_key`(`bookingId`),
    INDEX `ProofOfDelivery_tenantId_deliveredAt_idx`(`tenantId`, `deliveredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingProfile` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `legalName` VARCHAR(240) NOT NULL,
    `taxIdentifier` VARCHAR(120) NULL,
    `address` JSON NOT NULL,
    `email` VARCHAR(320) NULL,
    `defaultCurrency` CHAR(3) NOT NULL,
    `defaultTermsDays` INTEGER NOT NULL DEFAULT 0,
    `invoicePrefix` VARCHAR(20) NOT NULL DEFAULT 'INV',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BillingProfile_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentSequence` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `year` INTEGER NOT NULL,
    `nextValue` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DocumentSequence_tenantId_kind_year_key`(`tenantId`, `kind`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingInvoice` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `customerId` CHAR(36) NULL,
    `businessAccountId` CHAR(36) NULL,
    `commerceOrderId` CHAR(36) NULL,
    `businessOrderId` CHAR(36) NULL,
    `logisticsClientId` CHAR(36) NULL,
    `sourceType` VARCHAR(60) NOT NULL,
    `sourceId` CHAR(36) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ISSUED',
    `currency` CHAR(3) NOT NULL,
    `subtotalMinor` BIGINT NOT NULL,
    `taxMinor` BIGINT NOT NULL DEFAULT 0,
    `totalMinor` BIGINT NOT NULL,
    `paidMinor` BIGINT NOT NULL DEFAULT 0,
    `billingSnapshot` JSON NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `documentObjectKey` VARCHAR(500) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingInvoice_tenantId_customerId_status_dueAt_idx`(`tenantId`, `customerId`, `status`, `dueAt`),
    INDEX `BillingInvoice_tenantId_businessAccountId_status_dueAt_idx`(`tenantId`, `businessAccountId`, `status`, `dueAt`),
    UNIQUE INDEX `BillingInvoice_tenantId_number_key`(`tenantId`, `number`),
    UNIQUE INDEX `BillingInvoice_tenantId_sourceType_sourceId_key`(`tenantId`, `sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `kind` VARCHAR(60) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitMinor` BIGINT NOT NULL,
    `totalMinor` BIGINT NOT NULL,
    `taxMinor` BIGINT NOT NULL DEFAULT 0,
    `metadata` JSON NULL,

    INDEX `InvoiceLine_tenantId_invoiceId_idx`(`tenantId`, `invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoicePaymentSchedule` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `amountMinor` BIGINT NOT NULL,
    `paidMinor` BIGINT NOT NULL DEFAULT 0,
    `dueAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DUE',
    `sequence` INTEGER NOT NULL,

    INDEX `InvoicePaymentSchedule_tenantId_status_dueAt_idx`(`tenantId`, `status`, `dueAt`),
    UNIQUE INDEX `InvoicePaymentSchedule_tenantId_invoiceId_sequence_key`(`tenantId`, `invoiceId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSession` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `scheduleId` CHAR(36) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `providerReference` VARCHAR(240) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    `amountMinor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `checkoutUrl` VARCHAR(1000) NOT NULL,
    `idempotencyKey` VARCHAR(160) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentSession_tenantId_status_expiresAt_idx`(`tenantId`, `status`, `expiresAt`),
    UNIQUE INDEX `PaymentSession_provider_providerReference_key`(`provider`, `providerReference`),
    UNIQUE INDEX `PaymentSession_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NULL,
    `provider` VARCHAR(40) NOT NULL,
    `providerEventId` VARCHAR(240) NOT NULL,
    `eventType` VARCHAR(120) NOT NULL,
    `payloadHash` CHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'RECEIVED',
    `error` VARCHAR(1000) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    INDEX `PaymentEvent_tenantId_status_receivedAt_idx`(`tenantId`, `status`, `receivedAt`),
    UNIQUE INDEX `PaymentEvent_provider_providerEventId_key`(`provider`, `providerEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAllocation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `scheduleId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `amountMinor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `allocatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentAllocation_tenantId_invoiceId_allocatedAt_idx`(`tenantId`, `invoiceId`, `allocatedAt`),
    UNIQUE INDEX `PaymentAllocation_tenantId_sessionId_key`(`tenantId`, `sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentRefund` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `providerReference` VARCHAR(240) NULL,
    `amountMinor` BIGINT NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    `requestedBy` CHAR(36) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentRefund_tenantId_invoiceId_status_idx`(`tenantId`, `invoiceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditNote` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `amountMinor` BIGINT NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ISSUED',
    `issuedBy` CHAR(36) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreditNote_tenantId_invoiceId_idx`(`tenantId`, `invoiceId`),
    UNIQUE INDEX `CreditNote_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FreightStop` ADD CONSTRAINT `FreightStop_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `FreightRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoItem` ADD CONSTRAINT `CargoItem_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `FreightRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `FreightRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `FreightBooking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportRateRule` ADD CONSTRAINT `TransportRateRule_rateCardId_fkey` FOREIGN KEY (`rateCardId`) REFERENCES `TransportRateCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightEstimate` ADD CONSTRAINT `FreightEstimate_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `FreightRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightQuote` ADD CONSTRAINT `FreightQuote_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `FreightRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightQuoteLine` ADD CONSTRAINT `FreightQuoteLine_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `FreightQuote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `FreightRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `FreightQuote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `BillingInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportDriver` ADD CONSTRAINT `TransportDriver_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `TransportCarrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportVehicle` ADD CONSTRAINT `TransportVehicle_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `TransportCarrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportLeg` ADD CONSTRAINT `TransportLeg_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `FreightBooking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportLeg` ADD CONSTRAINT `TransportLeg_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `TransportCarrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportMilestone` ADD CONSTRAINT `TransportMilestone_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `FreightBooking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportMilestone` ADD CONSTRAINT `TransportMilestone_legId_fkey` FOREIGN KEY (`legId`) REFERENCES `TransportLeg`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightException` ADD CONSTRAINT `FreightException_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `FreightBooking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightException` ADD CONSTRAINT `FreightException_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `DispatchAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchAssignment` ADD CONSTRAINT `DispatchAssignment_legId_fkey` FOREIGN KEY (`legId`) REFERENCES `TransportLeg`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchAssignment` ADD CONSTRAINT `DispatchAssignment_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `TransportCarrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchAssignment` ADD CONSTRAINT `DispatchAssignment_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `TransportDriver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchAssignment` ADD CONSTRAINT `DispatchAssignment_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `TransportVehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriverCheckIn` ADD CONSTRAINT `DriverCheckIn_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `DispatchAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProofOfDelivery` ADD CONSTRAINT `ProofOfDelivery_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `FreightBooking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `BillingInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoicePaymentSchedule` ADD CONSTRAINT `InvoicePaymentSchedule_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `BillingInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSession` ADD CONSTRAINT `PaymentSession_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `InvoicePaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentEvent` ADD CONSTRAINT `PaymentEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PaymentSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `BillingInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `InvoicePaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PaymentSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentRefund` ADD CONSTRAINT `PaymentRefund_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `BillingInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentRefund` ADD CONSTRAINT `PaymentRefund_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PaymentSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNote` ADD CONSTRAINT `CreditNote_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `BillingInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the database-level tenant boundary used by every earlier phase.
ALTER TABLE `FreightRequest` ADD CONSTRAINT `FreightRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightStop` ADD CONSTRAINT `FreightStop_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CargoItem` ADD CONSTRAINT `CargoItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TransportRateCard` ADD CONSTRAINT `TransportRateCard_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TransportRateRule` ADD CONSTRAINT `TransportRateRule_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightEstimate` ADD CONSTRAINT `FreightEstimate_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightQuote` ADD CONSTRAINT `FreightQuote_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightQuoteLine` ADD CONSTRAINT `FreightQuoteLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TransportCarrier` ADD CONSTRAINT `TransportCarrier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TransportDriver` ADD CONSTRAINT `TransportDriver_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TransportVehicle` ADD CONSTRAINT `TransportVehicle_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TransportLeg` ADD CONSTRAINT `TransportLeg_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TransportMilestone` ADD CONSTRAINT `TransportMilestone_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightException` ADD CONSTRAINT `FreightException_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DispatchAssignment` ADD CONSTRAINT `DispatchAssignment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DriverCheckIn` ADD CONSTRAINT `DriverCheckIn_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProofOfDelivery` ADD CONSTRAINT `ProofOfDelivery_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BillingProfile` ADD CONSTRAINT `BillingProfile_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DocumentSequence` ADD CONSTRAINT `DocumentSequence_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BillingInvoice` ADD CONSTRAINT `BillingInvoice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InvoicePaymentSchedule` ADD CONSTRAINT `InvoicePaymentSchedule_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PaymentSession` ADD CONSTRAINT `PaymentSession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PaymentEvent` ADD CONSTRAINT `PaymentEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PaymentRefund` ADD CONSTRAINT `PaymentRefund_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditNote` ADD CONSTRAINT `CreditNote_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
