import { createContext, useContext, useState, useCallback, useRef, type ReactNode, type JSX } from 'react';

/**
 * State representing the current edge drag operation
 */
interface ConnectionDragState {
    /** Whether an edge is currently being dragged */
    isDragging: boolean;
    /** The ID of the source node being dragged from */
    sourceNodeId: string | null;
    /** The type of the source node */
    sourceNodeType: string | null;
    /** Set of valid target handles in format "nodeId:handleId" */
    validTargetHandles: Set<string>;
}

/**
 * Context value for connection drag state management
 */
export interface ConnectionDragContextValue {
    /** Current drag state */
    state: ConnectionDragState;
    /** Start a new drag operation */
    startDrag: (sourceNodeId: string, sourceNodeType: string, validHandles: Set<string>) => void;
    /** End the current drag operation */
    endDrag: () => void;
    /** Check if a specific handle is valid for the current drag */
    isHandleValid: (nodeId: string, handleId: string) => boolean;
    /** Get current source node ID (ref-based, safe for use in callbacks) */
    getSourceNodeId: () => string | null;
}

const defaultState: ConnectionDragState = {
    isDragging: false,
    sourceNodeId: null,
    sourceNodeType: null,
    validTargetHandles: new Set(),
};

const defaultContextValue: ConnectionDragContextValue = {
    state: defaultState,
    startDrag: () => {},
    endDrag: () => {},
    isHandleValid: () => true,
    getSourceNodeId: () => null,
};

export const ConnectionDragContext = createContext<ConnectionDragContextValue>(defaultContextValue);

interface ConnectionDragProviderProps {
    children: ReactNode;
}

/**
 * Provider component for connection drag state.
 * Wrap this around components that need access to drag state.
 */
export function ConnectionDragProvider({ children }: ConnectionDragProviderProps): JSX.Element {
    const [state, setState] = useState<ConnectionDragState>(defaultState);
    // Ref to track source node ID for use in callbacks (avoids stale closure issues)
    const sourceNodeIdRef = useRef<string | null>(null);

    const startDrag = useCallback((sourceNodeId: string, sourceNodeType: string, validHandles: Set<string>) => {
        sourceNodeIdRef.current = sourceNodeId;
        setState({
            isDragging: true,
            sourceNodeId,
            sourceNodeType,
            validTargetHandles: validHandles,
        });
    }, []);

    const endDrag = useCallback(() => {
        sourceNodeIdRef.current = null;
        setState(defaultState);
    }, []);

    const isHandleValid = useCallback((nodeId: string, handleId: string): boolean => {
        if (!state.isDragging) return true;
        // Source node's handles are never valid targets
        if (nodeId === state.sourceNodeId) return false;
        return state.validTargetHandles.has(`${nodeId}:${handleId}`);
    }, [state.isDragging, state.sourceNodeId, state.validTargetHandles]);

    const getSourceNodeId = useCallback((): string | null => {
        return sourceNodeIdRef.current;
    }, []);

    const value: ConnectionDragContextValue = {
        state,
        startDrag,
        endDrag,
        isHandleValid,
        getSourceNodeId,
    };

    return (
        <ConnectionDragContext.Provider value={value}>
            {children}
        </ConnectionDragContext.Provider>
    );
}

/**
 * Hook to access connection drag state and actions
 */
export function useConnectionDrag(): ConnectionDragContextValue {
    const context = useContext(ConnectionDragContext);
    if (!context) {
        throw new Error('useConnectionDrag must be used within a ConnectionDragProvider');
    }
    return context;
}
