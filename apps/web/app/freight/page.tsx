'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AppHeader } from '../components/app-header';
import { accessToken, authenticatedRequest } from '../components/authenticated-api';

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

type Quote = {
  id: string;
  number: string;
  status: string;
  currency: string;
  totalMinor: number;
  paymentPolicy: string;
  validUntil: string;
};
type FreightRequest = {
  id: string;
  number: string;
  status: string;
  preferredModes: string[];
  createdAt: string;
  stops: Array<{
    id: string;
    sequence: number;
    kind: string;
    name: string;
    city: string;
    countryCode: string;
  }>;
  cargoItems: Array<{ id: string; description: string; weightGrams: number }>;
  estimates: Array<{ id: string; status: string; currency: string; totalMinor: number }>;
  quotes: Quote[];
};
type Invoice = {
  id: string;
  number: string;
  status: string;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  dueAt: string;
  schedules: Array<{
    id: string;
    kind: string;
    amountMinor: number;
    paidMinor: number;
    status: string;
  }>;
};
type Booking = {
  id: string;
  number: string;
  status: string;
  invoiceId: string;
  request: { number: string; stops: FreightRequest['stops'] };
  legs: Array<{ id: string; sequence: number; mode: string; status: string }>;
  milestones: Array<{
    id: string;
    code: string;
    description: string;
    location?: string;
    occurredAt: string;
  }>;
};

const money = (minor: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(minor) / 100);

