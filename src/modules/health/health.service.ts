import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

export type HealthCheckResult = {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  services: {
    database: {
      status: 'up' | 'down';
      state: string;
    };
  };
};

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  check(): HealthCheckResult {
    const isDatabaseUp = this.connection.readyState === ConnectionStates.connected;

    const result: HealthCheckResult = {
      status: isDatabaseUp ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: isDatabaseUp ? 'up' : 'down',
          state: ConnectionStates[this.connection.readyState] ?? 'unknown',
        },
      },
    };

    if (!isDatabaseUp) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
