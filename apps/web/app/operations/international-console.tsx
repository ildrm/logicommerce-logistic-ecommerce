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

type Surface = 'network' | 'insurance' | 'postal';
type Location = {
  id: string;
  name: string;
  unLocode: string | null;
  countryCode: string;
  functions: string[];
};
type Hub = { id: string; code: string; name: string; type: string; customsBonded: boolean };
type HandlingUnit = {
  id: string;
  sscc: string | null;
  externalIdentifier: string | null;
  type: string;
  status: string;
  grossWeightGrams: number;
  verifiedGrossMassGrams: number | null;
};
type Consolidation = {
  id: string;
  number: string;
  status: string;
  mode: string;
  usedWeightGrams: number;
  maxWeightGrams: number | null;
  originHub: Hub;
  destinationHub: Hub;
  members: unknown[];
  loads: unknown[];
};
type Network = {
  hubs: Hub[];
  handlingUnits: HandlingUnit[];
  plans: Consolidation[];
  linehauls: Array<{
    id: string;
    number: string;
    status: string;
    mode: string;
    scheduledDepartureAt: string;
    allocations: unknown[];
  }>;
};
type InsuranceProduct = {
  id: string;
  code: string;
  name: string;
  coverageLevel: string;
  policyType: string;
  clauses: string[];
  supportedModes: string[];
  currency: string;
};
type InsuranceProvider = {
  id: string;
  key: string;
  name: string;
  kind: string;
  products: InsuranceProduct[];
};
type InsurancePolicy = {
  id: string;
  policyNumber: string;
  status: string;
  currency: string;
  insuredValueMinor: number;
  premiumMinor: number;
  claims: Array<{
    id: string;
    number: string;
    status: string;
    cause: string;
    claimedAmountMinor: number;
    version: number;
  }>;
};
type FreightRequest = {
  id: string;
  number: string;
  status: string;
  insuranceRequired: boolean;
  preferredModes: string[];
  cargoItems: Array<{ description: string; declaredValueMinor: number; currency: string }>;
};
type PostalOperator = {
  id: string;
  code: string;
  name: string;
  products: Array<{ id: string; code: string; name: string; category: string }>;
};
type PostalOverview = {
  operators: PostalOperator[];
  items: Array<{
    id: string;
    s10Identifier: string;
    status: string;
    originCountryCode: string;
    destinationCountryCode: string;
    weightGrams: number;
  }>;
  receptacles: Array<{
    id: string;
    receptacleId: string;
    status: string;
    mailCategory: string;
    itemLinks: unknown[];
  }>;
  dispatches: Array<{
    id: string;
    dispatchId: string;
    status: string;
    originImpcCode: string;
    destinationImpcCode: string;
    receptacleLinks: unknown[];
  }>;
  consignments: Array<{ id: string; consignmentId: string; status: string }>;
};

const number = new Intl.NumberFormat();
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(minor) / 100);

