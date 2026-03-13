/**
 * Admin Database API Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API Error: ${response.statusText}`);
  }

  return data;
}

export interface CollectionStats {
  name: string;
  count: number;
  size: number;
  storageSize: number;
  indexes: number;
  avgObjSize: number;
}

export interface QueryResult {
  results: any[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

export interface CollectionSchema {
  fields: Array<{
    name: string;
    type: string;
    example: any;
  }>;
  sample: any;
}

export interface BackupResult {
  collection: string;
  documentCount: number;
  timestamp: string;
  data: any[];
}

export async function getCollections(token: string): Promise<string[]> {
  const response = await apiRequest<{ success: boolean; data: { collections: string[] } }>(
    '/api/admin/database/collections',
    { method: 'GET' },
    token
  );
  return response.data.collections;
}

export async function getCollectionStats(
  token: string,
  collection: string
): Promise<CollectionStats> {
  const response = await apiRequest<{ success: boolean; data: CollectionStats }>(
    `/api/admin/database/stats/${collection}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function getCollectionSchema(
  token: string,
  collection: string
): Promise<CollectionSchema> {
  const response = await apiRequest<{ success: boolean; data: CollectionSchema }>(
    `/api/admin/database/schema/${collection}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function executeQuery(
  token: string,
  options: {
    collection: string;
    query?: any;
    projection?: any;
    limit?: number;
    skip?: number;
    sort?: any;
    readOnly?: boolean;
  }
): Promise<QueryResult> {
  const response = await apiRequest<{ success: boolean; data: QueryResult }>(
    '/api/admin/database/query',
    {
      method: 'POST',
      body: JSON.stringify(options),
    },
    token
  );
  return response.data;
}

export async function updateRecords(
  token: string,
  options: {
    collection: string;
    filter: any;
    update: any;
    options?: {
      multi?: boolean;
      upsert?: boolean;
    };
  }
): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount: number }> {
  const response = await apiRequest<{
    success: boolean;
    data: { matchedCount: number; modifiedCount: number; upsertedCount: number };
  }>(
    '/api/admin/database/update',
    {
      method: 'POST',
      body: JSON.stringify(options),
    },
    token
  );
  return response.data;
}

export async function deleteRecords(
  token: string,
  options: {
    collection: string;
    filter: any;
    limit?: number;
  }
): Promise<{ deletedCount: number; totalMatched: number }> {
  const response = await apiRequest<{
    success: boolean;
    data: { deletedCount: number; totalMatched: number };
  }>(
    '/api/admin/database/delete',
    {
      method: 'POST',
      body: JSON.stringify(options),
    },
    token
  );
  return response.data;
}

export async function backupCollection(
  token: string,
  collection: string
): Promise<BackupResult> {
  const response = await apiRequest<{ success: boolean; data: BackupResult }>(
    '/api/admin/database/backup-collection',
    {
      method: 'POST',
      body: JSON.stringify({ collection }),
    },
    token
  );
  return response.data;
}




