import { expect, test } from '@playwright/test';

test('foundation identifies implemented boundaries', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /one network/i })).toBeVisible();
  await page.getByRole('link', { name: 'View platform status' }).click();
  await expect(page.getByRole('heading', { name: 'Platform status' })).toBeVisible();
  await expect(page.getByText('Outbox publication process')).toBeVisible();
});
