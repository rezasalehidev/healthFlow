import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorCode } from '../constants/error-codes';
import { CORRELATION_ID_KEY, REQUEST_ID_KEY } from '../constants/headers';
import { AppException } from '../errors/app.exception';
import { errorResponse } from '../http/api-response';
import type { RequestWithContext } from '../middleware/correlation-id.middleware';

interface ValidationMessageShape {
  message?: string | string[];
}

/**
 * Global exception filter — maps known exceptions to the stable API error shape
 * and never leaks stack traces or internal Nest details to clients.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    const requestId = request[REQUEST_ID_KEY] ?? 'unknown';
    const correlationId = request[CORRELATION_ID_KEY] ?? 'unknown';

    const { statusCode, code, message, details } = this.normalize(exception);

    if (statusCode >= 500) {
      this.logger.error(
        {
          message: 'Unhandled exception',
          requestId,
          correlationId,
          path: request.url,
          method: request.method,
          error:
            exception instanceof Error
              ? { name: exception.name, message: exception.message, stack: exception.stack }
              : exception,
        },
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn({
        message: 'Request failed',
        requestId,
        correlationId,
        path: request.url,
        method: request.method,
        code,
        statusCode,
      });
    }

    response.status(statusCode).json(errorResponse(code, message, requestId, details));
  }

  private normalize(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();
      const message = this.extractHttpMessage(body, exception.message);
      const code = this.mapHttpStatusToCode(statusCode);

      const details =
        typeof body === 'object' && body !== null && 'message' in body
          ? this.extractValidationDetails(body as ValidationMessageShape)
          : undefined;

      return { statusCode, code, message, details };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    };
  }

  private extractHttpMessage(body: string | object, fallback: string): string {
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const msg = (body as ValidationMessageShape).message;
      if (Array.isArray(msg)) {
        return 'Validation failed';
      }
      if (typeof msg === 'string') {
        return msg;
      }
    }
    return fallback;
  }

  private extractValidationDetails(
    body: ValidationMessageShape,
  ): Record<string, unknown> | undefined {
    if (Array.isArray(body.message)) {
      return { validationErrors: body.message };
    }
    return undefined;
  }

  private mapHttpStatusToCode(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.BAD_REQUEST;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 429:
        return ErrorCode.RATE_LIMITED;
      case 422:
        return ErrorCode.VALIDATION_ERROR;
      default:
        return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
    }
  }
}
