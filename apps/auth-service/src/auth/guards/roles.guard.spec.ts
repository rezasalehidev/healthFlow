import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ErrorCode } from '@healthflow/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const createContext = (roles: string[]): ExecutionContext => {
    const request = { user: { sub: 'u1', email: 'a@b.c', roles, permissions: [] } };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('allows when no roles metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext([]))).toBe(true);
  });

  it('allows when user has a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
      if (key === ROLES_KEY) return ['ADMIN', 'DOCTOR'];
      return undefined;
    });
    expect(guard.canActivate(createContext(['DOCTOR']))).toBe(true);
  });

  it('denies when user lacks required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(createContext(['PATIENT']))).toThrow(ForbiddenException);
    try {
      guard.canActivate(createContext(['PATIENT']));
    } catch (error) {
      expect(error).toMatchObject({ code: ErrorCode.ACCESS_DENIED });
    }
  });
});
