import { ErrorCode } from '../constants/error-codes';
import {
  AppException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
} from './app.exception';

describe('AppException hierarchy', () => {
  it('creates an operational AppException with code and status', () => {
    const error = new AppException(ErrorCode.BAD_REQUEST, 'Invalid payload', 400, {
      field: 'email',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid payload');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.isOperational).toBe(true);
  });

  it('maps NotFoundException to 404', () => {
    const error = new NotFoundException(ErrorCode.PATIENT_NOT_FOUND, 'Patient not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe(ErrorCode.PATIENT_NOT_FOUND);
  });

  it('maps UnauthorizedException to 401', () => {
    const error = new UnauthorizedException();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('maps ForbiddenException to 403', () => {
    const error = new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Cannot view this record');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe(ErrorCode.ACCESS_DENIED);
  });

  it('maps ConflictException for double booking', () => {
    const error = new ConflictException(
      ErrorCode.APPOINTMENT_ALREADY_BOOKED,
      'The appointment slot is no longer available',
    );
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe(ErrorCode.APPOINTMENT_ALREADY_BOOKED);
  });

  it('maps ValidationException to 422', () => {
    const error = new ValidationException('Validation failed', {
      validationErrors: ['email must be an email'],
    });
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
