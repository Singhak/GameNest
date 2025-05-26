import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Determines if the current user has the necessary roles to access a route.
   * @param context The execution context (e.g., controller method, class).
   * @returns True if the user has at least one of the required roles, false otherwise.
   */
  canActivate(context: ExecutionContext): boolean {
    // Get the roles required for the current handler or class
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), // Check method decorator first
      context.getClass(),   // Then check class decorator
    ]);

    // If no roles are specified for the route, allow access
    if (!requiredRoles) {
      return true;
    }

    // Get the user object from the request (attached by JwtStrategy)
    const { user } = context.switchToHttp().getRequest();

    // Check if the user exists and has roles
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('User has no assigned roles or roles are invalid.');
    }

    // Check if the user's roles include any of the required roles
    const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRequiredRole) {
      throw new ForbiddenException('You do not have the necessary permissions to access this resource.');
    }

    return true;
  }
}