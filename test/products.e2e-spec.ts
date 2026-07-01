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

describe('Products (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let cashierToken: string;
  let storeId: string;
  let categoryId: string;
  let productId: string;

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

    categoryId = (
      await request(app.getHttpServer())
        .post(`/api/v1/stores/${storeId}/categories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Drinks' })
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
  });

  afterAll(async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;
    await app.close();
    await teardownTestDatabase();
  });

  it('creates and lists products', async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Cappuccino',
        categoryId,
        price: 4.5,
        description: 'Espresso with steamed milk foam',
      })
      .expect(201);

    expect(createResponse.body.data.name).toBe('Cappuccino');
    expect(createResponse.body.data.slug).toBe('cappuccino');
    expect(createResponse.body.data.price).toBe(4.5);
    productId = createResponse.body.data.id;

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(1);
  });

  it('filters products by categoryId', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products?categoryId=${categoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].categoryId).toBe(categoryId);
  });

  it('rejects duplicate product slug in same store', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Cappuccino', categoryId, price: 5 })
      .expect(409);
  });

  it('rejects product with invalid category', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Latte',
        categoryId: '507f1f77bcf86cd799439099',
        price: 4,
      })
      .expect(400);
  });

  it('allows cashier to read products', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('blocks cashier from creating products', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Latte', categoryId, price: 4 })
      .expect(403);
  });

  it('updates and soft-deletes a product', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/products/${productId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Iced Cappuccino', price: 5, isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeId}/products/${productId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const activeList = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products?active=true`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(activeList.body.data).toHaveLength(0);
  });
});
