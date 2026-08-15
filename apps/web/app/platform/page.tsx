'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '../components/app-header';

const services = [
  ['Web application', 'Next.js application and reporting surfaces'],
  ['API gateway', 'Tenant-scoped commerce and logistics API'],
  ['Background worker', 'Transactional outbox publication and retries'],
  ['MySQL', 'Transactional system of record'],
  ['Redis', 'Queues, cache, and coordination'],
  ['Object storage', 'Documents, labels, and operational evidence'],
] as const;

export default function PlatformPage() {
  const [readiness, setReadiness] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [checkedAt, setCheckedAt] = useState('');

  useEffect(() => {
    async function check() {
      try {
        const response = await fetch('/api/v1/health/ready', { cache: 'no-store' });
        if (!response.ok) throw new Error('not ready');
        const result = (await response.json()) as { timestamp: string };
        setReadiness('ready');
        setCheckedAt(result.timestamp);
      } catch {
        setReadiness('unavailable');
        setCheckedAt(new Date().toISOString());
      }
    }
    void check();
  }, []);

  return (
    <main id="main" className="app-page platform-page">
      <AppHeader active="platform" />
      <div className="page-heading page-heading--split">
        <div>
          <h1>Platform health</h1>
          <p className="page-subtitle">
            Runtime dependencies and the services that support every operational flow.
          </p>
        </div>
        <div className={`readiness readiness--${readiness}`} role="status">
          <i />
          <span>
            <strong>
              {readiness === 'checking'
                ? 'Checking readiness'
                : readiness === 'ready'
                  ? 'API ready'
                  : 'Readiness unavailable'}
            </strong>
            {checkedAt
              ? `Checked ${new Date(checkedAt).toLocaleTimeString()}`
              : 'Connecting to the API'}
          </span>
        </div>
      </div>
      <section className="platform-layout">
        <div className="service-list" role="list" aria-label="Platform services">
          {services.map(([service, detail], index) => (
            <article role="listitem" key={service}>
              <span className="service-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h2>{service}</h2>
                <p>{detail}</p>
              </div>
              <span
                className={`service-state service-state--${index === 1 ? readiness : 'configured'}`}
              >
                {index === 1 ? readiness : 'configured'}
              </span>
            </article>
          ))}
        </div>
        <aside className="platform-aside">
          <h2>Operational access</h2>
          <p>
            Use the analytical dashboard for process health. Use the API reference for integration
            contracts and request examples.
          </p>
          <a href="/dashboard">
            Open dashboard <span aria-hidden="true">→</span>
          </a>
          <a href="/api/docs">
            Open API reference <span aria-hidden="true">→</span>
          </a>
        </aside>
      </section>
    </main>
  );
}
