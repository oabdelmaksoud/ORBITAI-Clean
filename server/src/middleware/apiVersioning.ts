/**
 * API Versioning Middleware
 * Handles API version negotiation and routing
 */

import { Request, Response, NextFunction } from 'express';

export interface VersionedRequest extends Request {
  apiVersion?: string;
}

/**
 * API Versioning Middleware
 * Extracts version from URL path (/api/v1/...) or Accept header
 */
export function apiVersioning(req: VersionedRequest, res: Response, next: NextFunction): void {
  // Extract version from URL path
  const pathMatch = req.path.match(/^\/api\/v(\d+)\//);
  if (pathMatch) {
    req.apiVersion = pathMatch[1];
    // Remove version from path for routing
    // Note: req.path is read-only, so we only modify req.url
    // Express will automatically update req.path from req.url
    req.url = req.url.replace(`/v${pathMatch[1]}`, '');
  } else {
    // Check Accept header for version
    const acceptHeader = req.headers.accept || '';
    const versionMatch = acceptHeader.match(/version=(\d+)/);
    if (versionMatch) {
      req.apiVersion = versionMatch[1];
    } else {
      // Default to v1
      req.apiVersion = '1';
    }
  }

  // Add version to response headers
  res.setHeader('API-Version', req.apiVersion || '1');

  next();
}

/**
 * Version negotiation helper
 */
export function negotiateVersion(req: VersionedRequest, supportedVersions: string[]): string {
  const requestedVersion = req.apiVersion || '1';
  
  if (supportedVersions.includes(requestedVersion)) {
    return requestedVersion;
  }

  // Return latest supported version if requested version not available
  return supportedVersions[supportedVersions.length - 1] || '1';
}


