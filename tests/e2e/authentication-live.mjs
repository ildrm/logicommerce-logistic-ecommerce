import assert from 'node:assert/strict';

const applicationUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const baseUrl = `${applicationUrl}/api/v1/auth`;
const tenantA = '00000000-0000-4000-8000-000000000001';
const tenantB = '00000000-0000-4000-8000-000000000009';
const credentials = {
  email: 'admin@demo.logicommerce.local',
  password: 'ChangeMe-Local-Only-2026',
};
const viewerCredentials = {
  email: 'viewer@demo.logicommerce.local',
  password: credentials.password,
};

function refreshCookie(response) {
  const value = response.headers.get('set-cookie');
  assert.match(value ?? '', /HttpOnly/u);
  assert.match(value ?? '', /SameSite=Strict/u);
  return value.split(';', 1)[0];
}

async function login(password = credentials.password, loginCredentials = credentials) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...loginCredentials, password }),
  });
  const body = await response.json();
  return { response, body, cookie: response.ok ? refreshCookie(response) : undefined };
}

function authenticated(path, accessToken, init = {}, tenantId = tenantA) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'x-tenant-id': tenantId,
      ...init.headers,
    },
  });
}

async function refresh(cookie) {
  return fetch(`${baseUrl}/refresh`, {
    method: 'POST',
    headers: { cookie },
  });
}

async function verifyPermissionPolicy() {
  const admin = await login();
  assert.equal(admin.response.status, 200);
  const adminResponse = await fetch(`${applicationUrl}/api/v1/tenants/current`, {
    headers: { authorization: `Bearer ${admin.body.accessToken}` },
  });
  assert.equal(adminResponse.status, 200);

  const viewer = await login(viewerCredentials.password, viewerCredentials);
  assert.equal(viewer.response.status, 200);
  const viewerResponse = await fetch(`${applicationUrl}/api/v1/tenants/current`, {
    headers: { authorization: `Bearer ${viewer.body.accessToken}` },
  });
  assert.equal(viewerResponse.status, 403);
}

async function verifyLoginRateLimit() {
  const unknownCredentials = {
    email: `unknown-${Date.now()}@demo.logicommerce.local`,
    password: 'definitely-the-wrong-password',
  };

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const result = await login(unknownCredentials.password, unknownCredentials);
    assert.equal(result.response.status, 401);
  }
  const limited = await login(unknownCredentials.password, unknownCredentials);
  assert.equal(limited.response.status, 429);
}

async function verifyCoreFlow() {
  const first = await login();
  assert.equal(first.response.status, 200);
  assert.equal(first.body.tokenType, 'Bearer');
  assert.equal(first.body.expiresIn, 900);
  assert.equal(typeof first.body.accessToken, 'string');
  assert.ok(!JSON.stringify(first.body).includes('passwordHash'));

  const me = await authenticated('/me', first.body.accessToken);
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.tenantId, tenantA);
  assert.ok(meBody.permissions.includes('tenant.configure'));
  assert.equal((await authenticated('/me', first.body.accessToken, {}, tenantB)).status, 401);

  const rotated = await refresh(first.cookie);
  assert.equal(rotated.status, 200);
  const rotatedBody = await rotated.json();
  const rotatedCookie = refreshCookie(rotated);
  assert.equal((await refresh(first.cookie)).status, 401);
  assert.equal((await refresh(rotatedCookie)).status, 401);
  assert.equal((await authenticated('/me', rotatedBody.accessToken)).status, 401);

  const invalid = await login('definitely-the-wrong-password');
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.response.headers.get('set-cookie'), null);

  const sessionOne = await login();
  const sessionTwo = await login();
  const sessionsResponse = await authenticated('/sessions', sessionTwo.body.accessToken);
  assert.equal(sessionsResponse.status, 200);
  const sessions = await sessionsResponse.json();
  const other = sessions.find((session) => !session.current);
  assert.ok(other);
  assert.equal(
    (
      await authenticated(`/sessions/${other.id}`, sessionTwo.body.accessToken, {
        method: 'DELETE',
      })
    ).status,
    204,
  );
  assert.equal((await authenticated('/me', sessionOne.body.accessToken)).status, 401);
  assert.equal((await authenticated('/me', sessionTwo.body.accessToken)).status, 200);

  const logout = await authenticated('/logout', sessionTwo.body.accessToken, { method: 'POST' });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/u);
  assert.equal((await authenticated('/me', sessionTwo.body.accessToken)).status, 401);

  const allOne = await login();
  const allTwo = await login();
  assert.equal(
    (await authenticated('/logout-all', allTwo.body.accessToken, { method: 'POST' })).status,
    204,
  );
  assert.equal((await authenticated('/me', allOne.body.accessToken)).status, 401);
  assert.equal((await authenticated('/me', allTwo.body.accessToken)).status, 401);
}

async function verifyConcurrentReuse() {
  const raceLogin = await login();
  assert.equal(raceLogin.response.status, 200);
  const responses = await Promise.all([refresh(raceLogin.cookie), refresh(raceLogin.cookie)]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 401]);

  const successful = responses.find(({ status }) => status === 200);
  assert.ok(successful);
  const successfulBody = await successful.json();
  const replacementCookie = refreshCookie(successful);
  assert.equal((await refresh(replacementCookie)).status, 401);
  assert.equal((await authenticated('/me', successfulBody.accessToken)).status, 401);
}

await verifyCoreFlow();
await verifyConcurrentReuse();
await verifyPermissionPolicy();
await verifyLoginRateLimit();

console.log('Live authentication integration: passed');
