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

describe('Platform onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let superAdminToken: string;

  const superAdmin = {
    email: 'platform-admin@test.com',
    password: 'SuperSecure123',
  };

  const tenantPayload = {
    owner: {
      email: 'owner@alicoffee.com',
      password: 'OwnerPass123',
      firstName: 'Ali',
      lastName: 'Hassan',
    },
    organization: {
      name: 'Ali Coffee Group',
    },
    store: {
      name: 'Ali Coffee & Eatery',
      currency: 'USD',
      timezone: 'Africa/Nairobi',
    },
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

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(superAdmin)
      .expect(200);

    superAdminToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('onboards owner with organization and store', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/onboarding')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(tenantPayload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.owner.email).toBe(tenantPayload.owner.email);
    expect(response.body.data.organization.name).toBe(
      tenantPayload.organization.name,
    );
    expect(response.body.data.store.name).toBe(tenantPayload.store.name);
    expect(response.body.data.store.currency).toBe('USD');
  });

  it('allows onboarded owner to login', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: tenantPayload.owner.email,
        password: tenantPayload.owner.password,
      })
      .expect(200);

    expect(loginResponse.body.data.user.platformRole).toBeNull();
    expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
  });

  it('lists organizations for super admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe(tenantPayload.organization.name);
  });

  it('rejects duplicate owner onboarding', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/onboarding')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(tenantPayload)
      .expect(409);
  });

  it('blocks non-super-admin from onboarding', async () => {
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: tenantPayload.owner.email,
        password: tenantPayload.owner.password,
      });

    await request(app.getHttpServer())
      .post('/api/v1/platform/onboarding')
      .set(
        'Authorization',
        `Bearer ${ownerLogin.body.data.tokens.accessToken}`,
      )
      .send({
        ...tenantPayload,
        owner: {
          ...tenantPayload.owner,
          email: 'another-owner@coffee.com',
        },
      })
      .expect(403);
  });
});
