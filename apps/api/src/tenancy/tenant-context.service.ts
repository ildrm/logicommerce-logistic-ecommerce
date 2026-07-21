import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { TenantContext } from '@logicommerce/database';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run(context: TenantContext, next: () => void): void {
    this.storage.run(context, next);
  }

  get(): TenantContext {
    const context = this.storage.getStore();
    if (!context) throw new Error('Tenant context is unavailable');
    return context;
  }
}
