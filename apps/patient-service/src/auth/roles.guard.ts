import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, ForbiddenException } from '@healthflow/common';
import { ROLES_KEY, type AuthedRequest } from './auth.decorators';

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
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!required.some((role) => user?.roles?.includes(role))) {
      throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Insufficient role');
    }
    return true;
  }
}
