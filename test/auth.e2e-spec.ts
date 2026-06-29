import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from './setup-test-database';
import { seedTestSuperAdmin } from './seed-test-super-admin';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const superAdmin = {
    email: 'platform-admin@test.com',
    password: 'SuperSecure123',
  };

  beforeAll(async () => {
    await setupTestDatabase();
    process.env.SUPER_ADMIN_EMAIL = superAdmin.email;
    process.env.SUPER_ADMIN_PASSWORD = superAdmin.password;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedTestSuperAdmin(app, superAdmin);
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('blocks public registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'owner@coffee.com',
        password: 'SecurePass123',
        firstName: 'Ali',
        lastName: 'Hassan',
      })
      .expect(403);
  });

  it('logs in super admin and returns profile', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(superAdmin)
      .expect(200);

    expect(loginResponse.body.data.user.platformRole).toBe('super_admin');

    const { accessToken } = loginResponse.body.data.tokens;

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.data.platformRole).toBe('super_admin');
  });

  it('rejects invalid login', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdmin.email, password: 'WrongPassword1' })
      .expect(401);
  });

  it('rejects unauthenticated profile request', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
