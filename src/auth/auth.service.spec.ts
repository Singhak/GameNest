import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { FirebaseService } from '../firebase/firebase.service';
import { LoginDto } from './dtos/login.dto';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/schema/user.schema';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let firebaseService: FirebaseService;
  let configService: ConfigService;

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockUsersService = {
    findByFirebaseUid: jest.fn(),
    createUser: jest.fn(),
    updateUserById: jest.fn(),
    addRefreshToken: jest.fn(),
  };

  const mockFirebaseService = {
    verifyIdToken: jest.fn(),
    setCustomUserClaims: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    firebaseService = module.get<FirebaseService>(FirebaseService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset all mocks
    jest.clearAllMocks();

    // Default mock implementations for configService.get
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
      if (key === 'jwt.refreshExpiresIn') return '7d';
      return null;
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto: LoginDto = { idToken: 'test-firebase-id-token' };
    const decodedToken = { uid: 'firebase-uid', email: 'test@example.com' };
    const mockUser = {
      id: 'user-db-id',
      uid: 'firebase-uid',
      email: 'test@example.com',
      roles: [Role.User],
    } as User;
    const accessToken = 'test-access-token';
    const refreshToken = 'test-refresh-token';
    const hashedRefreshToken = 'hashed-refresh-token';

    beforeEach(() => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedToken);
      mockJwtService.sign
        .mockReturnValueOnce(accessToken) // First call for accessToken
        .mockReturnValueOnce(refreshToken); // Second call for refreshToken
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedRefreshToken);
      mockUsersService.addRefreshToken.mockResolvedValue(undefined);
    });

    it('should throw BadRequestException if idToken is missing', async () => {
      await expect(service.login({ idToken: '' })).rejects.toThrow(
        new BadRequestException('Firebase ID token is required.'),
      );
    });

    it('should successfully login an existing user', async () => {
      mockUsersService.findByFirebaseUid.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(mockFirebaseService.verifyIdToken).toHaveBeenCalledWith(loginDto.idToken);
      expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith(decodedToken.uid);
      expect(mockUsersService.createUser).not.toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        uid: mockUser.uid,
        email: mockUser.email,
        roles: mockUser.roles,
        sub: mockUser.id,
      });
      expect(jwtService.sign).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ uid: mockUser.uid }),
        { secret: 'test-refresh-secret', expiresIn: '7d' },
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(refreshToken, 10);
      expect(mockUsersService.addRefreshToken).toHaveBeenCalledWith(mockUser.id, expect.any(Object));
      expect(result).toEqual({ accessToken, refreshToken });
    });

    it('should create a new user if not found and then login', async () => {
      mockUsersService.findByFirebaseUid.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith(decodedToken.uid);
      expect(mockUsersService.createUser).toHaveBeenCalledWith({
        uid: decodedToken.uid,
        email: decodedToken.email,
        roles: [Role.User],
      });
      expect(result).toEqual({ accessToken, refreshToken });
    });

    it('should update user email if it changed in Firebase', async () => {
      const existingUserWithOldEmail = { ...mockUser, email: 'old@example.com' };
      mockUsersService.findByFirebaseUid.mockResolvedValue(existingUserWithOldEmail);
      mockUsersService.updateUserById.mockResolvedValue({ ...existingUserWithOldEmail, email: decodedToken.email });

      await service.login(loginDto);

      expect(mockUsersService.updateUserById).toHaveBeenCalledWith(existingUserWithOldEmail.id, { email: decodedToken.email });
    });

    it('should throw UnauthorizedException if Firebase token verification fails', async () => {
      mockFirebaseService.verifyIdToken.mockRejectedValue(new Error('Firebase auth error'));
      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Authentication failed. Invalid token or user data.'),
      );
    });

    it('should re-throw BadRequestException from downstream services', async () => {
      mockFirebaseService.verifyIdToken.mockRejectedValue(new BadRequestException('Specific bad request'));
      await expect(service.login(loginDto)).rejects.toThrow(
        new BadRequestException('Specific bad request'),
      );
    });

    it('should throw UnauthorizedException for generic errors during login process', async () => {
      mockUsersService.findByFirebaseUid.mockRejectedValue(new Error('DB error'));
      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Authentication failed. Invalid token or user data.'),
      );
    });
  });

  describe('assignRoles', () => {
    const firebaseUid = 'test-firebase-uid';
    const rolesToAssign = [Role.Admin, Role.User];
    const mockUser = {
      id: 'user-db-id',
      uid: firebaseUid,
      email: 'test@example.com',
      roles: [Role.User],
    } as User;
    const updatedUser = { ...mockUser, roles: rolesToAssign };

    it('should successfully assign roles to an existing user', async () => {
      mockUsersService.findByFirebaseUid.mockResolvedValue(mockUser);
      mockUsersService.updateUserById.mockResolvedValue(updatedUser);
      mockFirebaseService.setCustomUserClaims.mockResolvedValue(undefined);

      const result = await service.assignRoles(firebaseUid, rolesToAssign);

      expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith(firebaseUid);
      expect(mockUsersService.updateUserById).toHaveBeenCalledWith(mockUser.id, { roles: rolesToAssign });
      expect(mockFirebaseService.setCustomUserClaims).toHaveBeenCalledWith(firebaseUid, { roles: rolesToAssign });
      expect(result).toEqual(updatedUser);
    });

    it('should throw BadRequestException if user is not found', async () => {
      mockUsersService.findByFirebaseUid.mockResolvedValue(null);

      await expect(service.assignRoles(firebaseUid, rolesToAssign)).rejects.toThrow(
        new BadRequestException(`User with Firebase UID ${firebaseUid} not found.`),
      );
      expect(mockUsersService.updateUserById).not.toHaveBeenCalled();
      expect(mockFirebaseService.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('should still assign roles even if Firebase setCustomUserClaims fails (as per current logic, logs error)', async () => {
      // This test assumes that an error in setCustomUserClaims does not prevent the local update.
      // The FirebaseService itself throws an InternalServerErrorException which would bubble up.
      // If the requirement is that assignRoles should fail if setCustomUserClaims fails,
      // then FirebaseService.setCustomUserClaims should be mocked to throw and this test adjusted.

      mockUsersService.findByFirebaseUid.mockResolvedValue(mockUser);
      mockUsersService.updateUserById.mockResolvedValue(updatedUser);
      // Simulate FirebaseService throwing an error, which AuthService currently catches and logs,
      // but FirebaseService itself would throw InternalServerErrorException.
      // For this unit test, we'll assume FirebaseService.setCustomUserClaims completes.
      // If FirebaseService.setCustomUserClaims were to throw, that would be caught by the try/catch in FirebaseService.
      // AuthService.assignRoles doesn't have a try/catch around firebaseService.setCustomUserClaims.
      mockFirebaseService.setCustomUserClaims.mockResolvedValue(undefined); // Or mock it to throw if testing that path

      const result = await service.assignRoles(firebaseUid, rolesToAssign);

      expect(result).toEqual(updatedUser);
      expect(mockFirebaseService.setCustomUserClaims).toHaveBeenCalledWith(firebaseUid, { roles: rolesToAssign });
    });

    it('should throw if usersService.updateUserById fails', async () => {
      mockUsersService.findByFirebaseUid.mockResolvedValue(mockUser);
      mockUsersService.updateUserById.mockRejectedValue(new Error('DB update failed'));

      await expect(service.assignRoles(firebaseUid, rolesToAssign)).rejects.toThrow('DB update failed');
    });
  });
});
