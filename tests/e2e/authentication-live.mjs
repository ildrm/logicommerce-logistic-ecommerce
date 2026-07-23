import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

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

function apiAuthenticated(path, accessToken, init = {}, tenantId = tenantA) {
  return fetch(`${applicationUrl}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'x-tenant-id': tenantId,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...input]
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, '0'))
    .join('');
  return Buffer.from((bits.match(/.{8}/gu) ?? []).map((byte) => Number.parseInt(byte, 2)));
}

function totp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
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

async function verifyPhaseOneExitScenario() {
  const admin = await login();
  assert.equal(admin.response.status, 200);

  const rolesResponse = await apiAuthenticated('/identity/roles', admin.body.accessToken);
  assert.equal(rolesResponse.status, 200);
  const roles = await rolesResponse.json();
  const tenantAdmin = roles.find(({ key }) => key === 'tenant-admin');
  assert.ok(tenantAdmin);

  const suffix = Date.now();
  const credentialResponse = await apiAuthenticated(
    '/identity/credentials',
    admin.body.accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        name: `Phase One Exit Credential ${suffix}`,
        scopes: ['tenant.configure'],
      }),
    },
  );
  assert.equal(credentialResponse.status, 201);
  const credential = await credentialResponse.json();
  assert.match(credential.secret, new RegExp(`^${credential.keyPrefix}\\.`));
  const credentialList = await apiAuthenticated('/identity/credentials', admin.body.accessToken);
  assert.equal(credentialList.status, 200);
  const listedCredential = (await credentialList.json()).find(({ id }) => id === credential.id);
  assert.ok(listedCredential);
  assert.equal('secret' in listedCredential, false);
  const machineIdentity = await fetch(`${applicationUrl}/api/v1/identity/machine/me`, {
    headers: { 'x-api-key': credential.secret },
  });
  assert.equal(machineIdentity.status, 200);
  assert.deepEqual((await machineIdentity.json()).scopes, ['tenant.configure']);
  assert.equal(
    (
      await apiAuthenticated(`/identity/credentials/${credential.id}`, admin.body.accessToken, {
        method: 'DELETE',
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await fetch(`${applicationUrl}/api/v1/identity/machine/me`, {
        headers: { 'x-api-key': credential.secret },
      })
    ).status,
    401,
  );
  const revokedCredentials = await (
    await apiAuthenticated('/identity/credentials', admin.body.accessToken)
  ).json();
  assert.ok(revokedCredentials.find(({ id, revokedAt }) => id === credential.id && revokedAt));

  const phaseAdmin = {
    email: `phase-one-${suffix}@demo.logicommerce.local`,
    password: 'Phase-One-Local-2026!',
  };
  const createdUser = await apiAuthenticated('/identity/users', admin.body.accessToken, {
    method: 'POST',
    body: JSON.stringify({
      ...phaseAdmin,
      displayName: 'Phase One Exit Admin',
      roleIds: [tenantAdmin.id],
    }),
  });
  assert.equal(createdUser.status, 201);

  const first = await login(phaseAdmin.password, phaseAdmin);
  assert.equal(first.response.status, 200);
  const enrollment = await apiAuthenticated('/auth/mfa/totp/enroll', first.body.accessToken, {
    method: 'POST',
  });
  assert.equal(enrollment.status, 201, await enrollment.clone().text());
  const enrollmentBody = await enrollment.json();
  const confirmation = await apiAuthenticated('/auth/mfa/totp/confirm', first.body.accessToken, {
    method: 'POST',
    body: JSON.stringify({ code: totp(enrollmentBody.secret) }),
  });
  assert.equal(confirmation.status, 201);
  const { recoveryCodes } = await confirmation.json();
  assert.equal(recoveryCodes.length, 8);

  const roleCreation = await apiAuthenticated('/identity/roles', first.body.accessToken, {
    method: 'POST',
    body: JSON.stringify({ key: `exit-role-${suffix}`, name: 'Exit Scenario Role' }),
  });
  assert.equal(roleCreation.status, 201);
  const role = await roleCreation.json();
  const grant = await apiAuthenticated(
    `/identity/roles/${role.id}/permissions`,
    first.body.accessToken,
    { method: 'PUT', body: JSON.stringify({ permissionKeys: ['tenant.configure'] }) },
  );
  assert.equal(grant.status, 200);

  const missingMfa = await login(phaseAdmin.password, phaseAdmin);
  assert.equal(missingMfa.response.status, 401);
  const recovered = await login(phaseAdmin.password, { ...phaseAdmin, mfaCode: recoveryCodes[0] });
  assert.equal(recovered.response.status, 200);
  const replayedRecovery = await login(phaseAdmin.password, {
    ...phaseAdmin,
    mfaCode: recoveryCodes[0],
  });
  assert.equal(replayedRecovery.response.status, 401);

  const sessionsResponse = await apiAuthenticated('/auth/sessions', recovered.body.accessToken);
  assert.equal(sessionsResponse.status, 200);
  const sessions = await sessionsResponse.json();
  const otherSession = sessions.find(({ current }) => !current);
  assert.ok(otherSession);
  assert.equal(
    (
      await apiAuthenticated(`/auth/sessions/${otherSession.id}`, recovered.body.accessToken, {
        method: 'DELETE',
      })
    ).status,
    204,
  );

  assert.equal(
    (await apiAuthenticated('/identity/users', recovered.body.accessToken, {}, tenantB)).status,
    401,
  );

  const verificationRequest = await apiAuthenticated(
    '/auth/email-verification/request',
    recovered.body.accessToken,
    { method: 'POST' },
  );
  assert.equal(verificationRequest.status, 201);
  const verificationPreview = await apiAuthenticated(
    `/identity/delivery-preview?email=${encodeURIComponent(phaseAdmin.email)}&purpose=EMAIL_VERIFICATION`,
    admin.body.accessToken,
  );
  assert.equal(verificationPreview.status, 200);
  const verificationToken = (await verificationPreview.json()).token;
  assert.equal(
    (
      await fetch(`${baseUrl}/email-verification/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      })
    ).status,
    204,
  );

  const resetRequest = await fetch(`${baseUrl}/password-reset/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: phaseAdmin.email }),
  });
  assert.equal(resetRequest.status, 201);
  const resetPreview = await apiAuthenticated(
    `/identity/delivery-preview?email=${encodeURIComponent(phaseAdmin.email)}&purpose=PASSWORD_RESET`,
    admin.body.accessToken,
  );
  const resetToken = (await resetPreview.json()).token;
  const nextPassword = 'Phase-One-Rotated-2026!';
  assert.equal(
    (
      await fetch(`${baseUrl}/password-reset/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: nextPassword }),
      })
    ).status,
    204,
  );
  assert.equal((await login(phaseAdmin.password, phaseAdmin)).response.status, 401);
  assert.equal(
    (await login(nextPassword, { ...phaseAdmin, mfaCode: recoveryCodes[1] })).response.status,
    200,
  );

  const passwordlessRequest = await fetch(`${baseUrl}/passwordless/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: phaseAdmin.email }),
  });
  assert.equal(passwordlessRequest.status, 201);
  const passwordlessPreview = await apiAuthenticated(
    `/identity/delivery-preview?email=${encodeURIComponent(phaseAdmin.email)}&purpose=PASSWORDLESS_LOGIN`,
    admin.body.accessToken,
  );
  const passwordlessToken = (await passwordlessPreview.json()).token;
  const passwordless = await fetch(`${baseUrl}/passwordless/consume`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: passwordlessToken, mfaCode: recoveryCodes[2] }),
  });
  assert.equal(passwordless.status, 201);
  assert.equal(
    (
      await fetch(`${baseUrl}/passwordless/consume`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: passwordlessToken, mfaCode: recoveryCodes[3] }),
      })
    ).status,
    400,
  );
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
await verifyPhaseOneExitScenario();
await verifyLoginRateLimit();

console.log('Live authentication integration: passed');
