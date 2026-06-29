import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { ConnectionStates } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/olsera_pos_test';
    process.env.JWT_SECRET =
      'e2e-test-jwt-secret-with-sufficient-length';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue({
        readyState: ConnectionStates.connected,
        close: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns 200 when database is connected', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.services.database.status).toBe('up');
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
