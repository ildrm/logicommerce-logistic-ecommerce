'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AppHeader } from '../components/app-header';
import { accessToken, authenticatedRequest } from '../components/authenticated-api';
import { scaledDecimalFormValue } from '../components/form-values';

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

type PostalOverview = {
  operators: Array<{
    id: string;
    name: string;
    products: Array<{
      id: string;
      name: string;
      category: string;
      maxWeightGrams: number | null;
    }>;
  }>;
  items: Array<{
    id: string;
    s10Identifier: string;
    status: string;
    originCountryCode: string;
    destinationCountryCode: string;
    contentDescription: string;
    weightGrams: number;
    events: Array<{
      id: string;
      code: string;
      description: string;
      locationCode: string | null;
      occurredAt: string;
    }>;
  }>;
};

export default function PostalPage() {
  const [data, setData] = useState<PostalOverview>({ operators: [], items: [] });
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken()) {
      setSignedIn(false);
      return;
    }
    try {
      setData(await authenticatedRequest<PostalOverview>('/postal/mine'));
      setSignedIn(true);
    } catch (error) {
      setSignedIn(true);
      setMessage(error instanceof Error ? error.message : 'Postal data could not be loaded.');
    }
  }, []);

  useEffect(() => void load(), [load]);

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const [operatorId, productId] = formText(form, 'service').split(':');
    try {
      const item = await authenticatedRequest<{ s10Identifier: string }>('/postal/items', {
        method: 'POST',
        body: JSON.stringify({
          operatorId,
          productId,
          serviceIndicator: form.get('serviceIndicator'),
          serial: form.get('serial'),
          originCountryCode: formText(form, 'originCountryCode').toUpperCase(),
          destinationCountryCode: formText(form, 'destinationCountryCode').toUpperCase(),
          sender: {
            name: form.get('senderName'),
            address: form.get('senderAddress'),
          },
          recipient: {
            name: form.get('recipientName'),
            address: form.get('recipientAddress'),
          },
          contentDescription: form.get('contentDescription'),
          weightGrams: scaledDecimalFormValue(form.get('weightKg'), 3, 'Weight'),
          declaredValueMinor: scaledDecimalFormValue(
            form.get('declaredValue'),
            2,
            'Declared value',
          ),
          currency: form.get('currency'),
          customsData: {
            category: form.get('customsCategory'),
            hsCode: form.get('hsCode'),
            originCountryCode: formText(form, 'originCountryCode').toUpperCase(),
          },
        }),
      });
      formElement.reset();
      setMessage(`${item.s10Identifier} accepted into the postal network.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Postal item could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-page freight-page">
      <AppHeader active="postal" />
      <div className="page-heading">
        <div>
          <p className="eyebrow">International postal service</p>
          <h1>Send and track a cross-border postal item.</h1>
          <p className="page-subtitle">
            Create a tracked item with customs data, receive a validated S10 identifier, and follow
            the event timeline through delivery.
          </p>
        </div>
      </div>

      {signedIn === false ? (
        <section className="auth-gate">
          <div>
            <h2>Sign in to use postal services.</h2>
            <p>Sender, recipient, customs, and tracking information is private to your account.</p>
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
                <h2>New international item</h2>
                <p>Customs details are required for the seeded international parcel service.</p>
              </div>
            </div>
            <form className="freight-form" onSubmit={(event) => void createItem(event)}>
              <fieldset>
                <legend>Postal service and route</legend>
                <div className="freight-form-grid">
                  <label>
                    <span>Service</span>
                    <select name="service" required>
                      {data.operators.flatMap((operator) =>
                        operator.products.map((product) => (
                          <option key={product.id} value={`${operator.id}:${product.id}`}>
                            {operator.name} · {product.name}
                          </option>
                        )),
                      )}
                    </select>
                  </label>
                  <label>
                    <span>S10 service indicator</span>
                    <input name="serviceIndicator" defaultValue="CP" pattern="[A-Z]{2}" required />
                  </label>
                  <label>
                    <span>Eight-digit serial</span>
                    <input name="serial" inputMode="numeric" pattern="\d{8}" required />
                  </label>
                  <label>
                    <span>Origin country</span>
                    <input name="originCountryCode" maxLength={2} pattern="[A-Za-z]{2}" required />
                  </label>
                  <label>
                    <span>Destination country</span>
                    <input
                      name="destinationCountryCode"
                      maxLength={2}
                      pattern="[A-Za-z]{2}"
                      required
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Parties and contents</legend>
                <div className="freight-form-grid">
                  <label>
                    <span>Sender name</span>
                    <input name="senderName" required />
                  </label>
                  <label>
                    <span>Sender address</span>
                    <input name="senderAddress" required />
                  </label>
                  <label>
                    <span>Recipient name</span>
                    <input name="recipientName" required />
                  </label>
                  <label>
                    <span>Recipient address</span>
                    <input name="recipientAddress" required />
                  </label>
                  <label>
                    <span>Contents</span>
                    <input name="contentDescription" required />
                  </label>
                  <label>
                    <span>Weight (kg)</span>
                    <input name="weightKg" type="number" min="0.001" step="0.001" required />
                  </label>
                  <label>
                    <span>Declared value</span>
                    <input name="declaredValue" type="number" min="0" step="0.01" required />
                  </label>
                  <label>
                    <span>Currency</span>
                    <select name="currency">
                      <option>USD</option>
                      <option>EUR</option>
                      <option>GBP</option>
                    </select>
                  </label>
                  <label>
                    <span>Customs category</span>
                    <select name="customsCategory">
                      <option>SALE_OF_GOODS</option>
                      <option>GIFT</option>
                      <option>DOCUMENTS</option>
                      <option>RETURNED_GOODS</option>
                      <option>COMMERCIAL_SAMPLE</option>
                    </select>
                  </label>
                  <label>
                    <span>HS code</span>
                    <input name="hsCode" required placeholder="6–10 digit commodity code" />
                  </label>
                </div>
              </fieldset>
              <button className="button button--primary" disabled={busy}>
                Accept postal item
              </button>
            </form>
          </section>

          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Your postal timelines</h2>
                <p>Standard events in chronological order</p>
              </div>
            </div>
            <div className="freight-card-list">
              {data.items.map((item) => (
                <article className="freight-card" key={item.id}>
                  <span className="status-word">{item.status.toLowerCase()}</span>
                  <h3>{item.s10Identifier}</h3>
                  <p>
                    {item.originCountryCode} → {item.destinationCountryCode} ·{' '}
                    {item.contentDescription}
                  </p>
                  <ol className="milestone-list">
                    {item.events.map((event) => (
                      <li key={event.id}>
                        <strong>{event.code}</strong>
                        <span>{event.description}</span>
                        <small>
                          {new Date(event.occurredAt).toLocaleString()}
                          {event.locationCode ? ` · ${event.locationCode}` : ''}
                        </small>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
              {data.items.length === 0 ? (
                <p className="panel-empty">No postal items have been accepted yet.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
