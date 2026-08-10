import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { ContactCryptoService } from './contact-crypto.service.js';
import {
  DispatchController,
  FreightController,
  FreightOperationsController,
} from './freight.controller.js';
import { FreightRepository } from './freight.repository.js';
import { DocumentScannerService } from './document-scanner.service.js';
import { StorageSigningService } from './storage-signing.service.js';

@Module({
  imports: [TenantContextModule],
  controllers: [FreightController, FreightOperationsController, DispatchController],
  providers: [
    FreightRepository,
    ContactCryptoService,
    StorageSigningService,
    DocumentScannerService,
  ],
  exports: [StorageSigningService],
})
export class FreightModule {}
