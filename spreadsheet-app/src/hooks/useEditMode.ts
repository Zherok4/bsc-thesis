import { useState, useCallback } from 'react';

/**
 * Return type for the useEditMode hook
 */
export interface UseEditModeReturn {
    /** Whether edit mode is currently active */
    isEditModeActive: boolean;
    /** ID of the node currently being edited, or null */
    editingNodeId: string | null;
    /** Reference key temporarily unmerged for individual editing */
    editingUnmergedRefKey: string | null;
    /** Enters edit mode, optionally targeting a specific node */
    enterEditMode: (nodeId?: string) => void;
    /** Exits edit mode and clears the editing state */
    exitEditMode: () => void;
    /** Unmerges a merged node temporarily for individual editing */
    handleUnmerge: (refKey: string) => void;
}

/**
 * Hook to manage edit mode state for graph editing.
 * Tracks whether editing is active, which node is being edited,
 * and handles temporary unmerging of merged nodes.
 */
export function useEditMode(): UseEditModeReturn {
    const [isEditModeActive, setEditModeInternal] = useState<boolean>(false);
    const [editingNodeId, setEditingNodeIdInternal] = useState<string | null>(null);
    const [editingUnmergedRefKey, setEditingUnmergedRefKey] = useState<string | null>(null);

    /**
     * Enters edit mode, optionally targeting a specific node
     */
    const enterEditMode = useCallback((nodeId?: string): void => {
        setEditModeInternal(true);
        setEditingNodeIdInternal(nodeId ?? null);
    }, []);

    /**
     * Exits edit mode and clears the editing node
     */
    const exitEditMode = useCallback((): void => {
        setEditModeInternal(false);
        setEditingNodeIdInternal(null);
        setEditingUnmergedRefKey(null); // Re-merge on exit
    }, []);

    /**
     * Unmerges a merged node temporarily for individual editing
     */
    const handleUnmerge = useCallback((refKey: string): void => {
        setEditingUnmergedRefKey(refKey);
        setEditingNodeIdInternal(null); // Clear current node selection, user will pick one
    }, []);

    return {
        isEditModeActive,
        editingNodeId,
        editingUnmergedRefKey,
        enterEditMode,
        exitEditMode,
        handleUnmerge,
    };
}
