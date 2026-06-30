import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PlatformRole } from '../../users/enums/user.enum';
import { SafeUser } from '../../users/types/user.types';

type AuthenticatedRequest = Request & { user?: SafeUser };

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      return false;
    }

    if (request.user.platformRole === PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super admins use platform routes. Tenant routes are for organization users.',
      );
    }

    return true;
  }
}
