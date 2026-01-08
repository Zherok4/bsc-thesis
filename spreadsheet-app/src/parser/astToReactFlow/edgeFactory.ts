import type { Edge } from "@xyflow/react";

/**
 * Factory function for creating ReactFlow edges
 */

/**
 * Data stored on user-created edges for undo/delete operations
 */
export interface UserEdgeData {
    /** Whether this edge was created by user interaction (vs AST parsing) */
    isUserCreated: boolean;
    /** The original expression that was replaced */
    originalExpression: string;
    /** The target handle ID (e.g., "arghandle-0") for looking up AST node */
    targetHandle: string;
    /** The target cell information */
    targetCell: {
        row: number;
        col: number;
        sheet: string;
    };
    /** Index signature for compatibility with Edge data type */
    [key: string]: unknown;
}

/**
 * Creates a default straight edge between two nodes
 * @param source - ID of the source node
 * @param target - ID of the target node
 * @param handleID - Optional target handle ID (used for function argument connections)
 * @param userData - Optional data for user-created edges (stores original expression for deletion)
 */
export function createDefaultEdge(
    source: string,
    target: string,
    handleID?: string,
    userData?: UserEdgeData
): Edge {
    const edgeId = handleID ? `${source}-${target}-${handleID}` : `${source}-${target}`;
    return {
        id: edgeId,
        source,
        target,
        type: "simplebezier",
        label: "",
        targetHandle: handleID,
        style: { strokeWidth: 5, stroke: 'lightgrey'},
        animated: true,
        data: userData,
    };
}
