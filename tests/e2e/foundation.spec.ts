import { expect, test } from '@playwright/test';

test('foundation identifies implemented boundaries', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /one network/i })).toBeVisible();
  await page.getByRole('link', { name: 'View platform status' }).click();
  await expect(page.getByRole('heading', { name: 'Platform status' })).toBeVisible();
  await expect(page.getByText('Outbox publication process')).toBeVisible();
});

test('tenant administrator can sign in and reach identity controls', async ({ page }, testInfo) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Secure sign in.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reset access' })).toBeVisible();

  await page.getByLabel('Email').first().fill('admin@demo.logicommerce.local');
  await page.getByLabel('Password').fill('ChangeMe-Local-Only-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
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

test('operations surface exposes the Phase 4-11 execution rails', async ({ page }) => {
  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: 'Execution, with receipts.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fulfillment control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Peer marketplace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business procurement' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partner integrations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Returns and finance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3PL and 4PL control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Governed optimization' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Production readiness' })).toBeVisible();
  await expect(page.getByText('OPERATIONAL')).toHaveCount(8);
});
