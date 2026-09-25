import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const PRODUCT_CATEGORIES = ['อาหาร', 'เครื่องดื่ม', 'ของใช้', 'เสื้อผ้า'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export class CreateProductDto {
  @IsString({ message: 'ชื่อสินค้าต้องเป็นข้อความ' })
  @IsNotEmpty({ message: 'ชื่อสินค้าต้องไม่ว่าง' })
  name!: string;

  @IsString({ message: 'รหัสสินค้าต้องเป็นข้อความ' })
  @MinLength(3, { message: 'รหัสสินค้าต้องมีอย่างน้อย 3 ตัวอักษร' })
  sku!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'ราคาต้องเป็นตัวเลข' })
  @IsPositive({ message: 'ราคาต้องมากกว่า 0' })
  price!: number;

  @Type(() => Number)
  @IsInt({ message: 'จำนวนคงเหลือต้องเป็นจำนวนเต็ม' })
  @Min(0, { message: 'จำนวนคงเหลือต้องไม่ติดลบ' })
  stock!: number;

  @IsIn(PRODUCT_CATEGORIES, { message: 'หมวดหมู่ไม่ถูกต้อง' })
  category!: ProductCategory;
}