import React, { useState, useEffect } from 'react';
import { Editor } from '@craftjs/core';
import { PageBuilderProvider, usePageBuilder } from '@src/contexts/PageBuilderContext';
import { PageBuilderCanvas } from './PageBuilderCanvas';
import { BlockPalette } from './BlockPalette';
import { BlockInspector } from './BlockInspector';
import { DevicePreview } from './DevicePreview';
import {
  Save, Eye, Undo2, Redo2, Monitor, Tablet, Smartphone,
  Loader2, CheckCircle, AlertCircle, Maximize2, Minimize2, History
} from 'lucide-react';
import { RevisionTimeline } from './history/RevisionTimeline';
import { getPage, updatePage, publishPage as publishPageApi } from '@src/services/pageBuilderApi';
import { PageData } from '@orbitai/shared';

interface PageBuilderProps {
  token: string;
  pageKey: string;
}

function PageBuilderContent({ token, pageKey }: PageBuilderProps) {
  const {
    page,
    blocks,
    save,
    undo,
    redo,
    canUndo,
    canRedo,
    isSaving,
    isDirty,
    previewMode,
    setPreviewMode
  } = usePageBuilder();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scheduledPublishAt, setScheduledPublishAt] = useState<string>('');

  useEffect(() => {
    loadPage();
  }, [pageKey]);

  const loadPage = async () => {
    try {
      setLoading(true);
      setError(null);
      const { page: pageData } = await getPage(token, pageKey);
      setPage(pageData);
    } catch (err: any) {
      setError(err.message || 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await save();
      setSuccess('Page saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save page');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handlePublish = async () => {
    try {
      await publishPageApi(token, pageKey, {
        scheduledAt: scheduledPublishAt ? new Date(scheduledPublishAt) : undefined
      });
      setSuccess('Page published successfully!');
      setShowPublishModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to publish page');
      setTimeout(() => setError(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">{page?.title || 'Page Builder'}</h2>
          {isDirty && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
          <div className="w-px h-6 bg-slate-300 mx-2" />
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-2 rounded-lg hover:bg-slate-100"
            title="Preview"
          >
            {showPreview ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg hover:bg-slate-100 ${showHistory ? 'bg-blue-100' : ''}`}
            title="Revision History"
          >
            <History size={18} />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save
              </>
            )}
          </button>
          {page?.status === 'draft' && (
            <button
              onClick={() => setShowPublishModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 p-4 flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {showHistory ? (
          <RevisionTimeline token={token} pageKey={pageKey} />
        ) : !showPreview ? (
          <>
            <BlockPalette />
            <PageBuilderCanvas />
            <BlockInspector />
          </>
        ) : (
          <div className="flex-1">
            <DevicePreview />
          </div>
        )}
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Publish Page</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Schedule Publish (optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledPublishAt}
                  onChange={(e) => setScheduledPublishAt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                >
                  Publish Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageBuilder({ token, pageKey }: PageBuilderProps) {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, [pageKey]);

  const loadPage = async () => {
    try {
      const { page: pageData } = await getPage(token, pageKey);
      setPage(pageData);
    } catch (err) {
      console.error('Failed to load page:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <PageBuilderProvider token={token} initialPage={page}>
      <PageBuilderContent token={token} pageKey={pageKey} />
    </PageBuilderProvider>
  );
}

