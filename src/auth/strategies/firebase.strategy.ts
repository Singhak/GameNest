import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const authHeader = req.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('No token');

    const token = authHeader.toString().split('Bearer ')[1];
    if (!token) throw new UnauthorizedException('Invalid format');

    // return this.authService.validateFirebaseToken(token);
  }
}
