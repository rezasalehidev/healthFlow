import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CORRELATION_ID_KEY, REQUEST_ID_KEY } from '../constants/headers';
import type { RequestWithContext } from '../middleware/correlation-id.middleware';

/**
 * Structured access logging with correlation and request IDs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const { method, url } = request;
    const requestId = request[REQUEST_ID_KEY];
    const correlationId = request[CORRELATION_ID_KEY];
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          this.logger.log({
            message: 'request completed',
            method,
            url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            requestId,
            correlationId,
          });
        },
        error: () => {
          this.logger.warn({
            message: 'request failed',
            method,
            url,
            durationMs: Date.now() - startedAt,
            requestId,
            correlationId,
          });
        },
      }),
    );
  }
}
