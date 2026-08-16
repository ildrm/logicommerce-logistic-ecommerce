import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/account');
  const signInForm = page.getByRole('form', { name: 'Sign in' });
  await signInForm.getByLabel('Email', { exact: true }).fill('admin@demo.logicommerce.local');
  await signInForm.getByLabel('Password', { exact: true }).fill('ChangeMe-Local-Only-2026');
  await signInForm.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open dashboard' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('logicommerce_access')))
    .not.toBe('');
}

test('home and platform expose product and runtime state', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  await expect(page.getByRole('heading', { name: /one network/i })).toBeVisible();
  await page.getByRole('link', { name: 'Platform' }).click();
  await expect(page.getByRole('heading', { name: 'Platform health' })).toBeVisible();
  await expect(page.getByText('Transactional outbox publication and retries')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/API ready|Readiness unavailable/u);
});

test('tenant administrator can sign in and reach identity controls', async ({ page }, testInfo) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Secure sign in.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reset access' })).toBeVisible();

  const signInForm = page.getByRole('form', { name: 'Sign in' });
  await signInForm.getByLabel('Email', { exact: true }).fill('admin@demo.logicommerce.local');
  await signInForm.getByLabel('Password', { exact: true }).fill('ChangeMe-Local-Only-2026');
  await signInForm.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Identity & access' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active sessions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Multi-factor authentication' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tenant roles' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tenant users' })).toBeVisible();

  const suffix = `${Date.now()}-${testInfo.project.name}`;
  const roleName = `Browser role ${suffix}`;
  const createRoleForm = page.locator('form.inline-form');
  await createRoleForm.getByLabel('Role key').fill(`browser-role-${suffix}`);
  await createRoleForm.getByLabel('Display name').fill(roleName);
  await createRoleForm.getByRole('button', { name: 'Create role' }).click();
  const roleForm = page
    .locator('section[aria-labelledby="roles-title"] form.admin-item')
    .filter({ hasText: roleName });
  await expect(roleForm).toBeVisible();
  await roleForm.getByLabel('tenant.configure').check();
  await roleForm.getByRole('button', { name: 'Save grants' }).click();
  await expect(page.getByRole('status')).toContainText('Role grants updated');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Secure sign in.' })).toBeVisible();
});

test('storefront supports browse, search, and empty states', async ({ page }) => {
  await page.goto('/storefront');
  await expect(page.getByRole('heading', { name: 'Built for the field.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Modular Field Kit' })).toBeVisible();
  await expect(page.getByText(/\d+ available/u).first()).toBeVisible();

  await page.getByLabel('Search catalog').fill('a-result-that-does-not-exist');
  await expect(page.getByRole('heading', { name: 'No products found.' })).toBeVisible();
});

test('operations surface exposes product workflows without roadmap metadata', async ({ page }) => {
  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: 'Control every handoff.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fulfillment & delivery' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Peer marketplace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business procurement' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partner ecosystem' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Returns & financial control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Network orchestration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Governed optimization' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reliability & governance' })).toBeVisible();
  await expect(page.getByText(/phase \d|implementation evidence|current release/iu)).toHaveCount(0);
});

test('dashboard summarizes live tenant processes and remains accessible', async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await signIn(page);
  await page.getByRole('link', { name: 'Open dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard/u);
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
  await expect(page.getByText('System health', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order and fulfillment volume' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exceptions requiring attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Process health' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cross-domain activity' })).toBeVisible();
  for (const domain of [
    'Identity',
    'Catalog',
    'Commerce',
    'C2C',
    'B2B',
    'Shop APIs',
    '3PL / 4PL',
    'Optimization',
    'Reliability',
  ]) {
    await expect(page.getByText(domain, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Inventory position' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Financial control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service objectives' })).toBeVisible();
  await expect(page.getByText(/phase \d|implementation evidence|current release/iu)).toHaveCount(0);

  await page.getByRole('button', { name: '7 days' }).click();
  await expect(page).toHaveURL(/days=7/u);
  await expect(page.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  expect(browserErrors).toEqual([]);
});

test('freight customer and operations workspaces are responsive and actionable', async ({
  page,
}) => {
  await signIn(page);

  await page.goto('/freight');
  await expect(
    page.getByRole('heading', { name: 'Move large cargo with one accountable booking.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New transportation request' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Requests and quotes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bookings and movement' })).toBeVisible();
  await expect(page.getByLabel('Pickup city')).toBeEditable();

  await page.goto('/operations/freight');
  await expect(page.getByRole('heading', { name: 'Freight operations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Request review queue' })).toBeVisible();
  await page.getByRole('link', { name: 'Dispatch' }).click();
  await expect(page.getByRole('heading', { name: 'Driver coordination' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active driver contacts' })).toBeVisible();
  await page.getByRole('link', { name: 'Billing' }).click();
  await expect(page.getByRole('heading', { name: 'Billing operations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Canonical invoices' })).toBeVisible();
  await expect(page.getByText(/phase \d|implementation evidence|current release/iu)).toHaveCount(0);
});
