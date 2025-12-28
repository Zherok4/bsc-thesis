import type { Edge, Node } from "@xyflow/react";
import type { Graph, MergeConfig } from "./types";

// Re-export MergeConfig for convenience
export type { MergeConfig };

/**
 * Context passed to the merge function
 */
export interface MergeContext {
    /** Maximum edge distance for merging */
    maxDistance: number;
    /** Active sheet name for normalizing references without explicit sheet */
    activeSheetName: string;
}

/**
 * Internal type for reference node data
 */
interface ReferenceNodeData {
    reference: string;
    sheet?: string;
    hasFormula?: boolean;
}

/**
 * Internal type for range node data (supports cell, column, and row ranges)
 */
interface RangeNodeData {
    rangeType?: "cell" | "column" | "row";
    // Cell range properties
    startReference?: string;
    endReference?: string;
    // Column range properties
    startColumn?: string;
    endColumn?: string;
    // Row range properties
    startRow?: number;
    endRow?: number;
    sheet?: string;
}

/**
 * Generates a unique key for a reference or range node based on its address.
 * Format: "cell:Sheet1:A1" for cells, "range:Sheet1:A1:B10" for cell ranges,
 * "colrange:Sheet1:A:B" for column ranges, "rowrange:Sheet1:1:10" for row ranges
 *
 * @param node - The node to generate a key for
 * @param activeSheetName - Default sheet name when node doesn't specify one
 * @returns The key string, or null if node is not a reference/range type
 */
function getReferenceKey(node: Node, activeSheetName: string): string | null {
    if (node.type === "ReferenceNode") {
        const data = node.data as unknown as ReferenceNodeData;
        const sheet = data.sheet || activeSheetName;
        return `cell:${sheet}:${data.reference}`;
    }
    if (node.type === "RangeNode") {
        const data = node.data as unknown as RangeNodeData;
        const sheet = data.sheet || activeSheetName;
        const rangeType = data.rangeType ?? "cell";

        switch (rangeType) {
            case "column":
                return `colrange:${sheet}:${data.startColumn}:${data.endColumn}`;
            case "row":
                return `rowrange:${sheet}:${data.startRow}:${data.endRow}`;
            case "cell":
            default:
                return `range:${sheet}:${data.startReference}:${data.endReference}`;
        }
    }
    return null;
}

/**
 * Groups all reference and range nodes by their reference key.
 *
 * @param nodes - All nodes in the graph
 * @param activeSheetName - Default sheet name for nodes without explicit sheet
 * @returns Map from reference key to array of nodes with that key
 */
function buildReferenceIndex(
    nodes: Node[],
    activeSheetName: string
): Map<string, Node[]> {
    const index = new Map<string, Node[]>();

    for (const node of nodes) {
        const key = getReferenceKey(node, activeSheetName);
        if (key) {
            const existing = index.get(key);
            if (existing) {
                existing.push(node);
            } else {
                index.set(key, [node]);
            }
        }
    }

    return index;
}

/**
 * Builds an undirected adjacency graph for BFS distance calculation.
 * Edges are treated as bidirectional.
 *
 * @param edges - All edges in the graph
 * @returns Map from node ID to set of adjacent node IDs
 */
function buildAdjacencyGraph(edges: Edge[]): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();

    for (const edge of edges) {
        // Ensure both nodes have entries
        if (!adjacency.has(edge.source)) {
            adjacency.set(edge.source, new Set());
        }
        if (!adjacency.has(edge.target)) {
            adjacency.set(edge.target, new Set());
        }

        // Add bidirectional connections
        adjacency.get(edge.source)!.add(edge.target);
        adjacency.get(edge.target)!.add(edge.source);
    }

    return adjacency;
}

/**
 * Calculates the shortest path distance between two nodes using BFS.
 * Uses early termination when distance exceeds maxDistance for efficiency.
 *
 * @param nodeA - ID of the first node
 * @param nodeB - ID of the second node
 * @param adjacency - Adjacency map from buildAdjacencyGraph
 * @param maxDistance - Maximum distance to search (for early termination)
 * @returns The distance, or null if nodes are more than maxDistance apart
 */
function getDistance(
    nodeA: string,
    nodeB: string,
    adjacency: Map<string, Set<string>>,
    maxDistance: number
): number | null {
    if (nodeA === nodeB) return 0;

    const visited = new Set<string>([nodeA]);
    const queue: Array<{ nodeId: string; distance: number }> = [
        { nodeId: nodeA, distance: 0 },
    ];

    while (queue.length > 0) {
        const { nodeId, distance } = queue.shift()!;

        // Pruning: don't explore beyond maxDistance
        if (distance >= maxDistance) {
            continue;
        }

        const neighbors = adjacency.get(nodeId);
        if (!neighbors) continue;

        for (const neighbor of neighbors) {
            if (neighbor === nodeB) {
                return distance + 1;
            }
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ nodeId: neighbor, distance: distance + 1 });
            }
        }
    }

    return null; // No path within maxDistance
}

