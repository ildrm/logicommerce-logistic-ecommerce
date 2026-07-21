import type { HealthStatus, ProblemDetails, TenantSummary } from '@logicommerce/api-contracts';

export class ApiProblem extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail);
  }
}

export class LogiCommerceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  health(): Promise<HealthStatus> {
    return this.request('/health/live');
  }

  currentTenant(tenantId: string): Promise<TenantSummary> {
    return this.request('/api/v1/tenants/current', { headers: { 'x-tenant-id': tenantId } });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      headers: { accept: 'application/json', ...init?.headers },
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new ApiProblem(body as ProblemDetails);
    return body as T;
  }
}
