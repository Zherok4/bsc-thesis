import type { Edge } from "@xyflow/react";

/**
 * Factory function for creating ReactFlow edges
 */

/**
 * Creates a default straight edge between two nodes
 * @param source - ID of the source node
 * @param target - ID of the target node
 * @param handleID - Optional target handle ID (used for function argument connections)
 */
export function createDefaultEdge(
    source: string,
    target: string,
    handleID?: string
): Edge {
    return {
        id: `${source}-${target}`,
        source,
        target,
        type: "simplebezier",
        label: "",
        targetHandle: handleID,
    };
}
