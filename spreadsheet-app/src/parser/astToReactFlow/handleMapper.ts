import type { Node } from "@xyflow/react";

/**
 * Maps a target handle ID to the AST node ID that should be replaced.
 * @param targetNode - The ReactFlow target node
 * @param targetHandle - The handle ID (e.g., "arghandle-0", "operand")
 * @returns The AST node ID to transform, or null if not mappable
 */
export function getTargetAstNodeId(
    targetNode: Node,
    targetHandle: string | null
): string | null {
    const nodeType = targetNode.type;
    const data = targetNode.data;

    if (!nodeType || !data) {
        return null;
    }

    switch (nodeType) {
        case 'FunctionNode':
        case 'ConditionalNode': {
            if (!targetHandle || !targetHandle.startsWith('arghandle-')) {
                return null;
            }

            const argIndex = parseInt(targetHandle.replace('arghandle-', ''), 10);
            if (isNaN(argIndex) || argIndex < 0) {
                return null;
            }

            // Get the AST node ID from argAstNodeIds
            // Try both numeric and string keys since JS object keys are always strings
            const argAstNodeIds = data.argAstNodeIds as Record<string | number, string> | undefined;
            if (argAstNodeIds) {
                const astNodeId = argAstNodeIds[argIndex] ?? argAstNodeIds[String(argIndex)];
                if (astNodeId) {
                    return astNodeId;
                }
            }

            // Fallback to constantArgs if argAstNodeIds not available
            const constantArgs = data.constantArgs as Record<string | number, { astNodeId: string }> | undefined;
            if (constantArgs) {
                const constArg = constantArgs[argIndex] ?? constantArgs[String(argIndex)];
                if (constArg) {
                    return constArg.astNodeId;
                }
            }

            return null;
        }

        case 'BinOpNode': {
            // Check if we have the operand AST node IDs
            const leftOperandAstNodeId = data.leftOperandAstNodeId as string | undefined;
            const rightOperandAstNodeId = data.rightOperandAstNodeId as string | undefined;
            const leftConstant = data.leftConstant as string | undefined;
            const rightConstant = data.rightConstant as string | undefined;

            // New explicit handle IDs for dual-handle support
            if (targetHandle === 'left-operand' && leftOperandAstNodeId) {
                return leftOperandAstNodeId;
            }
            if (targetHandle === 'right-operand' && rightOperandAstNodeId) {
                return rightOperandAstNodeId;
            }

            // Backward compatibility: "operand" handle (deprecated)
            // The operand handle connects to the non-constant operand
            if (targetHandle === 'operand') {
                // If left is constant, the edge connects to right operand
                if (leftConstant && !rightConstant && rightOperandAstNodeId) {
                    return rightOperandAstNodeId;
                }
                // If right is constant, the edge connects to left operand
                if (rightConstant && !leftConstant && leftOperandAstNodeId) {
                    return leftOperandAstNodeId;
                }
                // If neither is constant, the edge connects to left operand
                if (!leftConstant && !rightConstant && leftOperandAstNodeId) {
                    return leftOperandAstNodeId;
                }
            }

            return null;
        }

        case 'ExpandableExpressionNode': {
            if (!targetHandle || !targetHandle.startsWith('arghandle-')) {
                return null;
            }

            const argIndex = parseInt(targetHandle.replace('arghandle-', ''), 10);
            if (isNaN(argIndex) || argIndex < 0) {
                return null;
            }

            // Get the AST node ID from argAstNodeIds
            const argAstNodeIds = data.argAstNodeIds as Record<string | number, string> | undefined;
            if (argAstNodeIds) {
                const astNodeId = argAstNodeIds[argIndex] ?? argAstNodeIds[String(argIndex)];
                if (astNodeId) {
                    return astNodeId;
                }
            }

            return null;
        }

        default:
            return null;
    }
}

/**
 * Gets the source cell information from a target node if it's part of an expanded branch.
 * This is needed to route edits to the correct cell.
 * @param targetNode - The ReactFlow target node
 * @returns The source cell info, or undefined if the node is top-level
 */
export function getSourceCell(targetNode: Node): { row: number; col: number; sheet: string } | undefined {
    const data = targetNode.data;
    if (!data) {
        return undefined;
    }

    const sourceCell = data.sourceCell as { row: number; col: number; sheet: string } | undefined;
    return sourceCell;
}
