import type { ReactElement } from 'react';
import { useGraphEditMode, type GraphEditModeContextValue } from './context';
import './GraphToolbar.css';

/**
 * Props for the GraphToolbar component.
 */
interface GraphToolbarProps {
  /** The cell address currently being viewed in the graph (e.g., "B3") */
  currentCellAddress: string | null;
  /** Whether the graph is out of sync with the current cell selection */
  hasPendingSync: boolean;
  /** The cell address to sync to (e.g., "B6"), shown in the sync button */
  pendingCellAddress: string | null;
  /** Callback to sync the graph to the current cell's AST */
  onSync: () => void;
}

/**
 * Toolbar for the flow graph with mode toggle buttons.
 * Allows switching between preview mode (read-only) and edit mode.
 * Includes a sync button to manually update the graph to the current selection.
 */
export default function GraphToolbar({ currentCellAddress, hasPendingSync, pendingCellAddress, onSync }: GraphToolbarProps): ReactElement {
  const { isEditModeActive, enterEditMode, exitEditMode }: GraphEditModeContextValue = useGraphEditMode();

  const handlePreviewMode = (): void => {
    exitEditMode();
  };

  const handleEditMode = (): void => {
    enterEditMode();
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
      {currentCellAddress && (
        <span className="current-cell-indicator" title="Currently viewing">
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
