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

describe('Transactions (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let cashierToken: string;
  let storeId: string;
  let productId: string;
  let orderId: string;
  let orderVersion: number;
  let transactionId: string;

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

    const categoryId = (
      await request(app.getHttpServer())
        .post(`/api/v1/stores/${storeId}/categories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Drinks' })
        .expect(201)
    ).body.data.id;

    productId = (
      await request(app.getHttpServer())
        .post(`/api/v1/stores/${storeId}/products`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Cappuccino',
          categoryId,
          price: 5,
        })
        .expect(201)
    ).body.data.id;

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

    const orderResponse = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        status: 'open',
        items: [{ productId, quantity: 2 }],
      })
      .expect(201);

    orderId = orderResponse.body.data.id;
    orderVersion = orderResponse.body.data.version;

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ status: 'in_kitchen', version: orderVersion })
      .expect(200);

    orderVersion += 1;

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ status: 'ready', version: orderVersion })
      .expect(200);
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('pays a ready order and marks it completed', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        method: 'cash',
        idempotencyKey: 'txn-e2e-pay-001',
      })
      .expect(200);

    expect(response.body.data.transaction.amount).toBe(10);
    expect(response.body.data.transaction.status).toBe('completed');
    expect(response.body.data.order.status).toBe('completed');
    expect(response.body.data.idempotentReplay).toBe(false);
    transactionId = response.body.data.transaction.id;
  });

  it('returns the same transaction for duplicate idempotency keys', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        method: 'cash',
        idempotencyKey: 'txn-e2e-pay-001',
      })
      .expect(200);

    expect(response.body.data.transaction.id).toBe(transactionId);
    expect(response.body.data.idempotentReplay).toBe(true);
  });

  it('blocks cashier from listing transactions', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/transactions`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(403);
  });

  it('lists transactions for owner with pagination meta', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/transactions?method=cash`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.meta.total).toBeGreaterThan(0);
  });

  it('allows owner to refund a completed transaction', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/transactions/${transactionId}/refund`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Customer changed mind' })
      .expect(200);

    expect(response.body.data.status).toBe('refunded');
  });

  it('blocks cashier from refunding transactions', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/transactions/${transactionId}/refund`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'Unauthorized refund' })
      .expect(403);
  });
});
