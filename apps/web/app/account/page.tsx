'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AppHeader } from '../components/app-header';

type User = { id: string; email: string; displayName: string; permissions: string[] };
type Session = { id: string; lastSeenAt: string; expiresAt: string; current: boolean };
type Permission = { id: string; key: string; description?: string | null };
type Role = {
  id: string;
  key: string;
  name: string;
  _count: { users: number };
  permissions: { permission: Permission }[];
};
type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  userRoles: { role: Pick<Role, 'id' | 'key' | 'name'> }[];
};

const api = '/api/v1';

export default function AccountPage() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem('logicommerce_access') ?? '';
    if (stored) void hydrate(stored);
  }, []);

  async function request(
    path: string,
    init: RequestInit = {},
    accessToken = token,
  ): Promise<unknown> {
    const response = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(problem?.detail ?? 'The request could not be completed.');
    }
    return response.status === 204 ? null : ((await response.json()) as unknown);
  }

  async function hydrate(accessToken: string) {
    try {
      const current = (await request('/auth/me', {}, accessToken)) as User;
      const activeSessions = (await request('/auth/sessions', {}, accessToken)) as Session[];
      setToken(accessToken);
      setUser(current);
      setSessions(activeSessions);
      if (current.permissions.includes('identity.roles.manage')) {
        setRoles((await request('/identity/roles', {}, accessToken)) as Role[]);
        setPermissions((await request('/identity/permissions', {}, accessToken)) as Permission[]);
      }
      if (current.permissions.includes('identity.users.manage')) {
        setManagedUsers((await request('/identity/users', {}, accessToken)) as ManagedUser[]);
      }
    } catch (error) {
      window.sessionStorage.removeItem('logicommerce_access');
      setToken('');
      setUser(null);
      setMessage(error instanceof Error ? error.message : 'Your session has expired.');
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const result = (await request(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: form.get('email'),
            password: form.get('password'),
            ...(form.get('mfaCode') ? { mfaCode: form.get('mfaCode') } : {}),
          }),
        },
        '',
      )) as { accessToken: string };
      window.sessionStorage.setItem('logicommerce_access', result.accessToken);
      await hydrate(result.accessToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('resetEmail');
    await request(
      '/auth/password-reset/request',
      { method: 'POST', body: JSON.stringify({ email }) },
      '',
    );
    setMessage('If that account exists, reset instructions have been sent.');
  }

  async function revoke(sessionId: string) {
    await request(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
    setSessions(sessions.filter(({ id }) => id !== sessionId));
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const role = (await request('/identity/roles', {
      method: 'POST',
      body: JSON.stringify({ key: form.get('key'), name: form.get('name') }),
    })) as Role;
    setRoles([...roles, { ...role, permissions: [], _count: { users: 0 } }]);
    event.currentTarget.reset();
    setMessage('Role created. Select its grants below.');
  }

  async function updateRolePermissions(event: FormEvent<HTMLFormElement>, roleId: string) {
    event.preventDefault();
    const permissionKeys = new FormData(event.currentTarget).getAll('permissionKey').map(String);
    await request(`/identity/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionKeys }),
    });
    setRoles(
      roles.map((role) =>
        role.id === roleId
          ? {
              ...role,
              permissions: permissions
                .filter(({ key }) => permissionKeys.includes(key))
                .map((permission) => ({ permission })),
            }
          : role,
      ),
    );
    setMessage('Role grants updated. Sessions using that role were revoked.');
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request('/identity/users', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        displayName: form.get('displayName'),
        password: form.get('password'),
        roleIds: form.getAll('roleId').map(String),
      }),
    });
    setManagedUsers((await request('/identity/users')) as ManagedUser[]);
    event.currentTarget.reset();
    setMessage('Tenant user created. Verification can now be requested.');
  }

  async function updateUserRoles(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    const roleIds = new FormData(event.currentTarget).getAll('roleId').map(String);
    await request(`/identity/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    });
    setManagedUsers(
      managedUsers.map((managedUser) =>
        managedUser.id === userId
          ? {
              ...managedUser,
              userRoles: roles.filter(({ id }) => roleIds.includes(id)).map((role) => ({ role })),
            }
          : managedUser,
      ),
    );
    setMessage('User roles updated. That user’s active sessions were revoked.');
  }

  async function enrollMfa() {
    setMfaSetup(
      (await request('/auth/mfa/totp/enroll', { method: 'POST' })) as {
        secret: string;
        otpauthUri: string;
      },
    );
  }

  async function confirmMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('code');
    const result = (await request('/auth/mfa/totp/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })) as { recoveryCodes: string[] };
    setRecoveryCodes(result.recoveryCodes);
    setMfaSetup(null);
    setMessage('MFA enabled. Save the recovery codes now; they are shown once.');
  }

  async function logout() {
    await request('/auth/logout', { method: 'POST' });
    window.sessionStorage.removeItem('logicommerce_access');
    setToken('');
    setUser(null);
  }

  return (
    <main id="main" className="account-page">
      <AppHeader active="account" />
      <div className="page-heading account-heading">
        <div>
          <h1>{user ? 'Identity & access' : 'Secure sign in.'}</h1>
          <p className="page-subtitle">
            {user
              ? `Signed in as ${user.displayName}. Manage authentication, devices, users, and authorization.`
              : 'Access your tenant workspace and protected operational tools.'}
          </p>
        </div>
        {user ? (
          <a className="button button--primary" href="/dashboard">
            Open dashboard
          </a>
        ) : null}
      </div>
      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      {!user ? (
        <div className="account-grid">
          <form
            className="panel"
            onSubmit={(event) => void signIn(event)}
            aria-labelledby="sign-in-title"
          >
            <h2 id="sign-in-title">Sign in</h2>
            <label>
              Email
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <label>
              MFA or recovery code <span>(when enabled)</span>
              <input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" />
            </label>
            <button disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <form
            className="panel secondary-panel"
            onSubmit={(event) => void requestReset(event)}
            aria-labelledby="reset-title"
          >
            <h2 id="reset-title">Reset access</h2>
            <p>We always return the same response to protect account privacy.</p>
            <label>
              Email
              <input name="resetEmail" type="email" autoComplete="email" required />
            </label>
            <button type="submit">Request reset</button>
          </form>
        </div>
      ) : (
        <div className="account-grid">
          <section className="panel" aria-labelledby="sessions-title">
            <h2 id="sessions-title">Active sessions</h2>
            {sessions.length === 0 ? (
              <p>No active sessions.</p>
            ) : (
              sessions.map((session) => (
                <div className="session-row" key={session.id}>
                  <div>
                    <strong>{session.current ? 'This device' : 'Other device'}</strong>
                    <small>Last active {new Date(session.lastSeenAt).toLocaleString()}</small>
                  </div>
                  {!session.current ? (
                    <button className="quiet-button" onClick={() => void revoke(session.id)}>
                      Revoke
                    </button>
                  ) : null}
                </div>
              ))
            )}
            <button className="quiet-button" onClick={() => void logout()}>
              Sign out
            </button>
          </section>

          <section className="panel" aria-labelledby="mfa-title">
            <h2 id="mfa-title">Multi-factor authentication</h2>
            {!mfaSetup && recoveryCodes.length === 0 ? (
              <button onClick={() => void enrollMfa()}>Set up authenticator</button>
            ) : null}
            {mfaSetup ? (
              <form onSubmit={(event) => void confirmMfa(event)}>
                <p>Enter this secret in your authenticator:</p>
                <code>{mfaSetup.secret}</code>
                <label>
                  Six-digit code
                  <input name="code" inputMode="numeric" pattern="[0-9]{6}" required />
                </label>
                <button type="submit">Confirm MFA</button>
              </form>
            ) : null}
            {recoveryCodes.length > 0 ? (
              <div>
                <h3>Recovery codes</h3>
                <ul className="recovery-list">
                  {recoveryCodes.map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {user.permissions.includes('identity.roles.manage') ? (
            <section className="panel wide-panel" aria-labelledby="roles-title">
              <h2 id="roles-title">Tenant roles</h2>
              <div className="role-list">
                {roles.map((role) => (
                  <form
                    className="admin-item"
                    key={role.id}
                    onSubmit={(event) => void updateRolePermissions(event, role.id)}
                  >
                    <div>
                      <strong>{role.name}</strong>
                      <span>
                        {role.key} · {role._count.users} users
                      </span>
                    </div>
                    <fieldset>
                      <legend>Permission grants</legend>
                      <div className="permission-grid">
                        {permissions.map((permission) => (
                          <label key={permission.id}>
                            <input
                              defaultChecked={role.permissions.some(
                                ({ permission: grant }) => grant.key === permission.key,
                              )}
                              name="permissionKey"
                              type="checkbox"
                              value={permission.key}
                            />
                            {permission.key}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button className="quiet-button" type="submit">
                      Save grants
                    </button>
                  </form>
                ))}
              </div>
              <form className="inline-form" onSubmit={(event) => void createRole(event)}>
                <label>
                  Role key
                  <input name="key" pattern="[a-z][a-z0-9-]+" required />
                </label>
                <label>
                  Display name
                  <input name="name" required />
                </label>
                <button type="submit">Create role</button>
              </form>
            </section>
          ) : null}

          {user.permissions.includes('identity.users.manage') ? (
            <section className="panel wide-panel" aria-labelledby="users-title">
              <h2 id="users-title">Tenant users</h2>
              <div className="role-list">
                {managedUsers.map((managedUser) => (
                  <form
                    className="admin-item"
                    key={managedUser.id}
                    onSubmit={(event) => void updateUserRoles(event, managedUser.id)}
                  >
                    <div>
                      <strong>{managedUser.displayName}</strong>
                      <span>
                        {managedUser.email} · {managedUser.isActive ? 'active' : 'inactive'}
                      </span>
                    </div>
                    <fieldset>
                      <legend>Assigned roles</legend>
                      <div className="permission-grid">
                        {roles.map((role) => (
                          <label key={role.id}>
                            <input
                              defaultChecked={managedUser.userRoles.some(
                                ({ role: assignment }) => assignment.id === role.id,
                              )}
                              name="roleId"
                              type="checkbox"
                              value={role.id}
                            />
                            {role.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button className="quiet-button" type="submit">
                      Save roles
                    </button>
                  </form>
                ))}
              </div>
              <form className="user-form" onSubmit={(event) => void createUser(event)}>
                <h3>Create tenant user</h3>
                <label>
                  Display name
                  <input name="displayName" minLength={2} required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Temporary password
                  <input name="password" type="password" minLength={12} required />
                </label>
                <fieldset>
                  <legend>Initial roles</legend>
                  <div className="permission-grid">
                    {roles.map((role) => (
                      <label key={role.id}>
                        <input name="roleId" type="checkbox" value={role.id} />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button type="submit">Create user</button>
              </form>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
