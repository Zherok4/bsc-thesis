import { createContext, useContext } from 'react';

/**
 * Context value for managing graph edit mode state.
 * Provides standardized functions for entering and exiting edit mode.
 */
export interface GraphEditModeContextValue {
    /** Indicates whether the user is in editing mode and can actively change values of nodes */
    isEditModeActive: boolean;
    /** The ID of the node currently being edited. Null when not in edit mode or no specific node selected */
    editingNodeId: string | null;
    /**
     * Enters edit mode, optionally targeting a specific node.
     * @param nodeId - Optional ID of the node to edit. If omitted, enters edit mode without a target node.
     */
    enterEditMode: (nodeId?: string) => void;
    /**
     * Exits edit mode and clears the editing node ID.
     * This is the only way to properly exit edit mode.
     */
    exitEditMode: () => void;
}

const GraphEditModeContext = createContext<GraphEditModeContextValue | undefined>(undefined);

export function useGraphEditMode(): GraphEditModeContextValue {
    const context = useContext(GraphEditModeContext);
    if (context === undefined) {
        throw new Error('useGraphEditMode must be used within a GraphEditModeContext.Provider');
    }
    return context;
}

export { GraphEditModeContext };
