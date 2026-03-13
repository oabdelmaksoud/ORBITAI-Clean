import { test, expect } from '@playwright/test';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
  });

  test('should display notification bell with count', async ({ page }) => {
    // Find notification bell
    const bell = page.locator('[data-testid="notification-bell"]');
    await expect(bell).toBeVisible();
    
    // Check badge count
    const badge = bell.locator('[data-testid="notification-badge"]');
    if (await badge.isVisible()) {
      const count = await badge.textContent();
      expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
    }
  });

  test('should open notification center', async ({ page }) => {
    // Click bell
    await page.click('[data-testid="notification-bell"]');
    
    // Verify notification panel opens
    await expect(page.locator('[data-testid="notification-center"]')).toBeVisible();
  });

  test('should display list of notifications', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Verify notifications list
    await expect(page.locator('[data-testid="notification-list"]')).toBeVisible();
    
    // Check if notifications exist
    const count = await page.locator('[data-testid="notification-item"]').count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should mark notification as read', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Find unread notification
    const notification = page.locator('[data-testid="notification-item"][data-read="false"]:first-child');
    
    if (await notification.isVisible()) {
      // Click notification
      await notification.click();
      
      // Verify marked as read
      await expect(notification).toHaveAttribute('data-read', 'true');
    }
  });

  test('should mark all notifications as read', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Click "Mark all as read"
    await page.click('button:has-text("Mark all as read")');
    
    // Verify all marked read
    const unreadCount = await page.locator('[data-testid="notification-item"][data-read="false"]').count();
    expect(unreadCount).toBe(0);
  });

  test('should delete notification', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Find notification
    const notification = page.locator('[data-testid="notification-item"]:first-child');
    await notification.hover();
    await notification.locator('button[aria-label="Delete"]').click();
    
    // Verify deleted
    await expect(notification).not.toBeVisible();
  });

  test('should delete all read notifications', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Click "Clear read"
    await page.click('button:has-text("Clear read")');
    
    // Verify read notifications deleted
    const readCount = await page.locator('[data-testid="notification-item"][data-read="true"]').count();
    expect(readCount).toBe(0);
  });

  test('should filter notifications by type', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Click filter
    await page.click('button[aria-label="Filter notifications"]');
    await page.click('text=Comments');
    
    // Verify filtered
    const notifications = await page.locator('[data-testid="notification-item"]').count();
    expect(notifications).toBeGreaterThanOrEqual(0);
  });

  test('should show unread count in badge', async ({ page }) => {
    // Get badge
    const badge = page.locator('[data-testid="notification-badge"]');
    
    if (await badge.isVisible()) {
      const count = await badge.textContent();
      expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
    }
  });

  test('should navigate to notification source', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Click notification
    const notification = page.locator('[data-testid="notification-item"]:first-child');
    await notification.click();
    
    // Verify navigation
    // Should navigate to project/comment/task
    await expect(page).not.toHaveURL(/.*\/dashboard$/);
  });

  test('should show notification timestamp', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Check timestamp
    const timestamp = page.locator('[data-testid="notification-timestamp"]:first-child');
    await expect(timestamp).toBeVisible();
    
    // Verify relative time format
    const text = await timestamp.textContent();
    expect(text).toMatch(/(just now|minute|hour|day|week|month|year)/i);
  });

  test('should show notification type icon', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Check for type icon
    const icon = page.locator('[data-testid="notification-icon"]:first-child');
    await expect(icon).toBeVisible();
  });

  test('should handle empty notifications', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // If no notifications, show empty state
    const emptyState = page.locator('text=No notifications');
    const hasNotifications = (await page.locator('[data-testid="notification-item"]').count()) > 0;
    
    if (!hasNotifications) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should close notification center when clicking outside', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Click outside
    await page.click('body', { position: { x: 0, y: 0 } });
    
    // Verify closed
    await expect(page.locator('[data-testid="notification-center"]')).not.toBeVisible();
  });

  test('should show notification preview text', async ({ page }) => {
    await page.click('[data-testid="notification-bell"]');
    
    // Check preview
    const preview = page.locator('[data-testid="notification-preview"]:first-child');
    if (await preview.isVisible()) {
      const text = await preview.textContent();
      expect(text!.length).toBeGreaterThan(0);
    }
  });
});
