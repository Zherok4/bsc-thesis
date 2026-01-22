import { useState, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import type { Edge, Node, NodeChange, NodeDimensionChange } from '@xyflow/react';
import type { NodeDimensionsMap } from '../../../parser/dagreLayout';
import type { CollapsedNode } from '../../../parser/collapseAST';
import type { PendingExpansionAction } from './useNodeExpansion';

/** Percentage of nodes that must have measured dimensions before relayout */
const MEASUREMENT_COVERAGE_THRESHOLD = 0.8;
/** Debounce time before applying relayout after dimension changes */
const LAYOUT_DEBOUNCE_MS = 50;
/** Padding for fitView */
const FIT_VIEW_PADDING = 0.1;
/** Threshold for considering a dimension change significant */
const DIMENSION_CHANGE_THRESHOLD = 1;
/** Animation duration for panning to expanded/collapsed nodes (ms) */
const CENTER_PAN_DURATION = 300;

/**
 * Find the reference node by its expansion node ID.
 */
function findReferenceNode(expansionNodeId: string, nodes: Node[]): Node | undefined {
    return nodes.find(node =>
        node.data &&
        typeof node.data === 'object' &&
        'expansionNodeId' in node.data &&
        node.data.expansionNodeId === expansionNodeId
    );
}

/**
 * Find all upstream nodes (the expanded subtree) for a reference node.
 * Returns the reference node and all its upstream nodes (sources that feed into it).
 */
function findExpansionSubtreeNodes(referenceNode: Node, nodes: Node[], edges: Edge[]): Node[] {
    const targetNodes: Node[] = [referenceNode];
    const targetNodeIds = new Set<string>([referenceNode.id]);

    // Find all upstream nodes (sources that connect to this reference node)
    const upstreamEdges = edges.filter(edge => edge.target === referenceNode.id);
    for (const edge of upstreamEdges) {
        if (!targetNodeIds.has(edge.source)) {
            const node = nodes.find(n => n.id === edge.source);
            if (node) {
                targetNodeIds.add(edge.source);
                targetNodes.push(node);
            }
        }
    }

    // Recursively find upstream nodes (nodes that feed into the immediate upstream)
    const queue = [...upstreamEdges.map(e => e.source)];

    while (queue.length > 0) {
        const currentNodeId = queue.shift()!;
        const currentUpstreamEdges = edges.filter(edge => edge.target === currentNodeId);
        for (const edge of currentUpstreamEdges) {
            if (!targetNodeIds.has(edge.source)) {
                const node = nodes.find(n => n.id === edge.source);
                if (node) {
                    targetNodeIds.add(edge.source);
                    targetNodes.push(node);
                    queue.push(edge.source);
                }
            }
        }
    }

    return targetNodes;
}

/**
 * Calculate the center point of a group of nodes.
 */
function calculateNodesCenter(nodes: Node[]): { x: number; y: number } | null {
    if (nodes.length === 0) return null;

    let sumX = 0;
    let sumY = 0;

    for (const node of nodes) {
        const width = node.measured?.width ?? node.width ?? 100;
        const height = node.measured?.height ?? node.height ?? 40;
        sumX += node.position.x + width / 2;
        sumY += node.position.y + height / 2;
    }

    return {
        x: sumX / nodes.length,
        y: sumY / nodes.length,
    };
}

/**
 * Find the parent node of a reference node.
 * Returns the parent node or the reference node if no parent exists.
 */
function findParentNode(referenceNode: Node, nodes: Node[], edges: Edge[]): Node {
    // Find the parent node (the node that this reference feeds into)
    const outgoingEdge = edges.find(edge => edge.source === referenceNode.id);
    if (!outgoingEdge) {
        // No parent found, return the reference node
        return referenceNode;
    }

    const parentNode = nodes.find(n => n.id === outgoingEdge.target);
    return parentNode ?? referenceNode;
}

/**
 * Check if dimensions have changed significantly
 */
const hasDimensionChanged = (
    existing: { width: number; height: number } | undefined,
    newDims: { width: number; height: number }
): boolean => !existing ||
    Math.abs(existing.width - newDims.width) > DIMENSION_CHANGE_THRESHOLD ||
    Math.abs(existing.height - newDims.height) > DIMENSION_CHANGE_THRESHOLD;

/**
 * Parameters for the useGraphLayout hook
 */
export interface UseGraphLayoutParams {
    /** Current nodes in the graph */
    nodes: Node[];
    /** Setter for nodes */
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    /** Setter for edges */
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    /** Original onNodesChange from useNodesState */
    onNodesChange: (changes: NodeChange<Node>[]) => void;
    /** The collapsed AST tree */
    collapsedTree: CollapsedNode | null;
    /** Function to build the graph from collapsed tree */
    buildGraph: (tree: CollapsedNode, dimensions?: NodeDimensionsMap) => { nodes: Node[]; edges: Edge[] };
    /** ReactFlow's fitView function */
    fitView: (options?: { padding?: number; nodes?: Array<{ id: string }>; duration?: number }) => void;
    /** ReactFlow's setCenter function */
    setCenter: (x: number, y: number, options?: { duration?: number; zoom?: number }) => void;
    /** ReactFlow's getZoom function */
    getZoom: () => number;
    /** Whether edit mode is active (blocks rebuilds) */
    isEditModeActive: boolean;
    /** Version counter that triggers rebuilds when values change */
    valuesVersion: number;
    /** Ref to track if fitView should be called on next render */
    fitViewOnNextRenderRef: MutableRefObject<boolean>;
    /** Ref containing the pending expansion/collapse action (for panning) */
    pendingExpansionRef: MutableRefObject<PendingExpansionAction | null>;
}

/**
 * Return type for the useGraphLayout hook
 */
export interface UseGraphLayoutReturn {
    /** Map of measured node dimensions */
    measuredDimensions: NodeDimensionsMap;
    /** Wrapped onNodesChange that tracks dimension measurements */
    handleNodesChange: (changes: NodeChange<Node>[]) => void;
}

/**
 * Hook to manage graph layout with dimension-based relayout.
 * Tracks node measurements and triggers relayout when dimensions change.
 */
export function useGraphLayout({
    nodes,
    setNodes,
    setEdges,
    onNodesChange,
    collapsedTree,
    buildGraph,
    fitView,
    setCenter,
    getZoom,
    isEditModeActive,
    valuesVersion,
    fitViewOnNextRenderRef,
    pendingExpansionRef,
}: UseGraphLayoutParams): UseGraphLayoutReturn {
    const [measuredDimensions, setMeasuredDimensions] = useState<NodeDimensionsMap>(new Map());
    const [needsRelayout, setNeedsRelayout] = useState(false);
    const layoutVersionRef = useRef(0);

    /**
     * Wrapped onNodesChange that tracks dimension measurements
     */
    const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
        onNodesChange(changes);

        const dimensionChanges = changes.filter(
            (change): change is NodeDimensionChange =>
                change.type === 'dimensions' &&
                change.dimensions !== undefined
        );

        if (dimensionChanges.length > 0) {
            setMeasuredDimensions(prev => {
                const next = new Map(prev);
                let hasChanges = false;

                for (const change of dimensionChanges) {
                    const existing = next.get(change.id);
                    const newDims = change.dimensions!;

                    if (hasDimensionChanged(existing, newDims)) {
                        next.set(change.id, { width: newDims.width, height: newDims.height });
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    setNeedsRelayout(true);
                }

                return hasChanges ? next : prev;
            });
        }
    }, [onNodesChange]);

    /**
     * Initial layout effect - builds graph when collapsed tree changes
     */
    useEffect(() => {
        if (isEditModeActive) return;

        if (collapsedTree === null) {
            setNodes([]);
            setEdges([]);
            setMeasuredDimensions(new Map());
            return;
        }

        layoutVersionRef.current += 1;
        const layoutedGraph = buildGraph(collapsedTree);
        setNodes(layoutedGraph.nodes);
        setEdges(layoutedGraph.edges);
        setMeasuredDimensions(new Map());
        setNeedsRelayout(false);

        // Don't pan here - wait for relayout with measured dimensions for accurate positioning
        if (!pendingExpansionRef.current && fitViewOnNextRenderRef.current) {
            setTimeout(() => fitView({ padding: FIT_VIEW_PADDING }), 0);
        }
    }, [collapsedTree, buildGraph, setNodes, setEdges, fitView, isEditModeActive, valuesVersion, pendingExpansionRef]);

    /**
     * Relayout effect - applies layout with measured dimensions
     */
    useEffect(() => {
        if (!needsRelayout || measuredDimensions.size === 0) {
            return;
        }

        const measurementCoverage = measuredDimensions.size / nodes.length;
        if (measurementCoverage < MEASUREMENT_COVERAGE_THRESHOLD) {
            return;
        }

        const currentGeneration = layoutVersionRef.current;
        // Capture the pending expansion action before async timeout
        const pendingAction = pendingExpansionRef.current;

        const timeoutId = setTimeout(() => {
            if (layoutVersionRef.current !== currentGeneration) {
                return;
            }
            if (collapsedTree === null) return;

            const layoutedGraph = buildGraph(collapsedTree, measuredDimensions);
            setNodes(layoutedGraph.nodes);
            setEdges(layoutedGraph.edges);
            setNeedsRelayout(false);

            // Center on nodes based on pending expand/collapse action
            if (pendingAction) {
                const referenceNode = findReferenceNode(pendingAction.nodeId, layoutedGraph.nodes);

                if (referenceNode) {
                    let centerPoint: { x: number; y: number } | null = null;

                    if (pendingAction.type === 'expand') {
                        // Center on the expanded subtree (reference node + upstream nodes)
                        const subtreeNodes = findExpansionSubtreeNodes(referenceNode, layoutedGraph.nodes, layoutedGraph.edges);
                        centerPoint = calculateNodesCenter(subtreeNodes);
                    } else {
                        // Center on the parent node when collapsing
                        const parentNode = findParentNode(referenceNode, layoutedGraph.nodes, layoutedGraph.edges);
                        centerPoint = calculateNodesCenter([parentNode]);
                    }

                    if (centerPoint) {
                        // Preserve current zoom level when centering
                        const currentZoom = getZoom();
                        setTimeout(() => {
                            setCenter(centerPoint.x, centerPoint.y, { duration: CENTER_PAN_DURATION, zoom: currentZoom });
                        }, 0);
                    }
                }
                // Clear the pending action after processing
                pendingExpansionRef.current = null;
            } else if (fitViewOnNextRenderRef.current) {
                setTimeout(() => fitView({ padding: FIT_VIEW_PADDING }), 0);
                fitViewOnNextRenderRef.current = false;
            }
        }, LAYOUT_DEBOUNCE_MS);

        return () => clearTimeout(timeoutId);
    }, [needsRelayout, measuredDimensions, nodes.length, collapsedTree, buildGraph, setNodes, setEdges, fitView, setCenter, pendingExpansionRef]);

    return {
        measuredDimensions,
        handleNodesChange,
    };
}
