import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { BulkPriceUpdateDto } from './dto/bulk-price-update.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { SearchProductsDto } from './dto/search-products.dto.js';
import { SellProductDto } from './dto/sell-product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(@Query() query: ListProductsDto) {
    return this.productsService.findAll(query.category);
  }

  @Post('sell')
  sell(@Body() sellProductDto: SellProductDto) {
    return this.productsService.sell(sellProductDto);
  }

  @Get('search')
  search(@Query() query: SearchProductsDto) {
    return this.productsService.search(query.keyword);
  }

  @Put('bulk-price-update')
  bulkPriceUpdate(@Body() bulkPriceUpdateDto: BulkPriceUpdateDto) {
    return this.productsService.bulkPriceUpdate(bulkPriceUpdateDto);
  }
}