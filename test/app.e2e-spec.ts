import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { eq } from 'drizzle-orm';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/common/configure-app.js';
import { DATABASE } from './../src/db/drizzle.module.js';
import type { Database } from './../src/db/drizzle.module.js';
import { products } from './../src/db/schema.js';

describe('Products API (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get<Database>(DATABASE);
  });

  beforeEach(async () => {
    await db.delete(products);
  });

  afterAll(async () => {
    await app.close();
  });

  const createProduct = (overrides: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'ชาเขียว',
        sku: 'TEA-001',
        price: 45.5,
        stock: 10,
        category: 'เครื่องดื่ม',
        ...overrides,
      });

  it('creates a product and validates invalid requests with the standard error format', async () => {
    const created = await createProduct().expect(201);

    expect(created.body).toMatchObject({
      name: 'ชาเขียว',
      sku: 'TEA-001',
      price: 45.5,
      stock: 10,
      category: 'เครื่องดื่ม',
    });

    const invalid = await createProduct({ name: '', sku: 'A', price: 0, stock: -1 })
      .expect(400);

    expect(invalid.body).toEqual({
      errors: expect.arrayContaining([
        'ชื่อสินค้าต้องไม่ว่าง',
        'รหัสสินค้าต้องมีอย่างน้อย 3 ตัวอักษร',
        'ราคาต้องมากกว่า 0',
        'จำนวนคงเหลือต้องไม่ติดลบ',
      ]),
    });
  });

  it('rejects duplicate SKU requests, including concurrent requests', async () => {
    const results = await Promise.all([
      createProduct({ sku: 'RACE-001' }),
      createProduct({ sku: 'RACE-001' }),
    ]);

    expect(results.filter((response) => response.status === 201)).toHaveLength(1);
    expect(results.filter((response) => response.status === 400)[0].body).toEqual({
      errors: ['รหัสสินค้าซ้ำกับที่มีอยู่แล้ว'],
    });
  });

  it('lists all products and filters by category', async () => {
    await createProduct({ sku: 'DRINK-001' }).expect(201);
    await createProduct({
      name: 'สมุด',
      sku: 'BOOK-001',
      category: 'ของใช้',
    }).expect(201);

    const allProducts = await request(app.getHttpServer()).get('/api/products').expect(200);
    const filteredProducts = await request(app.getHttpServer())
      .get('/api/products')
      .query({ category: 'ของใช้' })
      .expect(200);
    const invalidCategory = await request(app.getHttpServer())
      .get('/api/products')
      .query({ category: 'อื่นๆ' })
      .expect(400);

    expect(allProducts.body).toHaveLength(2);
    expect(filteredProducts.body).toHaveLength(1);
    expect(filteredProducts.body[0].sku).toBe('BOOK-001');
    expect(invalidCategory.body).toEqual({ errors: ['หมวดหมู่ไม่ถูกต้อง'] });
  });

  it('sells stock using business-rule error responses and never allows concurrent overselling', async () => {
    const created = await createProduct({ sku: 'SELL-001', stock: 5 }).expect(201);

    const missingProduct = await request(app.getHttpServer())
      .post('/api/products/sell')
      .send({ productId: 999999, quantity: 1 })
      .expect(404);
    const insufficientStock = await request(app.getHttpServer())
      .post('/api/products/sell')
      .send({ productId: created.body.id, quantity: 6 })
      .expect(400);
    const sales = await Promise.all([
      request(app.getHttpServer())
        .post('/api/products/sell')
        .send({ productId: created.body.id, quantity: 3 }),
      request(app.getHttpServer())
        .post('/api/products/sell')
        .send({ productId: created.body.id, quantity: 3 }),
    ]);
    const [storedProduct] = await db
      .select()
      .from(products)
      .where(eq(products.id, created.body.id));

    expect(missingProduct.body).toEqual({ errors: ['ไม่พบสินค้า'] });
    expect(insufficientStock.body).toEqual({ errors: ['สินค้าคงเหลือไม่เพียงพอ'] });
    expect(sales.filter((response) => response.status === 201)).toHaveLength(1);
    expect(sales.filter((response) => response.status === 400)).toHaveLength(1);
    expect(storedProduct.stock).toBe(2);
  });

  it('searches case-insensitively by name and SKU', async () => {
    await createProduct({ name: 'Coffee Bean', sku: 'COF-001' }).expect(201);

    const byName = await request(app.getHttpServer())
      .get('/api/products/search')
      .query({ keyword: 'coffee' })
      .expect(200);
    const bySku = await request(app.getHttpServer())
      .get('/api/products/search')
      .query({ keyword: 'cof' })
      .expect(200);
    const missingKeyword = await request(app.getHttpServer())
      .get('/api/products/search')
      .query({ keyword: '' })
      .expect(400);

    expect(byName.body[0].sku).toBe('COF-001');
    expect(bySku.body[0].name).toBe('Coffee Bean');
    expect(missingKeyword.body).toEqual({ errors: ['คำค้นหาต้องไม่ว่าง'] });
  });

  it('bulk-updates prices and reports products that do not exist', async () => {
    const first = await createProduct({ sku: 'BULK-001', price: 20 }).expect(201);
    const second = await createProduct({ sku: 'BULK-002', price: 30 }).expect(201);

    const response = await request(app.getHttpServer())
      .put('/api/products/bulk-price-update')
      .send({
        items: [
          { productId: first.body.id, newPrice: 25 },
          { productId: second.body.id, newPrice: 35 },
          { productId: 999999, newPrice: 99 },
        ],
      })
      .expect(200);
    const updatedProducts = await db.select().from(products);

    expect(response.body).toEqual({
      updated: 2,
      failed: 1,
      errors: [{ productId: 999999, reason: 'ไม่พบสินค้า' }],
    });
    expect(updatedProducts.map((product) => product.price).sort()).toEqual([25, 35]);
  });
});
