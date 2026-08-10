const api = '/api/v1';
let refreshInFlight: Promise<string> | undefined;

export function accessToken(): string {
  return typeof window === 'undefined'
    ? ''
    : (window.sessionStorage.getItem('logicommerce_access') ?? '');
}

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const response = await fetch(`${api}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      window.sessionStorage.removeItem('logicommerce_access');
      throw new Error('Your session expired. Sign in again.');
    }
    const result = (await response.json()) as { accessToken?: unknown };
    if (typeof result.accessToken !== 'string' || !result.accessToken) {
      window.sessionStorage.removeItem('logicommerce_access');
      throw new Error('The refreshed session was invalid. Sign in again.');
    }
    window.sessionStorage.setItem('logicommerce_access', result.accessToken);
    return result.accessToken;
  })().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

async function send(path: string, init: RequestInit, token: string) {
  return fetch(`${api}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
}

export async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = accessToken();
  if (!token) throw new Error('Sign in is required.');
  let response = await send(path, init, token);
  if (response.status === 401) response = await send(path, init, await refreshAccessToken());
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(problem?.detail ?? 'The request could not be completed.');
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
