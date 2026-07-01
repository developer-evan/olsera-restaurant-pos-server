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

describe('Promos (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let cashierToken: string;
  let storeId: string;
  let promoId: string;

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

  it('creates and lists promos', async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/promos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Summer Sale',
        code: 'summer20',
        type: 'percentage',
        value: 20,
        minOrderAmount: 25,
      })
      .expect(201);

    expect(createResponse.body.data.code).toBe('SUMMER20');
    expect(createResponse.body.data.type).toBe('percentage');
    promoId = createResponse.body.data.id;

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/promos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(1);
  });

  it('rejects duplicate promo code in same store', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/promos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Duplicate',
        code: 'SUMMER20',
        type: 'fixed',
        value: 5,
      })
      .expect(409);
  });

  it('allows cashier to validate a promo at checkout', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/promos/validate`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ code: 'SUMMER20', subtotal: 50 })
      .expect(200);

    expect(response.body.data.discountAmount).toBe(10);
    expect(response.body.data.totalAfterDiscount).toBe(40);
  });

  it('blocks cashier from creating promos', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/promos`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        name: 'Cashier Promo',
        code: 'CASH10',
        type: 'fixed',
        value: 10,
      })
      .expect(403);
  });

  it('rejects expired promo on validate', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/promos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Expired Promo',
        code: 'EXPIRED10',
        type: 'fixed',
        value: 10,
        endsAt: '2020-01-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/promos/validate`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ code: 'EXPIRED10', subtotal: 50 })
      .expect(400);
  });

  it('updates and soft-deletes a promo', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/promos/${promoId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Summer Sale Extended', isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeId}/promos/${promoId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const activeList = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/promos?active=true`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const activeIds = activeList.body.data.map(
      (promo: { id: string }) => promo.id,
    );

    expect(activeIds).not.toContain(promoId);
  });
});
