'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/app-header';
import { authenticatedRequest } from '../components/authenticated-api';

type Store = { id: string; key: string; name: string; defaultCurrency: string };
type Offer = {
  id: string;
  priceMinor: number;
  currency: string;
  minimumQuantity: number;
  seller: { name: string };
};
type Variant = {
  id: string;
  sku: string;
  title: string;
  availableQuantity: number;
  offers: Offer[];
};
type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  media: Array<{ url: string; altText: string }>;
  variants: Variant[];
};
type Cart = {
  id: string;
  currency: string;
  lines: Array<{
    id: string;
    quantity: number;
    unitPriceMinor: number;
    offer: { variant: { title: string; sku: string } };
  }>;
};
type Quote = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
};

const api = '/api/v1';

export default function StorefrontPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Cart | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    void loadStores();
  }, []);

  useEffect(() => {
    if (store) void loadProducts(store, query);
  }, [store, query]);

  async function request<T>(
    path: string,
    init: RequestInit = {},
    authenticated = false,
  ): Promise<T> {
    if (authenticated) return authenticatedRequest<T>(path, init);
    const response = await fetch(`${api}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(problem?.detail ?? 'The request could not be completed.');
    }
    return (await response.json()) as T;
  }

  async function loadStores() {
    setLoading(true);
    try {
      const result = await request<Store[]>('/storefront/stores');
      setStores(result);
      setStore(result[0] ?? null);
      if (result.length === 0) setLoading(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Storefront unavailable.');
      setLoading(false);
    }
  }

  async function loadProducts(selected: Store, search: string) {
    setLoading(true);
    setMessage('');
    try {
      const parameters = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
      setProducts(
        await request<Product[]>(`/storefront/stores/${selected.key}/products${parameters}`),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Products could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(offer: Offer) {
    if (!store) return;
    setMessage('');
    try {
      const active =
        cart ??
        (await request<Cart>(
          '/commerce/carts',
          { method: 'POST', body: JSON.stringify({ storeId: store.id }) },
          true,
        ));
      const updated = await request<Cart>(
        `/commerce/carts/${active.id}/lines`,
        {
          method: 'POST',
          body: JSON.stringify({ offerId: offer.id, quantity: offer.minimumQuantity }),
        },
        true,
      );
      setCart(updated);
      setQuote(null);
      setMessage('Added to cart.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Item could not be added.');
    }
  }

  async function quoteCart() {
    if (!cart) return;
    try {
      setQuote(
        await request<Quote>(
          `/commerce/carts/${cart.id}/quote`,
          { method: 'POST', body: '{}' },
          true,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Quote unavailable.');
    }
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart) return;
    const form = new FormData(event.currentTarget);
    const countryCode = form.get('countryCode');
    try {
      const order = await request<{ number: string }>(
        `/commerce/carts/${cart.id}/checkout`,
        {
          method: 'POST',
          headers: { 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            paymentToken: form.get('paymentToken'),
            address: {
              recipient: form.get('recipient'),
              line1: form.get('line1'),
              city: form.get('city'),
              region: form.get('region') || undefined,
              postalCode: form.get('postalCode'),
              countryCode: typeof countryCode === 'string' ? countryCode.toUpperCase() : '',
            },
          }),
        },
        true,
      );
      setMessage(`Order ${order.number} placed successfully.`);
      setCart(null);
      setQuote(null);
      setCheckoutOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout failed.');
    }
  }

  const money = (minor: number, currency = store?.defaultCurrency ?? 'USD') =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);

  return (
    <main id="main" className="shop-page">
      <AppHeader active="storefront" />

      <section className="shop-intro">
        <div className="storefront-title">
          <div>
            <h1>Built for the field.</h1>
            <p>Verified offers with visible availability and accountable delivery.</p>
          </div>
          <button className="cart-button" onClick={() => void quoteCart()}>
            Cart · {cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0}
          </button>
        </div>
        <div className="shop-controls">
          <label>
            <span>Store</span>
            <select
              value={store?.id ?? ''}
              onChange={(event) =>
                setStore(stores.find(({ id }) => id === event.target.value) ?? null)
              }
            >
              {stores.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Search catalog</span>
            <input
              type="search"
              value={query}
              placeholder="Product, description, or SKU"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      </section>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
      {loading ? <p className="shop-state">Loading verified offers…</p> : null}
      {!loading && products.length === 0 ? (
        <section className="shop-state">
          <h2>No products found.</h2>
          <p>Try a broader search or choose another storefront.</p>
        </section>
      ) : null}
      <section className="product-grid" aria-label="Products" aria-busy={loading}>
        {products.map((product) => {
          const variant = product.variants.find(({ offers }) => offers.length > 0);
          const offer = variant?.offers[0];
          return (
            <article className="product-card" key={product.id}>
              <div className="product-art" aria-hidden="true">
                {product.title.slice(0, 2).toUpperCase()}
              </div>
              <p className="eyebrow">{variant?.sku ?? 'Catalog item'}</p>
              <h2>{product.title}</h2>
              <p>{product.description}</p>
              <div className="offer-row">
                <div>
                  <strong>{offer ? money(offer.priceMinor, offer.currency) : 'Unavailable'}</strong>
                  <small>
                    {variant?.availableQuantity ?? 0} available
                    {offer ? ` · ${offer.seller.name}` : ''}
                  </small>
                </div>
                <button
                  disabled={!offer || (variant?.availableQuantity ?? 0) < offer.minimumQuantity}
                  onClick={() => offer && void addToCart(offer)}
                >
                  Add
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {quote && cart ? (
        <aside className="cart-drawer" aria-label="Cart summary">
          <div>
            <p className="eyebrow">Cart quote</p>
            <h2>{money(quote.totalMinor, quote.currency)}</h2>
          </div>
          {cart.lines.map((line) => (
            <div className="cart-line" key={line.id}>
              <span>
                {line.offer.variant.title} × {line.quantity}
              </span>
              <strong>{money(line.unitPriceMinor * line.quantity, cart.currency)}</strong>
            </div>
          ))}
          <small>
            Subtotal {money(quote.subtotalMinor, quote.currency)} · Tax{' '}
            {money(quote.taxMinor, quote.currency)} · Shipping{' '}
            {money(quote.shippingMinor, quote.currency)}
          </small>
          <button onClick={() => setCheckoutOpen(true)}>Checkout</button>
        </aside>
      ) : null}

      {checkoutOpen && cart ? (
        <div className="modal-backdrop">
          <form className="checkout-panel" onSubmit={(event) => void checkout(event)}>
            <button
              className="quiet-button close-button"
              type="button"
              onClick={() => setCheckoutOpen(false)}
            >
              Close
            </button>
            <p className="eyebrow">Secure checkout</p>
            <h2>Where should it go?</h2>
            <label>
              Payment token
              <input
                name="paymentToken"
                placeholder="Provided by the configured payment form"
                autoComplete="off"
                minLength={12}
                required
              />
            </label>
            <label>
              Recipient
              <input name="recipient" required />
            </label>
            <label>
              Address
              <input name="line1" required />
            </label>
            <div className="address-row">
              <label>
                City
                <input name="city" required />
              </label>
              <label>
                Region
                <input name="region" />
              </label>
            </div>
            <div className="address-row">
              <label>
                Postal code
                <input name="postalCode" required />
              </label>
              <label>
                Country
                <input name="countryCode" defaultValue="US" minLength={2} maxLength={2} required />
              </label>
            </div>
            <button type="submit">Authorize and place order</button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
