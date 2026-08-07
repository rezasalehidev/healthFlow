import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_KEY,
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from '../constants/headers';

export type RequestWithContext = Request & {
  [CORRELATION_ID_KEY]?: string;
  [REQUEST_ID_KEY]?: string;
};

/**
 * Ensures every request has a correlation ID (client-provided or generated)
 * and a unique request ID for this hop. Propagates both on the response.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const incomingCorrelation = req.header(CORRELATION_ID_HEADER)?.trim();
    const correlationId =
      incomingCorrelation && incomingCorrelation.length > 0 ? incomingCorrelation : randomUUID();
    const requestId = randomUUID();

    req[CORRELATION_ID_KEY] = correlationId;
    req[REQUEST_ID_KEY] = requestId;

    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
