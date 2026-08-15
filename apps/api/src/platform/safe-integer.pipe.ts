import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

@Injectable()
export class SafeIntegerPipe implements PipeTransform {
  transform(value: unknown): unknown {
    this.assertSafe(value);
    return value;
  }

  private assertSafe(value: unknown): void {
    if (typeof value === 'number') {
      if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
        throw new BadRequestException('Integer values must be within the JavaScript safe range');
      }
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const child of Object.values(value)) this.assertSafe(child);
  }
}
