const foundations = [
  ['Tenant isolation', 'Resolved request context and tenant-scoped repositories'],
  ['Immutable records', 'Stock, audit, and outbox foundations'],
  ['Operational runtime', 'Independent web, API, worker, and migration containers'],
  ['Provider safety', 'Mock adapters remain explicit and replaceable'],
] as const;

export default function HomePage() {
  return (
    <main id="main">
      <header className="masthead">
        <a className="brand" href="/" aria-label="LogiCommerce home">
          <span className="brand-mark" aria-hidden="true">
            L
          </span>
          <span>LogiCommerce</span>
        </a>
        <span className="phase">NETWORK OPERATIONS · PHASE 4–7</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Commerce × logistics operating system</p>
        <h1 id="page-title">
          One network.
          <br />
          Every route accountable.
        </h1>
        <p className="lede">
          A multi-tenant foundation for C2C, B2C, B2B, dropshipping, and 1PL–5PL operations—designed
          around explicit responsibility, auditable decisions, and safe execution.
        </p>
        <div className="actions">
          <a className="primary-action" href="/storefront">
            Shop catalog
          </a>
          <a className="primary-action" href="/account">
            Sign in
          </a>
          <a className="primary-action" href="/platform">
            View platform status
          </a>
          <a className="primary-action" href="/operations">
            Open operations
          </a>
          <a className="secondary-action" href="http://localhost:8080/api/docs">
            Explore API
          </a>
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">Current release</p>
          <h2 id="foundation-title">The rails before the routes.</h2>
          <p>
            Critical invariants are established before commerce workflows are allowed to depend on
            them.
          </p>
        </div>
        <div className="foundation-grid">
          {foundations.map(([title, detail], index) => (
            <article key={title}>
              <span aria-hidden="true">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>Default market: United States · Currency: USD · Storage timezone: UTC</footer>
    </main>
  );
}
