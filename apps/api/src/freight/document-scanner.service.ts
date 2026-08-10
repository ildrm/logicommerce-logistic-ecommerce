import { BadGatewayException, Injectable } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';
import { boundedJson } from '../platform/bounded-http.js';
import { StorageSigningService } from './storage-signing.service.js';

@Injectable()
export class DocumentScannerService {
  private readonly environment = parseEnvironment(process.env);

  constructor(private readonly storage: StorageSigningService) {}

  async scan(input: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    checksum: string;
  }): Promise<{ clean: boolean; reference: string; checksum: string }> {
    if (this.environment.DOCUMENT_SCANNER_ADAPTER === 'deterministic') {
      return { clean: true, reference: `local-scan:${input.checksum}`, checksum: input.checksum };
    }
    if (!this.environment.DOCUMENT_SCANNER_URL || !this.environment.DOCUMENT_SCANNER_TOKEN) {
      throw new Error('The HTTP document scanner is not completely configured');
    }
    const download = this.storage.presignGet(input.objectKey, 300);
    const { response, body } = await boundedJson<{
      clean?: unknown;
      reference?: unknown;
      checksum?: unknown;
    }>(
      new URL('/v1/documents/scan', this.environment.DOCUMENT_SCANNER_URL),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.environment.DOCUMENT_SCANNER_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ...input, downloadUrl: download.url }),
      },
      {
        timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
        maxResponseBytes: this.environment.PROVIDER_HTTP_MAX_RESPONSE_BYTES,
      },
    );
    if (
      !response.ok ||
      typeof body.clean !== 'boolean' ||
      typeof body.reference !== 'string' ||
      !body.reference ||
      typeof body.checksum !== 'string' ||
      body.checksum.toLowerCase() !== input.checksum.toLowerCase()
    ) {
      throw new BadGatewayException('Document scanner returned an invalid result');
    }
    return { clean: body.clean, reference: body.reference, checksum: body.checksum };
  }
}
