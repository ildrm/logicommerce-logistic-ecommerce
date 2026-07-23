import { AppHeader } from '../components/app-header';

const domains = [
  {
    key: 'fulfillment',
    title: 'Fulfillment & delivery',
    summary: 'Inbound receiving, warehouse execution, carrier handoff, and end-to-end tracking.',
    stages: ['Receive', 'Inspect', 'Put away', 'Pick', 'Pack', 'Dispatch', 'Deliver'],
  },
  {
    key: 'c2c',
    title: 'Peer marketplace',
    summary: 'Seller verification, listing moderation, buyer protection, disputes, payouts, and reviews.',
    stages: ['Verify', 'List', 'Moderate', 'Negotiate', 'Ship', 'Protect', 'Release'],
  },
  {
    key: 'b2b',
    title: 'Business procurement',
    summary: 'Contract pricing, RFQs, quotes, controlled approvals, purchase orders, and invoicing.',
    stages: ['Account', 'Price', 'RFQ', 'Quote', 'Approve', 'Fulfill', 'Invoice'],
  },
  {
    key: 'integrations',
    title: 'Partner ecosystem',
    summary: 'Scoped credentials, Shop orders, signed webhooks, retries, dead letters, and replay.',
    stages: ['Authorize', 'Scope', 'Submit', 'Fulfill', 'Sign', 'Retry', 'Replay'],
  },
  {
    key: 'returns',
    title: 'Returns & financial control',
    summary: 'Reverse logistics, disposition, refunds, journals, settlements, and reconciliation.',
    stages: ['Request', 'Approve', 'Receive', 'Inspect', 'Resolve', 'Post', 'Settle'],
  },
  {
    key: 'network',
    title: 'Network orchestration',
    summary: 'Client-isolated logistics, billable events, control-tower exceptions, and governed rerouting.',
    stages: ['Contract', 'Allocate', 'Operate', 'Bill', 'Detect', 'Approve', 'Reroute'],
  },
  {
    key: 'optimization',
    title: 'Governed optimization',
    summary: 'Frozen inputs, deterministic alternatives, explainable scoring, outcome measurement, and rollback.',
    stages: ['Version', 'Freeze', 'Constrain', 'Rank', 'Explain', 'Measure', 'Rollback'],
  },
  {
    key: 'reliability',
    title: 'Reliability & governance',
    summary: 'Service objectives, recovery exercises, retention, legal hold, and privacy workflows.',
    stages: ['Observe', 'Alert', 'Exercise', 'Restore', 'Retain', 'Respond', 'Evidence'],
  },
] as const;

export default function OperationsPage() {
  return (
    <main id="main" className="app-page operations-page">
      <AppHeader active="operations" />
      <div className="page-heading operations-heading">
        <div>
          <h1>Control every handoff.</h1>
          <p className="page-subtitle">A process directory for commerce, logistics, finance, partner, and governance workflows.</p>
        </div>
        <a className="button button--primary" href="/dashboard">View operational health</a>
      </div>
      <section className="operations-summary" aria-label="How to use operations">
        <div><strong>Monitor</strong><span>See exceptions and thresholds in the dashboard.</span></div>
        <div><strong>Investigate</strong><span>Follow the affected process and its evidence.</span></div>
        <div><strong>Act safely</strong><span>Use explicit transitions, approvals, and audit trails.</span></div>
      </section>
      <section className="workflow-directory" aria-labelledby="workflow-title">
        <div className="section-intro">
          <h2 id="workflow-title">Operational workflows</h2>
          <p>Each lane shows the key handoffs monitored by the analytical dashboard.</p>
        </div>
        <div className="workflow-list">
          {domains.map((domain) => (
            <article id={domain.key} key={domain.key}>
              <div className="workflow-copy"><h3>{domain.title}</h3><p>{domain.summary}</p></div>
              <ol className="workflow-stages" aria-label={`${domain.title} stages`}>
                {domain.stages.map((stage) => <li key={stage}>{stage}</li>)}
              </ol>
              <a href={`/dashboard?focus=${domain.key}`}>View signals <span aria-hidden="true">→</span></a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
