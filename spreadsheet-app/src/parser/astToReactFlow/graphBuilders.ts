import type { Edge, Node } from "@xyflow/react";
import type { CollapsedNode } from "../collapseAST";
import type { ASTNode } from "../visitor";
import { mergeDuplicateReferences } from "./mergeReferences";
import type { ExpansionContext, Graph, MergeConfig } from "./types";
import { visitCollapsedNodeWithExpansion } from "./visitors";

/**
 * Generic visitor function type for AST or CollapsedNode traversal
 */
type VisitorFunction<T> = (
    visitedObject: T,
    nodes: Node[],
    edges: Edge[],
    parentID: string
) => void;

/**
 * Generic graph builder that uses a provided visitor function.
 * This allows flexibility in how the AST is traversed and converted.
 *
 * @param nodeToVisit - The AST or CollapsedNode to convert
 * @param visitMethod - The visitor function to use for traversal
 * @returns A Graph containing nodes and edges
 */
export function toGraph<T extends ASTNode | CollapsedNode>(
    nodeToVisit: T,
    visitMethod: VisitorFunction<T>
): Graph {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    visitMethod(nodeToVisit, nodes, edges, "-1");
    return {
        nodes,
        edges,
    };
}

/**
 * Builds a ReactFlow graph from a collapsed AST with full expansion support.
 * This is the primary function used by the Sidebar component.
 *
 * @param collapsedNode - The collapsed AST node to convert
 * @param context - Expansion context with state and callbacks
 * @param mergeConfig - Optional configuration for merging duplicate reference nodes
 * @returns A Graph containing nodes and edges
 */
export function toGraphWithExpansion(
    collapsedNode: CollapsedNode,
    context: ExpansionContext,
    mergeConfig?: MergeConfig
): Graph {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    visitCollapsedNodeWithExpansion(
        collapsedNode,
        nodes,
        edges,
        "-1",
        context,
        undefined,
        "root"
    );

    const graph: Graph = { nodes, edges };

    // Apply reference merging if enabled
    if (mergeConfig?.enabled) {
        return mergeDuplicateReferences(graph, {
            maxDistance: mergeConfig.maxDistance,
            activeSheetName: context.activeSheetName,
        });
    }

    return graph;
}
