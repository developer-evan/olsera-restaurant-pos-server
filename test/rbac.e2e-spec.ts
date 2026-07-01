import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { seedTestSuperAdmin } from './seed-test-super-admin';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from './setup-test-database';

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let managerToken: string;
  let cashierToken: string;
  let storeId: string;
  let organizationId: string;

  const superAdmin = {
    email: 'platform-admin@test.com',
    password: 'SuperSecure123',
  };

  const owner = {
    email: 'owner@alicoffee.com',
    password: 'OwnerPass123',
    firstName: 'Ali',
    lastName: 'Hassan',
  };

  const manager = {
    email: 'manager@alicoffee.com',
    password: 'ManagerPass123',
    firstName: 'Mo',
    lastName: 'Manager',
  };

  const cashier = {
    email: 'cashier@alicoffee.com',
    password: 'CashierPass123',
    firstName: 'Jane',
    lastName: 'Cashier',
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

    const superAdminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(superAdmin)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/platform/onboarding')
      .set(
        'Authorization',
        `Bearer ${superAdminLogin.body.data.tokens.accessToken}`,
      )
      .send({
        owner,
        organization: { name: 'Ali Coffee Group' },
        store: { name: 'Ali Coffee & Eatery' },
      })
      .expect(201);

    ownerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: owner.email, password: owner.password })
        .expect(200)
    ).body.data.tokens.accessToken;

    const storesResponse = await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    storeId = storesResponse.body.data[0].id;
    organizationId = storesResponse.body.data[0].organizationId;

    const managerInvite = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: manager.email, role: 'manager' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({
        token: managerInvite.body.data.inviteToken,
        password: manager.password,
        firstName: manager.firstName,
        lastName: manager.lastName,
      })
      .expect(200);

    managerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: manager.email, password: manager.password })
        .expect(200)
    ).body.data.tokens.accessToken;

    const cashierInvite = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: cashier.email, role: 'cashier' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({
        token: cashierInvite.body.data.inviteToken,
        password: cashier.password,
        firstName: cashier.firstName,
        lastName: cashier.lastName,
      })
      .expect(200);

    cashierToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: cashier.email, password: cashier.password })
        .expect(200)
    ).body.data.tokens.accessToken;
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('returns access context with permissions for owner', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/access-context`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.role).toBe('owner');
    expect(response.body.data.permissions).toContain('invites:create');
    expect(response.body.data.permissions).toContain('stores:create');
  });

  it('allows manager to update store settings', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ currency: 'KES' })
      .expect(200);
  });

  it('blocks cashier from updating store settings', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ currency: 'USD' })
      .expect(403);
  });

  it('blocks cashier from inviting staff', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invites`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ email: 'blocked@coffee.com', role: 'kitchen' })
      .expect(403);
  });

  it('blocks manager from creating new stores', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        organizationId,
        name: 'Unauthorized Store',
      })
      .expect(403);
  });

  it('allows manager to invite kitchen staff', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invites`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ email: 'kitchen@alicoffee.com', role: 'kitchen' })
      .expect(201);
  });
});
