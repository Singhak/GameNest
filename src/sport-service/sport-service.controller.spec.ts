import { Test, TestingModule } from '@nestjs/testing';
import { SportServiceController } from './sport-service.controller';

describe('SportServiceController', () => {
  let controller: SportServiceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SportServiceController],
    }).compile();

    controller = module.get<SportServiceController>(SportServiceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
