const services = [
  ['Web', 'RUNNABLE', 'Next.js 16 App Router'],
  ['API', 'RUNNABLE', 'NestJS 11 + Fastify'],
  ['Worker', 'RUNNABLE', 'Outbox publication process'],
  ['MySQL', 'CONFIGURED', '8.4 LTS · InnoDB · utf8mb4'],
  ['Redis', 'CONFIGURED', 'Queues and cache'],
  ['Object storage', 'CONFIGURED', 'S3-compatible MinIO'],
] as const;

export default function PlatformPage() {
  return (
    <main id="main" className="platform-page">
      <nav aria-label="Breadcrumb">
        <a href="/">LogiCommerce</a> / Platform foundation
      </nav>
      <p className="eyebrow">Implementation evidence</p>
      <h1>Platform status</h1>
      <p className="lede">
        This surface reports implemented foundations only. Planned domains are never shown as
        complete.
      </p>
      <div className="service-table" role="table" aria-label="Platform services">
        {services.map(([service, status, detail]) => (
          <div className="service-row" role="row" key={service}>
            <strong role="cell">{service}</strong>
            <span className="status" role="cell">
              {status}
            </span>
            <span role="cell">{detail}</span>
          </div>
        ))}
      </div>
      <a className="secondary-action" href="/">
        Back to overview
      </a>
    </main>
  );
}
