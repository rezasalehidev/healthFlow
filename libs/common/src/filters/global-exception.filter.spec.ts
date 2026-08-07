import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
import { REQUEST_ID_KEY } from '../constants/headers';
import { AppException, ConflictException } from '../errors/app.exception';
import type { RequestWithContext } from '../middleware/correlation-id.middleware';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  const createHost = (exceptionIgnored?: unknown) => {
    void exceptionIgnored;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status };
    const request = {
      [REQUEST_ID_KEY]: 'req-abc',
      url: '/api/v1/appointments',
      method: 'POST',
    } as RequestWithContext;

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    return { host, status, json };
  };

  it('formats AppException into the standard error envelope', () => {
    const { host, status, json } = createHost();
    const exception = new ConflictException(
      ErrorCode.APPOINTMENT_ALREADY_BOOKED,
      'The appointment slot is no longer available',
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.APPOINTMENT_ALREADY_BOOKED,
        message: 'The appointment slot is no longer available',
        requestId: 'req-abc',
      },
    });
  });

  it('maps Nest HttpException validation arrays without leaking internals', () => {
    const { host, status, json } = createHost();
    const exception = new HttpException(
      { message: ['email must be an email', 'password is too short'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.BAD_REQUEST,
        message: 'Validation failed',
        requestId: 'req-abc',
        details: {
          validationErrors: ['email must be an email', 'password is too short'],
        },
      },
    });
  });

  it('hides unexpected errors behind INTERNAL_ERROR', () => {
    const { host, status, json } = createHost();

    filter.catch(new Error('secret db connection string'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        requestId: 'req-abc',
      },
    });
  });

  it('preserves AppException details when present', () => {
    const { host, json } = createHost();
    filter.catch(
      new AppException(ErrorCode.VALIDATION_ERROR, 'Invalid input', 422, { field: 'startsAt' }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid input',
        requestId: 'req-abc',
        details: { field: 'startsAt' },
      },
    });
  });
});
