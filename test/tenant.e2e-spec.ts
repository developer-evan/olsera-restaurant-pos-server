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

describe('Tenant stores & invites (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let organizationId: string;
  let primaryStoreId: string;
  let inviteToken: string;

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

  const staff = {
    email: 'cashier@alicoffee.com',
    password: 'StaffPass123',
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
        store: {
          name: 'Ali Coffee & Eatery',
          currency: 'USD',
          timezone: 'Africa/Nairobi',
        },
      })
      .expect(201);

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: owner.password })
      .expect(200);

    ownerToken = ownerLogin.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('returns owner organizations', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/organizations/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    organizationId = response.body.data[0].id;
    expect(response.body.data[0].name).toBe('Ali Coffee Group');
  });

  it('lists stores for store switcher', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].role).toBe('owner');
    primaryStoreId = response.body.data[0].id;
  });

  it('creates an additional store', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        organizationId,
        name: 'Ali Coffee Westlands',
        currency: 'KES',
      })
      .expect(201);

    expect(response.body.data.name).toBe('Ali Coffee Westlands');
    expect(response.body.data.role).toBe('owner');
  });

  it('invites staff to a store', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/stores/${primaryStoreId}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: staff.email,
        role: 'cashier',
      })
      .expect(201);

    expect(response.body.data.invite.email).toBe(staff.email);
    inviteToken = response.body.data.inviteToken;
  });

  it('accepts invite and logs staff in', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({
        token: inviteToken,
        password: staff.password,
        firstName: staff.firstName,
        lastName: staff.lastName,
      })
      .expect(200);

    expect(response.body.data.user.email).toBe(staff.email);
    expect(response.body.data.membership.role).toBe('cashier');
    expect(response.body.data.tokens.accessToken).toBeDefined();
  });

  it('allows staff to see assigned store only', async () => {
    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: staff.password });

    const response = await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${staffLogin.body.data.tokens.accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(primaryStoreId);
    expect(response.body.data[0].role).toBe('cashier');
  });

  it('blocks super admin from tenant store routes', async () => {
    const superAdminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(superAdmin);

    await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set(
        'Authorization',
        `Bearer ${superAdminLogin.body.data.tokens.accessToken}`,
      )
      .expect(403);
  });
});
