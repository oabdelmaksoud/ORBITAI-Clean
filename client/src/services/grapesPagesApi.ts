import { apiRequest } from './adminApi';
import { GrapesPage } from '../components/GrapesJSPageEditor';

export interface PageListResponse {
  pages: GrapesPage[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  customHead?: string;
}

export interface CreatePageData {
  name: string;
  slug?: string;
  html?: string;
  css?: string;
  components?: string;
  styles?: string;
  metadata?: PageMetadata;
  status?: 'draft' | 'published' | 'archived';
}

export interface UpdatePageData {
  name?: string;
  html?: string;
  css?: string;
  components?: string;
  styles?: string;
  metadata?: PageMetadata;
  status?: 'draft' | 'published' | 'archived';
}

/**
 * Get all pages
 */
export async function getPages(
  token: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<PageListResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  
  const queryString = params.toString();
  const url = `/pages${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiRequest('get', url, token);
  return response;
}

/**
 * Get a single page by slug
 */
export async function getPage(token: string, slug: string): Promise<{ page: GrapesPage }> {
  return apiRequest('get', `/pages/${slug}`, token);
}

/**
 * Create a new page
 */
export async function createPage(token: string, data: CreatePageData): Promise<{ page: GrapesPage }> {
  return apiRequest('post', '/pages', token, data);
}

/**
 * Update a page
 */
export async function updatePage(
  token: string,
  slug: string,
  data: UpdatePageData
): Promise<{ page: GrapesPage }> {
  return apiRequest('put', `/pages/${slug}`, token, data);
}

/**
 * Delete a page
 */
export async function deletePage(token: string, slug: string): Promise<{ message: string }> {
  return apiRequest('delete', `/pages/${slug}`, token);
}

/**
 * Publish a page
 */
export async function publishPage(token: string, slug: string): Promise<{ page: GrapesPage }> {
  return apiRequest('post', `/pages/${slug}/publish`, token);
}

/**
 * Unpublish a page (set to draft)
 */
export async function unpublishPage(token: string, slug: string): Promise<{ page: GrapesPage }> {
  return apiRequest('post', `/pages/${slug}/unpublish`, token);
}

/**
 * Duplicate a page
 */
export async function duplicatePage(
  token: string,
  slug: string,
  options?: { newName?: string; newSlug?: string }
): Promise<{ page: GrapesPage }> {
  return apiRequest('post', `/pages/${slug}/duplicate`, token, options || {});
}

/**
 * Save page content (convenience method for updating HTML/CSS)
 */
export async function savePageContent(
  token: string,
  slug: string,
  content: { html: string; css: string; components?: string; styles?: string }
): Promise<{ page: GrapesPage }> {
  return updatePage(token, slug, content);
}




