'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/app-header';

type Point = { date: string; value: number };
type ProcessHealth = {
  key: string;
  label: string;
  total: number;
  exceptions: number;
  healthyPercent: number | null;
};
type AnalyticsOverview = {
  generatedAt: string;
  window: { days: number; start: string; end: string };
  dataQuality: { status: 'live' | 'partial'; truncatedDomains: string[] };
  health: {
    score: number;
    state: 'healthy' | 'attention' | 'at-risk';
    activeExceptions: number;
    criticalSignals: number;
  };
  kpis: {
    orders: number;
    orderGmvMinor: number;
    atRiskShipments: number;
    openReturns: number;
    settlementExposureMinor: number;
    freightRequests: number;
    activeFreightBookings: number;
    staleDriverCheckIns: number;
    overdueReceivablesMinor: number;
    paymentBlocks: number;
  };
  trends: { orders: Point[]; fulfillment: Point[]; returns: Point[] };
  exceptions: Array<{
    severity: 'critical' | 'high' | 'medium' | 'info';
    process: string;
    issue: string;
    count: number;
    owner: string;
    href: string;
  }>;
  processHealth: ProcessHealth[];
  inventory: { states: Record<string, number>; totalUnits: number; riskUnits: number };
  finance: {
    currency: string;
    gmvMinor: number;
    settlementExposureMinor: number;
    reconciliationDifferenceMinor: number;
    reservesMinor: number;
    feesMinor: number;
  };
  network: {
    optimizationRuns: number;
    proposed: number;
    approved: number;
    executed: number;
    rolledBack: number;
  };
  transportation: {
    requestBacklog: number;
    quoteTurnaroundHours: number | null;
    quoteAcceptancePercent: number | null;
    expiringQuotes: number;
    activeBookings: number;
    delayedLegs: number;
    staleDriverCheckIns: number;
    carrierExceptions: number;
    overdueReceivablesMinor: number;
    paymentBlocks: number;
    bookingsByStatus: Record<string, number>;
    bookingsByMode: Record<string, number>;
  };
  international: {
    insuranceClaims: number;
    openInsuranceClaims: number;
    handlingUnits: number;
    handlingExceptions: number;
    consolidationPlans: number;
    activeConsolidations: number;
    consolidationExceptions: number;
    postalItems: number;
    postalDispatches: number;
    postalExceptions: number;
    delayedPostalDispatches: number;
    customsFilings: number;
    customsHolds: number;
  };
  domainActivity: Array<{
    key: string;
    label: string;
    value: number;
    context: string;
    href: string;
  }>;
  slos: Array<{
    key: string;
    name: string;
    target: number;
    windowDays: number;
    value: number | null;
    sampleSize: number;
    status: string;
    observedAt: string | null;
  }>;
  activity: Array<{ action: string; entityType: string; occurredAt: string }>;
};

const ranges = [7, 14, 30] as const;
const number = new Intl.NumberFormat();

function money(minor: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: Math.abs(minor) >= 100_000_00 ? 0 : 2,
  }).format(minor / 100);
}

