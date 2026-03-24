import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();

    // Diagnostic check 1: Is user object missing?
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Diagnostic check 2: Is user role missing in the token payload?
    if (!user.role) {
      throw new ForbiddenException('User object exists but role is missing');
    }

    // Diagnostic check 3: Role value mismatch?
    const hasRole = requiredRoles.some(
      (role) => role.toUpperCase() === user.role.toUpperCase(),
    );
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied for role: ${user.role}. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
