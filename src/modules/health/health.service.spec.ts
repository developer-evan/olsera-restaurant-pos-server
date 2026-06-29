import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { ConnectionStates } from 'mongoose';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const mockConnection = {
    readyState: ConnectionStates.connected,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    mockConnection.readyState = ConnectionStates.connected;
  });

  it('returns ok when database is connected', () => {
    const result = service.check();

    expect(result.status).toBe('ok');
    expect(result.services.database.status).toBe('up');
    expect(result.uptime).toBeGreaterThan(0);
  });

  it('throws ServiceUnavailableException when database is down', () => {
    mockConnection.readyState = ConnectionStates.disconnected;

    expect(() => service.check()).toThrow(ServiceUnavailableException);
  });
});
