import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class SellProductDto {
  @Type(() => Number)
  @IsInt({ message: 'รหัสสินค้าต้องเป็นจำนวนเต็ม' })
  productId!: number;

  @Type(() => Number)
  @IsInt({ message: 'จำนวนที่ขายต้องเป็นจำนวนเต็ม' })
  @IsPositive({ message: 'จำนวนที่ขายต้องมากกว่า 0' })
  quantity!: number;
}