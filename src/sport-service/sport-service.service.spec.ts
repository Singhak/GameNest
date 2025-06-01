import { Test, TestingModule } from '@nestjs/testing';
import { SportServiceService } from './sport-service.service';

describe('SportServiceService', () => {
  let service: SportServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SportServiceService],
    }).compile();

    service = module.get<SportServiceService>(SportServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
