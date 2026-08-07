import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export interface ErrorDetails {
  [key: string]: unknown;
}

/**
 * Domain / application exception with a stable machine-readable code.
 * Never put secrets or stack traces into `message` or `details`.
 */
export class AppException extends Error {
  readonly code: ErrorCode;
  readonly statusCode: HttpStatus;
  readonly details?: ErrorDetails;
  readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AppException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundException extends AppException {
  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(code, message, HttpStatus.NOT_FOUND, details);
    this.name = 'NotFoundException';
  }
}

export class UnauthorizedException extends AppException {
  constructor(
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
    message = 'Authentication required',
    details?: ErrorDetails,
  ) {
    super(code, message, HttpStatus.UNAUTHORIZED, details);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends AppException {
  constructor(
    code: ErrorCode = ErrorCode.FORBIDDEN,
    message = 'You do not have permission to perform this action',
    details?: ErrorDetails,
  ) {
    super(code, message, HttpStatus.FORBIDDEN, details);
    this.name = 'ForbiddenException';
  }
}

export class ConflictException extends AppException {
  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(code, message, HttpStatus.CONFLICT, details);
    this.name = 'ConflictException';
  }
}

export class ValidationException extends AppException {
  constructor(message = 'Validation failed', details?: ErrorDetails) {
    super(ErrorCode.VALIDATION_ERROR, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
    this.name = 'ValidationException';
  }
}
