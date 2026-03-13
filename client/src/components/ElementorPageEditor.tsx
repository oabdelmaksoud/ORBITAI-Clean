import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Save, Eye, ExternalLink, RefreshCw } from 'lucide-react';
import { getLandingConfig, isOriginAllowed } from '../config/landing';
import { showAlert } from '../utils/browserUtils';

interface ElementorPageEditorProps {
  token: string;
  pageKey?: string;
  /** Elementor editor URL (if different from embed URL) */
  editorUrl?: string;
  /** Callback when page is saved in Elementor */
  onSave?: () => void;
  /** Callback when page is published */
  onPublish?: () => void;
}

/**
 * Elementor Page Editor Component
 * Embeds Elementor's visual page builder for editing pages
 */
export const ElementorPageEditor: React.FC<ElementorPageEditorProps> = ({
  token,
  pageKey = 'home',
  editorUrl,
  onSave,
  onPublish,
}) => {
  const config = getLandingConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // Determine editor URL
  const getEditorUrl = (): string | null => {
    if (editorUrl) {
      return editorUrl;
    }
    
    // Try to construct Elementor editor URL from embed URL
    if (config.elementorUrl) {
      try {
        const url = new URL(config.elementorUrl);
        // Elementor editor URLs typically follow pattern: /wp-admin/post.php?post=ID&action=elementor
        // Or use Elementor's frontend editor: /?elementor-preview=ID
        // For now, we'll use the embed URL with editor parameters
        url.searchParams.set('elementor-preview', 'true');
        url.searchParams.set('page_key', pageKey);
        return url.toString();
      } catch (e) {
        console.error('[Elementor Editor] Invalid URL:', e);
      }
    }
    
    return null;
  };

  const editorUrlValue = getEditorUrl();

  // Handle messages from Elementor editor
  useEffect(() => {
    if (!editorUrlValue) {
      setError('Elementor editor URL is not configured');
      setLoading(false);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      // Validate message origin (fast check first)
      if (!isOriginAllowed(event.origin, config)) {
        console.warn('[Elementor Editor] Message from disallowed origin:', event.origin);
        return;
      }

      // Handle Elementor editor messages
      const data = event.data;
      
      // Elementor sends various messages - we'll listen for save/publish events
      if (data && typeof data === 'object') {
        // Defer heavy work to prevent blocking the message handler
        setTimeout(() => {
          // Elementor save event
          if (data.action === 'elementor:save' || data.event === 'save') {
            setIsSaving(false);
            setIsPublished(false);
            showAlert('Page saved successfully', 'success');
            onSave?.();
          }
          
          // Elementor publish event
          if (data.action === 'elementor:publish' || data.event === 'publish') {
            setIsSaving(false);
            setIsPublished(true);
            showAlert('Page published successfully', 'success');
            onPublish?.();
          }
          
          // Elementor autosave
          if (data.action === 'elementor:autosave' || data.event === 'autosave') {
            // Silently handle autosave
            console.debug('[Elementor Editor] Autosave completed');
          }
        }, 0);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [editorUrlValue, config, onSave, onPublish]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
    
    // Try to communicate with Elementor editor
    // Elementor editor may need authentication token passed
    if (iframeRef.current?.contentWindow && token) {
      try {
        // Send auth token to Elementor iframe (if Elementor supports it)
        iframeRef.current.contentWindow.postMessage({
          type: 'orbitai:auth',
          token: token,
          pageKey: pageKey,
        }, '*');
      } catch (e) {
        console.warn('[Elementor Editor] Failed to send auth token:', e);
      }
    }
  };

  // Handle iframe error
  const handleIframeError = () => {
    setLoading(false);
    setError('Failed to load Elementor editor');
  };

  // Refresh editor
  const handleRefresh = () => {
    if (iframeRef.current && editorUrlValue) {
      setLoading(true);
      setError(null);
      iframeRef.current.src = editorUrlValue;
    }
  };

  // Open in new tab
  const handleOpenInNewTab = () => {
    if (editorUrlValue) {
      window.open(editorUrlValue, '_blank');
    }
  };

  if (!editorUrlValue) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Elementor Editor Not Configured</h2>
          <p className="text-slate-600 mb-4">
            Please configure Elementor editor URL:
          </p>
          <ul className="text-left text-sm text-slate-600 space-y-2 mb-4">
            <li>• Set <code className="bg-slate-200 px-2 py-1 rounded">VITE_ELEMENTOR_EMBED_URL</code> in .env</li>
            <li>• Or pass <code className="bg-slate-200 px-2 py-1 rounded">editorUrl</code> prop</li>
            <li>• Ensure Elementor is installed and accessible</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Elementor Page Editor</h2>
          <span className="text-sm text-slate-500">Editing: {pageKey}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {isSaving && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          )}
          
          {isPublished && (
            <div className="flex items-center gap-2 text-green-600">
              <Eye size={16} />
              <span className="text-sm">Published</span>
            </div>
          )}
          
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Refresh Editor"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          
          <button
            onClick={handleOpenInNewTab}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Open in New Tab"
          >
            <ExternalLink size={16} />
            Open in New Tab
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 text-blue-600 animate-spin" size={48} />
            <p className="text-slate-600 font-medium">Loading Elementor editor...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center p-8 max-w-md">
            <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to Load</h2>
            <p className="text-slate-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Elementor editor iframe */}
      {!error && (
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            src={editorUrlValue}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="Elementor Page Editor"
            allow="fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals"
          />
        </div>
      )}
    </div>
  );
};

export default ElementorPageEditor;




