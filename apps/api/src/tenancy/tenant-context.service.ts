import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { TenantContext } from '@logicommerce/database';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, next: () => T): T {
    return this.storage.run(context, next);
  }

  get(): TenantContext {
    const context = this.storage.getStore();
    if (!context) throw new Error('Tenant context is unavailable');
    return context;
  }

  setActor(actorId: string): void {
    const context = this.get();
    this.storage.enterWith({ ...context, actorId });
  }
}
