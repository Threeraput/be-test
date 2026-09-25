import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkPriceUpdateDto } from './bulk-price-update.dto.js';
import { CreateProductDto } from './create-product.dto.js';
import { SellProductDto } from './sell-product.dto.js';

describe('product DTOs', () => {
  it('accepts a valid product payload', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'ชาเขียว',
      sku: 'TEA-001',
      price: 45.5,
      stock: 10,
      category: 'เครื่องดื่ม',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects each invalid create-product field', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '',
      sku: 'A',
      price: 0,
      stock: -1,
      category: 'อื่นๆ',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'sku', 'price', 'stock', 'category']),
    );
  });

  it('rejects invalid sell and bulk price update payloads', async () => {
    const sellErrors = await validate(
      plainToInstance(SellProductDto, { productId: 'product', quantity: 0 }),
    );
    const bulkErrors = await validate(plainToInstance(BulkPriceUpdateDto, { items: [] }));

    expect(sellErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['productId', 'quantity']),
    );
    expect(bulkErrors.map((error) => error.property)).toContain('items');
  });
});