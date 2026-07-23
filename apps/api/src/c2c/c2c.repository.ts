import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import type {
  CreateC2COfferDto,
  CreateDisputeDto,
  CreateListingDto,
  CreateReviewDto,
  ModerateListingDto,
  ResolveDisputeDto,
  ShipmentEvidenceDto,
  VerifySellerDto,
} from './c2c.dto.js';
import { DeterministicIdentityVerificationAdapter } from './identity-verification.adapter.js';

@Injectable()
export class C2CRepository {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly verification: DeterministicIdentityVerificationAdapter,
  ) {}

  async verifySeller(
    context: TenantContext,
    principal: AuthPrincipal,
    input: VerifySellerDto,
  ): Promise<unknown> {
    const result = this.verification.verify(input.verificationToken);
    return this.db.c2CSellerProfile.upsert({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: principal.userId } },
      create: {
        id: randomUUID(),
        tenantId: context.tenantId,
        userId: principal.userId,
        status: result.approved ? 'VERIFIED' : 'REJECTED',
        verificationReference: result.reference,
        verifiedAt: result.approved ? new Date() : null,
      },
      update: {
        status: result.approved ? 'VERIFIED' : 'REJECTED',
        verificationReference: result.reference,
        verifiedAt: result.approved ? new Date() : null,
      },
    });
  }

  publicListings(context: TenantContext): Promise<unknown> {
    return this.db.c2CListing
      .findMany({
        where: { tenantId: context.tenantId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      })
      .then((items) => items.map((item) => ({ ...item, priceMinor: Number(item.priceMinor) })));
  }

  mine(context: TenantContext, principal: AuthPrincipal): Promise<unknown> {
    return this.db.c2CListing.findMany({
      where: { tenantId: context.tenantId, sellerUserId: principal.userId },
      include: { offers: true, transaction: { include: { disputes: true, reviews: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createListing(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateListingDto,
  ): Promise<unknown> {
    const profile = await this.db.c2CSellerProfile.findFirst({
      where: { tenantId: context.tenantId, userId: principal.userId, status: 'VERIFIED' },
    });
    if (!profile) throw new ForbiddenException('Verified seller onboarding is required');
    return this.db.c2CListing.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        sellerUserId: principal.userId,
        title: input.title,
        description: input.description,
        conditionCode: input.conditionCode,
        priceMinor: input.priceMinor,
        currency: input.currency.toUpperCase(),
        media: (input.media ?? null) as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      },
    });
  }

  async submit(context: TenantContext, principal: AuthPrincipal, id: string): Promise<unknown> {
    const listing = await this.ownedListing(context, principal, id);
    if (listing.status !== 'DRAFT') throw new ConflictException('Listing is not a draft');
    const prohibited = /\b(weapon|counterfeit|stolen)\b/iu.test(
      `${listing.title} ${listing.description}`,
    );
    return this.db.c2CListing.update({
      where: { id },
      data: prohibited
        ? {
            status: 'REJECTED',
            moderationReason: 'Prohibited-goods policy match',
            version: { increment: 1 },
          }
        : { status: 'PENDING_MODERATION', version: { increment: 1 } },
    });
  }

  async moderate(context: TenantContext, id: string, input: ModerateListingDto): Promise<unknown> {
    const listing = await this.db.c2CListing.findFirst({
      where: { id, tenantId: context.tenantId, status: 'PENDING_MODERATION' },
    });
    if (!listing) throw new NotFoundException('Resource not found');
    if (input.decision === 'REJECT' && !input.reason) {
      throw new ConflictException('A rejection reason is required');
    }
    return this.db.c2CListing.update({
      where: { id },
      data: {
        status: input.decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
        moderationReason: input.reason ?? null,
        version: { increment: 1 },
      },
    });
  }

  async offer(
    context: TenantContext,
    principal: AuthPrincipal,
    listingId: string,
    input: CreateC2COfferDto,
  ): Promise<unknown> {
    const listing = await this.db.c2CListing.findFirst({
      where: {
        id: listingId,
        tenantId: context.tenantId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });
    if (!listing) throw new NotFoundException('Resource not found');
    if (listing.sellerUserId === principal.userId) {
      throw new ConflictException('A seller cannot bid on their own listing');
    }
    if (input.parentOfferId) {
      const parent = await this.db.c2COffer.findFirst({
        where: { id: input.parentOfferId, tenantId: context.tenantId, listingId },
      });
      if (!parent) throw new NotFoundException('Resource not found');
      await this.db.c2COffer.update({ where: { id: parent.id }, data: { status: 'COUNTERED' } });
    }
    return this.db.c2COffer.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        listingId,
        buyerUserId: principal.userId,
        parentOfferId: input.parentOfferId ?? null,
        amountMinor: input.amountMinor,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1_000),
      },
    });
  }

  async acceptOffer(
    context: TenantContext,
    principal: AuthPrincipal,
    offerId: string,
  ): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const offer = await tx.c2COffer.findFirst({
        where: { id: offerId, tenantId: context.tenantId, status: 'OPEN' },
        include: { listing: true },
      });
      if (!offer || offer.listing.sellerUserId !== principal.userId) {
        throw new NotFoundException('Resource not found');
      }
      if (offer.expiresAt <= new Date()) throw new ConflictException('Offer expired');
      await tx.c2COffer.update({
        where: { id: offer.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await tx.c2COffer.updateMany({
        where: {
          tenantId: context.tenantId,
          listingId: offer.listingId,
          id: { not: offer.id },
          status: 'OPEN',
        },
        data: { status: 'REJECTED' },
      });
      await tx.c2CListing.update({
        where: { id: offer.listingId },
        data: { status: 'SOLD', version: { increment: 1 } },
      });
      return tx.c2CTransaction.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          listingId: offer.listingId,
          acceptedOfferId: offer.id,
          buyerUserId: offer.buyerUserId,
          sellerUserId: offer.listing.sellerUserId,
          amountMinor: offer.amountMinor,
          currency: offer.listing.currency,
        },
      });
    });
  }

  async shipment(
    context: TenantContext,
    principal: AuthPrincipal,
    transactionId: string,
    input: ShipmentEvidenceDto,
  ): Promise<unknown> {
    const transaction = await this.partyTransaction(context, principal, transactionId);
    if (transaction.sellerUserId !== principal.userId || transaction.status !== 'PAYMENT_HELD') {
      throw new ForbiddenException('Only the seller can provide shipment evidence');
    }
    return this.db.c2CTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'SHIPPED',
        shipmentEvidence: {
          trackingNumber: input.trackingNumber,
          carrier: input.carrier,
          evidence: input.evidence ?? {},
        } as Prisma.InputJsonValue,
        protectionEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      },
    });
  }

  async confirmDelivery(
    context: TenantContext,
    principal: AuthPrincipal,
    transactionId: string,
  ): Promise<unknown> {
    const transaction = await this.partyTransaction(context, principal, transactionId);
    if (transaction.buyerUserId !== principal.userId || transaction.status !== 'SHIPPED') {
      throw new ForbiddenException('Only the buyer can confirm delivery');
    }
    return this.db.c2CTransaction.update({
      where: { id: transaction.id },
      data: { status: 'PAYOUT_ELIGIBLE', payoutEligibleAt: new Date() },
    });
  }

  async releasePayout(context: TenantContext, transactionId: string): Promise<unknown> {
    const transaction = await this.db.c2CTransaction.findFirst({
      where: { id: transactionId, tenantId: context.tenantId, status: 'PAYOUT_ELIGIBLE' },
    });
    if (!transaction) throw new NotFoundException('Resource not found');
    return this.db.c2CTransaction.update({
      where: { id: transaction.id },
      data: { status: 'COMPLETED', payoutReleasedAt: new Date() },
    });
  }

  async dispute(
    context: TenantContext,
    principal: AuthPrincipal,
    transactionId: string,
    input: CreateDisputeDto,
  ): Promise<unknown> {
    const transaction = await this.partyTransaction(context, principal, transactionId);
    const dispute = await this.db.c2CDispute.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        transactionId,
        openedBy: principal.userId,
        reason: input.reason,
      },
    });
    await this.db.c2CTransaction.update({
      where: { id: transaction.id },
      data: { status: 'DISPUTED' },
    });
    return dispute;
  }

  async resolveDispute(
    context: TenantContext,
    id: string,
    input: ResolveDisputeDto,
  ): Promise<unknown> {
    const dispute = await this.db.c2CDispute.findFirst({
      where: { id, tenantId: context.tenantId, status: 'OPEN' },
    });
    if (!dispute) throw new NotFoundException('Resource not found');
    return this.db.$transaction(async (tx) => {
      const resolved = await tx.c2CDispute.update({
        where: { id },
        data: {
          status: `RESOLVED_${input.outcome}`,
          resolution: input.resolution,
          resolvedAt: new Date(),
        },
      });
      await tx.c2CTransaction.update({
        where: { id: dispute.transactionId },
        data:
          input.outcome === 'SELLER'
            ? { status: 'PAYOUT_ELIGIBLE', payoutEligibleAt: new Date() }
            : { status: 'CANCELLED' },
      });
      return resolved;
    });
  }

  async review(
    context: TenantContext,
    principal: AuthPrincipal,
    transactionId: string,
    input: CreateReviewDto,
  ): Promise<unknown> {
    const transaction = await this.partyTransaction(context, principal, transactionId);
    if (transaction.status !== 'COMPLETED')
      throw new ConflictException('Transaction is incomplete');
    return this.db.c2CReview.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        transactionId,
        authorUserId: principal.userId,
        subjectUserId:
          transaction.buyerUserId === principal.userId
            ? transaction.sellerUserId
            : transaction.buyerUserId,
        ...input,
      },
    });
  }

  private async ownedListing(context: TenantContext, principal: AuthPrincipal, id: string) {
    const listing = await this.db.c2CListing.findFirst({
      where: { id, tenantId: context.tenantId, sellerUserId: principal.userId },
    });
    if (!listing) throw new NotFoundException('Resource not found');
    return listing;
  }

  private async partyTransaction(context: TenantContext, principal: AuthPrincipal, id: string) {
    const transaction = await this.db.c2CTransaction.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
        OR: [{ buyerUserId: principal.userId }, { sellerUserId: principal.userId }],
      },
    });
    if (!transaction) throw new NotFoundException('Resource not found');
    return transaction;
  }
}
