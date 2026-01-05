import type { Edge, Node } from "@xyflow/react";
import type { HyperFormula } from "hyperformula";

/**
 * Represents a ReactFlow graph with nodes and edges
 */
export interface Graph {
    nodes: Node[];
    edges: Edge[];
}

/**
 * Configuration for merging duplicate reference nodes
 */
export interface MergeConfig {
    /** Whether to merge duplicate references */
    enabled: boolean;
    /** Maximum edge distance for merging (nodes must be within N edges to merge) */
    maxDistance: number;
}

/**
 * Context passed through visitor functions for expansion state management
 */
export interface ExpansionContext {
    /** Set of node IDs that are currently expanded */
    expandedNodeIds: Set<string>;
    /** Callback to toggle expansion state of a node */
    onToggleExpand: (nodeId: string) => void;
    /** HyperFormula instance for formula evaluation */
    hfInstance: HyperFormula;
    /** Name of the currently active sheet */
    activeSheetName: string;
    /** Set of visited cell IDs for circular reference detection */
    visitedCells?: Set<string>;
    /** Whether edit mode is currently active */
    isEditModeActive: boolean;
    /** Enters edit mode, optionally targeting a specific node */
    enterEditMode: (nodeId?: string) => void;
    /** Whether this node is part of an inactive conditional branch (for graying out) */
    isInactivePath?: boolean;
    /** Reference key to skip merging for (allows temporary unmerge for editing) */
    skipMergeForRefKey?: string;
    /** Callback to unmerge a merged node for individual editing */
    onUnmerge?: (refKey: string) => void;
}
