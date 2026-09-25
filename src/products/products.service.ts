import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { DATABASE } from '../db/drizzle.module.js';
import type { Database } from '../db/drizzle.module.js';
import { products } from '../db/schema.js';
import { BulkPriceUpdateDto } from './dto/bulk-price-update.dto.js';
import { CreateProductDto, ProductCategory } from './dto/create-product.dto.js';
import { SellProductDto } from './dto/sell-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(createProductDto: CreateProductDto) {
    const existingProduct = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, createProductDto.sku))
      .limit(1);

    if (existingProduct.length > 0) {
      throw new BadRequestException('รหัสสินค้าซ้ำกับที่มีอยู่แล้ว');
    }

    try {
      const [product] = await this.db.insert(products).values(createProductDto).returning();
      return product;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('รหัสสินค้าซ้ำกับที่มีอยู่แล้ว');
      }

      throw error;
    }
  }

  async findAll(category?: ProductCategory) {
    if (!category) {
      return this.db.select().from(products);
    }

    return this.db.select().from(products).where(eq(products.category, category));
  }

  async sell({ productId, quantity }: SellProductDto) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('จำนวนที่ขายต้องมากกว่า 0');
    }

    const [product] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException('ไม่พบสินค้า');
    }

    return this.db.transaction(async (transaction) => {
      const [updatedProduct] = await transaction
        .update(products)
        .set({
          stock: sql`${products.stock} - ${quantity}`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(products.id, productId), gte(products.stock, quantity)))
        .returning();

      if (!updatedProduct) {
        throw new BadRequestException('สินค้าคงเหลือไม่เพียงพอ');
      }

      return updatedProduct;
    });
  }

  async search(keyword: string) {
    const pattern = `%${keyword}%`;
    return this.db
      .select()
      .from(products)
      .where(or(ilike(products.name, pattern), ilike(products.sku, pattern)));
  }

  async bulkPriceUpdate({ items }: BulkPriceUpdateDto) {
    const errors: { productId: number; reason: string }[] = [];
    let updated = 0;

    await this.db.transaction(async (transaction) => {
      for (const item of items) {
        const updatedRows = await transaction
          .update(products)
          .set({ price: item.newPrice, updatedAt: sql`now()` })
          .where(eq(products.id, item.productId))
          .returning({ id: products.id });

        if (updatedRows.length === 0) {
          errors.push({ productId: item.productId, reason: 'ไม่พบสินค้า' });
        } else {
          updated += 1;
        }
      }
    });

    return { updated, failed: errors.length, errors };
  }

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}