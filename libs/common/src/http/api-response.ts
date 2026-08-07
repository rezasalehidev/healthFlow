export interface ApiErrorBody {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function errorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      requestId,
      ...(details ? { details } : {}),
    },
  };
}
