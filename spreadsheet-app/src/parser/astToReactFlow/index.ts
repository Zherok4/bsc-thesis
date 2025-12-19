/**
 * AST to ReactFlow conversion module.
 *
 * This module provides functions to convert parsed formula ASTs into ReactFlow
 * graph structures for visualization. It supports multiple visualization modes:
 *
 * - Raw AST visualization (visitAstNode)
 * - Collapsed AST visualization (visitCollapsedNode)
 * - Collapsed with expansion support (visitCollapsedNodeWithExpansion)
 *
 * @module astToReactFlow
 */

// Types
export type { Graph, ExpansionContext, MergeConfig } from "./types";

// ID generation utilities
export { resetNodeIdCounter, generateNodeId, getNodeIdCounter } from "./idGenerator";

// Node factories (for advanced usage)
export {
    createDefaultNode,
    createReferenceNode,
    createRangeNode,
    createNumNode,
    createStringNode,
    createFunctionNode,
    createResultNode,
    createExpandableExpressionNode,
} from "./nodeFactories";

// Edge factory
export { createDefaultEdge } from "./edgeFactory";

// Visitor functions
export {
    visitAstNode,
    visitCollapsedNode,
    visitCollapsedNodeWithExpansion,
} from "./visitors";

// Graph builders (primary API)
export { toGraph, toGraphWithExpansion } from "./graphBuilders";

// Reference merging
export { mergeDuplicateReferences } from "./mergeReferences";
