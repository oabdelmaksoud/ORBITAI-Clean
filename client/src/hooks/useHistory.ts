import { useState, useCallback, useRef } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

import { useState, useCallback, useMemo } from 'react';

export function useHistory<T>(initialState: T, maxHistorySize: number = 50) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  // Memoize these to prevent unnecessary recalculations
  const canUndo = useMemo(() => history.past.length > 0, [history.past.length]);
  const canRedo = useMemo(() => history.future.length > 0, [history.future.length]);

  const setState = useCallback((newState: T, addToHistory: boolean = true) => {
    if (addToHistory) {
      setHistory(current => {
        const newPast = [...current.past, current.present].slice(-maxHistorySize);
        return {
          past: newPast,
          present: newState,
          future: [] // Clear future when new action is performed
        };
      });
    } else {
      setHistory(current => ({
        ...current,
        present: newState
      }));
    }
  }, [maxHistorySize]);

  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory(current => {
      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, -1);
      const newFuture = [current.present, ...current.future];

      return {
        past: newPast,
        present: previous,
        future: newFuture
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory(current => {
      const next = current.future[0];
      const newFuture = current.future.slice(1);
      const newPast = [...current.past, current.present];

      return {
        past: newPast,
        present: next,
        future: newFuture
      };
    });
  }, [canRedo]);

  const clearHistory = useCallback(() => {
    setHistory({
      past: [],
      present: history.present,
      future: []
    });
  }, [history.present]);

  // Memoize historySize calculation
  const historySize = useMemo(
    () => history.past.length + history.future.length,
    [history.past.length, history.future.length]
  );

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    historySize
  };
}

