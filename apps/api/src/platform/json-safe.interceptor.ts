import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

@Injectable()
export class JsonSafeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value: unknown) => this.serialize(value)));
  }

  private serialize(value: unknown): unknown {
    if (typeof value === 'bigint') {
      const number = Number(value);
      return Number.isSafeInteger(number) ? number : value.toString();
    }
    if (
      value instanceof Date ||
      Buffer.isBuffer(value) ||
      value instanceof Uint8Array ||
      value === null ||
      typeof value !== 'object'
    ) {
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
    );
  }
}
