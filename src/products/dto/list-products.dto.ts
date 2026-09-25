import { IsIn, IsOptional } from 'class-validator';
import { PRODUCT_CATEGORIES } from './create-product.dto.js';
import type { ProductCategory } from './create-product.dto.js';

export class ListProductsDto {
  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES, { message: 'หมวดหมู่ไม่ถูกต้อง' })
  category?: ProductCategory;
}