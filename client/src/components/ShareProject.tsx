import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, X, Link2, Eye, Lock, Globe, Calendar, Loader2 } from 'lucide-react';
import { shareLinksApi, ShareLink as ApiShareLink } from '../services/shareLinksApi';

import { showAlert, showConfirm } from '../utils/browserUtils';

interface LocalShareLink {
  id: string;
  token: string;
  createdAt: number;
  expiresAt?: number;
  accessCount: number;
}

interface ShareProjectProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  userToken?: string;
}


const ShareProject: React.FC<ShareProjectProps> = ({ projectId, projectName, onClose }) => {
  const [shareLinks, setShareLinks] = useState<LocalShareLink[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expirationDays, setExpirationDays] = useState<number>(30);

  useEffect(() => {
    // Load existing share links for this project from database
    const loadShareLinks = async () => {
      try {
        const links = await shareLinksApi.getShareLinks(projectId);
        // Convert API format to component format
        const formattedLinks: LocalShareLink[] = links.map(link => ({
          id: link.token,
          token: link.token,
          createdAt: new Date(link.createdAt).getTime(),
          expiresAt: link.expiresAt ? new Date(link.expiresAt).getTime() : undefined,
          accessCount: link.accessCount
        }));
        setShareLinks(formattedLinks);
      } catch (error: any) {
        if (error.message?.includes('Authentication')) {
          console.warn('User not authenticated, cannot load share links');
        } else {
          console.error('Failed to load share links:', error);
        }
      }
    };

    loadShareLinks();
  }, [projectId]);


  const createShareLink = async () => {
    setLoading(true);

    try {
      const createdLink = await shareLinksApi.createShareLink(projectId, expirationDays);

      // Convert API format to component format
      const newLink: LocalShareLink = {
        id: createdLink.token,
        token: createdLink.token,
        createdAt: new Date(createdLink.createdAt).getTime(),
        expiresAt: createdLink.expiresAt ? new Date(createdLink.expiresAt).getTime() : undefined,
        accessCount: createdLink.accessCount
      };

      // Update share links list
      const updatedLinks = [...shareLinks, newLink];
      setShareLinks(updatedLinks);

      console.log('Share link created successfully:', createdLink.token);
    } catch (e: any) {
      console.error('Failed to create share link', e);
      alert(`Failed to create share link: ${e.message || 'Unknown error'}\n\nPlease try again.`);
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = (token: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/${token}`;
  };

  const copyToClipboard = async (url: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const revokeLink = async (linkId: string) => {
    const linkToRemove = shareLinks.find(l => l.id === linkId);
    if (!linkToRemove) return;

    try {
      await shareLinksApi.deleteShareLink(projectId, linkToRemove.token);
      const updatedLinks = shareLinks.filter(link => link.id !== linkId);
      setShareLinks(updatedLinks);
    } catch (error: any) {
      console.error('Failed to revoke share link:', error);
      alert(`Failed to revoke share link: ${error.message || 'Unknown error'}`);
    }
  };

  const isLinkExpired = (link: LocalShareLink): boolean => {
    if (!link.expiresAt) return false;
    return Date.now() > link.expiresAt;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Share2 className="text-white" size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Share Project</h1>
                  <p className="text-sm text-slate-500">{projectName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <Eye size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">View-Only Access</h3>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Shared links provide read-only access. Viewers can see the project but cannot make any changes, execute tasks, or modify content.
                </p>
              </div>
            </div>

            {/* Create New Link */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Link Expiration (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(Math.max(0, Math.min(365, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="30"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {expirationDays === 0 ? 'Link never expires' : `Link expires in ${expirationDays} day${expirationDays !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={createShareLink}
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Link2 size={18} />
                        <span>Create Share Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing Links */}
            {shareLinks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Globe size={16} />
                  Active Share Links
                </h3>
                <div className="space-y-3">
                  {shareLinks.map((link) => {
                    const url = getShareUrl(link.token);
                    const expired = isLinkExpired(link);

                    return (
                      <div
                        key={link.id}
                        className={`p-4 rounded-xl border-2 transition-all ${expired
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${expired ? 'bg-slate-400' : 'bg-green-500 animate-pulse'}`} />
                              <span className={`text-xs font-semibold ${expired ? 'text-slate-500' : 'text-green-600'}`}>
                                {expired ? 'Expired' : 'Active'}
                              </span>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-2">
                              <p className="text-xs font-mono text-slate-600 break-all">{url}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <div className="flex items-center gap-1">
                                <Calendar size={12} />
                                <span>Created: {formatDate(link.createdAt)}</span>
                              </div>
                              {link.expiresAt && (
                                <div className="flex items-center gap-1">
                                  <Calendar size={12} />
                                  <span>Expires: {formatDate(link.expiresAt)}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Eye size={12} />
                                <span>{link.accessCount} view{link.accessCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(url, link.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-semibold"
                          >
                            {copiedLink === link.id ? (
                              <>
                                <Check size={16} />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={16} />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => revokeLink(link.id)}
                            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors text-sm font-semibold"
                            title="Revoke link"
                          >
                            <Lock size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {shareLinks.length === 0 && (
              <div className="text-center py-12">
                <Share2 size={48} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-sm mb-2">No share links created yet</p>
                <p className="text-slate-400 text-xs">Create a link above to share this project</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareProject;

