import { Test, TestingModule } from '@nestjs/testing';
import { SportClubController } from './sport-club.controller';

describe('SportClubController', () => {
  let controller: SportClubController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SportClubController],
    }).compile();

    controller = module.get<SportClubController>(SportClubController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
