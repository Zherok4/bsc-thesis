import { useState, useCallback } from 'react';

/**
 * Parameters for the useNodeExpansion hook
 */
export interface UseNodeExpansionParams {
    /** Whether edit mode is active (blocks expansion changes) */
    isEditModeActive: boolean;
}

/**
 * Return type for the useNodeExpansion hook
 */
export interface UseNodeExpansionReturn {
    /** Set of currently expanded node IDs */
    expandedNodeIds: Set<string>;
    /** Toggle expansion state of a node */
    handleToggleExpand: (nodeId: string) => void;
    /** Reset all expansions (clear the set) */
    resetExpansion: () => void;
}

/**
 * Hook to manage node expansion state in the graph.
 * Tracks which nodes are expanded and provides toggle functionality.
 * Blocks expansion changes while in edit mode.
 */
export function useNodeExpansion({
    isEditModeActive,
}: UseNodeExpansionParams): UseNodeExpansionReturn {
    const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

    /**
     * Toggle expansion state of a node.
     * Does nothing if edit mode is active (graph rebuilds are blocked in edit mode).
     */
    const handleToggleExpand = useCallback((nodeId: string) => {
        // Don't allow expansion changes in edit mode to prevent stale state
        // (graph rebuilds are blocked in edit mode, so expansion wouldn't be visible anyway)
        if (isEditModeActive) return;

        setExpandedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, [isEditModeActive]);

    /** Reset all expansions */
    const resetExpansion = useCallback(() => {
        setExpandedNodeIds(new Set());
    }, []);

    return {
        expandedNodeIds,
        handleToggleExpand,
        resetExpansion,
    };
}
