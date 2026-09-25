import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsInt, IsPositive, ValidateNested } from 'class-validator';

export class PriceUpdateItem {
  @Type(() => Number)
  @IsInt({ message: 'รหัสสินค้าต้องเป็นจำนวนเต็ม' })
  productId!: number;

  @Type(() => Number)
  @IsPositive({ message: 'ราคาต้องมากกว่า 0' })
  newPrice!: number;
}

export class BulkPriceUpdateDto {
  @ArrayNotEmpty({ message: 'รายการปรับราคาต้องไม่ว่าง' })
  @ValidateNested({ each: true })
  @Type(() => PriceUpdateItem)
  items!: PriceUpdateItem[];
}