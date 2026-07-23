import { AppHeader } from './components/app-header';

const capabilities = [
  ['Commerce', 'Catalog, offers, cart, checkout, and orders'],
  ['Fulfillment', 'Warehouse execution, carrier handoff, and tracking'],
  ['Marketplaces', 'C2C protection and B2B procurement workflows'],
  ['Network control', '3PL billing, governed routing, and optimization'],
  ['Financial control', 'Returns, journals, settlements, and reconciliation'],
  ['Reliability', 'Service objectives, recovery evidence, and privacy operations'],
] as const;

export default function HomePage() {
  return (
    <main id="main" className="app-page home-page">
      <AppHeader />
      <section className="home-hero" aria-labelledby="page-title">
        <div>
          <h1 id="page-title">One network. Every handoff accountable.</h1>
          <p>
            Run commerce, fulfillment, partner operations, returns, finance, and logistics from one
            tenant-scoped operating system.
          </p>
          <div className="actions">
            <a className="button button--primary" href="/dashboard">Open dashboard</a>
            <a className="button button--secondary" href="/storefront">Browse storefront</a>
          </div>
        </div>
        <aside className="home-brief" aria-label="Operational promise">
          <strong>See the whole flow.</strong>
          <p>Monitor current workload, spot exceptions, and move directly from evidence to the responsible process.</p>
          <a href="/operations">Explore operations <span aria-hidden="true">→</span></a>
        </aside>
      </section>
      <section className="capability-list" aria-labelledby="capability-title">
        <div className="section-intro">
          <h2 id="capability-title">Connected by design.</h2>
          <p>Each domain keeps its own controls while contributing evidence to one analytical view.</p>
        </div>
        <div>
          {capabilities.map(([title, description]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="site-footer">Default market: United States · Currency: USD · Storage timezone: UTC</footer>
    </main>
  );
}
