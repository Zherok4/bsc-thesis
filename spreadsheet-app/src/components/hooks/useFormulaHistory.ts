import { useState, useCallback, useRef } from 'react';

/**
 * Represents a single state in the formula history
 */
interface HistoryEntry {
    /** The formula string at this state */
    formula: string;
    /** The cell this formula belongs to */
    cell: {
        row: number;
        col: number;
        sheet: string;
    };
}

/**
 * Return type for the useFormulaHistory hook
 */
export interface FormulaHistoryState {
    /** Whether undo is available */
    canUndo: boolean;
    /** Whether redo is available */
    canRedo: boolean;
    /** Push a new formula state to history */
    push: (formula: string, row: number, col: number, sheet: string) => void;
    /** Undo to the previous state, returns the formula to restore or null */
    undo: () => HistoryEntry | null;
    /** Redo to the next state, returns the formula to restore or null */
    redo: () => HistoryEntry | null;
    /** Clear history (e.g., when switching cells) */
    clear: () => void;
    /** Get the current history length */
    historyLength: number;
    /** Get current position in history */
    currentIndex: number;
}

/** Maximum number of history entries to keep */
const MAX_HISTORY_SIZE = 50;

/**
 * Hook to manage formula history for undo/redo functionality.
 * Tracks changes to formulas and allows navigating through the history.
 */
export function useFormulaHistory(): FormulaHistoryState {
    // History stack - array of formula states
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    // Current position in history (-1 means at the latest state)
    const [currentIndex, setCurrentIndex] = useState<number>(-1);

    // Use ref to avoid stale closure issues in callbacks
    const historyRef = useRef(history);
    const currentIndexRef = useRef(currentIndex);
    historyRef.current = history;
    currentIndexRef.current = currentIndex;

    /**
     * Push a new formula state to history.
     * Clears any redo states if we're not at the end of history.
     */
    const push = useCallback((formula: string, row: number, col: number, sheet: string) => {
        setHistory(prev => {
            // If we're in the middle of history (after undo), truncate redo states
            let newHistory = currentIndexRef.current >= 0
                ? prev.slice(0, currentIndexRef.current + 1)
                : prev;

            // Add new entry
            const newEntry: HistoryEntry = {
                formula,
                cell: { row, col, sheet }
            };
            newHistory = [...newHistory, newEntry];

            // Limit history size
            if (newHistory.length > MAX_HISTORY_SIZE) {
                newHistory = newHistory.slice(-MAX_HISTORY_SIZE);
            }

            return newHistory;
        });

        // Reset to end of history
        setCurrentIndex(-1);
    }, []);

    /**
     * Undo to the previous state.
     * Returns the previous formula entry, or null if can't undo.
     */
    const undo = useCallback((): HistoryEntry | null => {
        const hist = historyRef.current;
        const idx = currentIndexRef.current;

        if (hist.length < 2) {
            return null; // Need at least 2 entries to undo
        }

        // Calculate the index to go to
        const currentPos = idx === -1 ? hist.length - 1 : idx;
        const newPos = currentPos - 1;

        if (newPos < 0) {
            return null; // Can't undo further
        }

        setCurrentIndex(newPos);
        return hist[newPos];
    }, []);

    /**
     * Redo to the next state.
     * Returns the next formula entry, or null if can't redo.
     */
    const redo = useCallback((): HistoryEntry | null => {
        const hist = historyRef.current;
        const idx = currentIndexRef.current;

        if (idx === -1 || idx >= hist.length - 1) {
            return null; // Already at the end or nothing to redo
        }

        const newPos = idx + 1;

        // If we're going to the last entry, set to -1 (natural end)
        if (newPos === hist.length - 1) {
            setCurrentIndex(-1);
        } else {
            setCurrentIndex(newPos);
        }

        return hist[newPos];
    }, []);

    /**
     * Clear all history
     */
    const clear = useCallback(() => {
        setHistory([]);
        setCurrentIndex(-1);
    }, []);

    // Calculate canUndo and canRedo
    const currentPos = currentIndex === -1 ? history.length - 1 : currentIndex;
    const canUndo = history.length >= 2 && currentPos > 0;
    const canRedo = currentIndex !== -1 && currentIndex < history.length - 1;

    return {
        canUndo,
        canRedo,
        push,
        undo,
        redo,
        clear,
        historyLength: history.length,
        currentIndex,
    };
}
