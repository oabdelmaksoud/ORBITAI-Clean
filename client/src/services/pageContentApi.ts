/**
 * Page Content API Service
 * Frontend service for managing page content
 */

import { apiRequest } from './adminApi';

export interface PageSection {
  id?: string;
  pageKey: string;
  sectionKey: string;
  content: {
    title?: string;
    subtitle?: string;
    description?: string;
    ctaText?: string;
    ctaLink?: string;
    backgroundImage?: string;
    videoUrl?: string;
    features?: Array<{
      title: string;
      description: string;
      icon?: string;
      color?: string;
    }>;
    plansHeading?: string;
    plansSubheading?: string;
    testimonials?: Array<{
      name: string;
      role: string;
      company: string;
      avatar: string;
      content: string;
      rating?: number;
    }>;
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
    stats?: Array<{
      label: string;
      value: string;
      description?: string;
    }>;
    text?: string;
    html?: string;
    images?: string[];
    videos?: string[];
    buttons?: Array<{
      text: string;
      link: string;
      variant?: 'primary' | 'secondary' | 'outline';
    }>;
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
    customData?: Record<string, any>;
  };
  isActive?: boolean;
  sortOrder?: number;
  metadata?: {
    lastEditedBy?: string;
    lastEditedAt?: Date;
    version?: number;
  };
}

export interface PageContent {
  pageKey: string;
  sections: Record<string, {
    content: PageSection['content'];
  }>;
}

/**
 * Get all sections for a page
 */
export async function getPageContent(
  token: string,
  pageKey: string
): Promise<PageContent> {
  const response = await apiRequest<{
    success: boolean;
    data: PageContent;
  }>(`/api/admin/page-content/${pageKey}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch page content');
  }

  return response.data;
}

/**
 * Get a specific section
 */
export async function getPageSection(
  token: string,
  pageKey: string,
  sectionKey: string
): Promise<{ section: PageSection }> {
  const response = await apiRequest<{
    success: boolean;
    data: { section: PageSection };
  }>(`/api/admin/page-content/${pageKey}/${sectionKey}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch page section');
  }

  return response.data;
}

/**
 * Save or update a page section
 */
export async function savePageSection(
  token: string,
  section: Omit<PageSection, 'id' | 'metadata'>
): Promise<{ section: PageSection }> {
  const response = await apiRequest<{
    success: boolean;
    data: { section: PageSection };
  }>('/api/admin/page-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(section),
  }, token);

  if (!response.success) {
    throw new Error('Failed to save page section');
  }

  return response.data;
}

/**
 * Update a specific section
 */
export async function updatePageSection(
  token: string,
  pageKey: string,
  sectionKey: string,
  updates: Partial<Pick<PageSection, 'content' | 'isActive' | 'sortOrder'>>
): Promise<{ section: PageSection }> {
  const response = await apiRequest<{
    success: boolean;
    data: { section: PageSection };
  }>(`/api/admin/page-content/${pageKey}/${sectionKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update page section');
  }

  return response.data;
}

/**
 * Delete (deactivate) a section
 */
export async function deletePageSection(
  token: string,
  pageKey: string,
  sectionKey: string
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/admin/page-content/${pageKey}/${sectionKey}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete page section');
  }
}

/**
 * Get public page content (no auth required)
 */
export async function getPublicPageContent(pageKey: string): Promise<PageContent> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/page-content/public/${pageKey}`, {
    headers: {
      'Bypass-Tunnel-Reminder': 'true',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch public page content');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error('Failed to fetch public page content');
  }

  return data.data;
}