export function InternationalConsole({ surface }: { surface: Surface }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [network, setNetwork] = useState<Network>({
    hubs: [],
    handlingUnits: [],
    plans: [],
    linehauls: [],
  });
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [freightRequests, setFreightRequests] = useState<FreightRequest[]>([]);
  const [postal, setPostal] = useState<PostalOverview>({
    operators: [],
    items: [],
    receptacles: [],
    dispatches: [],
    consignments: [],
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken()) {
      setSignedIn(false);
      return;
    }
    try {
      if (surface === 'network') {
        const [locationRows, overview] = await Promise.all([
          authenticatedRequest<Location[]>('/international-logistics/locations'),
          authenticatedRequest<Network>('/logistics-network'),
        ]);
        setLocations(locationRows);
        setNetwork(overview);
      } else if (surface === 'insurance') {
        const [catalog, operations, requests] = await Promise.all([
          authenticatedRequest<InsuranceProvider[]>('/insurance/catalog'),
          authenticatedRequest<InsurancePolicy[]>('/insurance/operations'),
          authenticatedRequest<FreightRequest[]>('/freight/operations/requests'),
        ]);
        setProviders(catalog);
        setPolicies(operations);
        setFreightRequests(requests.filter(({ insuranceRequired }) => insuranceRequired));
      } else {
        setPostal(await authenticatedRequest<PostalOverview>('/postal/operations'));
      }
      setSignedIn(true);
    } catch (error) {
      setSignedIn(true);
      setMessage(error instanceof Error ? error.message : 'Operations data could not be loaded.');
    }
  }, [surface]);

  useEffect(() => void load(), [load]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    body: (form: FormData) => object,
    success: string,
  ) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      await authenticatedRequest(path, { method: 'POST', body: JSON.stringify(body(form)) });
      formElement.reset();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function transitionClaim(claim: InsurancePolicy['claims'][number], status: string) {
    setBusy(true);
    try {
      await authenticatedRequest(`/insurance/operations/claims/${claim.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, version: claim.version }),
      });
      setMessage(`Claim ${claim.number} moved to ${status.toLowerCase()}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim transition failed.');
    } finally {
      setBusy(false);
    }
  }

  const titles = {
    network: [
      'International logistics network',
      'Govern hubs, handling units, consolidation, shared capacity, and deconsolidation.',
    ],
    insurance: [
      'Cargo insurance and claims',
      'Operate policy products, coverage evidence, loss notifications, and claims decisions.',
    ],
    postal: [
      'International postal operations',
      'Manage the item → receptacle → dispatch → consignment hierarchy and UPU-style events.',
    ],
  } as const;

  return (
    <main id="main" className="app-page operations-console">
      <AppHeader active="operations" />
      <div className="page-heading">
        <div>
          <p className="eyebrow">International operations</p>
          <h1>{titles[surface][0]}</h1>
          <p className="page-subtitle">{titles[surface][1]}</p>
        </div>
        <nav className="console-tabs" aria-label="International logistics operations">
          <a className={surface === 'network' ? 'is-active' : ''} href="/operations/network">
            Network
          </a>
          <a className={surface === 'insurance' ? 'is-active' : ''} href="/operations/insurance">
            Insurance
          </a>
          <a className={surface === 'postal' ? 'is-active' : ''} href="/operations/postal">
            Postal
          </a>
        </nav>
      </div>

      {signedIn === false ? (
        <section className="auth-gate">
          <div>
            <h2>Operations sign-in required.</h2>
            <p>Role permissions control each catalog, handling, claims, and postal action.</p>
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

      {signedIn && surface === 'network' ? (
        <div className="console-grid">
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>International location</h2>
                <p>Tenant-governed UN/LOCODE reference subset</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) =>
                void submit(
                  event,
                  '/international-logistics/locations',
                  (form) => ({
                    name: form.get('name'),
                    countryCode: formText(form, 'countryCode').toUpperCase(),
                    unLocode: formText(form, 'unLocode').toUpperCase(),
                    functions: form.getAll('functions'),
                  }),
                  'International location added.',
                )
              }
            >
              <input name="name" required placeholder="Gateway name" />
              <input
                name="countryCode"
                required
                pattern="[A-Za-z]{2}"
                placeholder="Country, e.g. NL"
              />
              <input
                name="unLocode"
                required
                pattern="[A-Za-z]{2}[A-Za-z0-9]{3}"
                placeholder="UN/LOCODE"
              />
              <select name="functions" multiple defaultValue={['PORT']}>
                <option>PORT</option>
                <option>AIRPORT</option>
                <option>RAIL_TERMINAL</option>
                <option>ROAD_TERMINAL</option>
                <option>IMPC</option>
              </select>
              <button disabled={busy}>Add location</button>
            </form>
          </section>

          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Hub or gateway</h2>
                <p>Consolidation, cross-dock, customs, and postal capabilities</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) =>
                void submit(
                  event,
                  '/logistics-network/hubs',
                  (form) => ({
                    locationId: form.get('locationId'),
                    code: form.get('code'),
                    name: form.get('name'),
                    type: form.get('type'),
                    customsBonded: form.get('customsBonded') === 'on',
                    capabilities: ['CONSOLIDATION', 'DECONSOLIDATION', 'CROSS_DOCK'],
                  }),
                  'Hub created.',
                )
              }
            >
              <select name="locationId" required>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.unLocode ?? location.countryCode} · {location.name}
                  </option>
                ))}
              </select>
              <input name="code" required placeholder="Hub code" />
              <input name="name" required placeholder="Hub name" />
              <select name="type">
                <option>HUB</option>
                <option>CROSS_DOCK</option>
                <option>CFS</option>
                <option>IMPC</option>
                <option>PORT_TERMINAL</option>
                <option>AIR_CARGO_TERMINAL</option>
                <option>RAIL_TERMINAL</option>
              </select>
              <label className="check-row">
                <input name="customsBonded" type="checkbox" /> Customs bonded
              </label>
              <button disabled={busy}>Create hub</button>
            </form>
          </section>

          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Handling unit</h2>
                <p>GS1 SSCC or controlled external identifier</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) =>
                void submit(
                  event,
                  '/logistics-network/handling-units',
                  (form) => ({
                    type: form.get('type'),
                    externalIdentifier: form.get('externalIdentifier'),
                    currentHubId: form.get('currentHubId') || undefined,
                    grossWeightGrams: scaledDecimalFormValue(
                      form.get('weightKg'),
                      3,
                      'Gross weight',
                    ),
                  }),
                  'Handling unit registered.',
                )
              }
            >
              <select name="type">
                <option>PACKAGE</option>
                <option>PALLET</option>
                <option>CAGE</option>
                <option>BAG</option>
                <option>ULD</option>
                <option>CONTAINER</option>
              </select>
              <input name="externalIdentifier" required placeholder="Scannable identifier" />
              <select name="currentHubId">
                <option value="">Not received</option>
                {network.hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.code}
                  </option>
                ))}
              </select>
              <input
                name="weightKg"
                type="number"
                min="0.001"
                step="0.001"
                required
                placeholder="Gross kg"
              />
              <button disabled={busy}>Register unit</button>
            </form>
          </section>

          <section className="report-panel span-2">
            <div className="report-heading">
              <div>
                <h2>Network execution</h2>
                <p>Real handling units, consolidation plans, and shared linehaul allocations</p>
              </div>
            </div>
            <div className="network-metrics">
              <div>
                <dt>Locations</dt>
                <dd>{number.format(locations.length)}</dd>
              </div>
              <div>
                <dt>Hubs</dt>
                <dd>{number.format(network.hubs.length)}</dd>
              </div>
              <div>
                <dt>Handling units</dt>
                <dd>{number.format(network.handlingUnits.length)}</dd>
              </div>
              <div>
                <dt>Consolidations</dt>
                <dd>{number.format(network.plans.length)}</dd>
              </div>
              <div>
                <dt>Linehauls</dt>
                <dd>{number.format(network.linehauls.length)}</dd>
              </div>
            </div>
            <div className="operations-list">
              {network.plans.map((plan) => (
                <article key={plan.id}>
                  <div>
                    <span className="status-word">{plan.status.toLowerCase()}</span>
                    <h3>{plan.number}</h3>
                    <p>
                      {plan.originHub.code} → {plan.destinationHub.code} · {plan.mode}
                    </p>
                    <small>
                      {number.format(plan.usedWeightGrams / 1000)} kg allocated ·{' '}
                      {plan.members.length} consignments · {plan.loads.length} load units
                    </small>
                  </div>
                </article>
              ))}
              {network.plans.length === 0 ? (
                <p className="panel-empty">No consolidation plan has been opened yet.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {signedIn && surface === 'insurance' ? (
        <div className="console-grid">
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Underwriter or broker</h2>
                <p>Licensed-provider metadata is mandatory for production activation</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) =>
                void submit(
                  event,
                  '/insurance/operations/providers',
                  (form) => ({
                    key: form.get('key'),
                    name: form.get('name'),
                    kind: form.get('kind'),
                    countries: formText(form, 'countries')
                      .toUpperCase()
                      .split(',')
                      .map((value) => value.trim()),
                    modes: ['ROAD', 'SEA', 'AIR', 'RAIL'],
                    currencies: ['USD'],
                  }),
                  'Insurance provider created.',
                )
              }
            >
              <input name="key" required placeholder="provider-key" />
              <input name="name" required placeholder="Legal provider name" />
              <select name="kind">
                <option>INSURER</option>
                <option>BROKER</option>
                <option>MGA</option>
              </select>
              <input name="countries" required placeholder="Countries: NL,SG,US" />
              <button disabled={busy}>Register provider</button>
            </form>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Versioned coverage product</h2>
                <p>Illustrative ICC clause mapping; legal wording remains provider-controlled</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                const providerId = formText(form, 'providerId');
                void submit(
                  event,
                  `/insurance/operations/providers/${providerId}/products`,
                  (values) => ({
                    code: values.get('code'),
                    name: values.get('name'),
                    policyType: 'SINGLE_TRANSIT',
                    coverageLevel: values.get('coverageLevel'),
                    clauses: values.get('coverageLevel') === 'ICC_C' ? ['ICC(C)'] : ['ICC(A)'],
                    exclusions: [
                      'WILFUL_MISCONDUCT',
                      'INSUFFICIENT_PACKING',
                      'INHERENT_VICE',
                      'DELAY',
                      'NUCLEAR',
                    ],
                    supportedModes: ['ROAD', 'SEA', 'AIR', 'RAIL'],
                    supportedCountries: formText(values, 'countries')
                      .toUpperCase()
                      .split(',')
                      .map((value) => value.trim()),
                    currency: 'USD',
                    rateBasisPoints: Number(values.get('rateBasisPoints')),
                    minimumPremiumMinor: scaledDecimalFormValue(
                      values.get('minimumPremium'),
                      2,
                      'Minimum premium',
                    ),
                    deductibleType: 'FIXED',
                    deductibleValue: scaledDecimalFormValue(
                      values.get('deductible'),
                      2,
                      'Deductible',
                    ),
                    valuationUpliftPercent: 10,
                    effectiveAt: new Date(formText(values, 'effectiveAt')).toISOString(),
                  }),
                  'Insurance product version created.',
                );
              }}
            >
              <select name="providerId" required>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <input name="code" required placeholder="Product code" />
              <input name="name" required placeholder="Product name" />
              <select name="coverageLevel">
                <option>ICC_A</option>
                <option>ICC_B</option>
                <option>ICC_C</option>
                <option>ALL_RISK</option>
                <option>NAMED_PERILS</option>
                <option>CARRIER_LIABILITY</option>
              </select>
              <input name="countries" required placeholder="Countries: NL,SG,US" />
              <input name="rateBasisPoints" type="number" min="0" required defaultValue="35" />
              <input name="minimumPremium" type="number" min="0" step="0.01" defaultValue="75" />
              <input name="deductible" type="number" min="0" step="0.01" defaultValue="500" />
              <input name="effectiveAt" type="datetime-local" required />
              <button disabled={busy || providers.length === 0}>Create product version</button>
            </form>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Quote requested cover</h2>
                <p>Premium and insured value are calculated from the immutable product version</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) =>
                void submit(
                  event,
                  '/insurance/operations/quotes',
                  (form) => ({
                    requestId: form.get('requestId'),
                    productId: form.get('productId'),
                    coverageStartAt: new Date(formText(form, 'coverageStartAt')).toISOString(),
                    coverageEndAt: new Date(formText(form, 'coverageEndAt')).toISOString(),
                    validUntil: new Date(formText(form, 'validUntil')).toISOString(),
                    taxMinor: scaledDecimalFormValue(form.get('tax'), 2, 'Tax'),
                  }),
                  'Cargo-insurance quote issued.',
                )
              }
            >
              <select name="requestId" required>
                {freightRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.number} ·{' '}
                    {request.cargoItems.map(({ description }) => description).join(', ')}
                  </option>
                ))}
              </select>
              <select name="productId" required>
                {providers.flatMap((provider) =>
                  provider.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {provider.name} · {product.name}
                    </option>
                  )),
                )}
              </select>
              <label>
                <span>Coverage starts</span>
                <input name="coverageStartAt" type="datetime-local" required />
              </label>
              <label>
                <span>Coverage ends</span>
                <input name="coverageEndAt" type="datetime-local" required />
              </label>
              <label>
                <span>Quote expires</span>
                <input name="validUntil" type="datetime-local" required />
              </label>
              <input name="tax" type="number" min="0" step="0.01" defaultValue="0" />
              <button
                disabled={
                  busy ||
                  freightRequests.length === 0 ||
                  providers.every(({ products }) => products.length === 0)
                }
              >
                Issue insurance quote
              </button>
            </form>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Coverage catalog</h2>
                <p>Clause editions and exclusions are snapshotted at quote and policy issue</p>
              </div>
            </div>
            <div className="compact-list">
              {providers.flatMap((provider) =>
                provider.products.map((product) => (
                  <div key={product.id}>
                    <span>{product.name}</span>
                    <strong>{product.coverageLevel.replaceAll('_', ' ').toLowerCase()}</strong>
                    <small>
                      {provider.name} · {product.clauses.join(', ')}
                    </small>
                  </div>
                )),
              )}
            </div>
          </section>
          <section className="report-panel span-2">
            <div className="report-heading">
              <div>
                <h2>Policies and claims</h2>
                <p>Loss evidence, assessment decisions, reserve, settlement, and audit history</p>
              </div>
            </div>
            <div className="operations-list">
              {policies.map((policy) => (
                <article key={policy.id}>
                  <div>
                    <span className="status-word">{policy.status.toLowerCase()}</span>
                    <h3>{policy.policyNumber}</h3>
                    <p>
                      {money(policy.insuredValueMinor, policy.currency)} insured ·{' '}
                      {money(policy.premiumMinor, policy.currency)} premium
                    </p>
                  </div>
                  <div className="compact-list">
                    {policy.claims.map((claim) => (
                      <div key={claim.id}>
                        <span>
                          {claim.number} · {claim.cause.replaceAll('_', ' ').toLowerCase()}
                        </span>
                        <strong>{claim.status.toLowerCase()}</strong>
                        <small>{money(claim.claimedAmountMinor, policy.currency)} claimed</small>
                        {claim.status === 'SUBMITTED' ? (
                          <button
                            disabled={busy}
                            onClick={() => void transitionClaim(claim, 'UNDER_REVIEW')}
                          >
                            Start assessment
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
              {policies.length === 0 ? (
                <p className="panel-empty">No bound cargo-insurance policies yet.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {signedIn && surface === 'postal' ? (
        <div className="console-grid">
          <section className="report-panel span-2">
            <div className="report-heading">
              <div>
                <h2>Postal exchange overview</h2>
                <p>
                  Operational objects remain separate so scans and EDI can be reconciled by level.
                </p>
              </div>
            </div>
            <div className="network-metrics">
              <div>
                <dt>Items</dt>
                <dd>{postal.items.length}</dd>
              </div>
              <div>
                <dt>Receptacles</dt>
                <dd>{postal.receptacles.length}</dd>
              </div>
              <div>
                <dt>Dispatches</dt>
                <dd>{postal.dispatches.length}</dd>
              </div>
              <div>
                <dt>Consignments</dt>
                <dd>{postal.consignments.length}</dd>
              </div>
            </div>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Open receptacle</h2>
                <p>Items are loaded before close, despatch, receipt, and opening</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) =>
                void submit(
                  event,
                  '/postal/operations/receptacles',
                  (form) => ({
                    operatorId: form.get('operatorId'),
                    receptacleId: form.get('receptacleId'),
                    type: form.get('type'),
                    mailCategory: form.get('mailCategory'),
                    originImpcCode: formText(form, 'originImpcCode').toUpperCase(),
                    destinationImpcCode: formText(form, 'destinationImpcCode').toUpperCase(),
                  }),
                  'Postal receptacle opened.',
                )
              }
            >
              <select name="operatorId" required>
                {postal.operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
              <input name="receptacleId" required placeholder="Receptacle identifier" />
              <select name="type">
                <option>BAG</option>
                <option>TRAY</option>
                <option>CAGE</option>
                <option>CONTAINER</option>
                <option>ULD</option>
              </select>
              <select name="mailCategory">
                <option>PARCEL</option>
                <option>LETTER</option>
                <option>EMS</option>
                <option>EXPRESS</option>
              </select>
              <input
                name="originImpcCode"
                required
                pattern="[A-Za-z0-9]{6}"
                placeholder="Origin IMPC"
              />
              <input
                name="destinationImpcCode"
                required
                pattern="[A-Za-z0-9]{6}"
                placeholder="Destination IMPC"
              />
              <button disabled={busy}>Open receptacle</button>
            </form>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Open dispatch</h2>
                <p>Closed receptacles are assigned in sequence before handover</p>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={(event) =>
                void submit(
                  event,
                  '/postal/operations/dispatches',
                  (form) => ({
                    operatorId: form.get('operatorId'),
                    dispatchId: form.get('dispatchId'),
                    originImpcCode: formText(form, 'originImpcCode').toUpperCase(),
                    destinationImpcCode: formText(form, 'destinationImpcCode').toUpperCase(),
                    mailCategory: form.get('mailCategory'),
                    dispatchNumber: Number(form.get('dispatchNumber')),
                  }),
                  'Postal dispatch opened.',
                )
              }
            >
              <select name="operatorId" required>
                {postal.operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
              <input name="dispatchId" required placeholder="Dispatch identifier" />
              <input
                name="originImpcCode"
                required
                pattern="[A-Za-z0-9]{6}"
                placeholder="Origin IMPC"
              />
              <input
                name="destinationImpcCode"
                required
                pattern="[A-Za-z0-9]{6}"
                placeholder="Destination IMPC"
              />
              <select name="mailCategory">
                <option>PARCEL</option>
                <option>LETTER</option>
                <option>EMS</option>
                <option>EXPRESS</option>
              </select>
              <input
                name="dispatchNumber"
                type="number"
                min="1"
                required
                placeholder="Dispatch no."
              />
              <button disabled={busy}>Open dispatch</button>
            </form>
          </section>
          <section className="report-panel span-2">
            <div className="report-heading">
              <div>
                <h2>Postal tracking objects</h2>
                <p>Item identifiers and dispatch status from standard or internal events</p>
              </div>
            </div>
            <div className="operations-list">
              {postal.items.map((item) => (
                <article key={item.id}>
                  <div>
                    <span className="status-word">{item.status.toLowerCase()}</span>
                    <h3>{item.s10Identifier}</h3>
                    <p>
                      {item.originCountryCode} → {item.destinationCountryCode}
                    </p>
                    <small>{number.format(item.weightGrams / 1000)} kg</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
