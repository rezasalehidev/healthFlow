import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ErrorCode } from '@healthflow/common';
import { PERMISSIONS_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userPermissions = request.user?.permissions ?? [];
    const allowed = required.every((permission) => userPermissions.includes(permission));
    if (!allowed) {
      throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Insufficient permissions');
    }
    return true;
  }
}
