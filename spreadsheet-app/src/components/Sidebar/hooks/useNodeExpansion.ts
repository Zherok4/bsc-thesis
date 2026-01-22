import { useState, useCallback, useRef } from 'react';

/**
 * Parameters for the useNodeExpansion hook
 */
export interface UseNodeExpansionParams {
    /** Whether edit mode is active (blocks expansion changes) */
    isEditModeActive: boolean;
}

/**
 * Pending expansion/collapse action for panning
 */
export interface PendingExpansionAction {
    /** The expansion node ID */
    nodeId: string;
    /** Whether this is an expand or collapse action */
    type: 'expand' | 'collapse';
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
    /** Ref containing the pending expansion/collapse action (for panning) */
    pendingExpansionRef: React.MutableRefObject<PendingExpansionAction | null>;
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
    /** Ref to track a pending expansion/collapse action (for panning after layout) */
    const pendingExpansionRef = useRef<PendingExpansionAction | null>(null);

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
                // Track this node for centering on collapse
                pendingExpansionRef.current = { nodeId, type: 'collapse' };
            } else {
                next.add(nodeId);
                // Track this node for centering on expand
                pendingExpansionRef.current = { nodeId, type: 'expand' };
            }
            return next;
        });
    }, [isEditModeActive]);

    /** Reset all expansions */
    const resetExpansion = useCallback(() => {
        setExpandedNodeIds(new Set());
        pendingExpansionRef.current = null;
    }, []);

    return {
        expandedNodeIds,
        handleToggleExpand,
        resetExpansion,
        pendingExpansionRef,
    };
}
