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

describe('Analytics (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let cashierToken: string;
  let storeId: string;
  let productId: string;
  let today: string;

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

    const now = new Date();
    today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

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

    const orderId = orderResponse.body.data.id;
    let orderVersion = orderResponse.body.data.version;

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

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        method: 'cash',
        idempotencyKey: 'analytics-e2e-pay-001',
      })
      .expect(200);
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('returns daily overview metrics for owner', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/analytics/overview?date=${today}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.sales).toBe(10);
    expect(response.body.data.orderCount).toBe(1);
    expect(response.body.data.avgTicket).toBe(10);
  });

  it('returns sales-by-day chart data', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeId}/analytics/sales-by-day?fromDate=${today}&toDate=${today}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.points.length).toBeGreaterThan(0);
    expect(response.body.data.points[0].sales).toBe(10);
  });

  it('returns top products for the store', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeId}/analytics/top-products?fromDate=${today}&toDate=${today}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.products[0].name).toBe('Cappuccino');
    expect(response.body.data.products[0].quantity).toBe(2);
    expect(response.body.data.products[0].revenue).toBe(10);
  });

  it('blocks cashier from analytics endpoints', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/analytics/overview?date=${today}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(403);
  });
});
