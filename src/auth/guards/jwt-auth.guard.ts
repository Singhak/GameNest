import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // This guard uses the 'jwt' strategy defined in src/auth/strategies/jwt.strategy.ts
  // It automatically handles token extraction and validation.
  // If validation fails, it throws an UnauthorizedException.
}