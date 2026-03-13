import { test, expect } from '@playwright/test';

test.describe('Authentication - Login', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check if login form elements are visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verify user is logged in
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in login form with invalid credentials
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Check for error message
    await expect(page.locator('text=/invalid|incorrect|failed/i')).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields', async ({ page }) => {
    // Submit form without filling any fields
    await page.locator('button[type="submit"]').click();
    
    // Check for validation errors
    await expect(page.locator('text=/required|invalid email/i')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Fill in invalid email
    await page.locator('input[type="email"]').fill('invalidemail');
    await page.locator('input[type="password"]').fill('password123');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Check for email validation error
    await expect(page.locator('text=/invalid email/i')).toBeVisible();
  });

  test('should redirect to dashboard if already logged in', async ({ page, context }) => {
    // First, login
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
    
    // Now try to access login page again
    await page.goto('/login');
    
    // Should be redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');
    const toggleButton = page.locator('button[aria-label*="password"], button:has-text("show"), button:has-text("hide")').first();
    
    // Fill password
    await passwordInput.fill('mypassword');
    
    // Check if password is hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Toggle visibility
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Toggle back
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });

  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
    
    // Reload page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should handle special characters in password', async ({ page }) => {
    const specialPassword = 'P@ssw0rd!#$%&*()';
    
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill(specialPassword);
    await page.locator('button[type="submit"]').click();
    
    // If user exists with this password, should login
    // Otherwise should show error
    const loggedIn = await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => false);
    if (!loggedIn) {
      await expect(page.locator('text=/invalid|incorrect/i')).toBeVisible();
    }
  });
});
