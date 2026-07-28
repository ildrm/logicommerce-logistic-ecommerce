type AppHeaderProps = {
  active?: 'dashboard' | 'operations' | 'freight' | 'storefront' | 'platform' | 'account';
  compact?: boolean;
};

const links = [
  ['dashboard', '/dashboard', 'Dashboard'],
  ['operations', '/operations', 'Operations'],
  ['freight', '/freight', 'Freight'],
  ['storefront', '/storefront', 'Storefront'],
  ['platform', '/platform', 'Platform'],
  ['account', '/account', 'Account'],
] as const;

export function AppHeader({ active, compact = false }: AppHeaderProps) {
  return (
    <header className={`app-header${compact ? ' app-header--compact' : ''}`}>
      <a className="app-brand" href="/" aria-label="LogiCommerce home">
        <span className="app-brand__mark" aria-hidden="true">
          LC
        </span>
        <span>LogiCommerce</span>
      </a>
      <nav className="app-nav" aria-label="Primary navigation">
        {links.map(([key, href, label]) => (
          <a
            aria-current={active === key ? 'page' : undefined}
            className={active === key ? 'is-active' : undefined}
            href={href}
            key={key}
          >
            {label}
          </a>
        ))}
      </nav>
      <a className="header-action" href="http://localhost:8080/api/docs">
        API
        <span className="sr-only"> documentation</span>
      </a>
    </header>
  );
}
