import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import type { ProblemDetails } from '@logicommerce/api-contracts';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const response = context.getResponse<FastifyReply>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.headers['x-request-id']?.toString() ?? 'unknown';
    const safeDetail = status >= 500 ? 'An unexpected error occurred.' : this.message(exception);
    const problem: ProblemDetails = {
      type: `https://logicommerce.local/problems/${status === 404 ? 'not-found' : 'request-failed'}`,
      title: status === 404 ? 'Resource not found' : 'Request failed',
      status,
      code: status === 404 ? 'RESOURCE_NOT_FOUND' : `HTTP_${status}`,
      detail: safeDetail,
      instance: request.url,
      requestId,
      errors: [],
    };
    if (status >= 500) this.logger.error({ err: exception, requestId }, 'Unhandled API error');
    void response.status(status).send(problem);
  }

  private message(exception: unknown): string {
    if (!(exception instanceof HttpException)) return 'Request failed.';
    const body: unknown = exception.getResponse();
    if (typeof body === 'string') return body;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
    return exception.message;
  }
}
