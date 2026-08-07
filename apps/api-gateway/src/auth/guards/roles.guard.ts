import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, ForbiddenException } from '@healthflow/common';
import { ROLES_KEY } from '../decorators/auth.decorators';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowed = required.some((role) => user?.roles?.includes(role));
    if (!allowed) {
      throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Insufficient role');
    }
    return true;
  }
}
