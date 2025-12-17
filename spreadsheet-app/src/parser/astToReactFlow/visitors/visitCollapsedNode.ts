import type { Edge, Node } from "@xyflow/react";
import { nodeToString, type CollapsedNode } from "../../collapseAST";
import type {
    CellRangeNode,
    CellReferenceNode,
    FunctionCallNode,
    NumberLiteralNode,
    StringLiteralNode,
} from "../../visitor";
import { createDefaultEdge } from "../edgeFactory";
import {
    createDefaultNode,
    createFunctionNode,
    createNumNode,
    createRangeNode,
    createReferenceNode,
    createResultNode,
    createStringNode,
} from "../nodeFactories";

/**
 * Visits a collapsed AST node and creates ReactFlow nodes/edges.
 * This visitor works with the simplified/collapsed representation of the AST.
 *
 * @param collapsedNode - The collapsed node to visit
 * @param nodes - Array to collect created nodes
 * @param edges - Array to collect created edges
 * @param parentID - ID of the parent node to connect to
 * @param handleID - Optional handle ID for function argument connections
 */
export function visitCollapsedNode(
    collapsedNode: CollapsedNode,
    nodes: Node[],
    edges: Edge[],
    parentID: string,
    handleID?: string
): void {
    switch (collapsedNode.original.type) {
        case "Formula": {
            const createdNode = createResultNode(collapsedNode.label);
            nodes.push(createdNode);
            collapsedNode.children.forEach((child) => {
                visitCollapsedNode(child, nodes, edges, createdNode.id);
            });
            break;
        }

        case "CellReference": {
            const refNode = collapsedNode.original as CellReferenceNode;
            const createdNode = createReferenceNode(
                refNode.reference,
                refNode.sheet
            );
            const createdEdge = createDefaultEdge(
                createdNode.id,
                parentID,
                handleID
            );
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "CellRange": {
            const rangeNode = collapsedNode.original as CellRangeNode;
            const startNode = rangeNode.start;
            const endNode = rangeNode.end;
            const createdNode = createRangeNode(
                startNode.reference,
                endNode.reference,
                rangeNode.sheet
            );
            const createdEdge = createDefaultEdge(
                createdNode.id,
                parentID,
                handleID
            );
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "NumberLiteral": {
            const numLiteralNode = collapsedNode.original as NumberLiteralNode;
            const createdNode = createNumNode(numLiteralNode.value);
            const createdEdge = createDefaultEdge(
                createdNode.id,
                parentID,
                handleID
            );
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "StringLiteral": {
            const strLiteralNode = collapsedNode.original as StringLiteralNode;
            const createdNode = createStringNode(strLiteralNode.value);
            const createdEdge = createDefaultEdge(
                createdNode.id,
                parentID,
                handleID
            );
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "FunctionCall": {
            const funNode = collapsedNode.original as FunctionCallNode;
            const funFormula = nodeToString(funNode);
            const argFormulas = collapsedNode.children.map(
                (child) => child.label
            );
            const createdNode = createFunctionNode(
                funNode.name,
                argFormulas,
                funFormula
            );
            const createdEdge = createDefaultEdge(
                createdNode.id,
                parentID,
                handleID
            );
            nodes.push(createdNode);
            edges.push(createdEdge);
            collapsedNode.children.forEach((child, idx) => {
                visitCollapsedNode(
                    child,
                    nodes,
                    edges,
                    createdNode.id,
                    `arghandle-${idx}`
                );
            });
            break;
        }

        default: {
            const createdNode = createDefaultNode(collapsedNode.label);
            const createdEdge = createDefaultEdge(
                createdNode.id,
                parentID,
                handleID
            );
            nodes.push(createdNode);
            edges.push(createdEdge);
            collapsedNode.children.forEach((child) => {
                visitCollapsedNode(child, nodes, edges, createdNode.id);
            });
        }
    }
}
