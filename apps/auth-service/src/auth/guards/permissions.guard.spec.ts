import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, ForbiddenException } from '@healthflow/common';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/roles.decorator';

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  const createContext = (permissions: string[]): ExecutionContext => {
    const request = {
      user: { sub: 'u1', email: 'a@b.c', roles: ['DOCTOR'], permissions },
    };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('allows when no permission metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext([]))).toBe(true);
  });

  it('requires all listed permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
      if (key === PERMISSIONS_KEY) return ['medical-records:read', 'medical-records:create'];
      return undefined;
    });

    expect(
      guard.canActivate(createContext(['medical-records:read', 'medical-records:create'])),
    ).toBe(true);

    expect(() => guard.canActivate(createContext(['medical-records:read']))).toThrow(
      ForbiddenException,
    );
  });

  it('uses ACCESS_DENIED code', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users:delete']);
    try {
      guard.canActivate(createContext([]));
      fail('expected throw');
    } catch (error) {
      expect(error).toMatchObject({ code: ErrorCode.ACCESS_DENIED });
    }
  });
});
