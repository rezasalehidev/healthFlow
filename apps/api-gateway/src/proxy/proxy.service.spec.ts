import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { AppException, ErrorCode } from '@healthflow/common';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  const request = jest.fn();
  const http = { request } as unknown as HttpService;
  const config = {
    get: jest.fn((key: string, fallback?: string | number) => {
      if (key === 'PROXY_TIMEOUT_MS') return 5000;
      if (key === 'PATIENT_SERVICE_URL') return fallback;
      if (key === 'DOCTOR_SERVICE_URL') return fallback;
      if (key === 'APPOINTMENT_SERVICE_URL') return fallback;
      return fallback;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'AUTH_SERVICE_URL') return 'http://auth:3001';
      throw new Error(key);
    }),
  } as unknown as ConfigService;

  const service = new ProxyService(http, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards to auth service and returns status/data', async () => {
    request.mockReturnValue(
      of({
        status: 200,
        data: { success: true, data: { ok: true } },
        headers: {},
        config: { headers: new AxiosHeaders() },
        statusText: 'OK',
      }),
    );

    const result = await service.forward({
      service: 'auth',
      method: 'GET',
      path: '/health',
      correlationId: 'corr-1',
      requestId: 'req-1',
    });

    expect(result).toEqual({
      status: 200,
      data: { success: true, data: { ok: true } },
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://auth:3001/health',
        method: 'GET',
        headers: expect.objectContaining({
          'x-correlation-id': 'corr-1',
          'x-request-id': 'req-1',
        }) as Record<string, string>,
      }) as Record<string, unknown>,
    );
  });

  it('maps connection failures to 503 AppException', async () => {
    request.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

    await expect(
      service.forward({ service: 'auth', method: 'GET', path: '/health' }),
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      statusCode: 503,
    });
    expect(AppException).toBeDefined();
  });

  it('maps timeouts to 504 AppException', async () => {
    const timeoutError = new AxiosError('timeout');
    timeoutError.code = 'ECONNABORTED';
    request.mockReturnValue(throwError(() => timeoutError));

    await expect(
      service.forward({ service: 'auth', method: 'POST', path: '/api/v1/auth/login' }),
    ).rejects.toMatchObject({
      statusCode: 504,
    });
  });
});
