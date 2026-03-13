/**
 * Community Sharing API Service
 */

import { apiRequest } from './adminApi';

export interface MarketplaceItem {
  id?: string;
  title: string;
  description: string;
  category: string;
  content: string; // Process improvement content
  tags?: string[];
  authorId?: string;
  authorName?: string;
  rating?: number;
  ratingsCount?: number;
  downloads?: number;
  forks?: number;
  status: 'draft' | 'published' | 'featured';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get marketplace items
 */
export async function getMarketplaceItems(
  token: string,
  filters?: { category?: string; search?: string; status?: string }
): Promise<MarketplaceItem[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);

  const queryString = params.toString();
  const endpoint = `/api/admin/community-sharing/marketplace${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{
    success: boolean;
    data: MarketplaceItem[];
  }>(endpoint, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch marketplace items');
  }

  return response.data;
}

/**
 * Get marketplace item by ID
 */
export async function getMarketplaceItem(token: string, id: string): Promise<MarketplaceItem> {
  const response = await apiRequest<{
    success: boolean;
    data: MarketplaceItem;
  }>(`/api/admin/community-sharing/marketplace/${id}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch marketplace item');
  }

  return response.data;
}

/**
 * Create marketplace item
 */
export async function createMarketplaceItem(
  token: string,
  item: Omit<MarketplaceItem, 'id' | 'createdAt' | 'updatedAt' | 'rating' | 'ratingsCount' | 'downloads' | 'forks'>
): Promise<MarketplaceItem> {
  const response = await apiRequest<{
    success: boolean;
    data: MarketplaceItem;
  }>('/api/admin/community-sharing/marketplace', {
    method: 'POST',
    body: JSON.stringify(item),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create marketplace item');
  }

  return response.data;
}

/**
 * Rate marketplace item
 */
export async function rateMarketplaceItem(
  token: string,
  itemId: string,
  rating: number
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>(`/api/admin/community-sharing/marketplace/${itemId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to rate marketplace item');
  }
}

/**
 * Fork marketplace item
 */
export async function forkMarketplaceItem(
  token: string,
  itemId: string
): Promise<MarketplaceItem> {
  const response = await apiRequest<{
    success: boolean;
    data: MarketplaceItem;
  }>(`/api/admin/community-sharing/marketplace/${itemId}/fork`, {
    method: 'POST',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fork marketplace item');
  }

  return response.data;
}
















