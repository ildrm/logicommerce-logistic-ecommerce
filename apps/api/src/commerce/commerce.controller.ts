import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  AddCartLineDto,
  CheckoutDto,
  CreateAddressDto,
  CreateCartDto,
  CreatePromotionDto,
  InventoryFeedDto,
  QuoteCartDto,
  UpdateCartLineDto,
} from './commerce.dto.js';
import { CommerceService } from './commerce.service.js';

@ApiTags('commerce')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'commerce', version: '1' })
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly contexts: TenantContextService,
  ) {}

  @Post('inventory/feeds')
  @RequirePermissions('inventory.manage')
  inventoryFeed(@Body() input: InventoryFeedDto, @Req() request: AuthenticatedRequest) {
    return this.commerce.inventoryFeed(this.contexts.get(), this.principal(request), input);
  }

  @Get('inventory')
  @RequirePermissions('inventory.manage')
  inventory() {
    return this.commerce.inventory(this.contexts.get());
  }

  @Get('inventory/reconciliation')
  @RequirePermissions('inventory.manage')
  inventoryReconciliation() {
    return this.commerce.inventoryReconciliation(this.contexts.get());
  }

  @Get('promotions')
  @RequirePermissions('offer.manage')
  promotions() {
    return this.commerce.promotions(this.contexts.get());
  }

  @Post('promotions')
  @RequirePermissions('offer.manage')
  createPromotion(@Body() input: CreatePromotionDto, @Req() request: AuthenticatedRequest) {
    return this.commerce.createPromotion(this.contexts.get(), this.principal(request), input);
  }

  @Post('carts')
  @RequirePermissions('cart.use')
  createCart(@Body() input: CreateCartDto, @Req() request: AuthenticatedRequest) {
    return this.commerce.createCart(this.contexts.get(), this.principal(request), input);
  }

  @Get('carts/:cartId')
  @RequirePermissions('cart.use')
  cart(@Param('cartId', new ParseUUIDPipe()) cartId: string, @Req() request: AuthenticatedRequest) {
    return this.commerce.cart(this.contexts.get(), this.principal(request), cartId);
  }

  @Post('carts/:cartId/lines')
  @RequirePermissions('cart.use')
  addLine(
    @Param('cartId', new ParseUUIDPipe()) cartId: string,
    @Body() input: AddCartLineDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.addCartLine(this.contexts.get(), this.principal(request), cartId, input);
  }

  @Put('carts/:cartId/lines/:lineId')
  @RequirePermissions('cart.use')
  updateLine(
    @Param('cartId', new ParseUUIDPipe()) cartId: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() input: UpdateCartLineDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.updateCartLine(
      this.contexts.get(),
      this.principal(request),
      cartId,
      lineId,
      input,
    );
  }

  @Delete('carts/:cartId/lines/:lineId')
  @RequirePermissions('cart.use')
  removeLine(
    @Param('cartId', new ParseUUIDPipe()) cartId: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.removeCartLine(
      this.contexts.get(),
      this.principal(request),
      cartId,
      lineId,
    );
  }

  @Post('carts/:cartId/quote')
  @RequirePermissions('cart.use')
  quote(
    @Param('cartId', new ParseUUIDPipe()) cartId: string,
    @Body() input: QuoteCartDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.quote(this.contexts.get(), this.principal(request), cartId, input);
  }

  @Post('carts/:cartId/checkout')
  @RequirePermissions('cart.use')
  checkout(
    @Param('cartId', new ParseUUIDPipe()) cartId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CheckoutDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.checkout(
      this.contexts.get(),
      this.principal(request),
      cartId,
      idempotencyKey ?? '',
      input,
    );
  }

  @Get('addresses')
  @RequirePermissions('cart.use')
  addresses(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.commerce.addressesForUser(this.contexts.get(), this.principal(request));
  }

  @Post('addresses')
  @RequirePermissions('cart.use')
  createAddress(@Body() input: CreateAddressDto, @Req() request: AuthenticatedRequest) {
    return this.commerce.createAddress(this.contexts.get(), this.principal(request), input);
  }

  @Get('orders/mine')
  @RequirePermissions('cart.use')
  myOrders(@Req() request: AuthenticatedRequest) {
    return this.commerce.myOrders(this.contexts.get(), this.principal(request));
  }

  @Get('orders/mine/:orderId')
  @RequirePermissions('cart.use')
  myOrder(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.orderForUser(this.contexts.get(), this.principal(request), orderId);
  }

  @Get('orders')
  @RequirePermissions('order.manage')
  orders() {
    return this.commerce.orders(this.contexts.get());
  }

  @Get('orders/:orderId')
  @RequirePermissions('order.manage')
  order(@Param('orderId', new ParseUUIDPipe()) orderId: string) {
    return this.commerce.orderForAdmin(this.contexts.get(), orderId);
  }

  @Get('purchase-orders')
  @RequirePermissions('purchase-order.manage')
  purchaseOrders() {
    return this.commerce.purchaseOrders(this.contexts.get());
  }

  @Put('purchase-orders/:purchaseOrderId/accept')
  @RequirePermissions('purchase-order.manage')
  acceptPurchaseOrder(
    @Param('purchaseOrderId', new ParseUUIDPipe()) purchaseOrderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.acceptPurchaseOrder(
      this.contexts.get(),
      this.principal(request),
      purchaseOrderId,
    );
  }

  private principal(request: AuthenticatedRequest): AuthPrincipal {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}
