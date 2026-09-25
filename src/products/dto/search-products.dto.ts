import { IsNotEmpty, IsString } from 'class-validator';

export class SearchProductsDto {
  @IsString({ message: 'คำค้นหาต้องเป็นข้อความ' })
  @IsNotEmpty({ message: 'คำค้นหาต้องไม่ว่าง' })
  keyword!: string;
}