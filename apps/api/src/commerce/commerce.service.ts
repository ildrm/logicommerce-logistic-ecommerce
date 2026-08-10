import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import type {
  AddCartLineDto,
  CheckoutDto,
  CreateAddressDto,
  CreateCartDto,
  CreatePromotionDto,
  InventoryFeedDto,
  QuoteCartDto,
  UpdateCartLineDto,
} from './commerce.dto.js';
import {
  COMMERCE_ADAPTER,
  type CommerceAdapter,
  type NormalizedAddress,
} from './commerce-adapters.js';
import {
  CommerceRepository,
  type CartSnapshot,
  type CommerceQuote,
} from './commerce.repository.js';

@Injectable()
export class CommerceService {
  constructor(
    private readonly commerce: CommerceRepository,
    @Inject(COMMERCE_ADAPTER) private readonly adapter: CommerceAdapter,
  ) {}

  inventoryFeed(context: TenantContext, principal: AuthPrincipal, input: InventoryFeedDto) {
    return this.commerce.inventoryFeed(context, principal, input);
  }

  inventory(context: TenantContext) {
    return this.commerce.inventory(context);
  }

  inventoryReconciliation(context: TenantContext) {
    return this.commerce.inventoryReconciliation(context);
  }

  promotions(context: TenantContext) {
    return this.commerce.promotions(context);
  }

  createPromotion(context: TenantContext, principal: AuthPrincipal, input: CreatePromotionDto) {
    return this.commerce.createPromotion(context, principal, input);
  }

  createCart(context: TenantContext, principal: AuthPrincipal, input: CreateCartDto) {
    return this.commerce.createCart(context, principal, input);
  }

  cart(context: TenantContext, principal: AuthPrincipal, cartId: string) {
    return this.commerce.cart(context, principal, cartId);
  }

  addCartLine(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    input: AddCartLineDto,
  ) {
    return this.commerce.addCartLine(context, principal, cartId, input);
  }

  updateCartLine(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    lineId: string,
    input: UpdateCartLineDto,
  ) {
    return this.commerce.updateCartLine(context, principal, cartId, lineId, input);
  }

  removeCartLine(context: TenantContext, principal: AuthPrincipal, cartId: string, lineId: string) {
    return this.commerce.removeCartLine(context, principal, cartId, lineId);
  }

  async quote(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    input: QuoteCartDto,
  ) {
    const cart = await this.commerce.cart(context, principal, cartId);
    const address: NormalizedAddress = {
      recipient: 'Estimate',
      line1: 'Estimate',
      city: 'Estimate',
      postalCode: '00000',
      countryCode: 'US',
      validatedBy: 'deterministic-local-v1',
    };
    return {
      cartId,
      cartVersion: cart.version,
      ...(await this.calculateQuote(context, cart, input.promotionCode, address)),
      estimated: true,
    };
  }

  createAddress(context: TenantContext, principal: AuthPrincipal, input: CreateAddressDto) {
    return this.commerce.createAddress(context, principal, input);
  }

  addressesForUser(context: TenantContext, principal: AuthPrincipal): Promise<unknown> {
    return this.commerce.addresses(context, principal);
  }

  async checkout(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    idempotencyKey: string,
    input: CheckoutDto,
  ) {
    if (idempotencyKey.trim().length < 8 || idempotencyKey.length > 160) {
      throw new ConflictException('A valid Idempotency-Key header is required');
    }
    const replay = await this.commerce.checkoutReplay(context, principal, cartId, idempotencyKey);
    if (replay) return replay;
    const cart = await this.commerce.cart(context, principal, cartId);
    const address = await this.adapter.validate(input.address);
    const quote = await this.calculateQuote(context, cart, input.promotionCode, address);
    const fraudDecision = await this.adapter.assess({
      totalMinor: quote.totalMinor,
      userId: principal.userId,
    });
    if (fraudDecision !== 'APPROVED') throw new ForbiddenException('Checkout was declined');
    const payment = await this.adapter.authorize({
      paymentToken: input.paymentToken,
      amountMinor: quote.totalMinor,
      currency: quote.currency,
      idempotencyKey,
    });
    try {
      return await this.commerce.checkout(context, principal, cartId, {
        cartVersion: cart.version,
        idempotencyKey,
        quote,
        address,
        paymentReference: payment.reference,
        fraudDecision,
      });
    } catch (error) {
      await this.adapter.void(payment.reference);
      throw error;
    }
  }

  orders(context: TenantContext) {
    return this.commerce.orders(context);
  }

  myOrders(context: TenantContext, principal: AuthPrincipal) {
    return this.commerce.myOrders(context, principal);
  }

  orderForUser(context: TenantContext, principal: AuthPrincipal, orderId: string) {
    return this.commerce.orderForUser(context, principal, orderId);
  }

  orderForAdmin(context: TenantContext, orderId: string) {
    return this.commerce.orderForAdmin(context, orderId);
  }

  purchaseOrders(context: TenantContext) {
    return this.commerce.purchaseOrders(context);
  }

  acceptPurchaseOrder(context: TenantContext, principal: AuthPrincipal, purchaseOrderId: string) {
    return this.commerce.acceptPurchaseOrder(context, principal, purchaseOrderId);
  }

  private async calculateQuote(
    context: TenantContext,
    cart: CartSnapshot,
    promotionCode: string | undefined,
    address: NormalizedAddress,
  ): Promise<CommerceQuote> {
    if (cart.status !== 'ACTIVE' || cart.lines.length === 0) {
      throw new ConflictException('Cart is empty or unavailable');
    }
    for (const line of cart.lines) {
      if (
        line.offer.status !== 'ACTIVE' ||
        line.offer.version !== line.offerVersion ||
        line.offer.priceMinor !== line.unitPriceMinor
      ) {
        throw new ConflictException('An offer changed; refresh the cart');
      }
    }
    const subtotalMinor = cart.lines.reduce(
      (sum, line) => sum + line.unitPriceMinor * line.quantity,
      0,
    );
    const discount = await this.commerce.promotionDiscount(
      context,
      cart,
      promotionCode,
      subtotalMinor,
    );
    const taxableMinor = subtotalMinor - discount.amount;
    const splitCount = new Set(
      cart.lines.map((line) => `${line.offer.sellerId}:${line.offer.supplierId}`),
    ).size;
    const [taxMinor, shippingMinor] = await Promise.all([
      this.adapter.quoteTax(taxableMinor, address),
      this.adapter.quoteShipping(splitCount, address),
    ]);
    return {
      subtotalMinor,
      discountMinor: discount.amount,
      taxMinor,
      shippingMinor,
      totalMinor: taxableMinor + taxMinor + shippingMinor,
      currency: cart.currency,
      promotionCode: discount.code,
      splitCount,
    };
  }
}
