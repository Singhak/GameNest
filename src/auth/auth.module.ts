import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import { FirebaseModule } from '../firebase/firebase.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule, // Required for user management
    FirebaseModule, // Required for Firebase Admin SDK
    PassportModule, // For integrating Passport strategies
    JwtModule.registerAsync({ // Register JwtModule asynchronously to use ConfigService
      inject: [ConfigService], // Inject ConfigService
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'), // Get JWT secret from config
        signOptions: { expiresIn: configService.get<string>('jwt.expiresIn') }, // Get expiration from config
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy], // Register AuthService and JwtStrategy
  exports: [AuthService], // Export AuthService if other modules need to use it
})
export class AuthModule {}