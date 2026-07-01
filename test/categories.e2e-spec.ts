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

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let cashierToken: string;
  let storeId: string;
  let categoryId: string;

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

  it('creates and lists categories', async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Drinks', sortOrder: 1 })
      .expect(201);

    expect(createResponse.body.data.name).toBe('Drinks');
    expect(createResponse.body.data.slug).toBe('drinks');
    categoryId = createResponse.body.data.id;

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(1);
  });

  it('rejects duplicate category slug in same store', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Drinks' })
      .expect(409);
  });

  it('allows cashier to read categories', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/categories`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('blocks cashier from creating categories', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/categories`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Desserts' })
      .expect(403);
  });

  it('updates and soft-deletes a category', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/categories/${categoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Hot Drinks', isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeId}/categories/${categoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const activeList = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/categories?active=true`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(activeList.body.data).toHaveLength(0);
  });
});
