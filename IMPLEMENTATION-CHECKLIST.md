# FlowAccount Product API Checklist

ทำเครื่องหมาย `[x]` เฉพาะเมื่อ implementation และ test ของขั้นนั้นผ่านแล้ว

## 0. Database Setup

- [x] สร้าง PostgreSQL database `flowaccount` และ user `flowaccount`
- [x] ตั้งค่า `DATABASE_URL` ใน `.env`
- [x] ติดตั้ง Drizzle ORM, `postgres` และ Drizzle Kit
- [x] สร้าง `products` schema และ `category` enum
- [x] Generate และ apply initial migration
- [x] ตรวจสอบว่ามีตาราง `products`, enum 4 ค่า และ migration record

## 1. Shared Error and Validation Setup

- [x] ติดตั้ง `class-validator` และ `class-transformer`
- [x] สร้าง `src/common/filters/http-exception.filter.ts`
- [x] ให้ exception ทุกชนิดตอบรูปแบบ `{ "errors": ["..."] }`
- [x] ตั้ง `ValidationPipe({ whitelist: true, transform: true, exceptionFactory })` ใน `main.ts`
- [x] Flatten validation messages เป็น array ของ string
- [x] เพิ่ม test: invalid request ได้ HTTP 400 และ body ตรง `{ errors: [...] }`
- [x] เพิ่ม test: 404 ได้ body ตรง `{ errors: ["..."] }`

## 2. Product Module and DTOs

- [x] สร้าง `src/products/products.module.ts`
- [x] สร้าง `src/products/products.controller.ts`
- [x] สร้าง `src/products/products.service.ts`
- [x] Import `ProductsModule` ใน `AppModule`
- [x] สร้าง `CreateProductDto`
  - [x] `name` เป็น string และห้ามว่าง
  - [x] `sku` เป็น string ความยาวอย่างน้อย 3
  - [x] `price` เป็น number มากกว่า 0
  - [x] `stock` เป็น number ตั้งแต่ 0
  - [x] `category` อยู่ใน 4 category ที่กำหนด
- [x] สร้าง `SellProductDto`
  - [x] `productId` เป็น integer
  - [x] `quantity` เป็น integer มากกว่า 0
- [x] สร้าง `BulkPriceUpdateDto` และ nested `PriceUpdateItem`
- [x] เพิ่ม unit test สำหรับ valid/invalid DTO ทุก rule

## 3. Create Product: POST /api/products

- [x] เพิ่ม endpoint `POST /api/products`
- [x] ตรวจ DTO ก่อนเข้าถึง database
- [x] ตรวจ SKU ซ้ำก่อน insert เพื่อคืนข้อความ `รหัสสินค้าซ้ำกับที่มีอยู่แล้ว`
- [x] Handle unique constraint จาก database เพื่อกัน concurrent request
- [x] Insert และคืน HTTP 201 พร้อมสินค้าใหม่
- [x] เพิ่ม service test: สร้างสินค้าสำเร็จ
- [x] เพิ่ม service test: SKU ซ้ำได้ HTTP 400 และข้อความถูกต้อง
- [x] เพิ่ม E2E test: invalid payload ได้ HTTP 400
- [x] เพิ่ม E2E test: ส่ง create สอง request พร้อมกันแล้วสำเร็จเพียงรายการเดียว

## 4. List Products: GET /api/products

- [x] เพิ่ม endpoint `GET /api/products`
- [x] ไม่มี query `category` ต้องคืนสินค้าทั้งหมด
- [x] มี `category` ต้อง filter ด้วยค่า category นั้น
- [x] category ไม่ถูกต้องต้องได้ HTTP 400
- [x] เพิ่ม E2E test: list สินค้าทั้งหมด
- [x] เพิ่ม E2E test: filter category ถูกต้อง
- [x] เพิ่ม E2E test: invalid category ได้ HTTP 400

## 5. Sell Product: POST /api/products/sell

- [x] เพิ่ม endpoint `POST /api/products/sell`
- [x] ตรวจ `quantity > 0` ก่อนหา product
- [x] product ไม่พบต้องได้ HTTP 404 พร้อม `ไม่พบสินค้า`
- [x] stock ไม่พอต้องได้ HTTP 400 พร้อม `สินค้าคงเหลือไม่เพียงพอ`
- [x] ใช้ transaction และ conditional update (`stock >= quantity`) เพื่อ atomic stock decrement
- [x] Update `updatedAt` ระหว่างตัด stock
- [x] เพิ่ม service test: quantity ไม่ถูกต้องถูกตรวจเป็นลำดับแรก
- [x] เพิ่ม service test: ไม่พบสินค้า
- [x] เพิ่ม service test: stock ไม่พอ
- [x] เพิ่ม E2E test: ตัด stock สำเร็จและ stock ลดตาม quantity
- [x] เพิ่ม integration test: requests ตัด stock พร้อมกันไม่ทำให้ stock ติดลบ

## 6. Search Products (Bonus): GET /api/products/search

- [x] เพิ่ม endpoint `GET /api/products/search?keyword=...`
- [x] ค้นหา case-insensitive ใน `name` และ `sku` ด้วย PostgreSQL `ilike`
- [x] กำหนดพฤติกรรมของ keyword ว่างให้ชัดเจน (HTTP 400)
- [x] เพิ่ม E2E test: ค้นหาด้วย name
- [x] เพิ่ม E2E test: ค้นหาด้วย SKU แบบต่างตัวพิมพ์

## 7. Bulk Price Update (Bonus): PUT /api/products/bulk-price-update

- [x] เพิ่ม endpoint `PUT /api/products/bulk-price-update`
- [x] ตรวจว่ารายการ `items` ไม่ว่าง
- [x] ตรวจ `productId` เป็น integer และ `newPrice > 0`
- [x] ใช้ best-effort ภายใน transaction โดยเก็บรายการสินค้าที่ไม่พบเป็น error
- [x] ตอบ `{ "updated": number, "failed": number, "errors": [...] }`
- [x] เพิ่ม unit test: input invalid
- [x] เพิ่ม E2E test: update สำเร็จหลายสินค้า
- [x] เพิ่ม E2E test: product ไม่พบและ response summary ถูกต้อง

## 8. Final Verification

- [x] รัน `npm run build`
- [x] รัน `npm run lint`
- [x] รัน `npm run test`
- [x] รัน `npm run test:e2e`
- [x] รัน `npm run db:migrate` ซ้ำได้โดยไม่มี schema error
- [x] ตรวจด้วย E2E client ว่า error response ของทุก endpoint มี key `errors`
- [x] ตรวจว่า `.env` ไม่ถูก commit และ `.env.example` มีตัวแปรครบ