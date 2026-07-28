-- CreateTable
CREATE TABLE `InternationalCodeList` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `authority` VARCHAR(40) NOT NULL,
    `listName` VARCHAR(120) NOT NULL,
    `version` VARCHAR(60) NOT NULL,
    `effectiveAt` DATETIME(3) NOT NULL,
    `sourceUrl` VARCHAR(1000) NULL,
    `checksum` CHAR(64) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `importedBy` CHAR(36) NOT NULL,
    `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InternationalCodeList_tenantId_authority_status_effectiveAt_idx`(`tenantId`, `authority`, `status`, `effectiveAt`),
    UNIQUE INDEX `InternationalCodeList_tenantId_authority_listName_version_key`(`tenantId`, `authority`, `listName`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StandardLocation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `unLocode` CHAR(5) NULL,
    `childCode` VARCHAR(20) NULL,
    `iataCode` CHAR(3) NULL,
    `impcCode` CHAR(6) NULL,
    `gln` CHAR(13) NULL,
    `name` VARCHAR(200) NOT NULL,
    `countryCode` CHAR(2) NOT NULL,
    `subdivisionCode` VARCHAR(6) NULL,
    `functions` JSON NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `timeZone` VARCHAR(80) NULL,
    `standardVersion` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StandardLocation_tenantId_countryCode_status_idx`(`tenantId`, `countryCode`, `status`),
    INDEX `StandardLocation_tenantId_iataCode_idx`(`tenantId`, `iataCode`),
    INDEX `StandardLocation_tenantId_impcCode_idx`(`tenantId`, `impcCode`),
    UNIQUE INDEX `StandardLocation_tenantId_unLocode_childCode_key`(`tenantId`, `unLocode`, `childCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportParty` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `legalName` VARCHAR(240) NOT NULL,
    `identifiers` JSON NULL,
    `address` JSON NOT NULL,
    `contacts` JSON NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportParty_tenantId_kind_status_idx`(`tenantId`, `kind`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportConsignment` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `ginc` VARCHAR(30) NULL,
    `gsIn` VARCHAR(30) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    `consignorId` CHAR(36) NOT NULL,
    `consigneeId` CHAR(36) NOT NULL,
    `originLocationId` CHAR(36) NOT NULL,
    `destinationLocationId` CHAR(36) NOT NULL,
    `transportContractType` VARCHAR(40) NOT NULL,
    `serviceLevel` VARCHAR(40) NULL,
    `incoterm` VARCHAR(20) NULL,
    `packageCount` INTEGER NOT NULL,
    `grossWeightGrams` BIGINT NOT NULL,
    `grossVolumeCubicCm` BIGINT NULL,
    `goodsDescription` VARCHAR(1000) NOT NULL,
    `commodityCodes` JSON NULL,
    `dangerousGoods` JSON NULL,
    `temperatureControl` JSON NULL,
    `customsStatus` VARCHAR(40) NOT NULL DEFAULT 'NOT_REQUIRED',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportConsignment_tenantId_bookingId_status_idx`(`tenantId`, `bookingId`, `status`),
    UNIQUE INDEX `TransportConsignment_tenantId_number_key`(`tenantId`, `number`),
    UNIQUE INDEX `TransportConsignment_tenantId_ginc_key`(`tenantId`, `ginc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportDocument` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `consignmentId` CHAR(36) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `number` VARCHAR(120) NOT NULL,
    `standard` VARCHAR(80) NOT NULL,
    `standardVersion` VARCHAR(40) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    `revision` INTEGER NOT NULL DEFAULT 1,
    `payload` JSON NOT NULL,
    `supersedesId` CHAR(36) NULL,
    `issuedBy` CHAR(36) NULL,
    `issuedAt` DATETIME(3) NULL,
    `signedAt` DATETIME(3) NULL,
    `surrenderedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TransportDocument_tenantId_type_status_issuedAt_idx`(`tenantId`, `type`, `status`, `issuedAt`),
    UNIQUE INDEX `TransportDocument_tenantId_consignmentId_type_revision_key`(`tenantId`, `consignmentId`, `type`, `revision`),
    UNIQUE INDEX `TransportDocument_tenantId_number_revision_key`(`tenantId`, `number`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomsFiling` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `consignmentId` CHAR(36) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `direction` VARCHAR(20) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    `mrn` VARCHAR(80) NULL,
    `customsOfficeCode` VARCHAR(40) NULL,
    `dataModel` VARCHAR(40) NOT NULL DEFAULT 'WCO_DM',
    `dataModelVersion` VARCHAR(40) NULL,
    `declaration` JSON NOT NULL,
    `response` JSON NULL,
    `lodgedBy` CHAR(36) NULL,
    `lodgedAt` DATETIME(3) NULL,
    `releasedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomsFiling_tenantId_status_direction_createdAt_idx`(`tenantId`, `status`, `direction`, `createdAt`),
    INDEX `CustomsFiling_tenantId_mrn_idx`(`tenantId`, `mrn`),
    UNIQUE INDEX `CustomsFiling_tenantId_consignmentId_type_version_key`(`tenantId`, `consignmentId`, `type`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoInsuranceProvider` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `countries` JSON NOT NULL,
    `modes` JSON NOT NULL,
    `currencies` JSON NOT NULL,
    `licenseRefs` JSON NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CargoInsuranceProvider_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `CargoInsuranceProvider_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoInsuranceProduct` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `providerId` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `policyType` VARCHAR(40) NOT NULL,
    `coverageLevel` VARCHAR(40) NOT NULL,
    `clauses` JSON NOT NULL,
    `exclusions` JSON NULL,
    `supportedModes` JSON NOT NULL,
    `supportedCountries` JSON NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `rateBasisPoints` INTEGER NOT NULL,
    `minimumPremiumMinor` BIGINT NOT NULL DEFAULT 0,
    `deductibleType` VARCHAR(40) NOT NULL,
    `deductibleValue` INTEGER NOT NULL,
    `valuationUpliftPercent` INTEGER NOT NULL DEFAULT 10,
    `maxInsuredValueMinor` BIGINT NULL,
    `effectiveAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',

    INDEX `CargoInsuranceProduct_tenantId_status_coverageLevel_effectiv_idx`(`tenantId`, `status`, `coverageLevel`, `effectiveAt`),
    UNIQUE INDEX `CargoInsuranceProduct_tenantId_providerId_code_version_key`(`tenantId`, `providerId`, `code`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoInsuranceQuote` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'QUOTED',
    `currency` CHAR(3) NOT NULL,
    `declaredValueMinor` BIGINT NOT NULL,
    `insuredValueMinor` BIGINT NOT NULL,
    `premiumMinor` BIGINT NOT NULL,
    `taxMinor` BIGINT NOT NULL DEFAULT 0,
    `totalMinor` BIGINT NOT NULL,
    `coverageStartAt` DATETIME(3) NOT NULL,
    `coverageEndAt` DATETIME(3) NOT NULL,
    `clausesSnapshot` JSON NOT NULL,
    `exclusionsSnapshot` JSON NULL,
    `deductibleSnapshot` JSON NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `createdBy` CHAR(36) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CargoInsuranceQuote_tenantId_requestId_status_validUntil_idx`(`tenantId`, `requestId`, `status`, `validUntil`),
    UNIQUE INDEX `CargoInsuranceQuote_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoInsurancePolicy` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `quoteId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NULL,
    `policyNumber` VARCHAR(120) NOT NULL,
    `certificateNumber` VARCHAR(120) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'BOUND',
    `currency` CHAR(3) NOT NULL,
    `insuredValueMinor` BIGINT NOT NULL,
    `premiumMinor` BIGINT NOT NULL,
    `deductible` JSON NOT NULL,
    `clauses` JSON NOT NULL,
    `exclusions` JSON NULL,
    `coverageStartAt` DATETIME(3) NOT NULL,
    `coverageEndAt` DATETIME(3) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CargoInsurancePolicy_quoteId_key`(`quoteId`),
    INDEX `CargoInsurancePolicy_tenantId_requestId_bookingId_status_idx`(`tenantId`, `requestId`, `bookingId`, `status`),
    UNIQUE INDEX `CargoInsurancePolicy_tenantId_policyNumber_key`(`tenantId`, `policyNumber`),
    UNIQUE INDEX `CargoInsurancePolicy_tenantId_certificateNumber_key`(`tenantId`, `certificateNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoInsuranceClaim` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `policyId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    `cause` VARCHAR(80) NOT NULL,
    `lossOccurredAt` DATETIME(3) NOT NULL,
    `discoveredAt` DATETIME(3) NOT NULL,
    `lossLocation` VARCHAR(240) NOT NULL,
    `description` VARCHAR(2000) NOT NULL,
    `claimedAmountMinor` BIGINT NOT NULL,
    `approvedAmountMinor` BIGINT NULL,
    `paidAmountMinor` BIGINT NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL,
    `evidence` JSON NULL,
    `survey` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `submittedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CargoInsuranceClaim_tenantId_policyId_status_createdAt_idx`(`tenantId`, `policyId`, `status`, `createdAt`),
    UNIQUE INDEX `CargoInsuranceClaim_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoInsuranceClaimEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `claimId` CHAR(36) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `fromStatus` VARCHAR(40) NULL,
    `toStatus` VARCHAR(40) NULL,
    `note` VARCHAR(1000) NULL,
    `evidence` JSON NULL,
    `actorId` CHAR(36) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CargoInsuranceClaimEvent_tenantId_claimId_occurredAt_idx`(`tenantId`, `claimId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogisticsHub` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `locationId` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `customsBonded` BOOLEAN NOT NULL DEFAULT false,
    `capabilities` JSON NOT NULL,
    `operatingCalendar` JSON NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LogisticsHub_tenantId_type_status_idx`(`tenantId`, `type`, `status`),
    UNIQUE INDEX `LogisticsHub_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HandlingUnit` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `sscc` CHAR(18) NULL,
    `externalIdentifier` VARCHAR(120) NULL,
    `type` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'CREATED',
    `parentId` CHAR(36) NULL,
    `currentHubId` CHAR(36) NULL,
    `owner` VARCHAR(160) NULL,
    `sealNumber` VARCHAR(80) NULL,
    `tareWeightGrams` BIGINT NOT NULL DEFAULT 0,
    `grossWeightGrams` BIGINT NOT NULL,
    `verifiedGrossMassGrams` BIGINT NULL,
    `vgmMethod` VARCHAR(20) NULL,
    `vgmVerifiedBy` CHAR(36) NULL,
    `vgmVerifiedAt` DATETIME(3) NULL,
    `volumeCubicCm` BIGINT NULL,
    `dimensions` JSON NULL,
    `dangerousGoods` JSON NULL,
    `temperatureControl` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HandlingUnit_tenantId_type_status_currentHubId_idx`(`tenantId`, `type`, `status`, `currentHubId`),
    UNIQUE INDEX `HandlingUnit_tenantId_sscc_key`(`tenantId`, `sscc`),
    UNIQUE INDEX `HandlingUnit_tenantId_externalIdentifier_key`(`tenantId`, `externalIdentifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HandlingUnitContent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `handlingUnitId` CHAR(36) NOT NULL,
    `cargoItemId` CHAR(36) NOT NULL,
    `packageCount` INTEGER NOT NULL,
    `weightGrams` BIGINT NOT NULL,
    `volumeCubicCm` BIGINT NULL,

    INDEX `HandlingUnitContent_tenantId_cargoItemId_idx`(`tenantId`, `cargoItemId`),
    UNIQUE INDEX `HandlingUnitContent_tenantId_handlingUnitId_cargoItemId_key`(`tenantId`, `handlingUnitId`, `cargoItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HandlingEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `handlingUnitId` CHAR(36) NOT NULL,
    `hubId` CHAR(36) NULL,
    `type` VARCHAR(80) NOT NULL,
    `condition` VARCHAR(40) NULL,
    `locationText` VARCHAR(240) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(40) NOT NULL,
    `externalKey` VARCHAR(160) NOT NULL,
    `data` JSON NULL,
    `recordedBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HandlingEvent_tenantId_hubId_occurredAt_idx`(`tenantId`, `hubId`, `occurredAt`),
    UNIQUE INDEX `HandlingEvent_tenantId_handlingUnitId_externalKey_key`(`tenantId`, `handlingUnitId`, `externalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsolidationPlan` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    `mode` VARCHAR(20) NOT NULL,
    `serviceLevel` VARCHAR(40) NULL,
    `originHubId` CHAR(36) NOT NULL,
    `destinationHubId` CHAR(36) NOT NULL,
    `cutoffAt` DATETIME(3) NOT NULL,
    `plannedDepartureAt` DATETIME(3) NOT NULL,
    `plannedArrivalAt` DATETIME(3) NOT NULL,
    `maxWeightGrams` BIGINT NULL,
    `maxVolumeCubicCm` BIGINT NULL,
    `equipmentType` VARCHAR(60) NULL,
    `masterReference` VARCHAR(120) NULL,
    `sealNumber` VARCHAR(80) NULL,
    `route` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` CHAR(36) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `departedAt` DATETIME(3) NULL,
    `arrivedAt` DATETIME(3) NULL,
    `deconsolidatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConsolidationPlan_tenantId_status_cutoffAt_plannedDepartureA_idx`(`tenantId`, `status`, `cutoffAt`, `plannedDepartureAt`),
    UNIQUE INDEX `ConsolidationPlan_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsolidationMember` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NOT NULL,
    `consignmentId` CHAR(36) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ALLOCATED',
    `allocatedWeightGrams` BIGINT NOT NULL,
    `allocatedVolumeCubicCm` BIGINT NULL,
    `packageCount` INTEGER NOT NULL,
    `loadingPriority` INTEGER NOT NULL DEFAULT 100,
    `finalDestination` VARCHAR(240) NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unloadedAt` DATETIME(3) NULL,

    INDEX `ConsolidationMember_tenantId_bookingId_status_idx`(`tenantId`, `bookingId`, `status`),
    UNIQUE INDEX `ConsolidationMember_tenantId_planId_bookingId_key`(`tenantId`, `planId`, `bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsolidationLoad` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `handlingUnitId` CHAR(36) NOT NULL,
    `loadSequence` INTEGER NOT NULL,
    `position` VARCHAR(80) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PLANNED',
    `loadedAt` DATETIME(3) NULL,
    `unloadedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConsolidationLoad_tenantId_planId_handlingUnitId_key`(`tenantId`, `planId`, `handlingUnitId`),
    UNIQUE INDEX `ConsolidationLoad_tenantId_planId_loadSequence_key`(`tenantId`, `planId`, `loadSequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InternationalLinehaul` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'SCHEDULED',
    `mode` VARCHAR(20) NOT NULL,
    `originLocationId` CHAR(36) NOT NULL,
    `destinationLocationId` CHAR(36) NOT NULL,
    `carrierId` CHAR(36) NULL,
    `conveyanceReference` VARCHAR(120) NULL,
    `equipmentIdentifier` VARCHAR(120) NULL,
    `scheduledDepartureAt` DATETIME(3) NOT NULL,
    `scheduledArrivalAt` DATETIME(3) NOT NULL,
    `actualDepartureAt` DATETIME(3) NULL,
    `actualArrivalAt` DATETIME(3) NULL,
    `maxWeightGrams` BIGINT NULL,
    `maxVolumeCubicCm` BIGINT NULL,
    `route` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InternationalLinehaul_tenantId_mode_status_scheduledDepartur_idx`(`tenantId`, `mode`, `status`, `scheduledDepartureAt`),
    UNIQUE INDEX `InternationalLinehaul_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InternationalLinehaulAllocation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `linehaulId` CHAR(36) NOT NULL,
    `consolidationPlanId` CHAR(36) NOT NULL,
    `allocatedWeightGrams` BIGINT NOT NULL,
    `allocatedVolumeCubicCm` BIGINT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'BOOKED',

    UNIQUE INDEX `InternationalLinehaulAllocation_tenantId_linehaulId_consolid_key`(`tenantId`, `linehaulId`, `consolidationPlanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalOperator` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `countryCode` CHAR(2) NOT NULL,
    `designated` BOOLEAN NOT NULL DEFAULT false,
    `identifiers` JSON NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PostalOperator_tenantId_countryCode_status_idx`(`tenantId`, `countryCode`, `status`),
    UNIQUE INDEX `PostalOperator_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalProduct` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `operatorId` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `tracked` BOOLEAN NOT NULL DEFAULT true,
    `registered` BOOLEAN NOT NULL DEFAULT false,
    `insured` BOOLEAN NOT NULL DEFAULT false,
    `signatureRequired` BOOLEAN NOT NULL DEFAULT false,
    `customsRequired` BOOLEAN NOT NULL DEFAULT false,
    `maxWeightGrams` BIGINT NULL,
    `maxDimensions` JSON NULL,
    `serviceStandard` JSON NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',

    UNIQUE INDEX `PostalProduct_tenantId_operatorId_code_key`(`tenantId`, `operatorId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalItem` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `operatorId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `s10Identifier` CHAR(13) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'ACCEPTED',
    `originCountryCode` CHAR(2) NOT NULL,
    `destinationCountryCode` CHAR(2) NOT NULL,
    `sender` JSON NOT NULL,
    `recipient` JSON NOT NULL,
    `contentDescription` VARCHAR(1000) NOT NULL,
    `weightGrams` BIGINT NOT NULL,
    `dimensions` JSON NULL,
    `declaredValueMinor` BIGINT NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL,
    `customsData` JSON NULL,
    `postageMinor` BIGINT NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PostalItem_tenantId_customerId_status_createdAt_idx`(`tenantId`, `customerId`, `status`, `createdAt`),
    UNIQUE INDEX `PostalItem_tenantId_s10Identifier_key`(`tenantId`, `s10Identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalReceptacle` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `operatorId` CHAR(36) NOT NULL,
    `handlingUnitId` CHAR(36) NULL,
    `receptacleId` VARCHAR(35) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `mailCategory` VARCHAR(40) NOT NULL,
    `originImpcCode` CHAR(6) NOT NULL,
    `destinationImpcCode` CHAR(6) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    `sealNumber` VARCHAR(80) NULL,
    `grossWeightGrams` BIGINT NULL,
    `closedAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PostalReceptacle_handlingUnitId_key`(`handlingUnitId`),
    INDEX `PostalReceptacle_tenantId_originImpcCode_destinationImpcCode_idx`(`tenantId`, `originImpcCode`, `destinationImpcCode`, `status`),
    UNIQUE INDEX `PostalReceptacle_tenantId_receptacleId_key`(`tenantId`, `receptacleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalReceptacleItem` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `receptacleId` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `loadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unloadedAt` DATETIME(3) NULL,

    INDEX `PostalReceptacleItem_tenantId_itemId_idx`(`tenantId`, `itemId`),
    UNIQUE INDEX `PostalReceptacleItem_tenantId_receptacleId_itemId_key`(`tenantId`, `receptacleId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalDispatch` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `operatorId` CHAR(36) NOT NULL,
    `dispatchId` VARCHAR(35) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    `originImpcCode` CHAR(6) NOT NULL,
    `destinationImpcCode` CHAR(6) NOT NULL,
    `mailCategory` VARCHAR(40) NOT NULL,
    `dispatchNumber` INTEGER NOT NULL,
    `scheduledDepartureAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `handedOverAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PostalDispatch_tenantId_status_scheduledDepartureAt_idx`(`tenantId`, `status`, `scheduledDepartureAt`),
    UNIQUE INDEX `PostalDispatch_tenantId_dispatchId_key`(`tenantId`, `dispatchId`),
    UNIQUE INDEX `PostalDispatch_tenantId_originImpcCode_destinationImpcCode_m_key`(`tenantId`, `originImpcCode`, `destinationImpcCode`, `mailCategory`, `dispatchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalDispatchReceptacle` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `dispatchId` CHAR(36) NOT NULL,
    `receptacleId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,

    UNIQUE INDEX `PostalDispatchReceptacle_tenantId_dispatchId_receptacleId_key`(`tenantId`, `dispatchId`, `receptacleId`),
    UNIQUE INDEX `PostalDispatchReceptacle_tenantId_dispatchId_sequence_key`(`tenantId`, `dispatchId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalConsignment` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `operatorId` CHAR(36) NOT NULL,
    `consignmentId` VARCHAR(12) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PLANNED',
    `carrierId` CHAR(36) NULL,
    `transportReference` VARCHAR(120) NULL,
    `originImpcCode` CHAR(6) NOT NULL,
    `destinationImpcCode` CHAR(6) NOT NULL,
    `scheduledDepartureAt` DATETIME(3) NULL,
    `scheduledArrivalAt` DATETIME(3) NULL,
    `handedOverAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostalConsignment_tenantId_status_scheduledDepartureAt_idx`(`tenantId`, `status`, `scheduledDepartureAt`),
    UNIQUE INDEX `PostalConsignment_tenantId_consignmentId_key`(`tenantId`, `consignmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalConsignmentReceptacle` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `consignmentId` CHAR(36) NOT NULL,
    `receptacleId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,

    UNIQUE INDEX `PostalConsignmentReceptacle_tenantId_consignmentId_receptacl_key`(`tenantId`, `consignmentId`, `receptacleId`),
    UNIQUE INDEX `PostalConsignmentReceptacle_tenantId_consignmentId_sequence_key`(`tenantId`, `consignmentId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostalEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NULL,
    `receptacleId` CHAR(36) NULL,
    `dispatchId` CHAR(36) NULL,
    `standard` VARCHAR(40) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `locationCode` VARCHAR(40) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(40) NOT NULL,
    `externalKey` VARCHAR(160) NOT NULL,
    `data` JSON NULL,
    `recordedBy` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostalEvent_tenantId_itemId_occurredAt_idx`(`tenantId`, `itemId`, `occurredAt`),
    INDEX `PostalEvent_tenantId_receptacleId_occurredAt_idx`(`tenantId`, `receptacleId`, `occurredAt`),
    INDEX `PostalEvent_tenantId_dispatchId_occurredAt_idx`(`tenantId`, `dispatchId`, `occurredAt`),
    UNIQUE INDEX `PostalEvent_tenantId_standard_externalKey_key`(`tenantId`, `standard`, `externalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TransportConsignment` ADD CONSTRAINT `TransportConsignment_consignorId_fkey` FOREIGN KEY (`consignorId`) REFERENCES `TransportParty`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportConsignment` ADD CONSTRAINT `TransportConsignment_consigneeId_fkey` FOREIGN KEY (`consigneeId`) REFERENCES `TransportParty`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportConsignment` ADD CONSTRAINT `TransportConsignment_originLocationId_fkey` FOREIGN KEY (`originLocationId`) REFERENCES `StandardLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportConsignment` ADD CONSTRAINT `TransportConsignment_destinationLocationId_fkey` FOREIGN KEY (`destinationLocationId`) REFERENCES `StandardLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportDocument` ADD CONSTRAINT `TransportDocument_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `TransportConsignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomsFiling` ADD CONSTRAINT `CustomsFiling_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `TransportConsignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoInsuranceProduct` ADD CONSTRAINT `CargoInsuranceProduct_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `CargoInsuranceProvider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoInsuranceQuote` ADD CONSTRAINT `CargoInsuranceQuote_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `CargoInsuranceProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoInsurancePolicy` ADD CONSTRAINT `CargoInsurancePolicy_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `CargoInsuranceQuote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoInsuranceClaim` ADD CONSTRAINT `CargoInsuranceClaim_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `CargoInsurancePolicy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoInsuranceClaimEvent` ADD CONSTRAINT `CargoInsuranceClaimEvent_claimId_fkey` FOREIGN KEY (`claimId`) REFERENCES `CargoInsuranceClaim`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogisticsHub` ADD CONSTRAINT `LogisticsHub_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `StandardLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandlingUnit` ADD CONSTRAINT `HandlingUnit_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `HandlingUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandlingUnit` ADD CONSTRAINT `HandlingUnit_currentHubId_fkey` FOREIGN KEY (`currentHubId`) REFERENCES `LogisticsHub`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandlingUnitContent` ADD CONSTRAINT `HandlingUnitContent_handlingUnitId_fkey` FOREIGN KEY (`handlingUnitId`) REFERENCES `HandlingUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandlingEvent` ADD CONSTRAINT `HandlingEvent_handlingUnitId_fkey` FOREIGN KEY (`handlingUnitId`) REFERENCES `HandlingUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HandlingEvent` ADD CONSTRAINT `HandlingEvent_hubId_fkey` FOREIGN KEY (`hubId`) REFERENCES `LogisticsHub`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationPlan` ADD CONSTRAINT `ConsolidationPlan_originHubId_fkey` FOREIGN KEY (`originHubId`) REFERENCES `LogisticsHub`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationPlan` ADD CONSTRAINT `ConsolidationPlan_destinationHubId_fkey` FOREIGN KEY (`destinationHubId`) REFERENCES `LogisticsHub`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationMember` ADD CONSTRAINT `ConsolidationMember_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `ConsolidationPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationMember` ADD CONSTRAINT `ConsolidationMember_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `TransportConsignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationLoad` ADD CONSTRAINT `ConsolidationLoad_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `ConsolidationPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsolidationLoad` ADD CONSTRAINT `ConsolidationLoad_handlingUnitId_fkey` FOREIGN KEY (`handlingUnitId`) REFERENCES `HandlingUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternationalLinehaul` ADD CONSTRAINT `InternationalLinehaul_originLocationId_fkey` FOREIGN KEY (`originLocationId`) REFERENCES `StandardLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternationalLinehaul` ADD CONSTRAINT `InternationalLinehaul_destinationLocationId_fkey` FOREIGN KEY (`destinationLocationId`) REFERENCES `StandardLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternationalLinehaulAllocation` ADD CONSTRAINT `InternationalLinehaulAllocation_linehaulId_fkey` FOREIGN KEY (`linehaulId`) REFERENCES `InternationalLinehaul`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternationalLinehaulAllocation` ADD CONSTRAINT `InternationalLinehaulAllocation_consolidationPlanId_fkey` FOREIGN KEY (`consolidationPlanId`) REFERENCES `ConsolidationPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalProduct` ADD CONSTRAINT `PostalProduct_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `PostalOperator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalItem` ADD CONSTRAINT `PostalItem_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `PostalOperator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalItem` ADD CONSTRAINT `PostalItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `PostalProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalReceptacle` ADD CONSTRAINT `PostalReceptacle_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `PostalOperator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalReceptacle` ADD CONSTRAINT `PostalReceptacle_handlingUnitId_fkey` FOREIGN KEY (`handlingUnitId`) REFERENCES `HandlingUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalReceptacleItem` ADD CONSTRAINT `PostalReceptacleItem_receptacleId_fkey` FOREIGN KEY (`receptacleId`) REFERENCES `PostalReceptacle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalReceptacleItem` ADD CONSTRAINT `PostalReceptacleItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `PostalItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalDispatch` ADD CONSTRAINT `PostalDispatch_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `PostalOperator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalDispatchReceptacle` ADD CONSTRAINT `PostalDispatchReceptacle_dispatchId_fkey` FOREIGN KEY (`dispatchId`) REFERENCES `PostalDispatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalDispatchReceptacle` ADD CONSTRAINT `PostalDispatchReceptacle_receptacleId_fkey` FOREIGN KEY (`receptacleId`) REFERENCES `PostalReceptacle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalConsignment` ADD CONSTRAINT `PostalConsignment_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `PostalOperator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalConsignmentReceptacle` ADD CONSTRAINT `PostalConsignmentReceptacle_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `PostalConsignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalConsignmentReceptacle` ADD CONSTRAINT `PostalConsignmentReceptacle_receptacleId_fkey` FOREIGN KEY (`receptacleId`) REFERENCES `PostalReceptacle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalEvent` ADD CONSTRAINT `PostalEvent_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `PostalItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalEvent` ADD CONSTRAINT `PostalEvent_receptacleId_fkey` FOREIGN KEY (`receptacleId`) REFERENCES `PostalReceptacle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostalEvent` ADD CONSTRAINT `PostalEvent_dispatchId_fkey` FOREIGN KEY (`dispatchId`) REFERENCES `PostalDispatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
