import { useGraphEditMode, type GraphEditModeContextValue } from './context';
import './GraphToolbar.css';

/**
 * Toolbar for the flow graph with mode toggle buttons.
 * Allows switching between preview mode (read-only) and edit mode.
 */
export default function GraphToolbar() {
  const { isEditModeActive, setEditMode, setEditingNodeId }: GraphEditModeContextValue = useGraphEditMode();

  const handlePreviewMode = () => {
    setEditMode(false);
    setEditingNodeId(null);
  };

  const handleEditMode = () => {
    setEditMode(true);
  };

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
    </div>
  );
}
