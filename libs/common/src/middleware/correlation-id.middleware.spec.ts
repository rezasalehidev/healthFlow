import type { NextFunction, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_KEY,
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from '../constants/headers';
import { CorrelationIdMiddleware, type RequestWithContext } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  const createMock = (headers: Record<string, string | undefined> = {}) => {
    const req = {
      header: (name: string) => headers[name.toLowerCase()],
    } as unknown as RequestWithContext;

    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    return { req, res, next, setHeader };
  };

  it('reuses an incoming correlation id and always creates a request id', () => {
    const { req, res, next, setHeader } = createMock({
      [CORRELATION_ID_HEADER]: 'corr-from-client',
    });

    middleware.use(req, res, next);

    expect(req[CORRELATION_ID_KEY]).toBe('corr-from-client');
    expect(req[REQUEST_ID_KEY]).toEqual(expect.any(String));
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'corr-from-client');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req[REQUEST_ID_KEY]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a correlation id when the header is missing', () => {
    const { req, res, next, setHeader } = createMock();

    middleware.use(req, res, next);

    expect(req[CORRELATION_ID_KEY]).toEqual(expect.any(String));
    expect(req[REQUEST_ID_KEY]).toEqual(expect.any(String));
    expect(req[CORRELATION_ID_KEY]).not.toBe(req[REQUEST_ID_KEY]);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, req[CORRELATION_ID_KEY]);
    expect(next).toHaveBeenCalled();
  });

  it('ignores blank correlation headers', () => {
    const { req, res, next } = createMock({ [CORRELATION_ID_HEADER]: '   ' });

    middleware.use(req, res, next);

    expect(req[CORRELATION_ID_KEY]).toEqual(expect.any(String));
    expect(req[CORRELATION_ID_KEY]).not.toBe('   ');
  });
});
