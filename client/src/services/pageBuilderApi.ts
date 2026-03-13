/**
 * Page Builder API Service
 * Frontend service for managing pages, themes, templates, and revisions
 */

import { apiRequest } from './adminApi';
import { PageData, PageRevision, PageTheme, PageTemplate, BlockSchema } from '@orbitai/shared';

/**
 * Get block registry from backend
 */
export async function getBlockRegistry(token: string): Promise<{ blocks: BlockSchema[] }> {
  const response = await apiRequest<{
    success: boolean;
    data: { blocks: BlockSchema[] };
  }>('/api/admin/page-builder/blocks/registry', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch block registry');
  }

  return response.data;
}

/**
 * List all pages
 */
export async function listPages(
  token: string,
  options?: { status?: string; search?: string }
): Promise<{ pages: PageData[] }> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.search) params.append('search', options.search);

  const response = await apiRequest<{
    success: boolean;
    data: { pages: PageData[] };
  }>(`/api/admin/page-builder/pages?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch pages');
  }

  return response.data;
}

/**
 * Get a specific page
 */
export async function getPage(token: string, pageKey: string): Promise<{ page: PageData }> {
  const response = await apiRequest<{
    success: boolean;
    data: { page: PageData };
  }>(`/api/admin/page-builder/pages/${pageKey}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch page');
  }

  return response.data;
}

/**
 * Create a new page
 */
export async function createPage(
  token: string,
  pageData: {
    pageKey: string;
    title: string;
    slug: string;
    blocks?: any;
    themeId?: string;
    templateId?: string;
    seo?: any;
    settings?: any;
  }
): Promise<{ page: PageData }> {
  const response = await apiRequest<{
    success: boolean;
    data: { page: PageData };
  }>('/api/admin/page-builder/pages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pageData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create page');
  }

  return response.data;
}

/**
 * Update a page
 */
export async function updatePage(
  token: string,
  pageKey: string,
  updates: {
    title?: string;
    slug?: string;
    blocks?: any;
    themeId?: string;
    templateId?: string;
    seo?: any;
    settings?: any;
    autoSave?: boolean;
  }
): Promise<{ page: PageData }> {
  const response = await apiRequest<{
    success: boolean;
    data: { page: PageData };
  }>(`/api/admin/page-builder/pages/${pageKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update page');
  }

  return response.data;
}

/**
 * Publish a page
 */
export async function publishPage(
  token: string,
  pageKey: string,
  options?: { scheduledAt?: Date }
): Promise<{ page: PageData; revision: PageRevision }> {
  const response = await apiRequest<{
    success: boolean;
    data: { page: PageData; revision: PageRevision };
  }>(`/api/admin/page-builder/pages/${pageKey}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options || {}),
  }, token);

  if (!response.success) {
    throw new Error('Failed to publish page');
  }

  return response.data;
}

/**
 * Get page revisions
 */
export async function getPageRevisions(
  token: string,
  pageKey: string,
  limit?: number
): Promise<{ revisions: PageRevision[] }> {
  const params = limit ? `?limit=${limit}` : '';
  const response = await apiRequest<{
    success: boolean;
    data: { revisions: PageRevision[] };
  }>(`/api/admin/page-builder/pages/${pageKey}/revisions${params}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch revisions');
  }

  return response.data;
}

/**
 * Rollback to a specific revision
 */
export async function rollbackToRevision(
  token: string,
  pageKey: string,
  revisionId: string
): Promise<{ page: PageData; revision: PageRevision }> {
  const response = await apiRequest<{
    success: boolean;
    data: { page: PageData; revision: PageRevision };
  }>(`/api/admin/page-builder/pages/${pageKey}/rollback/${revisionId}`, {
    method: 'POST',
  }, token);

  if (!response.success) {
    throw new Error('Failed to rollback page');
  }

  return response.data;
}

/**
 * List all themes
 */
export async function listThemes(token: string): Promise<{ themes: PageTheme[] }> {
  const response = await apiRequest<{
    success: boolean;
    data: { themes: PageTheme[] };
  }>('/api/admin/page-builder/themes', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch themes');
  }

  return response.data;
}

/**
 * Create a theme
 */
export async function createTheme(
  token: string,
  themeData: {
    name: string;
    slug: string;
    description?: string;
    designTokens?: any;
    customCss?: string;
    isDefault?: boolean;
  }
): Promise<{ theme: PageTheme }> {
  const response = await apiRequest<{
    success: boolean;
    data: { theme: PageTheme };
  }>('/api/admin/page-builder/themes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(themeData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create theme');
  }

  return response.data;
}

/**
 * Update a theme
 */
export async function updateTheme(
  token: string,
  themeId: string,
  updates: {
    name?: string;
    description?: string;
    designTokens?: any;
    customCss?: string;
    isDefault?: boolean;
  }
): Promise<{ theme: PageTheme }> {
  const response = await apiRequest<{
    success: boolean;
    data: { theme: PageTheme };
  }>(`/api/admin/page-builder/themes/${themeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update theme');
  }

  return response.data;
}

/**
 * Delete a theme
 */
export async function deleteTheme(token: string, themeId: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/admin/page-builder/themes/${themeId}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete theme');
  }
}

/**
 * List all templates
 */
export async function listTemplates(
  token: string,
  options?: { category?: string; search?: string }
): Promise<{ templates: PageTemplate[] }> {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.search) params.append('search', options.search);

  const response = await apiRequest<{
    success: boolean;
    data: { templates: PageTemplate[] };
  }>(`/api/admin/page-builder/templates?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch templates');
  }

  return response.data;
}

/**
 * Create a template
 */
export async function createTemplate(
  token: string,
  templateData: {
    name: string;
    slug: string;
    description?: string;
    category?: string;
    thumbnail?: string;
    blocks: any;
    themeId?: string;
    tags?: string[];
    isPublic?: boolean;
  }
): Promise<{ template: PageTemplate }> {
  const response = await apiRequest<{
    success: boolean;
    data: { template: PageTemplate };
  }>('/api/admin/page-builder/templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templateData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create template');
  }

  return response.data;
}

/**
 * Use a template to create a page
 */
export async function useTemplate(
  token: string,
  templateId: string,
  pageData: {
    pageKey: string;
    title: string;
    slug: string;
  }
): Promise<{ page: PageData }> {
  const response = await apiRequest<{
    success: boolean;
    data: { page: PageData };
  }>(`/api/admin/page-builder/templates/${templateId}/use`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pageData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to use template');
  }

  return response.data;
}




