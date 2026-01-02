import type { Edge, Node } from "@xyflow/react";
import { nodeToString } from "../../collapseAST";
import type {
    ASTNode,
    BinaryOpNode,
    CellRangeNode,
    CellReferenceNode,
    ColumnRangeNode,
    FormulaNode,
    FunctionCallNode,
    NumberLiteralNode,
    PercentNode,
    RowRangeNode,
    StringLiteralNode,
    UnaryOpNode,
} from "../../visitor";
import { createDefaultEdge } from "../edgeFactory";
import {
    createColumnRangeNode,
    createDefaultNode,
    createFunctionNode,
    createNumNode,
    createRangeNode,
    createReferenceNode,
    createRowRangeNode,
    createStringNode,
} from "../nodeFactories";

/**
 * Visits a raw AST node and creates ReactFlow nodes/edges.
 * This is the simplest visitor - it creates a node for every AST node.
 *
 * @param node - The AST node to visit
 * @param nodes - Array to collect created nodes
 * @param edges - Array to collect created edges
 * @param parentID - ID of the parent node to connect to
 */
export function visitAstNode(
    node: ASTNode,
    nodes: Node[],
    edges: Edge[],
    parentID: string
): void {
    switch (node.type) {
        case "Formula": {
            const formulaNode = node as FormulaNode;
            const createdNode = createDefaultNode(nodeToString(formulaNode));
            nodes.push(createdNode);
            visitAstNode(formulaNode.expression, nodes, edges, createdNode.id);
            break;
        }

        case "BinaryOp": {
            const binaryNode = node as BinaryOpNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(binaryNode.left, nodes, edges, createdNode.id);
            visitAstNode(binaryNode.right, nodes, edges, createdNode.id);
            break;
        }

        case "UnaryOp": {
            const unaryNode = node as UnaryOpNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(unaryNode.operand, nodes, edges, createdNode.id);
            break;
        }

        case "Percent": {
            const percentNode = node as PercentNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(percentNode.operand, nodes, edges, createdNode.id);
            break;
        }

        case "FunctionCall": {
            const functionNode = node as FunctionCallNode;
            const funFormula = nodeToString(functionNode);
            const argFormulas = functionNode.arguments.map((arg) =>
                nodeToString(arg)
            );
            const createdNode = createFunctionNode(
                functionNode.name,
                argFormulas,
                funFormula,
                ''
            );
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            functionNode.arguments.forEach((arg) => {
                visitAstNode(arg, nodes, edges, createdNode.id);
            });
            break;
        }

        case "CellReference": {
            const refNode = node as CellReferenceNode;
            const createdNode = createReferenceNode(
                refNode.reference,
                refNode.sheet,
                false,
                undefined,
                refNode.nodeId
            );
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "CellRange": {
            const rangeNode = node as CellRangeNode;
            const createdNode = createRangeNode(
                rangeNode.start.reference,
                rangeNode.end.reference,
                rangeNode.sheet ?? ''
            );
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            // Range node is a leaf - don't visit start/end as separate nodes
            break;
        }

        case "ColumnRange": {
            const colRangeNode = node as ColumnRangeNode;
            const createdNode = createColumnRangeNode(
                colRangeNode.startColumn,
                colRangeNode.endColumn,
                colRangeNode.sheet ?? ''
            );
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "RowRange": {
            const rowRangeNode = node as RowRangeNode;
            const createdNode = createRowRangeNode(
                rowRangeNode.startRow,
                rowRangeNode.endRow,
                rowRangeNode.sheet ?? ''
            );
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "NumberLiteral": {
            const numNode = node as NumberLiteralNode;
            const createdNode = createNumNode(numNode.value);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case "StringLiteral": {
            const strNode = node as StringLiteralNode;
            const createdNode = createStringNode(strNode.value);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
    }
}
