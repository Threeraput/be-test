# FlowAccount Technical Test — Product Management API
**Stack:** NestJS + Drizzle ORM + PostgreSQL

---

## 1. โครงสร้างโปรเจกต์

```
src/
├── db/
│   ├── schema.ts          # Drizzle schema
│   ├── drizzle.module.ts  # Provider สำหรับ inject DB client
│   └── migrations/
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   ├── dto/
│   │   ├── create-product.dto.ts
│   │   ├── sell-product.dto.ts
│   │   └── bulk-price-update.dto.ts
│   └── products.repository.ts   # (optional) แยก DB access ออกจาก service
├── common/
│   ├── filters/http-exception.filter.ts
│   └── enums/category.enum.ts
├── app.module.ts
└── main.ts
```

---

## 2. Database Schema (Drizzle)

```ts
// src/db/schema.ts
import { pgTable, serial, varchar, numeric, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const categoryEnum = pgEnum('category', ['อาหาร', 'เครื่องดื่ม', 'ของใช้', 'เสื้อผ้า']);

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
  category: categoryEnum('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**หมายเหตุ:**
- `sku` มี `unique()` constraint ที่ระดับ DB — กัน race condition ที่ application-level validation เพียงอย่างเดียวเอาไม่อยู่ (เช่น สอง request พร้อมกัน)
- ใช้ `numeric` แทน `float` สำหรับราคา เพื่อเลี่ยงปัญหา floating-point rounding กับเงินบาท

---

## 3. DTO + Validation (`class-validator`)

```ts
// dto/create-product.dto.ts
import { IsString, IsNotEmpty, MinLength, IsNumber, Min, IsIn, IsPositive } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'ชื่อสินค้าต้องไม่ว่าง' })
  name: string;

  @IsString()
  @MinLength(3, { message: 'รหัสสินค้าต้องมีอย่างน้อย 3 ตัวอักษร' })
  sku: string;

  @IsNumber()
  @IsPositive({ message: 'ราคาต้องมากกว่า 0' })
  price: number;

  @IsNumber()
  @Min(0, { message: 'จำนวนคงเหลือต้องไม่ติดลบ' })
  stock: number;

  @IsIn(['อาหาร', 'เครื่องดื่ม', 'ของใช้', 'เสื้อผ้า'], { message: 'หมวดหมู่ไม่ถูกต้อง' })
  category: string;
}
```

```ts
// dto/sell-product.dto.ts
export class SellProductDto {
  @IsInt()
  productId: number;

  @IsInt()
  @IsPositive({ message: 'จำนวนที่ขายต้องมากกว่า 0' })
  quantity: number;
}
```

```ts
// dto/bulk-price-update.dto.ts
class PriceUpdateItem {
  @IsInt()
  productId: number;

  @IsNumber()
  @IsPositive()
  newPrice: number;
}

export class BulkPriceUpdateDto {
  @ValidateNested({ each: true })
  @Type(() => PriceUpdateItem)
  @ArrayNotEmpty()
  items: PriceUpdateItem[];
}
```

Bootstrap `main.ts` ด้วย `ValidationPipe({ whitelist: true, exceptionFactory })` เพื่อรวม error messages เป็น array รูปแบบเดียวกับที่โจทย์กำหนด (`{ "errors": [...] }`) — ใช้ custom `exceptionFactory` แปลง `ValidationError[]` เป็น flat array ของ message string

---

## 4. Endpoints

### Challenge 1 — `POST /api/products`
| Step | รายละเอียด |
|---|---|
| 1 | Validate ผ่าน DTO (name, price, stock, category ตาม rule) |
| 2 | เช็ค `sku` ซ้ำ: query `SELECT ... WHERE sku = ?` ก่อน insert (application check เพื่อ error message ที่ดี) แล้วยังพึ่ง DB unique constraint เป็น safety net |
| 3 | ถ้าซ้ำ → 400 พร้อม message `"รหัสสินค้าซ้ำกับที่มีอยู่แล้ว"` |
| 4 | ผ่านทุกอย่าง → insert แล้วคืน 201 พร้อม object ที่สร้าง |

### Challenge 2 — `GET /api/products?category=...`
- ถ้ามี `category` query param → filter ด้วย `where(eq(products.category, category))`
- ถ้าไม่มี → คืนทั้งหมด
- Validate ว่า `category` (ถ้าส่งมา) อยู่ใน 4 ค่าที่กำหนด ไม่งั้นคืน 400

### Challenge 3 — `POST /api/products/sell`
ลำดับการตรวจสอบ (**ตามที่โจทย์ระบุ ต้องตรวจตามลำดับนี้เป๊ะ ๆ** เพราะ error message ที่คืนต่างกัน):
1. `quantity > 0` → ไม่งั้น 400 `"จำนวนที่ขายต้องมากกว่า 0"`
2. หา product จาก `productId` → ไม่เจอ 404 `"ไม่พบสินค้า"`
3. `stock >= quantity` → ไม่งั้น 400 `"สินค้าคงเหลือไม่เพียงพอ"`
4. Update: `stock = stock - quantity`

**Concurrency:** ใช้ transaction + conditional update กัน race condition ตอนตัดสต็อกพร้อมกันหลาย request:
```ts
await db.transaction(async (tx) => {
  const result = await tx
    .update(products)
    .set({ stock: sql`${products.stock} - ${quantity}` })
    .where(and(eq(products.id, productId), gte(products.stock, quantity)))
    .returning();
  if (result.length === 0) throw new BadRequestException('สินค้าคงเหลือไม่เพียงพอ หรือไม่พบสินค้า');
});
```
วิธีนี้ atomic กว่าการ read-then-write แยกสองสเต็ป

### Challenge 4 (Bonus) — `GET /api/products/search?keyword=...`
```ts
.where(or(
  ilike(products.name, `%${keyword}%`),
  ilike(products.sku, `%${keyword}%`),
))
```
`ilike` ของ Postgres case-insensitive อยู่แล้ว ไม่ต้อง `LOWER()` เอง

### Challenge 5 (Bonus) — `PUT /api/products/bulk-price-update`
- Loop ผ่าน items, update ทีละตัวภายใน transaction เดียว (ถ้าอยากให้ all-or-nothing) หรือ update แบบ best-effort พร้อมนับจำนวนสำเร็จ/ล้มเหลว
- Response:
```json
{ "updated": 8, "failed": 2, "errors": [{ "productId": 5, "reason": "ไม่พบสินค้า" }] }
```

---

## 5. Error Response Format (ทั้งระบบ)

Global `HttpExceptionFilter` แปลง exception ทุกชนิดให้เป็นรูปแบบเดียว:
```json
{ "errors": ["message1", "message2"] }
```
- `BadRequestException` (validation) → 400
- `NotFoundException` (product not found) → 404
- Unhandled → 500 พร้อม generic message (ไม่ leak stack trace)

---

## 6. Testing Priorities (ถ้าเวลาเหลือ)
1. Unit test service logic: validation edge cases, sell business rules (ลำดับการเช็ค)
2. Integration test: SKU uniqueness ภายใต้ concurrent requests
3. E2E happy path ทั้ง 5 endpoints

---

## 7. Time Allocation ที่แนะนำ (50 นาที)
| งาน | เวลา |
|---|---|
| Setup project + Drizzle schema + migration | 8 นาที |
| Challenge 1 (create + validate) | 10 นาที |
| Challenge 2 (list + filter) | 4 นาที |
| Challenge 3 (sell + stock logic) | 10 นาที |
| Challenge 4 (search) | 5 นาที |
| Challenge 5 (bulk update) | 8 นาที |
| Buffer / testing | 5 นาที |
