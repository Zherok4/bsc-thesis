import { useState, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import type { Edge, Node, NodeChange, NodeDimensionChange } from '@xyflow/react';
import type { NodeDimensionsMap } from '../../../parser/dagreLayout';
import type { CollapsedNode } from '../../../parser/collapseAST';

/** Percentage of nodes that must have measured dimensions before relayout */
const MEASUREMENT_COVERAGE_THRESHOLD = 0.8;
/** Debounce time before applying relayout after dimension changes */
const LAYOUT_DEBOUNCE_MS = 50;
/** Padding for fitView */
const FIT_VIEW_PADDING = 0.1;
/** Threshold for considering a dimension change significant */
const DIMENSION_CHANGE_THRESHOLD = 1;

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
    fitView: (options?: { padding?: number }) => void;
    /** Whether edit mode is active (blocks rebuilds) */
    isEditModeActive: boolean;
    /** Version counter that triggers rebuilds when values change */
    valuesVersion: number;
    /** Ref to track if fitView should be called on next render */
    fitViewOnNextRenderRef: MutableRefObject<boolean>;
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
    isEditModeActive,
    valuesVersion,
    fitViewOnNextRenderRef,
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

        if (fitViewOnNextRenderRef.current) {
            setTimeout(() => fitView({ padding: FIT_VIEW_PADDING }), 0);
        }
    }, [collapsedTree, buildGraph, setNodes, setEdges, fitView, isEditModeActive, valuesVersion]);

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

        const timeoutId = setTimeout(() => {
            if (layoutVersionRef.current !== currentGeneration) {
                return;
            }
            if (collapsedTree === null) return;

            const layoutedGraph = buildGraph(collapsedTree, measuredDimensions);
            setNodes(layoutedGraph.nodes);
            setEdges(layoutedGraph.edges);
            setNeedsRelayout(false);

            if (fitViewOnNextRenderRef.current) {
                setTimeout(() => fitView({ padding: FIT_VIEW_PADDING }), 0);
                fitViewOnNextRenderRef.current = false;
            }
        }, LAYOUT_DEBOUNCE_MS);

        return () => clearTimeout(timeoutId);
    }, [needsRelayout, measuredDimensions, nodes.length, collapsedTree, buildGraph, setNodes, setEdges, fitView]);

    return {
        measuredDimensions,
        handleNodesChange,
    };
}
