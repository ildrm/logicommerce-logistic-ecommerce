CREATE TABLE `IdentityToken` (
  `id` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `userId` CHAR(36) NULL,
  `email` VARCHAR(320) NOT NULL,
  `purpose` ENUM('EMAIL_VERIFICATION','PASSWORD_RESET','PASSWORDLESS_LOGIN') NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `IdentityToken_tokenHash_key`(`tokenHash`),
  INDEX `IdentityToken_tenant_email_purpose_consumed_idx`(`tenantId`,`email`,`purpose`,`consumedAt`),
  INDEX `IdentityToken_expires_idx`(`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `IdentityToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `IdentityToken_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `MfaCredential` (
  `id` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `kind` ENUM('TOTP') NOT NULL,
  `secretCiphertext` VARCHAR(512) NOT NULL,
  `confirmedAt` DATETIME(3) NULL,
  `lastUsedStep` BIGINT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MfaCredential_tenant_user_kind_key`(`tenantId`,`userId`,`kind`),
  INDEX `MfaCredential_tenant_confirmed_idx`(`tenantId`,`confirmedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MfaCredential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MfaCredential_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `MfaRecoveryCode` (
  `id` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `credentialId` CHAR(36) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MfaRecoveryCode_codeHash_key`(`codeHash`),
  INDEX `MfaRecoveryCode_tenant_credential_consumed_idx`(`tenantId`,`credentialId`,`consumedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MfaRecoveryCode_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `MfaCredential`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MfaRecoveryCode_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `ApiCredential` (
  `id` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `keyPrefix` VARCHAR(24) NOT NULL,
  `secretHash` CHAR(64) NOT NULL,
  `scopes` JSON NOT NULL,
  `ipPolicy` JSON NULL,
  `expiresAt` DATETIME(3) NULL,
  `lastUsedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ApiCredential_keyPrefix_key`(`keyPrefix`),
  UNIQUE INDEX `ApiCredential_secretHash_key`(`secretHash`),
  INDEX `ApiCredential_tenant_revoked_expires_idx`(`tenantId`,`revokedAt`,`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ApiCredential_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;