export default function FreightPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<FreightRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken()) {
      setSignedIn(false);
      return;
    }
    try {
      const [requestRows, bookingRows, invoiceRows] = await Promise.all([
        authenticatedRequest<FreightRequest[]>('/freight/requests'),
        authenticatedRequest<Booking[]>('/freight/bookings/mine'),
        authenticatedRequest<Invoice[]>('/billing/invoices/mine'),
      ]);
      setRequests(requestRows);
      setBookings(bookingRows);
      setInvoices(invoiceRows);
      setSignedIn(true);
    } catch (error) {
      setSignedIn(true);
      setMessage(error instanceof Error ? error.message : 'Freight data could not be loaded.');
    }
  }, []);

  useEffect(() => void load(), [load]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const created = await authenticatedRequest<FreightRequest>('/freight/requests', {
        method: 'POST',
        body: JSON.stringify({
          serviceLevel: form.get('serviceLevel'),
          preferredModes: form.getAll('mode'),
          incoterm: form.get('incoterm') || undefined,
          insuranceRequired: form.get('insurance') === 'on',
          customsRequired: form.get('customs') === 'on',
          specialInstructions: form.get('instructions') || undefined,
          stops: [
            {
              sequence: 1,
              kind: 'PICKUP',
              locationType: form.get('originType'),
              name: form.get('originName'),
              city: form.get('originCity'),
              countryCode: formText(form, 'originCountry').toUpperCase(),
            },
            {
              sequence: 2,
              kind: 'DELIVERY',
              locationType: form.get('destinationType'),
              name: form.get('destinationName'),
              city: form.get('destinationCity'),
              countryCode: formText(form, 'destinationCountry').toUpperCase(),
            },
          ],
          cargoItems: [
            {
              description: form.get('cargoDescription'),
              packageType: form.get('packageType'),
              packageCount: Number(form.get('packageCount')),
              weightGrams: Math.round(Number(form.get('weightKg')) * 1000),
              currency: 'USD',
              hazardous: form.get('hazardous') === 'on',
            },
          ],
        }),
      });
      await authenticatedRequest(`/freight/requests/${created.id}/submit`, { method: 'POST' });
      event.currentTarget.reset();
      setMessage(`${created.number} submitted for review.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request could not be submitted.');
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote(quoteId: string) {
    setBusy(true);
    try {
      await authenticatedRequest(`/freight/quotes/${quoteId}/accept`, { method: 'POST' });
      setMessage('Quote accepted. Your invoice and booking are ready.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Quote could not be accepted.');
    } finally {
      setBusy(false);
    }
  }

  async function pay(invoice: Invoice, provider: 'STRIPE' | 'COINBASE' | 'MOCK') {
    setBusy(true);
    try {
      const session = await authenticatedRequest<{ checkoutUrl: string; status: string }>(
        `/billing/invoices/${invoice.id}/payment-sessions`,
        {
          method: 'POST',
          headers: { 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ provider }),
        },
      );
      if (provider === 'MOCK') {
        setMessage('Local payment completed.');
        await load();
      } else {
        window.location.assign(session.checkoutUrl);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment session could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadInvoice(invoice: Invoice) {
    const response = await fetch(`/api/v1/billing/invoices/${invoice.id}/document`, {
      headers: { authorization: `Bearer ${accessToken()}` },
    });
    if (!response.ok) {
      setMessage('Invoice document could not be downloaded.');
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.number}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main id="main" className="app-page freight-page">
      <AppHeader active="freight" />
      <div className="page-heading">
        <div>
          <p className="eyebrow">Global transportation</p>
          <h1>Move large cargo with one accountable booking.</h1>
          <p className="page-subtitle">
            Request road, sea, air, or rail service; compare a reviewed quote; pay securely; and
            follow every operational handoff.
          </p>
        </div>
      </div>

      {signedIn === false ? (
        <section className="auth-gate">
          <div>
            <h2>Sign in to request freight.</h2>
            <p>Requests, quotes, invoices, and tracking are private to your account.</p>
          </div>
          <a className="button button--primary" href="/account">
            Go to account
          </a>
        </section>
      ) : null}
      {message ? (
        <p className="freight-notice" role="status">
          {message}
        </p>
      ) : null}

      {signedIn ? (
        <div className="freight-layout">
          <section className="report-panel freight-request-panel">
            <div className="report-heading">
              <div>
                <h2>New transportation request</h2>
                <p>
                  Describe the route and shipment. Operations will review the estimate before
                  quoting.
                </p>
              </div>
            </div>
            <form className="freight-form" onSubmit={(event) => void createRequest(event)}>
              <fieldset>
                <legend>Route</legend>
                <div className="freight-form-grid">
                  <label>
                    <span>Pickup name</span>
                    <input name="originName" required placeholder="Origin facility" />
                  </label>
                  <label>
                    <span>Pickup city</span>
                    <input name="originCity" required />
                  </label>
                  <label>
                    <span>Pickup country</span>
                    <input
                      name="originCountry"
                      required
                      minLength={2}
                      maxLength={2}
                      placeholder="US"
                    />
                  </label>
                  <label>
                    <span>Pickup type</span>
                    <select name="originType">
                      <option>ADDRESS</option>
                      <option>PORT</option>
                      <option>AIRPORT</option>
                      <option>RAIL_TERMINAL</option>
                    </select>
                  </label>
                  <label>
                    <span>Delivery name</span>
                    <input name="destinationName" required placeholder="Destination facility" />
                  </label>
                  <label>
                    <span>Delivery city</span>
                    <input name="destinationCity" required />
                  </label>
                  <label>
                    <span>Delivery country</span>
                    <input
                      name="destinationCountry"
                      required
                      minLength={2}
                      maxLength={2}
                      placeholder="DE"
                    />
                  </label>
                  <label>
                    <span>Delivery type</span>
                    <select name="destinationType">
                      <option>ADDRESS</option>
                      <option>PORT</option>
                      <option>AIRPORT</option>
                      <option>RAIL_TERMINAL</option>
                    </select>
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Cargo</legend>
                <div className="freight-form-grid">
                  <label className="span-2">
                    <span>Description</span>
                    <input
                      name="cargoDescription"
                      required
                      placeholder="Industrial machinery, crated"
                    />
                  </label>
                  <label>
                    <span>Packaging</span>
                    <select name="packageType">
                      <option>PALLET</option>
                      <option>CRATE</option>
                      <option>CONTAINER</option>
                      <option>BULK</option>
                    </select>
                  </label>
                  <label>
                    <span>Package count</span>
                    <input name="packageCount" type="number" min="1" defaultValue="1" required />
                  </label>
                  <label>
                    <span>Total weight (kg)</span>
                    <input name="weightKg" type="number" min="1" step="0.1" required />
                  </label>
                  <label>
                    <span>Service level</span>
                    <select name="serviceLevel">
                      <option>STANDARD</option>
                      <option>EXPRESS</option>
                      <option>ECONOMY</option>
                    </select>
                  </label>
                  <label>
                    <span>Incoterm</span>
                    <input name="incoterm" placeholder="EXW, FOB, DDP…" />
                  </label>
                </div>
                <div className="mode-picker">
                  {['ROAD', 'SEA', 'AIR', 'RAIL'].map((mode) => (
                    <label key={mode}>
                      <input
                        type="checkbox"
                        name="mode"
                        value={mode}
                        defaultChecked={mode === 'ROAD'}
                      />
                      {mode.toLowerCase()}
                    </label>
                  ))}
                  <label>
                    <input type="checkbox" name="insurance" />
                    Insurance required
                  </label>
                  <label>
                    <input type="checkbox" name="customs" />
                    Customs support
                  </label>
                  <label>
                    <input type="checkbox" name="hazardous" />
                    Hazardous cargo
                  </label>
                </div>
                <label>
                  <span>Special instructions</span>
                  <textarea name="instructions" rows={3} />
                </label>
              </fieldset>
              <button className="button button--primary" disabled={busy}>
                Submit for review
              </button>
            </form>
          </section>

          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Requests and quotes</h2>
                <p>Your active pricing conversations</p>
              </div>
            </div>
            {requests.length === 0 ? (
              <p className="panel-empty">No freight requests yet.</p>
            ) : (
              <div className="freight-card-list">
                {requests.map((request) => {
                  const quote = request.quotes[0];
                  return (
                    <article className="freight-card" key={request.id}>
                      <div>
                        <span className="status-word">
                          {request.status.replaceAll('_', ' ').toLowerCase()}
                        </span>
                        <h3>{request.number}</h3>
                        <p>
                          {request.stops
                            .map((stop) => `${stop.city}, ${stop.countryCode}`)
                            .join(' → ')}
                        </p>
                      </div>
                      <small>{request.preferredModes.join(' · ')}</small>
                      {quote ? (
                        <div className="quote-summary">
                          <span>{quote.number}</span>
                          <strong>{money(quote.totalMinor, quote.currency)}</strong>
                          <small>
                            {quote.paymentPolicy.replaceAll('_', ' ').toLowerCase()} · valid until{' '}
                            {new Date(quote.validUntil).toLocaleDateString()}
                          </small>
                          {quote.status === 'PUBLISHED' ? (
                            <button
                              className="button button--primary"
                              disabled={busy}
                              onClick={() => void acceptQuote(quote.id)}
                            >
                              Accept quote
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <p>Operations review pending.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Invoices</h2>
                <p>Download documents or continue a payment</p>
              </div>
            </div>
            {invoices.length === 0 ? (
              <p className="panel-empty">Invoices appear after quote acceptance.</p>
            ) : (
              <div className="freight-card-list">
                {invoices.map((invoice) => (
                  <article className="invoice-card" key={invoice.id}>
                    <div>
                      <span className="status-word">
                        {invoice.status.replaceAll('_', ' ').toLowerCase()}
                      </span>
                      <h3>{invoice.number}</h3>
                      <p>Due {new Date(invoice.dueAt).toLocaleDateString()}</p>
                    </div>
                    <strong>{money(invoice.totalMinor, invoice.currency)}</strong>
                    <small>{money(invoice.paidMinor, invoice.currency)} paid</small>
                    <div className="card-actions">
                      <button
                        className="button button--secondary"
                        onClick={() => void downloadInvoice(invoice)}
                      >
                        Invoice PDF
                      </button>
                      {invoice.status !== 'PAID' ? (
                        <>
                          <button onClick={() => void pay(invoice, 'STRIPE')}>Pay by card</button>
                          <button onClick={() => void pay(invoice, 'COINBASE')}>
                            Pay with crypto
                          </button>
                          <button className="link-button" onClick={() => void pay(invoice, 'MOCK')}>
                            Local demo
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Bookings and movement</h2>
                <p>Milestones reported by operations and driver coordinators</p>
              </div>
            </div>
            {bookings.length === 0 ? (
              <p className="panel-empty">Accepted quotes become bookings.</p>
            ) : (
              <div className="freight-card-list">
                {bookings.map((booking) => (
                  <article className="freight-card" key={booking.id}>
                    <div>
                      <span className="status-word">
                        {booking.status.replaceAll('_', ' ').toLowerCase()}
                      </span>
                      <h3>{booking.number}</h3>
                      <p>{booking.request.stops.map((stop) => stop.city).join(' → ')}</p>
                    </div>
                    <ol className="milestone-list">
                      {booking.milestones.length ? (
                        booking.milestones.map((milestone) => (
                          <li key={milestone.id}>
                            <span>{milestone.code.replaceAll('_', ' ').toLowerCase()}</span>
                            <strong>{milestone.location ?? milestone.description}</strong>
                            <time>{new Date(milestone.occurredAt).toLocaleString()}</time>
                          </li>
                        ))
                      ) : (
                        <li>Planning has not started.</li>
                      )}
                    </ol>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
