import { useEffect } from 'react';

/**
 * Parameters for the useGraphKeyboardShortcuts hook
 */
export interface UseGraphKeyboardShortcutsParams {
    /** Whether edit mode is currently active */
    isEditModeActive: boolean;
    /** Callback to exit edit mode */
    exitEditMode: () => void;
    /** Callback to handle undo action */
    handleUndo: () => void;
    /** Callback to handle redo action */
    handleRedo: () => void;
    /** Currently selected cell in the spreadsheet */
    selectedCell: { row: number; col: number } | null;
    /** Callback to scroll to a cell in the spreadsheet */
    scrollToCell: (row: number, col: number, sheet?: string) => void;
    /** Name of the active spreadsheet sheet */
    activeSheetName: string;
}

/**
 * Hook to handle keyboard shortcuts for the graph.
 * - Escape: Exit edit mode and scroll back to selected cell
 * - Ctrl+Z: Undo
 * - Ctrl+Shift+Z / Ctrl+Y: Redo
 */
export function useGraphKeyboardShortcuts({
    isEditModeActive,
    exitEditMode,
    handleUndo,
    handleRedo,
    selectedCell,
    scrollToCell,
    activeSheetName,
}: UseGraphKeyboardShortcutsParams): void {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            // Escape to exit edit mode
            if (e.key === 'Escape' && isEditModeActive) {
                exitEditMode();
                if (selectedCell !== null) {
                    scrollToCell(selectedCell.row, selectedCell.col, activeSheetName);
                }
                return;
            }

            // Undo: Ctrl+Z (or Cmd+Z on Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Redo: Ctrl+Shift+Z or Ctrl+Y (or Cmd+Shift+Z on Mac)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
                e.preventDefault();
                handleRedo();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditModeActive, exitEditMode, handleUndo, handleRedo, selectedCell, scrollToCell, activeSheetName]);
}
