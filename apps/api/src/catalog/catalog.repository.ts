import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import { DATABASE } from '../database/database.module.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import type {
  CreateAttributeDto,
  CreateCategoryDto,
  CreateOfferDto,
  CreatePartnerDto,
  CreateStoreDto,
  CreateStoreDomainDto,
  CreateSubmissionDto,
  ReviewSubmissionDto,
  StorefrontQueryDto,
  SubmissionMediaDto,
} from './catalog.dto.js';

@Injectable()
export class CatalogRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  stores(context: TenantContext) {
    return this.database.store.findMany({
      where: { tenantId: context.tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        domains: { orderBy: [{ isPrimary: 'desc' }, { hostname: 'asc' }] },
        _count: { select: { products: true, offers: true } },
      },
    });
  }

  async createStoreDomain(
    context: TenantContext,
    principal: AuthPrincipal,
    storeId: string,
    input: CreateStoreDomainDto,
  ) {
    await this.store(context, storeId);
    const hostname = input.hostname.trim().toLowerCase();
    try {
      return await this.database.$transaction(async (transaction) => {
        if (input.isPrimary) {
          await transaction.storeDomain.updateMany({
            where: { tenantId: context.tenantId, storeId },
            data: { isPrimary: false },
          });
        }
        const domain = await transaction.storeDomain.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            storeId,
            hostname,
            isPrimary: input.isPrimary ?? false,
          },
        });
        await this.transactionAudit(
          transaction,
          context,
          principal,
          'store.domain.created',
          'STORE_DOMAIN',
          domain.id,
          hostname,
        );
        return domain;
      });
    } catch (error) {
      this.rethrowUnique(error, 'Store domain is already assigned');
    }
  }

  async createStore(context: TenantContext, principal: AuthPrincipal, input: CreateStoreDto) {
    try {
      const store = await this.database.store.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          key: input.key,
          name: input.name,
          status: 'ACTIVE',
          defaultLocale: input.defaultLocale ?? 'en',
          defaultCurrency: input.defaultCurrency ?? 'USD',
          ...(input.branding ? { branding: input.branding as Prisma.InputJsonValue } : {}),
          ...(input.seo ? { seo: input.seo as Prisma.InputJsonValue } : {}),
        },
      });
      await this.audit(context, principal, 'store.created', 'STORE', store.id, input.key);
      return store;
    } catch (error) {
      this.rethrowUnique(error, 'Store key already exists');
    }
  }

  async createCategory(
    context: TenantContext,
    principal: AuthPrincipal,
    storeId: string,
    input: CreateCategoryDto,
  ) {
    await this.store(context, storeId);
    if (input.parentId) {
      const parent = await this.database.category.findFirst({
        where: {
          id: input.parentId,
          tenantId: context.tenantId,
          storeId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Resource not found');
    }
    try {
      const category = await this.database.category.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          storeId,
          parentId: input.parentId ?? null,
          slug: input.slug,
          name: input.name,
        },
      });
      await this.audit(
        context,
        principal,
        'catalog.category.created',
        'CATEGORY',
        category.id,
        input.slug,
      );
      return category;
    } catch (error) {
      this.rethrowUnique(error, 'Category slug already exists');
    }
  }

  async createAttribute(
    context: TenantContext,
    principal: AuthPrincipal,
    storeId: string,
    input: CreateAttributeDto,
  ) {
    await this.store(context, storeId);
    if (input.kind !== 'SELECT' && input.options?.length) {
      throw new ConflictException('Only SELECT attributes may define options');
    }
    try {
      const attribute = await this.database.attributeDefinition.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          storeId,
          key: input.key,
          name: input.name,
          kind: input.kind,
          isVariant: input.isVariant,
          isRequired: input.isRequired ?? false,
          ...(input.options?.length
            ? {
                options: {
                  create: input.options.map((option, index) => ({
                    id: randomUUID(),
                    tenantId: context.tenantId,
                    value: option.value,
                    label: option.label,
                    sortOrder: index,
                  })),
                },
              }
            : {}),
        },
        include: { options: true },
      });
      await this.audit(
        context,
        principal,
        'catalog.attribute.created',
        'ATTRIBUTE_DEFINITION',
        attribute.id,
        input.key,
      );
      return attribute;
    } catch (error) {
      this.rethrowUnique(error, 'Attribute key or option already exists');
    }
  }

  partners(context: TenantContext) {
    return Promise.all([
      this.database.supplier.findMany({
        where: { tenantId: context.tenantId },
        orderBy: { name: 'asc' },
      }),
      this.database.seller.findMany({
        where: { tenantId: context.tenantId },
        orderBy: { name: 'asc' },
      }),
    ]).then(([suppliers, sellers]) => ({ suppliers, sellers }));
  }

  async createSupplier(context: TenantContext, principal: AuthPrincipal, input: CreatePartnerDto) {
    try {
      const supplier = await this.database.supplier.create({
        data: { id: randomUUID(), tenantId: context.tenantId, ...input },
      });
      await this.audit(
        context,
        principal,
        'catalog.supplier.created',
        'SUPPLIER',
        supplier.id,
        input.key,
      );
      return supplier;
    } catch (error) {
      this.rethrowUnique(error, 'Supplier key already exists');
    }
  }

  async createSeller(context: TenantContext, principal: AuthPrincipal, input: CreatePartnerDto) {
    try {
      const seller = await this.database.seller.create({
        data: { id: randomUUID(), tenantId: context.tenantId, ...input },
      });
      await this.audit(
        context,
        principal,
        'catalog.seller.created',
        'SELLER',
        seller.id,
        input.key,
      );
      return seller;
    } catch (error) {
      this.rethrowUnique(error, 'Seller key already exists');
    }
  }

  submissions(context: TenantContext) {
    return this.database.productSubmission.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { id: true, key: true, name: true } },
        supplier: { select: { id: true, key: true, name: true } },
        variants: true,
      },
    });
  }

  async createSubmission(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateSubmissionDto,
  ) {
    await this.assertSubmissionOwners(context, input);
    const duplicateSku = new Set(input.variants.map(({ sku }) => sku));
    if (duplicateSku.size !== input.variants.length) {
      throw new ConflictException('Submission variant SKUs must be unique');
    }
    const submission = await this.database.productSubmission.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        storeId: input.storeId,
        supplierId: input.supplierId,
        categoryId: input.categoryId ?? null,
        slug: input.slug,
        title: input.title,
        description: input.description,
        locale: input.locale ?? 'en',
        ...(input.seo ? { seo: input.seo as Prisma.InputJsonValue } : {}),
        ...(input.media ? { media: input.media as unknown as Prisma.InputJsonValue } : {}),
        ...(input.attributes ? { attributes: input.attributes as Prisma.InputJsonValue } : {}),
        variants: {
          create: input.variants.map((variant) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            sku: variant.sku,
            title: variant.title,
            ...(variant.attributes
              ? { attributes: variant.attributes as Prisma.InputJsonValue }
              : {}),
            barcode: variant.barcode ?? null,
          })),
        },
      },
      include: { variants: true },
    });
    await this.audit(
      context,
      principal,
      'catalog.submission.created',
      'PRODUCT_SUBMISSION',
      submission.id,
    );
    return submission;
  }

  async submit(context: TenantContext, principal: AuthPrincipal, submissionId: string) {
    const updated = await this.database.productSubmission.updateMany({
      where: {
        id: submissionId,
        tenantId: context.tenantId,
        status: 'DRAFT',
        productId: null,
      },
      data: { status: 'SUBMITTED', submittedAt: new Date(), version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new NotFoundException('Resource not found');
    await this.audit(
      context,
      principal,
      'catalog.submission.submitted',
      'PRODUCT_SUBMISSION',
      submissionId,
    );
    return this.submission(context, submissionId);
  }

  async approve(
    context: TenantContext,
    principal: AuthPrincipal,
    submissionId: string,
    input: ReviewSubmissionDto,
  ) {
    return this.database.$transaction(async (transaction) => {
      const submission = await transaction.productSubmission.findFirst({
        where: {
          id: submissionId,
          tenantId: context.tenantId,
          status: 'SUBMITTED',
          productId: null,
        },
        include: { variants: true, store: true, supplier: true },
      });
      if (!submission) throw new NotFoundException('Resource not found');
      if (submission.categoryId) {
        const category = await transaction.category.findFirst({
          where: {
            id: submission.categoryId,
            tenantId: context.tenantId,
            storeId: submission.storeId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!category) throw new NotFoundException('Resource not found');
      }
      const productId = randomUUID();
      const media = this.media(submission.media);
      const submittedAttributes = this.attributes(submission.attributes);
      const attributeDefinitions = await transaction.attributeDefinition.findMany({
        where: {
          tenantId: context.tenantId,
          storeId: submission.storeId,
        },
        include: { options: true },
      });
      const definitionsByKey = new Map(
        attributeDefinitions.map((definition) => [definition.key, definition]),
      );
      const unknownAttribute = Object.keys(submittedAttributes).find(
        (key) => !definitionsByKey.has(key),
      );
      if (unknownAttribute) {
        throw new ConflictException(`Unknown product attribute: ${unknownAttribute}`);
      }
      const missingRequired = attributeDefinitions.find(
        (definition) => definition.isRequired && submittedAttributes[definition.key] === undefined,
      );
      if (missingRequired) {
        throw new ConflictException(
          `Required product attribute is missing: ${missingRequired.key}`,
        );
      }
      try {
        await transaction.product.create({
          data: {
            id: productId,
            tenantId: context.tenantId,
            storeId: submission.storeId,
            categoryId: submission.categoryId,
            supplierId: submission.supplierId,
            slug: submission.slug,
            title: submission.title,
            description: submission.description,
            status: 'ACTIVE',
            ...(submission.seo ? { seo: submission.seo as Prisma.InputJsonValue } : {}),
          },
        });
        await transaction.productTranslation.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            productId,
            locale: submission.locale,
            title: submission.title,
            description: submission.description,
            ...(submission.seo ? { seo: submission.seo as Prisma.InputJsonValue } : {}),
          },
        });
        if (media.length) {
          await transaction.productMedia.createMany({
            data: media.map((item, index) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              productId,
              url: item.url,
              altText: item.altText,
              sortOrder: index,
            })),
          });
        }
        if (Object.keys(submittedAttributes).length > 0) {
          await transaction.productAttributeValue.createMany({
            data: Object.entries(submittedAttributes).map(([key, rawValue]) => {
              const definition = definitionsByKey.get(key);
              if (!definition) throw new ConflictException(`Unknown product attribute: ${key}`);
              if (definition.kind === 'SELECT') {
                const option = definition.options.find(
                  (candidate) => candidate.value === String(rawValue),
                );
                if (!option) {
                  throw new ConflictException(`Invalid option for product attribute: ${key}`);
                }
                return {
                  id: randomUUID(),
                  tenantId: context.tenantId,
                  productId,
                  attributeId: definition.id,
                  optionId: option.id,
                };
              }
              return {
                id: randomUUID(),
                tenantId: context.tenantId,
                productId,
                attributeId: definition.id,
                value: String(rawValue),
              };
            }),
          });
        }
        await transaction.productVariant.createMany({
          data: submission.variants.map((variant) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            productId,
            sku: variant.sku,
            title: variant.title,
            barcode: variant.barcode,
            ...(variant.attributes
              ? { attributes: variant.attributes as Prisma.InputJsonValue }
              : {}),
            status: 'ACTIVE',
          })),
        });
        await transaction.productSubmission.update({
          where: { id: submission.id },
          data: {
            productId,
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: principal.userId,
            reviewNote: input.note ?? null,
            version: { increment: 1 },
          },
        });
        await this.transactionAudit(
          transaction,
          context,
          principal,
          'catalog.submission.approved',
          'PRODUCT',
          productId,
          submissionId,
        );
        await transaction.outboxEvent.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            type: 'catalog.product.approved.v1',
            subject: `product/${productId}`,
            payload: { productId, submissionId, storeId: submission.storeId },
            correlationId: context.correlationId,
          },
        });
        return transaction.product.findUniqueOrThrow({
          where: { id: productId },
          include: { variants: true, media: true, translations: true },
        });
      } catch (error) {
        this.rethrowUnique(error, 'Product slug or variant SKU already exists');
      }
    });
  }

  async reject(
    context: TenantContext,
    principal: AuthPrincipal,
    submissionId: string,
    input: ReviewSubmissionDto,
  ) {
    const updated = await this.database.productSubmission.updateMany({
      where: { id: submissionId, tenantId: context.tenantId, status: 'SUBMITTED' },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: principal.userId,
        reviewNote: input.note ?? null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new NotFoundException('Resource not found');
    await this.audit(
      context,
      principal,
      'catalog.submission.rejected',
      'PRODUCT_SUBMISSION',
      submissionId,
      input.note,
    );
    return this.submission(context, submissionId);
  }

  offers(context: TenantContext) {
    return this.database.offer
      .findMany({
        where: { tenantId: context.tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          store: { select: { id: true, key: true, name: true } },
          seller: { select: { id: true, key: true, name: true } },
          supplier: { select: { id: true, key: true, name: true } },
          variant: {
            include: { product: { select: { id: true, slug: true, title: true, status: true } } },
          },
        },
      })
      .then((offers) => offers.map((offer) => this.offer(offer)));
  }

  async createOffer(context: TenantContext, principal: AuthPrincipal, input: CreateOfferDto) {
    const [store, variant, seller, supplier] = await Promise.all([
      this.database.store.findFirst({
        where: { id: input.storeId, tenantId: context.tenantId, deletedAt: null },
      }),
      this.database.productVariant.findFirst({
        where: {
          id: input.variantId,
          tenantId: context.tenantId,
          deletedAt: null,
          product: { storeId: input.storeId, supplierId: input.supplierId },
        },
      }),
      this.database.seller.findFirst({
        where: { id: input.sellerId, tenantId: context.tenantId, status: 'ACTIVE' },
      }),
      this.database.supplier.findFirst({
        where: { id: input.supplierId, tenantId: context.tenantId, status: 'ACTIVE' },
      }),
    ]);
    if (!store || !variant || !seller || !supplier) {
      throw new NotFoundException('Resource not found');
    }
    try {
      const offer = await this.database.offer.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          storeId: input.storeId,
          variantId: input.variantId,
          sellerId: input.sellerId,
          supplierId: input.supplierId,
          currency: input.currency,
          priceMinor: BigInt(input.priceMinor),
          compareAtMinor: input.compareAtMinor === undefined ? null : BigInt(input.compareAtMinor),
          minimumQuantity: input.minimumQuantity ?? 1,
        },
      });
      await this.audit(context, principal, 'offer.created', 'OFFER', offer.id);
      return this.offer(offer);
    } catch (error) {
      this.rethrowUnique(error, 'An offer already exists for this seller and variant');
    }
  }

  async publishOffer(context: TenantContext, principal: AuthPrincipal, offerId: string) {
    return this.database.$transaction(async (transaction) => {
      const offer = await transaction.offer.findFirst({
        where: {
          id: offerId,
          tenantId: context.tenantId,
          status: { in: ['DRAFT', 'SUSPENDED'] },
          store: { status: 'ACTIVE', deletedAt: null },
          variant: { status: 'ACTIVE', deletedAt: null, product: { status: 'ACTIVE' } },
        },
      });
      if (!offer) throw new NotFoundException('Resource not found');
      const published = await transaction.offer.update({
        where: { id: offer.id },
        data: { status: 'ACTIVE', version: { increment: 1 } },
      });
      await this.transactionAudit(
        transaction,
        context,
        principal,
        'offer.published',
        'OFFER',
        offer.id,
      );
      await transaction.outboxEvent.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          type: 'catalog.offer.published.v1',
          subject: `offer/${offer.id}`,
          payload: { offerId: offer.id, storeId: offer.storeId, variantId: offer.variantId },
          correlationId: context.correlationId,
        },
      });
      return this.offer(published);
    });
  }

  async publicStores(context: TenantContext) {
    return this.database.store.findMany({
      where: { tenantId: context.tenantId, status: 'ACTIVE', deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        defaultLocale: true,
        defaultCurrency: true,
        branding: true,
        seo: true,
      },
    });
  }

  async publicProducts(context: TenantContext, storeKey: string, query: StorefrontQueryDto) {
    const store = await this.publicStore(context, storeKey);
    const products = await this.database.product.findMany({
      where: {
        tenantId: context.tenantId,
        storeId: store.id,
        status: 'ACTIVE',
        deletedAt: null,
        ...(query.category ? { category: { slug: query.category, deletedAt: null } } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q } },
                { description: { contains: query.q } },
                { variants: { some: { sku: { contains: query.q } } } },
              ],
            }
          : {}),
        variants: { some: { status: 'ACTIVE', offers: { some: { status: 'ACTIVE' } } } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { slug: true, name: true } },
        media: { orderBy: { sortOrder: 'asc' }, take: 1 },
        variants: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: {
            offers: {
              where: { status: 'ACTIVE' },
              orderBy: { priceMinor: 'asc' },
              include: { seller: { select: { name: true } } },
            },
          },
        },
      },
    });
    return Promise.all(products.map((product) => this.publicProduct(context, product)));
  }

  async publicProductBySlug(context: TenantContext, storeKey: string, slug: string) {
    const store = await this.publicStore(context, storeKey);
    const product = await this.database.product.findFirst({
      where: {
        tenantId: context.tenantId,
        storeId: store.id,
        slug,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        category: { select: { slug: true, name: true } },
        media: { orderBy: { sortOrder: 'asc' } },
        translations: true,
        attributes: {
          include: { attribute: true, option: true },
        },
        variants: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: {
            offers: {
              where: { status: 'ACTIVE' },
              orderBy: { priceMinor: 'asc' },
              include: { seller: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Resource not found');
    return this.publicProduct(context, product);
  }

  private async publicProduct(context: TenantContext, product: ProductWithOffers) {
    const variantIds = product.variants.map(({ id }) => id);
    const inventory = await this.database.inventoryItem.findMany({
      where: { tenantId: context.tenantId, productRef: { in: variantIds } },
      select: {
        productRef: true,
        balances: { where: { state: 'ON_HAND' }, select: { quantity: true } },
      },
    });
    const available = new Map(
      inventory.map((item) => [
        item.productRef,
        item.balances.reduce((sum, balance) => sum + balance.quantity, 0n),
      ]),
    );
    return {
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        availableQuantity: Number(available.get(variant.id) ?? 0n),
        offers: variant.offers.map((offer) => this.offer(offer)),
      })),
    };
  }

  private publicStore(context: TenantContext, key: string) {
    return this.database.store
      .findFirst({
        where: {
          tenantId: context.tenantId,
          key,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true, key: true, defaultCurrency: true },
      })
      .then((store) => {
        if (!store) throw new NotFoundException('Resource not found');
        return store;
      });
  }

  private store(context: TenantContext, storeId: string) {
    return this.database.store
      .findFirst({
        where: { id: storeId, tenantId: context.tenantId, deletedAt: null },
        select: { id: true },
      })
      .then((store) => {
        if (!store) throw new NotFoundException('Resource not found');
        return store;
      });
  }

  private submission(context: TenantContext, submissionId: string) {
    return this.database.productSubmission
      .findFirst({
        where: { id: submissionId, tenantId: context.tenantId },
        include: { variants: true },
      })
      .then((submission) => {
        if (!submission) throw new NotFoundException('Resource not found');
        return submission;
      });
  }

  private async assertSubmissionOwners(context: TenantContext, input: CreateSubmissionDto) {
    const [store, supplier, category] = await Promise.all([
      this.database.store.findFirst({
        where: { id: input.storeId, tenantId: context.tenantId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.database.supplier.findFirst({
        where: { id: input.supplierId, tenantId: context.tenantId, status: 'ACTIVE' },
        select: { id: true },
      }),
      input.categoryId
        ? this.database.category.findFirst({
            where: {
              id: input.categoryId,
              tenantId: context.tenantId,
              storeId: input.storeId,
              deletedAt: null,
            },
            select: { id: true },
          })
        : Promise.resolve({ id: 'none' }),
    ]);
    if (!store || !supplier || !category) throw new NotFoundException('Resource not found');
  }

  private media(value: unknown): SubmissionMediaDto[] {
    if (!Array.isArray(value)) return [];
    return (value as unknown[]).filter(
      (item): item is SubmissionMediaDto =>
        typeof item === 'object' &&
        item !== null &&
        'url' in item &&
        typeof item.url === 'string' &&
        'altText' in item &&
        typeof item.altText === 'string',
    );
  }

  private attributes(value: unknown): Record<string, string | number | boolean> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string | number | boolean] =>
        ['string', 'number', 'boolean'].includes(typeof entry[1]),
      ),
    );
  }

  private offer<T extends { priceMinor: bigint; compareAtMinor?: bigint | null }>(offer: T) {
    return {
      ...offer,
      priceMinor: Number(offer.priceMinor),
      compareAtMinor:
        offer.compareAtMinor === null || offer.compareAtMinor === undefined
          ? null
          : Number(offer.compareAtMinor),
    };
  }

  private audit(
    context: TenantContext,
    principal: AuthPrincipal,
    action: string,
    entityType: string,
    entityId: string,
    reason?: string,
  ) {
    return this.database.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        actorId: principal.userId,
        actorType: 'USER',
        action,
        entityType,
        entityId,
        reason: reason ?? null,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        authenticationMethod: 'BEARER',
      },
    });
  }

  private transactionAudit(
    transaction: TransactionClient,
    context: TenantContext,
    principal: AuthPrincipal,
    action: string,
    entityType: string,
    entityId: string,
    reason?: string,
  ) {
    return transaction.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        actorId: principal.userId,
        actorType: 'USER',
        action,
        entityType,
        entityId,
        reason: reason ?? null,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        authenticationMethod: 'BEARER',
      },
    });
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }
}

type TransactionClient = Prisma.TransactionClient;

type ProductWithOffers = Record<string, unknown> & {
  variants: {
    id: string;
    offers: {
      priceMinor: bigint;
      compareAtMinor: bigint | null;
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  }[];
};
