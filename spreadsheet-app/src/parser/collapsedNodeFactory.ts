import { nodeToString, type CollapsedNode } from "./collapseAST";
import type { ASTNode } from "./visitor";

export function collapsedNodeFactory(node: ASTNode, nodeType: "function" | "literal" | "expression" | "reference", children: CollapsedNode[]): CollapsedNode {
    return {
        type: "CollapsedNode",
        label: nodeToString(node),
        nodeType,
        children,
        original: node, 
    };
}