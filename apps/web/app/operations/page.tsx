const domains = [
  {
    phase: '04',
    title: 'Fulfillment control',
    state: 'OPERATIONAL',
    summary:
      'ASN receiving, inspection, putaway, picking, packing, labels, manifests, and tracking.',
    stages: ['Receive', 'Inspect', 'Put away', 'Pick', 'Pack', 'Label', 'Dispatch', 'Deliver'],
  },
  {
    phase: '05',
    title: 'Peer marketplace',
    state: 'OPERATIONAL',
    summary:
      'Verified sellers, moderated listings, negotiation, protection, disputes, payouts, reviews.',
    stages: ['Verify', 'List', 'Moderate', 'Negotiate', 'Ship', 'Protect', 'Release', 'Review'],
  },
  {
    phase: '06',
    title: 'Business procurement',
    state: 'OPERATIONAL',
    summary:
      'Accounts, controlled buyers, contract prices, RFQs, quotes, approvals, POs, and invoices.',
    stages: ['Account', 'Price', 'RFQ', 'Quote', 'Approve', 'PO', 'Fulfill', 'Invoice'],
  },
  {
    phase: '07',
    title: 'Partner integrations',
    state: 'OPERATIONAL',
    summary:
      'Scoped credentials, idempotent Shop orders, signed webhooks, retries, dead letters, replay.',
    stages: ['Issue', 'Scope', 'Read', 'Submit', 'Fulfill', 'Sign', 'Retry', 'Replay'],
  },
  {
    phase: '08',
    title: 'Returns and finance',
    state: 'OPERATIONAL',
    summary:
      'RMA approval, reverse labels, inspection, disposition, refunds, journals, settlements, and reconciliation.',
    stages: ['Request', 'Approve', 'Receive', 'Inspect', 'Resolve', 'Post', 'Settle', 'Reconcile'],
  },
  {
    phase: '09',
    title: '3PL and 4PL control',
    state: 'OPERATIONAL',
    summary:
      'Isolated client inventory and billing with human-approved, fully audited network rerouting.',
    stages: ['Contract', 'Allocate', 'Operate', 'Bill', 'Detect', 'Compare', 'Approve', 'Reroute'],
  },
  {
    phase: '10',
    title: 'Governed optimization',
    state: 'OPERATIONAL',
    summary:
      'Frozen inputs, deterministic alternatives, explainable scoring, approval, outcome measurement, and rollback.',
    stages: [
      'Version',
      'Freeze',
      'Constrain',
      'Rank',
      'Explain',
      'Approve',
      'Measure',
      'Roll back',
    ],
  },
  {
    phase: '11',
    title: 'Production readiness',
    state: 'OPERATIONAL',
    summary:
      'Metrics, SLO evidence, recovery drills, retention, legal hold, privacy workflows, and hardened ingress.',
    stages: ['Observe', 'Alert', 'Exercise', 'Restore', 'Retain', 'Hold', 'Respond', 'Evidence'],
  },
] as const;

const metrics = [
  ['8', 'active domain surfaces'],
  ['42', 'deny-by-default permissions'],
  ['15 min', 'recovery point objective'],
  ['60 min', 'recovery time objective'],
] as const;

export default function OperationsPage() {
  return (
    <main id="main" className="operations-page">
      <header className="operations-header">
        <div>
          <a className="brand" href="/" aria-label="LogiCommerce home">
            <span className="brand-mark" aria-hidden="true">
              L
            </span>
            <span>LogiCommerce</span>
          </a>
          <p className="eyebrow">Network operations · Phases 4–11</p>
          <h1>Execution, with receipts.</h1>
        </div>
        <nav aria-label="Operations navigation">
          <a href="/storefront">Storefront</a>
          <a href="/account">Identity</a>
          <a href="/platform">Platform</a>
          <a href="http://localhost:8080/api/docs">API</a>
        </nav>
      </header>

      <section className="metric-strip" aria-label="Release safeguards">
        {metrics.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="domain-list" aria-labelledby="domain-title">
        <div className="section-heading">
          <p className="eyebrow">Implemented workflows</p>
          <h2 id="domain-title">From dock door to governed network.</h2>
        </div>
        {domains.map((domain) => (
          <article className="domain-row" key={domain.phase}>
            <div className="domain-index">{domain.phase}</div>
            <div className="domain-copy">
              <div className="domain-title">
                <h3>{domain.title}</h3>
                <span className="status">{domain.state}</span>
              </div>
              <p>{domain.summary}</p>
              <ol className="stage-rail" aria-label={`${domain.title} workflow`}>
                {domain.stages.map((stage) => (
                  <li key={stage}>{stage}</li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </section>

      <footer>
        Tenant-scoped persistence · Append-only evidence · Explicit workflow transitions
      </footer>
    </main>
  );
}
