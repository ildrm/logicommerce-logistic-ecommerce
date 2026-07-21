-- Foundation migration. Append-only tables intentionally expose no update/delete application path.
CREATE TABLE `Tenant` (
  `id` CHAR(36) NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `status` ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `defaultLocale` VARCHAR(20) NOT NULL DEFAULT 'en',
  `defaultCurrency` CHAR(3) NOT NULL DEFAULT 'USD',
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Tenant_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `TenantDomain` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `hostname` VARCHAR(253) NOT NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false, `verifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TenantDomain_hostname_key`(`hostname`), INDEX `TenantDomain_tenantId_idx`(`tenantId`), PRIMARY KEY (`id`),
  CONSTRAINT `TenantDomain_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `User` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `email` VARCHAR(320) NOT NULL,
  `displayName` VARCHAR(160) NOT NULL, `isActive` BOOLEAN NOT NULL DEFAULT true, `verifiedAt` DATETIME(3) NULL,
  `version` INTEGER NOT NULL DEFAULT 1, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_tenantId_email_key`(`tenantId`,`email`), INDEX `User_tenantId_isActive_idx`(`tenantId`,`isActive`), PRIMARY KEY (`id`),
  CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `UserIdentity` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `userId` CHAR(36) NOT NULL,
  `kind` ENUM('PASSWORD','PASSWORDLESS_EMAIL','OIDC','SOCIAL') NOT NULL, `provider` VARCHAR(80) NOT NULL,
  `providerUserId` VARCHAR(255) NOT NULL, `passwordHash` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `UserIdentity_tenant_provider_user_key`(`tenantId`,`provider`,`providerUserId`), INDEX `UserIdentity_tenant_user_idx`(`tenantId`,`userId`), PRIMARY KEY (`id`),
  CONSTRAINT `UserIdentity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `UserSession` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `userId` CHAR(36) NOT NULL,
  `refreshTokenHash` VARCHAR(255) NOT NULL, `userAgentHash` CHAR(64) NULL, `ipPrefix` VARCHAR(64) NULL,
  `expiresAt` DATETIME(3) NOT NULL, `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  INDEX `UserSession_tenant_user_revoked_idx`(`tenantId`,`userId`,`revokedAt`), PRIMARY KEY (`id`),
  CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `RefreshToken` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `sessionId` CHAR(36) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL, `familyId` CHAR(36) NOT NULL, `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL, `revokedAt` DATETIME(3) NULL, `replacedById` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
  INDEX `RefreshToken_tenant_family_idx`(`tenantId`,`familyId`), PRIMARY KEY (`id`),
  CONSTRAINT `RefreshToken_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `UserSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `Role` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `key` VARCHAR(100) NOT NULL, `name` VARCHAR(160) NOT NULL,
  `description` VARCHAR(500) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Role_tenantId_key_key`(`tenantId`,`key`), PRIMARY KEY (`id`),
  CONSTRAINT `Role_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `Permission` (
  `id` CHAR(36) NOT NULL, `key` VARCHAR(120) NOT NULL, `description` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX `Permission_key_key`(`key`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `RolePermission` (
  `roleId` CHAR(36) NOT NULL, `permissionId` CHAR(36) NOT NULL, PRIMARY KEY (`roleId`,`permissionId`),
  CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `UserRole` (
  `tenantId` CHAR(36) NOT NULL, `userId` CHAR(36) NOT NULL, `roleId` CHAR(36) NOT NULL,
  INDEX `UserRole_tenant_role_idx`(`tenantId`,`roleId`), PRIMARY KEY (`tenantId`,`userId`,`roleId`),
  CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `InventoryItem` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `sku` VARCHAR(120) NOT NULL, `facilityId` CHAR(36) NOT NULL,
  `productRef` CHAR(36) NOT NULL, `allowNegative` BOOLEAN NOT NULL DEFAULT false, `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `InventoryItem_tenant_facility_sku_key`(`tenantId`,`facilityId`,`sku`), INDEX `InventoryItem_tenant_product_idx`(`tenantId`,`productRef`), PRIMARY KEY (`id`),
  CONSTRAINT `InventoryItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `InventoryBalance` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `inventoryItemId` CHAR(36) NOT NULL,
  `state` ENUM('EXPECTED','INBOUND','RECEIVING','ON_HAND','RESERVED','ALLOCATED','PICKED','PACKED','SHIPPED','IN_TRANSIT','RETURN_EXPECTED','RETURNED','INSPECTION_PENDING','QUARANTINED','DAMAGED','EXPIRED','RECALLED','LOST','VIRTUAL','BACKORDERED') NOT NULL,
  `quantity` BIGINT NOT NULL DEFAULT 0, `version` INTEGER NOT NULL DEFAULT 1, `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `InventoryBalance_tenant_item_state_key`(`tenantId`,`inventoryItemId`,`state`), INDEX `InventoryBalance_tenant_state_idx`(`tenantId`,`state`), PRIMARY KEY (`id`),
  CONSTRAINT `InventoryBalance_item_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `StockLedgerEntry` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `inventoryItemId` CHAR(36) NOT NULL,
  `state` ENUM('EXPECTED','INBOUND','RECEIVING','ON_HAND','RESERVED','ALLOCATED','PICKED','PACKED','SHIPPED','IN_TRANSIT','RETURN_EXPECTED','RETURNED','INSPECTION_PENDING','QUARANTINED','DAMAGED','EXPIRED','RECALLED','LOST','VIRTUAL','BACKORDERED') NOT NULL,
  `quantityDelta` BIGINT NOT NULL, `operation` VARCHAR(80) NOT NULL, `reasonCode` VARCHAR(120) NOT NULL,
  `sourceType` VARCHAR(80) NOT NULL, `sourceId` CHAR(36) NOT NULL, `idempotencyKey` VARCHAR(160) NOT NULL,
  `correlationId` CHAR(36) NOT NULL, `actorId` CHAR(36) NULL, `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `StockLedger_tenant_idempotency_key`(`tenantId`,`idempotencyKey`), INDEX `StockLedger_tenant_item_time_idx`(`tenantId`,`inventoryItemId`,`occurredAt`), PRIMARY KEY (`id`),
  CONSTRAINT `StockLedger_item_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `InventoryReservation` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `inventoryItemId` CHAR(36) NOT NULL,
  `demandType` VARCHAR(80) NOT NULL, `demandId` CHAR(36) NOT NULL, `quantity` BIGINT NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL, `releasedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Reservation_tenant_item_expiry_idx`(`tenantId`,`inventoryItemId`,`expiresAt`), INDEX `Reservation_tenant_demand_idx`(`tenantId`,`demandType`,`demandId`), PRIMARY KEY (`id`),
  CONSTRAINT `Reservation_item_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `AuditEvent` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `actorId` CHAR(36) NULL, `actorType` VARCHAR(80) NOT NULL,
  `action` VARCHAR(160) NOT NULL, `entityType` VARCHAR(120) NOT NULL, `entityId` CHAR(36) NOT NULL, `reason` VARCHAR(1000) NULL,
  `requestId` CHAR(36) NOT NULL, `correlationId` CHAR(36) NOT NULL, `metadata` JSON NULL,
  `authenticationMethod` VARCHAR(80) NULL, `approvalReference` CHAR(36) NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Audit_tenant_entity_time_idx`(`tenantId`,`entityType`,`entityId`,`occurredAt`), INDEX `Audit_tenant_actor_time_idx`(`tenantId`,`actorId`,`occurredAt`), PRIMARY KEY (`id`),
  CONSTRAINT `Audit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `OutboxEvent` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `type` VARCHAR(160) NOT NULL, `eventVersion` INTEGER NOT NULL DEFAULT 1,
  `subject` VARCHAR(255) NOT NULL, `payload` JSON NOT NULL, `correlationId` CHAR(36) NOT NULL, `causationId` CHAR(36) NULL,
  `status` ENUM('PENDING','PROCESSING','PUBLISHED','FAILED') NOT NULL DEFAULT 'PENDING', `attempts` INTEGER NOT NULL DEFAULT 0,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `publishedAt` DATETIME(3) NULL, `lastErrorCode` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Outbox_status_available_idx`(`status`,`availableAt`), INDEX `Outbox_tenant_type_created_idx`(`tenantId`,`type`,`createdAt`), PRIMARY KEY (`id`),
  CONSTRAINT `Outbox_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `IdempotencyRecord` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `scope` VARCHAR(120) NOT NULL, `keyHash` CHAR(64) NOT NULL,
  `requestHash` CHAR(64) NOT NULL, `responseStatus` INTEGER NULL, `responseBody` JSON NULL, `lockedUntil` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Idempotency_tenant_scope_key_key`(`tenantId`,`scope`,`keyHash`), INDEX `Idempotency_expires_idx`(`expiresAt`), PRIMARY KEY (`id`),
  CONSTRAINT `Idempotency_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;