/**
 * Groups duplicate nodes that are within maxDistance edges of each other.
 * Uses a clustering approach where nodes within distance form a group.
 *
 * @param duplicateNodes - Array of nodes that reference the same cell/range
 * @param adjacency - Adjacency map for distance calculation
 * @param maxDistance - Maximum edge distance for nodes to be in same group
 * @returns Array of node groups, where each group should be merged
 */
function findMergeGroups(
    duplicateNodes: Node[],
    adjacency: Map<string, Set<string>>,
    maxDistance: number
): Node[][] {
    const mergeGroups: Node[][] = [];
    const assigned = new Set<string>();

    for (let i = 0; i < duplicateNodes.length; i++) {
        const currentNode = duplicateNodes[i];
        if (assigned.has(currentNode.id)) continue;

        const group: Node[] = [currentNode];
        assigned.add(currentNode.id);

        // Check remaining nodes for proximity to any node in the current group
        for (let j = i + 1; j < duplicateNodes.length; j++) {
            const candidateNode = duplicateNodes[j];
            if (assigned.has(candidateNode.id)) continue;

            // Check if candidate is within distance of any node in the group
            const withinDistance = group.some((groupNode) => {
                const dist = getDistance(
                    groupNode.id,
                    candidateNode.id,
                    adjacency,
                    maxDistance
                );
                return dist !== null && dist <= maxDistance;
            });

            if (withinDistance) {
                group.push(candidateNode);
                assigned.add(candidateNode.id);
            }
        }

        // Only include groups with more than one node (actual merges)
        if (group.length > 1) {
            mergeGroups.push(group);
        }
    }

    return mergeGroups;
}

/**
 * Executes the merge operation: removes duplicate nodes and rewires edges.
 *
 * @param nodes - All nodes in the graph
 * @param edges - All edges in the graph
 * @param mergeGroups - Groups of nodes to merge (from findMergeGroups)
 * @returns Object containing filtered nodes, rewired edges, and merge mapping
 */
function executeMerge(
    nodes: Node[],
    edges: Edge[],
    mergeGroups: Node[][]
): { nodes: Node[]; edges: Edge[] } {
    // Build merge mapping: old node ID -> canonical node ID
    const mergeMap = new Map<string, string>();
    const nodesToRemove = new Set<string>();

    for (const group of mergeGroups) {
        // Keep the first node as canonical
        const canonicalNode = group[0];

        // Merge hasFormula property: if any node has it, canonical should have it
        if (canonicalNode.type === "ReferenceNode") {
            const hasFormulaInAny = group.some(
                (n) => (n.data as unknown as ReferenceNodeData).hasFormula
            );
            if (hasFormulaInAny) {
                (canonicalNode.data as unknown as ReferenceNodeData).hasFormula = true;
            }
        }

        // Map all other nodes in group to canonical
        for (let i = 1; i < group.length; i++) {
            mergeMap.set(group[i].id, canonicalNode.id);
            nodesToRemove.add(group[i].id);
        }
    }

    // Filter out merged nodes
    const resultNodes = nodes.filter((n) => !nodesToRemove.has(n.id));

    // Rewire edges and deduplicate
    const seenEdges = new Set<string>();
    const resultEdges: Edge[] = [];

    for (const edge of edges) {
        const newSource = mergeMap.get(edge.source) || edge.source;
        const newTarget = mergeMap.get(edge.target) || edge.target;

        // Skip self-loops created by merging
        if (newSource === newTarget) continue;

        // Deduplicate edges (same source, target, and handle)
        const edgeKey = `${newSource}-${newTarget}-${edge.targetHandle || ""}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);

        resultEdges.push({
            ...edge,
            id: `${newSource}-${newTarget}${edge.targetHandle ? `-${edge.targetHandle}` : ""}`,
            source: newSource,
            target: newTarget,
        });
    }

    return { nodes: resultNodes, edges: resultEdges };
}

/**
 * Merges duplicate cell/range reference nodes that are within N edges of each other.
 * This improves graph readability by consolidating repeated references.
 *
 * @param graph - The original graph with nodes and edges
 * @param context - Merge configuration including maxDistance and activeSheetName
 * @returns Graph with merged nodes and rewired edges
 */
export function mergeDuplicateReferences(
    graph: Graph,
    context: MergeContext
): Graph {
    const { nodes, edges } = graph;
    const { maxDistance, activeSheetName } = context;

    // Step 1: Build reference index (group nodes by reference key)
    const referenceIndex = buildReferenceIndex(nodes, activeSheetName);

    // Step 2: Build adjacency graph for distance calculation
    const adjacency = buildAdjacencyGraph(edges);

    // Step 3: Find all merge groups
    const allMergeGroups: Node[][] = [];
    for (const duplicateNodes of referenceIndex.values()) {
        if (duplicateNodes.length > 1) {
            const groups = findMergeGroups(duplicateNodes, adjacency, maxDistance);
            allMergeGroups.push(...groups);
        }
    }

    // Step 4: Execute merge if there are groups to merge
    if (allMergeGroups.length === 0) {
        return graph; // No merging needed
    }

    const result = executeMerge(nodes, edges, allMergeGroups);
    return { nodes: result.nodes, edges: result.edges };
}
