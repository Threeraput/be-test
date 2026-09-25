import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';

const createQuery = (result: unknown[]) => ({
  from: () => ({
    where: () => ({
      limit: async () => result,
    }),
  }),
});

describe('ProductsService', () => {
  it('checks sell quantity before looking up the product', async () => {
    const db = { select: vi.fn() };
    const service = new ProductsService(db as never);

    await expect(service.sell({ productId: 1, quantity: 0 })).rejects.toThrow(
      BadRequestException,
    );
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns not found when the product does not exist', async () => {
    const db = { select: vi.fn(() => createQuery([])) };
    const service = new ProductsService(db as never);

    await expect(service.sell({ productId: 1, quantity: 1 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns insufficient stock when the conditional update affects no rows', async () => {
    const db = {
      select: vi.fn(() => createQuery([{ id: 1 }])),
      transaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          update: () => ({
            set: () => ({
              where: () => ({ returning: async () => [] }),
            }),
          }),
        }),
    };
    const service = new ProductsService(db as never);

    await expect(service.sell({ productId: 1, quantity: 1 })).rejects.toThrow(
      'สินค้าคงเหลือไม่เพียงพอ',
    );
  });

  it('rejects an existing SKU before attempting an insert', async () => {
    const db = { select: vi.fn(() => createQuery([{ id: 1 }])), insert: vi.fn() };
    const service = new ProductsService(db as never);

    await expect(
      service.create({
        name: 'ชาเขียว',
        sku: 'TEA-001',
        price: 10,
        stock: 1,
        category: 'เครื่องดื่ม',
      }),
    ).rejects.toThrow('รหัสสินค้าซ้ำกับที่มีอยู่แล้ว');
    expect(db.insert).not.toHaveBeenCalled();
  });
});