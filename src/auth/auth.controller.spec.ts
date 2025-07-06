import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { AssignRolesDto } from './dtos/assign-roles.dto';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotFoundException } from '@nestjs/common';
import { User } from '../users/schema/user.schema';

// Mock AuthService
const mockAuthService = {
  login: jest.fn(),
  assignRoles: jest.fn(),
};

// Mock Guards - typically, guard logic is tested separately or in e2e tests.
// For controller unit tests, we often override them or assume they pass.
const mockJwtAuthGuard = { canActivate: jest.fn(() => true) };
const mockRolesGuard = { canActivate: jest.fn(() => true) };

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login and return access token', async () => {
      const loginDto: LoginDto = { idToken: 'test-id-token' };
      const expectedResult = { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' };
      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResult);
      // Check if @HttpCode(HttpStatus.OK) is implicitly tested by successful execution
      // or if we need to inspect metadata (usually not needed for basic unit tests)
    });
  });

  describe('getMe', () => {
    it('should return user information from request object', () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        roles: [Role.User],
        sub: 'user-db-id',
      };
      const mockRequest = { user: mockUser };

      const result = controller.getMe(mockRequest);

      expect(result).toEqual({
        message: `Hello ${mockUser.email}! You are authenticated.`,
        user: mockUser,
      });
    });
  });

  describe('assignRoles', () => {
    it('should call authService.assignRoles and return success message and updated user', async () => {
      const assignRolesDto: AssignRolesDto = {
        firebaseUid: 'test-firebase-uid',
        roles: [Role.Admin],
      };
      const mockUpdatedUser = {
        id: 'user-db-id',
        uid: 'test-firebase-uid',
        email: 'user@example.com',
        roles: [Role.Admin],
      } as User; // Cast to User type

      mockAuthService.assignRoles.mockResolvedValue(mockUpdatedUser);

      const result = await controller.assignRoles(assignRolesDto);

      expect(authService.assignRoles).toHaveBeenCalledWith(assignRolesDto.firebaseUid, assignRolesDto.roles);
      expect(result).toEqual({
        message: `Roles updated for user ${assignRolesDto.firebaseUid}`,
        user: {
          firebaseUid: mockUpdatedUser.uid,
          email: mockUpdatedUser.email,
          roles: mockUpdatedUser.roles,
        },
      });
    });

    it('should throw NotFoundException if authService.assignRoles returns null', async () => {
      const assignRolesDto: AssignRolesDto = { firebaseUid: 'non-existent-uid', roles: [Role.User] };
      mockAuthService.assignRoles.mockResolvedValue(null);

      await expect(controller.assignRoles(assignRolesDto)).rejects.toThrow(NotFoundException);
      expect(authService.assignRoles).toHaveBeenCalledWith(assignRolesDto.firebaseUid, assignRolesDto.roles);
    });
  });
});
