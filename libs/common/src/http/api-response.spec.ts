import { errorResponse, successResponse } from './api-response';

describe('api-response helpers', () => {
  it('builds a success envelope', () => {
    expect(successResponse({ id: '1' })).toEqual({
      success: true,
      data: { id: '1' },
    });
  });

  it('includes meta when provided', () => {
    expect(successResponse([], { page: 1, total: 0 })).toEqual({
      success: true,
      data: [],
      meta: { page: 1, total: 0 },
    });
  });

  it('builds the standard error envelope', () => {
    expect(
      errorResponse(
        'APPOINTMENT_ALREADY_BOOKED',
        'The appointment slot is no longer available',
        'req-1',
      ),
    ).toEqual({
      success: false,
      error: {
        code: 'APPOINTMENT_ALREADY_BOOKED',
        message: 'The appointment slot is no longer available',
        requestId: 'req-1',
      },
    });
  });

  it('includes optional details without leaking when omitted', () => {
    expect(
      errorResponse('VALIDATION_ERROR', 'Validation failed', 'req-2', { field: 'email' }),
    ).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        requestId: 'req-2',
        details: { field: 'email' },
      },
    });
  });
});