function compactMoney(minor: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(minor / 100);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

function TrendChart({ orders, fulfillment }: { orders: Point[]; fulfillment: Point[] }) {
  const width = 760;
  const height = 260;
  const inset = { top: 22, right: 22, bottom: 42, left: 48 };
  const all = [...orders, ...fulfillment];
  const maximum = Math.max(1, ...all.map(({ value }) => value));
  const x = (index: number, count: number) =>
    inset.left + (index / Math.max(1, count - 1)) * (width - inset.left - inset.right);
  const y = (value: number) =>
    inset.top + (1 - value / maximum) * (height - inset.top - inset.bottom);
  const path = (points: Point[]) =>
    points
      .map(
        (point, index) => `${index === 0 ? 'M' : 'L'}${x(index, points.length)},${y(point.value)}`,
      )
      .join(' ');
  const hasActivity = all.some(({ value }) => value > 0);

  return (
    <figure className="trend-figure">
      <div className="chart-key" aria-hidden="true">
        <span>
          <i className="key-line key-line--orders" />
          Orders
        </span>
        <span>
          <i className="key-line key-line--fulfillment" />
          Fulfillment
        </span>
      </div>
      <svg
        className="trend-chart"
        role="img"
        aria-labelledby="trend-title trend-description"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id="trend-title">Order and fulfillment volume</title>
        <desc id="trend-description">
          Daily order and fulfillment records for the selected reporting window. Exact values are
          available in the table following the chart.
        </desc>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const gridY = inset.top + ratio * (height - inset.top - inset.bottom);
          const value = Math.round(maximum * (1 - ratio));
          return (
            <g key={ratio}>
              <line
                className="chart-grid"
                x1={inset.left}
                x2={width - inset.right}
                y1={gridY}
                y2={gridY}
              />
              <text className="chart-axis" x={inset.left - 10} y={gridY + 4} textAnchor="end">
                {number.format(value)}
              </text>
            </g>
          );
        })}
        {orders.map((point, index) =>
          index % Math.max(1, Math.ceil(orders.length / 7)) === 0 || index === orders.length - 1 ? (
            <text
              className="chart-axis"
              key={point.date}
              x={x(index, orders.length)}
              y={height - 14}
              textAnchor={index === 0 ? 'start' : index === orders.length - 1 ? 'end' : 'middle'}
            >
              {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
                new Date(`${point.date}T12:00:00Z`),
              )}
            </text>
          ) : null,
        )}
        <path className="chart-line chart-line--orders" d={path(orders)} />
        <path className="chart-line chart-line--fulfillment" d={path(fulfillment)} />
        {hasActivity ? (
          <>
            <circle
              className="chart-point chart-point--orders"
              cx={x(orders.length - 1, orders.length)}
              cy={y(orders.at(-1)?.value ?? 0)}
              r="4"
            />
            <circle
              className="chart-point chart-point--fulfillment"
              cx={x(fulfillment.length - 1, fulfillment.length)}
              cy={y(fulfillment.at(-1)?.value ?? 0)}
              r="4"
            />
          </>
        ) : null}
      </svg>
      {!hasActivity ? (
        <p className="chart-empty">No order or fulfillment activity in this window.</p>
      ) : null}
      <table className="sr-only">
        <caption>Daily order and fulfillment volumes</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Orders</th>
            <th>Fulfillment records</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((point, index) => (
            <tr key={point.date}>
              <th>{point.date}</th>
              <td>{point.value}</td>
              <td>{fulfillment[index]?.value ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function ProcessLane({ processes }: { processes: ProcessHealth[] }) {
  return (
    <div className="process-lane">
      {processes.map((process) => {
        const healthy = process.healthyPercent;
        const state =
          healthy === null
            ? 'no-data'
            : healthy >= 95
              ? 'healthy'
              : healthy >= 85
                ? 'attention'
                : 'at-risk';
        return (
          <div className="process-node" key={process.key}>
            <div className="process-node__heading">
              <strong>{process.label}</strong>
              <span className={`state-text state-text--${state}`}>
                {healthy === null ? 'No data' : `${healthy}%`}
              </span>
            </div>
            <div
              className={`process-bar process-bar--${state}`}
              aria-label={`${process.label}: ${healthy === null ? 'no data' : `${healthy} percent healthy`}`}
            >
              {healthy !== null ? <span style={{ width: `${healthy}%` }} /> : null}
            </div>
            <small>
              {number.format(process.total)} records · {number.format(process.exceptions)}{' '}
              exceptions
            </small>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardClient() {
  const [days, setDays] = useState<(typeof ranges)[number]>(14);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  const load = useCallback(async (selectedDays: number, background = false) => {
    const token = window.sessionStorage.getItem('logicommerce_access') ?? '';
    setHasToken(Boolean(token));
    if (!token) {
      setLoading(false);
      return;
    }
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/v1/analytics/overview?days=${selectedDays}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(problem?.detail ?? 'Analytics could not be loaded.');
      }
      setData((await response.json()) as AnalyticsOverview);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analytics could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get('days'));
    const initial = ranges.includes(requested as (typeof ranges)[number])
      ? (requested as (typeof ranges)[number])
      : 14;
    setDays(initial);
    void load(initial);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(days, true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [days, load]);

  function chooseRange(next: (typeof ranges)[number]) {
    setDays(next);
    const url = new URL(window.location.href);
    url.searchParams.set('days', String(next));
    window.history.pushState({}, '', url);
    void load(next, data !== null);
  }

  const inventoryRows = useMemo(
    () =>
      data
        ? Object.entries(data.inventory.states)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 6)
        : [],
    [data],
  );

  return (
    <main id="main" className="app-page dashboard-page">
      <AppHeader active="dashboard" />
      <div className="page-heading dashboard-heading">
        <div>
          <h1>Operations overview</h1>
          <p className="page-subtitle">
            {data
              ? `Last updated ${formatDate(data.generatedAt)}`
              : 'Tenant-wide process health and exceptions'}
            {data ? (
              <span
                className={`live-state live-state--${error ? 'stale' : data.dataQuality.status}`}
              >
                {error ? 'Stale' : data.dataQuality.status === 'partial' ? 'Partial data' : 'Live'}
              </span>
            ) : null}
          </p>
        </div>
        <div className="dashboard-controls">
          <button
            className="button button--secondary refresh-button"
            disabled={refreshing}
            onClick={() => void load(days, true)}
          >
            <span aria-hidden="true">↻</span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <div className="range-control" aria-label="Reporting window">
            {ranges.map((range) => (
              <button
                aria-pressed={days === range}
                className={days === range ? 'is-selected' : ''}
                key={range}
                onClick={() => chooseRange(range)}
              >
                {range} days
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasToken === false ? (
        <section className="auth-gate">
          <div>
            <h2>Sign in to view operational analytics.</h2>
            <p>Reports are tenant-scoped and require the operational-read permission.</p>
          </div>
          <a className="button button--primary" href="/account">
            Go to account
          </a>
        </section>
      ) : null}
      {loading ? (
        <div className="dashboard-loading" role="status">
          Building your operational view…
        </div>
      ) : null}
      {error && !data ? (
        <div className="error-state" role="alert">
          <strong>Dashboard unavailable</strong>
          <span>{error}</span>
          <button onClick={() => void load(days)}>Try again</button>
        </div>
      ) : null}
      {error && data ? (
        <p className="stale-notice" role="status">
          Refresh failed. The last good snapshot remains visible. {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="health-strip" aria-label="Operational summary">
            <div className={`health-strip__primary health-strip__primary--${data.health.state}`}>
              <span>System health</span>
              <strong>{data.health.score}%</strong>
              <small>
                {data.health.state === 'healthy'
                  ? 'Healthy'
                  : data.health.state === 'attention'
                    ? 'Needs attention'
                    : 'At risk'}
              </small>
            </div>
            <div>
              <span>Orders</span>
              <strong>{number.format(data.kpis.orders)}</strong>
              <small>{compactMoney(data.kpis.orderGmvMinor)} GMV</small>
            </div>
            <div>
              <span>At-risk shipments</span>
              <strong>{number.format(data.kpis.atRiskShipments)}</strong>
              <small>
                {data.kpis.atRiskShipments === 0 ? 'No current SLA risk' : 'Review fulfillment'}
              </small>
            </div>
            <div>
              <span>Open returns</span>
              <strong>{number.format(data.kpis.openReturns)}</strong>
              <small>
                {data.kpis.openReturns === 0 ? 'Queue is clear' : 'Awaiting resolution'}
              </small>
            </div>
            <div>
              <span>Active freight</span>
              <strong>{number.format(data.kpis.activeFreightBookings)}</strong>
              <small>{number.format(data.kpis.freightRequests)} total requests</small>
            </div>
            <div>
              <span>Overdue receivables</span>
              <strong>{compactMoney(data.kpis.overdueReceivablesMinor)}</strong>
              <small>{data.kpis.paymentBlocks} failed payments</small>
            </div>
          </section>

          <div className="dashboard-primary-grid">
            <section className="report-panel trend-panel" aria-labelledby="volume-title">
              <div className="report-heading">
                <div>
                  <h2 id="volume-title">Order and fulfillment volume</h2>
                  <p>Daily records in the selected window</p>
                </div>
              </div>
              <TrendChart orders={data.trends.orders} fulfillment={data.trends.fulfillment} />
            </section>
            <section className="report-panel exception-panel" aria-labelledby="exception-title">
              <div className="report-heading">
                <div>
                  <h2 id="exception-title">Exceptions requiring attention</h2>
                  <p>Prioritized by operational impact</p>
                </div>
                <strong className="exception-total">
                  {number.format(data.health.activeExceptions)}
                </strong>
              </div>
              {data.exceptions.length === 0 ? (
                <div className="clear-state">
                  <span aria-hidden="true">✓</span>
                  <strong>No active exception signals</strong>
                  <p>Monitored process queues are within their current thresholds.</p>
                </div>
              ) : (
                <div className="exception-table-wrap">
                  <table className="data-table exception-table">
                    <thead>
                      <tr>
                        <th>Severity</th>
                        <th>Process</th>
                        <th>Issue</th>
                        <th>Count</th>
                        <th>Owner</th>
                        <th>
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exceptions.slice(0, 8).map((exception) => (
                        <tr key={`${exception.process}-${exception.issue}`}>
                          <td>
                            <span className={`severity severity--${exception.severity}`}>
                              <i />
                              {exception.severity}
                            </span>
                          </td>
                          <td>{exception.process}</td>
                          <td>{exception.issue}</td>
                          <td className="numeric">
                            {['Finance', 'Billing'].includes(exception.process)
                              ? money(exception.count)
                              : number.format(exception.count)}
                          </td>
                          <td>{exception.owner}</td>
                          <td>
                            <a
                              className="row-link"
                              href={exception.href}
                              aria-label={`Open ${exception.issue}`}
                            >
                              →
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="report-panel process-panel" aria-labelledby="process-title">
            <div className="report-heading report-heading--inline">
              <div>
                <h2 id="process-title">Process health</h2>
                <p>Healthy share and exception load at each operational handoff</p>
              </div>
              <div className="process-legend" aria-hidden="true">
                <span>
                  <i className="legend-dot legend-dot--healthy" />
                  Healthy ≥95%
                </span>
                <span>
                  <i className="legend-dot legend-dot--attention" />
                  Attention 85–95%
                </span>
                <span>
                  <i className="legend-dot legend-dot--risk" />
                  At risk &lt;85%
                </span>
              </div>
            </div>
            <ProcessLane processes={data.processHealth} />
          </section>

          <section className="report-panel transport-report" aria-labelledby="transport-title">
            <div className="report-heading report-heading--inline">
              <div>
                <h2 id="transport-title">Global freight control tower</h2>
                <p>Commercial, billing, and movement risks from request through delivery</p>
              </div>
              <a href="/operations/freight">
                Open freight operations <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="transport-metrics">
              <div>
                <span>Review backlog</span>
                <strong>{number.format(data.transportation.requestBacklog)}</strong>
                <small>submitted requests</small>
              </div>
              <div>
                <span>Quote turnaround</span>
                <strong>
                  {data.transportation.quoteTurnaroundHours === null
                    ? '—'
                    : `${data.transportation.quoteTurnaroundHours}h`}
                </strong>
                <small>
                  {data.transportation.quoteAcceptancePercent === null
                    ? 'no decisions yet'
                    : `${data.transportation.quoteAcceptancePercent}% accepted`}
                </small>
              </div>
              <div>
                <span>Expiring quotes</span>
                <strong>{number.format(data.transportation.expiringQuotes)}</strong>
                <small>within 48 hours</small>
              </div>
              <div>
                <span>Delayed legs</span>
                <strong>{number.format(data.transportation.delayedLegs)}</strong>
                <small>{data.transportation.carrierExceptions} open exceptions</small>
              </div>
              <div>
                <span>Stale driver calls</span>
                <strong>{number.format(data.transportation.staleDriverCheckIns)}</strong>
                <small>coordinator action due</small>
              </div>
              <div>
                <span>Payment blocks</span>
                <strong>{number.format(data.transportation.paymentBlocks)}</strong>
                <small>{compactMoney(data.transportation.overdueReceivablesMinor)} overdue</small>
              </div>
            </div>
            <div className="transport-breakdown">
              <div>
                <h3>Bookings by mode</h3>
                <div className="breakdown-bars">
                  {Object.entries(data.transportation.bookingsByMode).map(([label, value]) => (
                    <span key={label}>
                      <i
                        style={{
                          width: `${Math.max(8, (value / Math.max(1, ...Object.values(data.transportation.bookingsByMode))) * 100)}%`,
                        }}
                      />
                      <em>{label.toLowerCase()}</em>
                      <strong>{number.format(value)}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3>Bookings by status</h3>
                <div className="status-cloud">
                  {Object.entries(data.transportation.bookingsByStatus).map(([label, value]) => (
                    <span key={label}>
                      {label.replaceAll('_', ' ').toLowerCase()}{' '}
                      <strong>{number.format(value)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="report-panel transport-report" aria-labelledby="international-title">
            <div className="report-heading report-heading--inline">
              <div>
                <h2 id="international-title">International logistics and postal control</h2>
                <p>
                  Physical-unit custody, consolidation, insurance claims, customs, and postal
                  exchange risks
                </p>
              </div>
              <a href="/operations/network">
                Open logistics network <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="transport-metrics">
              <div>
                <span>Handling units</span>
                <strong>{number.format(data.international.handlingUnits)}</strong>
                <small>{data.international.handlingExceptions} in exception</small>
              </div>
              <div>
                <span>Active consolidations</span>
                <strong>{number.format(data.international.activeConsolidations)}</strong>
                <small>{data.international.consolidationExceptions} in exception</small>
              </div>
              <div>
                <span>Insurance claims</span>
                <strong>{number.format(data.international.openInsuranceClaims)}</strong>
                <small>{data.international.insuranceClaims} total</small>
              </div>
              <div>
                <span>Postal items</span>
                <strong>{number.format(data.international.postalItems)}</strong>
                <small>{data.international.postalExceptions} held, lost, or damaged</small>
              </div>
              <div>
                <span>Postal dispatches</span>
                <strong>{number.format(data.international.postalDispatches)}</strong>
                <small>{data.international.delayedPostalDispatches} handovers late</small>
              </div>
              <div>
                <span>Customs filings</span>
                <strong>{number.format(data.international.customsFilings)}</strong>
                <small>{data.international.customsHolds} on hold</small>
              </div>
            </div>
            <div className="card-actions">
              <a href="/operations/network">Consolidation and hubs</a>
              <a href="/operations/insurance">Insurance and claims</a>
              <a href="/operations/postal">Postal exchange</a>
            </div>
          </section>

          <section className="report-panel domain-report" aria-labelledby="domain-title">
            <div className="report-heading report-heading--inline">
              <div>
                <h2 id="domain-title">Cross-domain activity</h2>
                <p>Current workload across every implemented business and control process</p>
              </div>
              <a href="/operations">
                Open process directory <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="domain-activity">
              {data.domainActivity.map((domain) => (
                <a href={domain.href} key={domain.key}>
                  <span>{domain.label}</span>
                  <strong>{number.format(domain.value)}</strong>
                  <small>{domain.context}</small>
                </a>
              ))}
            </div>
          </section>

          <div className="dashboard-secondary-grid">
            <section className="report-panel" aria-labelledby="inventory-title">
              <div className="report-heading">
                <div>
                  <h2 id="inventory-title">Inventory position</h2>
                  <p>{number.format(data.inventory.totalUnits)} units across all states</p>
                </div>
              </div>
              {inventoryRows.length === 0 ? (
                <p className="panel-empty">No inventory balances recorded.</p>
              ) : (
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th>State</th>
                      <th>Units</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRows.map(([state, value]) => (
                      <tr key={state}>
                        <td>{state.replaceAll('_', ' ').toLowerCase()}</td>
                        <td className="numeric">{number.format(value)}</td>
                        <td className="numeric">
                          {data.inventory.totalUnits
                            ? `${Math.round((value / data.inventory.totalUnits) * 100)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className="report-panel" aria-labelledby="finance-title">
              <div className="report-heading">
                <div>
                  <h2 id="finance-title">Financial control</h2>
                  <p>Posted commerce and settlement exposure</p>
                </div>
              </div>
              <dl className="metric-list">
                <div>
                  <dt>GMV</dt>
                  <dd>{money(data.finance.gmvMinor, data.finance.currency)}</dd>
                </div>
                <div>
                  <dt>Settlement exposure</dt>
                  <dd>{money(data.finance.settlementExposureMinor, data.finance.currency)}</dd>
                </div>
                <div>
                  <dt>Reserves</dt>
                  <dd>{money(data.finance.reservesMinor, data.finance.currency)}</dd>
                </div>
                <div>
                  <dt>Reconciliation difference</dt>
                  <dd className={data.finance.reconciliationDifferenceMinor ? 'text-risk' : ''}>
                    {money(data.finance.reconciliationDifferenceMinor, data.finance.currency)}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="report-panel" aria-labelledby="sla-title">
              <div className="report-heading">
                <div>
                  <h2 id="sla-title">Service objectives</h2>
                  <p>Latest measured reliability evidence</p>
                </div>
              </div>
              {data.slos.length === 0 ? (
                <p className="panel-empty">No service objectives configured.</p>
              ) : (
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th>Objective</th>
                      <th>Target</th>
                      <th>Actual</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slos.map((slo) => (
                      <tr key={slo.key}>
                        <td>
                          {slo.name}
                          <small>{slo.windowDays}-day window</small>
                        </td>
                        <td className="numeric">{slo.target}</td>
                        <td className="numeric">{slo.value ?? '—'}</td>
                        <td>
                          <span className={`status-word status-word--${slo.status.toLowerCase()}`}>
                            {slo.status.replaceAll('_', ' ').toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="dashboard-tertiary-grid">
            <section className="report-panel network-report" aria-labelledby="network-title">
              <div className="report-heading">
                <div>
                  <h2 id="network-title">Network intelligence</h2>
                  <p>Governed optimization activity in this reporting window</p>
                </div>
              </div>
              <dl className="network-metrics">
                <div>
                  <dt>Runs</dt>
                  <dd>{number.format(data.network.optimizationRuns)}</dd>
                </div>
                <div>
                  <dt>Proposed</dt>
                  <dd>{number.format(data.network.proposed)}</dd>
                </div>
                <div>
                  <dt>Approved</dt>
                  <dd>{number.format(data.network.approved)}</dd>
                </div>
                <div>
                  <dt>Executed</dt>
                  <dd>{number.format(data.network.executed)}</dd>
                </div>
                <div>
                  <dt>Rolled back</dt>
                  <dd>{number.format(data.network.rolledBack)}</dd>
                </div>
              </dl>
            </section>
            <section className="report-panel activity-report" aria-labelledby="activity-title">
              <div className="report-heading">
                <div>
                  <h2 id="activity-title">Recent governed activity</h2>
                  <p>Latest tenant audit evidence</p>
                </div>
              </div>
              {data.activity.length === 0 ? (
                <p className="panel-empty">No audit activity recorded.</p>
              ) : (
                <ol className="activity-list">
                  {data.activity.map((event, index) => (
                    <li key={`${event.occurredAt}-${index}`}>
                      <span>
                        <strong>{event.action.replaceAll('.', ' ')}</strong>
                        <small>{event.entityType}</small>
                      </span>
                      <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <footer className="dashboard-footer">
            <span>
              <i className={`legend-dot legend-dot--${error ? 'risk' : 'healthy'}`} />
              Data status: {error ? 'last good snapshot' : data.dataQuality.status}
            </span>
            <span>Automatic refresh every 60 seconds · Times shown in your local timezone</span>
          </footer>
        </>
      ) : null}
    </main>
  );
}
