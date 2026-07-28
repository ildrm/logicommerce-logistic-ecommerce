const api = '/api/v1';

export function accessToken(): string {
  return typeof window === 'undefined'
    ? ''
    : (window.sessionStorage.getItem('logicommerce_access') ?? '');
}

export async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = accessToken();
  if (!token) throw new Error('Sign in is required.');
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(problem?.detail ?? 'The request could not be completed.');
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
