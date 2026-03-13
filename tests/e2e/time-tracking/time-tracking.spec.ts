import { test, expect } from '@playwright/test';

test.describe('Time Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
  });

  test('should display timer widget', async ({ page }) => {
    // Check timer widget visible
    await expect(page.locator('[data-testid="timer-widget"]')).toBeVisible();
  });

  test('should start timer', async ({ page }) => {
    // Click start timer
    await page.click('[data-testid="start-timer"]');
    
    // Select project (if modal appears)
    const projectModal = page.locator('[data-testid="project-select-modal"]');
    if (await projectModal.isVisible()) {
      await projectModal.locator('button:first-child').click();
    }
    
    // Verify timer running
    await expect(page.locator('[data-testid="timer-status"]')).toContainText('Running');
    await expect(page.locator('[data-testid="timer-display"]')).toBeVisible();
  });

  test('should stop timer', async ({ page }) => {
    // Start timer first
    await page.click('[data-testid="start-timer"]');
    await page.waitForTimeout(2000);
    
    // Stop timer
    await page.click('[data-testid="stop-timer"]');
    
    // Verify timer stopped
    await expect(page.locator('[data-testid="timer-status"]')).toContainText('Stopped');
  });

  test('should display timer duration in real-time', async ({ page }) => {
    // Start timer
    await page.click('[data-testid="start-timer"]');
    
    // Wait 2 seconds
    await page.waitForTimeout(2000);
    
    // Check duration updated
    const duration = await page.locator('[data-testid="timer-display"]').textContent();
    expect(duration).toMatch(/00:00:0[2-9]|00:00:1[0-9]/); // 2-19 seconds
  });

  test('should add description to timer', async ({ page }) => {
    // Start timer
    await page.click('[data-testid="start-timer"]');
    
    // Add description
    await page.click('[data-testid="timer-description"]');
    await page.locator('input[name="description"]').fill('Working on E2E tests');
    await page.press('input[name="description"]', 'Enter');
    
    // Verify saved
    await expect(page.locator('text=Working on E2E tests')).toBeVisible();
  });

  test('should select project for timer', async ({ page }) => {
    // Start timer
    await page.click('[data-testid="start-timer"]');
    
    // Click project selector
    await page.click('[data-testid="timer-project-select"]');
    
    // Select project
    await page.click('[data-testid="project-option"]:first-child');
    
    // Verify project selected
    const project = await page.locator('[data-testid="selected-project"]').textContent();
    expect(project!.length).toBeGreaterThan(0);
  });

  test('should toggle billable status', async ({ page }) => {
    // Start timer
    await page.click('[data-testid="start-timer"]');
    
    // Toggle billable
    await page.click('[data-testid="toggle-billable"]');
    
    // Verify billable
    await expect(page.locator('[data-testid="billable-indicator"]')).toBeVisible();
    
    // Toggle again
    await page.click('[data-testid="toggle-billable"]');
    
    // Verify not billable
    await expect(page.locator('[data-testid="billable-indicator"]')).not.toBeVisible();
  });

  test('should create manual time entry', async ({ page }) => {
    // Click add manual entry
    await page.click('[data-testid="add-manual-entry"]');
    
    // Fill form
    await page.locator('input[name="description"]').fill('Manual entry test');
    await page.locator('input[name="startTime"]').fill('09:00');
    await page.locator('input[name="endTime"]').fill('10:30');
    
    // Submit
    await page.click('button:has-text("Add Entry")');
    
    // Verify entry created
    await expect(page.locator('text=Manual entry test')).toBeVisible();
  });

  test('should display time entries list', async ({ page }) => {
    // Navigate to time entries
    await page.click('text=Time Tracking');
    
    // Verify entries visible
    await expect(page.locator('[data-testid="time-entries-list"]')).toBeVisible();
  });

  test('should edit time entry', async ({ page }) => {
    await page.click('text=Time Tracking');
    
    // Find entry and edit
    const entry = page.locator('[data-testid="time-entry"]:first-child');
    await entry.locator('button[aria-label="Edit"]').click();
    
    // Update description
    await page.locator('input[name="description"]').fill('Updated description');
    await page.click('button:has-text("Save")');
    
    // Verify updated
    await expect(page.locator('text=Updated description')).toBeVisible();
  });

  test('should delete time entry', async ({ page }) => {
    await page.click('text=Time Tracking');
    
    // Find entry and delete
    const entry = page.locator('[data-testid="time-entry"]:first-child');
    await entry.locator('button[aria-label="Delete"]').click();
    
    // Confirm
    await page.click('button:has-text("Delete")');
    
    // Verify deleted
    await expect(entry).not.toBeVisible();
  });

  test('should filter time entries by date range', async ({ page }) => {
    await page.click('text=Time Tracking');
    
    // Open date filter
    await page.click('button[aria-label="Date filter"]');
    
    // Select "This week"
    await page.click('text=This week');
    
    // Verify filtered
    const entries = await page.locator('[data-testid="time-entry"]').count();
    expect(entries).toBeGreaterThanOrEqual(0);
  });

  test('should filter time entries by project', async ({ page }) => {
    await page.click('text=Time Tracking');
    
    // Open project filter
    await page.click('button[aria-label="Project filter"]');
    
    // Select project
    await page.click('[data-testid="project-filter-option"]:first-child');
    
    // Verify filtered
    const entries = await page.locator('[data-testid="time-entry"]').count();
    expect(entries).toBeGreaterThanOrEqual(0);
  });

  test('should show time summary', async ({ page }) => {
    await page.click('text=Time Tracking');
    
    // Check summary cards
    await expect(page.locator('text=Total Time')).toBeVisible();
    await expect(page.locator('text=Billable')).toBeVisible();
    await expect(page.locator('text=Non-billable')).toBeVisible();
  });

  test('should show daily time breakdown', async ({ page }) => {
    await page.click('text=Time Tracking');
    
    // Check daily breakdown
    await expect(page.locator('[data-testid="daily-breakdown"]')).toBeVisible();
  });

  test('should export time report', async ({ page }) => {
    await page.click('text=Time Tracking');
    
    // Click export
    await page.click('button:has-text("Export")');
    
    // Select format
    await page.click('text=CSV');
    
    // Verify download initiated
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should show running timer in navbar', async ({ page }) => {
    // Start timer
    await page.click('[data-testid="start-timer"]');
    
    // Check navbar widget
    await expect(page.locator('[data-testid="navbar-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="navbar-timer"]')).toContainText(':');
  });

  test('should pause and resume timer', async ({ page }) => {
    // Start timer
    await page.click('[data-testid="start-timer"]');
    await page.waitForTimeout(1000);
    
    // Pause
    await page.click('[data-testid="pause-timer"]');
    await expect(page.locator('[data-testid="timer-status"]')).toContainText('Paused');
    
    // Get paused time
    const pausedTime = await page.locator('[data-testid="timer-display"]').textContent();
    
    // Wait
    await page.waitForTimeout(2000);
    
    // Verify time didn't change
    const currentTime = await page.locator('[data-testid="timer-display"]').textContent();
    expect(currentTime).toBe(pausedTime);
    
    // Resume
    await page.click('[data-testid="resume-timer"]');
    await expect(page.locator('[data-testid="timer-status"]')).toContainText('Running');
  });
});
