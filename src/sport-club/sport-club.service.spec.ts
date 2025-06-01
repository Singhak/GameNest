import { Test, TestingModule } from '@nestjs/testing';
import { SportClubService } from './sport-club.service';

describe('SportClubService', () => {
  let service: SportClubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SportClubService],
    }).compile();

    service = module.get<SportClubService>(SportClubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
