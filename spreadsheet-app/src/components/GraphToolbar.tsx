import type { ReactElement } from 'react';
import { useGraphEditMode, useHyperFormula, type GraphEditModeContextValue, type HyperFormulaContextValue } from './context';
import './GraphToolbar.css';

/**
 * Props for the GraphToolbar component.
 */
interface GraphToolbarProps {
  /** The cell address currently being viewed in the graph (e.g., "B3") */
  currentCellAddress: string | null;
  /** The cell coordinates currently being viewed in the graph */
  currentCell: { row: number; col: number; sheet: string } | null;
  /** Whether the graph is out of sync with the current cell selection */
  hasPendingSync: boolean;
  /** The cell address to sync to (e.g., "B6"), shown in the sync button */
  pendingCellAddress: string | null;
  /** Callback to sync the graph to the current cell's AST */
  onSync: () => void;
  /** Callback to undo the last formula change */
  onUndo: () => void;
  /** Callback to redo the last undone formula change */
  onRedo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}

/**
 * Toolbar for the flow graph with mode toggle buttons.
 * Allows switching between preview mode (read-only) and edit mode.
 * Includes a sync button to manually update the graph to the current selection.
 */
export default function GraphToolbar({
  currentCellAddress,
  currentCell,
  hasPendingSync,
  pendingCellAddress,
  onSync,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: GraphToolbarProps): ReactElement {
  const { isEditModeActive, enterEditMode, exitEditMode }: GraphEditModeContextValue = useGraphEditMode();
  const { scrollToCell }: HyperFormulaContextValue = useHyperFormula();

  const handlePreviewMode = (): void => {
    exitEditMode();
  };

  const handleEditMode = (): void => {
    enterEditMode();
  };

  const handleNavigateToCell = (): void => {
    if (currentCell) {
      scrollToCell(currentCell.row, currentCell.col, currentCell.sheet);
    }
  };

  const shouldShowSyncButton = pendingCellAddress && currentCellAddress !== pendingCellAddress && !isEditModeActive;

  return (
    <div className="graph-toolbar">
      <button
        className={`toolbar-button ${!isEditModeActive ? 'previewMode' : ''}`}
        onClick={handlePreviewMode}
        title="Preview mode"
        aria-label="Preview mode"
      >
      </button>
      <button
        className={`toolbar-button ${isEditModeActive ? 'editMode' : ''}`}
        onClick={handleEditMode}
        title="Edit mode"
        aria-label="Edit mode"
      >
      </button>
      <div className="toolbar-divider" />
      <button
        className={`toolbar-button undo-button ${canUndo ? '' : 'disabled'}`}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        &#x21B6;
      </button>
      <button
        className={`toolbar-button redo-button ${canRedo ? '' : 'disabled'}`}
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        &#x21B7;
      </button>
      <div className="toolbar-divider" />
      {currentCellAddress && (
        <span
          className="current-cell-indicator"
          title="Click to navigate to this cell"
          onClick={handleNavigateToCell}
        >
          {currentCellAddress}
        </span>
      )}
      <button
        className={`toolbar-button sync-button ${shouldShowSyncButton ? 'visible' : 'hidden'}`}
        onClick={onSync}
        title="Sync graph to current selection"
        aria-label="Sync graph"
      >
        {`load ${pendingCellAddress} \u21BB`}
      </button>
    </div>
  );
}
