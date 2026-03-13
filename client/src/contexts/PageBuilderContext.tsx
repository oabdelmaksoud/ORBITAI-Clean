import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { PageData, PageRevision } from '@orbitai/shared';
import { updatePage } from '../services/pageBuilderApi';

interface PageBuilderContextType {
  page: PageData | null;
  setPage: (page: PageData | null) => void;
  blocks: any;
  setBlocks: (blocks: any) => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  undoStack: any[];
  redoStack: any[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  autoSave: () => Promise<void>;
  isSaving: boolean;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  token: string;
  previewMode: 'desktop' | 'tablet' | 'mobile';
  setPreviewMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
}

const PageBuilderContext = createContext<PageBuilderContextType | undefined>(undefined);

interface PageBuilderProviderProps {
  children: React.ReactNode;
  token: string;
  initialPage?: PageData | null;
}

export function PageBuilderProvider({ children, token, initialPage }: PageBuilderProviderProps) {
  const [page, setPage] = useState<PageData | null>(initialPage || null);
  const [blocks, setBlocks] = useState<any>(initialPage?.blocks || {});
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<any[]>([initialPage?.blocks || {}]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedBlocksRef = useRef<any>(initialPage?.blocks || {});

  // Update blocks when page changes
  useEffect(() => {
    if (initialPage) {
      setPage(initialPage);
      const pageBlocks = initialPage.blocks || {};
      setBlocks(pageBlocks);
      setUndoStack([pageBlocks]);
      setRedoStack([]);
      lastSavedBlocksRef.current = pageBlocks;
      setIsDirty(false);
    }
  }, [initialPage]);

  // Track changes for undo/redo
  const handleBlocksChange = useCallback((newBlocks: any) => {
    setBlocks(newBlocks);
    setUndoStack(prev => [...prev, newBlocks].slice(-50)); // Keep last 50 states
    setRedoStack([]); // Clear redo stack on new change
    setIsDirty(true);

    // Auto-save after 2 seconds of inactivity
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 2000);
  }, []);

  // Override setBlocks to track history
  const setBlocksWithHistory = useCallback((newBlocks: any) => {
    handleBlocksChange(newBlocks);
  }, [handleBlocksChange]);

  const undo = useCallback(() => {
    if (undoStack.length <= 1) return;

    const current = undoStack[undoStack.length - 1];
    const previous = undoStack[undoStack.length - 2];

    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [current, ...prev]);
    setBlocks(previous);
    setIsDirty(true);
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const next = redoStack[0];
    const current = undoStack[undoStack.length - 1];

    setUndoStack(prev => [...prev, next]);
    setRedoStack(prev => prev.slice(1));
    setBlocks(next);
    setIsDirty(true);
  }, [redoStack]);

  const save = useCallback(async () => {
    if (!page || !isDirty) return;

    try {
      setIsSaving(true);
      const result = await updatePage(token, page.pageKey, {
        blocks,
        autoSave: false
      });

      setPage(result.page);
      lastSavedBlocksRef.current = blocks;
      setIsDirty(false);
      setUndoStack([blocks]); // Reset undo stack after save
      setRedoStack([]);
    } catch (error) {
      console.error('Failed to save page:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [page, blocks, isDirty, token]);

  const autoSave = useCallback(async () => {
    if (!page || !isDirty) return;

    try {
      await updatePage(token, page.pageKey, {
        blocks,
        autoSave: true
      });

      lastSavedBlocksRef.current = blocks;
      setIsDirty(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [page, blocks, isDirty, token]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const value: PageBuilderContextType = {
    page,
    setPage,
    blocks,
    setBlocks: setBlocksWithHistory,
    selectedBlockId,
    setSelectedBlockId,
    undoStack,
    redoStack,
    canUndo: undoStack.length > 1,
    canRedo: redoStack.length > 0,
    undo,
    redo,
    save,
    autoSave,
    isSaving,
    isDirty,
    setIsDirty,
    token,
    previewMode,
    setPreviewMode
  };

  return (
    <PageBuilderContext.Provider value={value}>
      {children}
    </PageBuilderContext.Provider>
  );
}

export function usePageBuilder() {
  const context = useContext(PageBuilderContext);
  if (context === undefined) {
    throw new Error('usePageBuilder must be used within a PageBuilderProvider');
  }
  return context;
}

