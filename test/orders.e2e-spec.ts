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

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let cashierToken: string;
  let kitchenToken: string;
  let storeId: string;
  let productId: string;
  let orderId: string;
  let orderVersion: number;

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

  const kitchen = {
    email: 'kitchen@alicoffee.com',
    password: 'KitchenPass123',
    firstName: 'Ken',
    lastName: 'Kitchen',
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
          price: 4.5,
        })
        .expect(201)
    ).body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/promos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Order Promo',
        code: 'ORDER10',
        type: 'fixed',
        value: 1,
        minOrderAmount: 5,
      })
      .expect(201);

    for (const staff of [
      { user: cashier, role: 'cashier' },
      { user: kitchen, role: 'kitchen' },
    ]) {
      const invite = await request(app.getHttpServer())
        .post(`/api/v1/stores/${storeId}/invites`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: staff.user.email, role: staff.role })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/accept-invite')
        .send({
          token: invite.body.data.inviteToken,
          password: staff.user.password,
          firstName: staff.user.firstName,
          lastName: staff.user.lastName,
        })
        .expect(200);
    }

    cashierToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: cashier.email, password: cashier.password })
        .expect(200)
    ).body.data.tokens.accessToken;

    kitchenToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: kitchen.email, password: kitchen.password })
        .expect(200)
    ).body.data.tokens.accessToken;
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('creates an order with snapshotted product pricing', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId, quantity: 2 }],
        notes: 'Table 4',
      })
      .expect(201);

    expect(response.body.data.status).toBe('draft');
    expect(response.body.data.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(response.body.data.items[0].name).toBe('Cappuccino');
    expect(response.body.data.items[0].unitPrice).toBe(4.5);
    expect(response.body.data.subtotal).toBe(9);
    orderId = response.body.data.id;
    orderVersion = response.body.data.version;
  });

  it('updates items, applies promo, and recalculates totals', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        version: orderVersion,
        items: [{ productId, quantity: 3 }],
        promoCode: 'ORDER10',
      })
      .expect(200);

    expect(response.body.data.subtotal).toBe(13.5);
    expect(response.body.data.discountAmount).toBe(1);
    expect(response.body.data.total).toBe(12.5);
    orderVersion = response.body.data.version;
  });

  it('lists orders with pagination meta', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/orders?status=draft`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.meta.total).toBeGreaterThan(0);
  });

  it('blocks kitchen from creating orders', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(403);
  });

  it('runs the order lifecycle through completion', async () => {
    let response = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ status: 'open', version: orderVersion })
      .expect(200);

    expect(response.body.data.status).toBe('open');
    orderVersion = response.body.data.version;

    response = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'in_kitchen', version: orderVersion })
      .expect(200);

    expect(response.body.data.status).toBe('in_kitchen');
    orderVersion = response.body.data.version;

    response = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'ready', version: orderVersion })
      .expect(200);

    orderVersion = response.body.data.version;

    response = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ status: 'completed', version: orderVersion })
      .expect(200);

    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.completedAt).toBeTruthy();
  });

  it('rejects invalid status transitions', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'open', version: 6 })
      .expect(400);
  });

  it('blocks item changes after the order leaves draft/open', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        version: 6,
        items: [{ productId, quantity: 1 }],
      })
      .expect(400);
  });
});
