import type { Node } from "@xyflow/react";

/**
 * Result of connection validation
 */
export interface ValidationResult {
    isValid: boolean;
    errorMessage?: string;
}

/**
 * Node types that can act as sources (produce values)
 */
const SOURCE_NODE_TYPES = new Set([
    'ReferenceNode',
    'RangeNode',
    'FunctionNode',
    'BinOpNode',
    'NumberNode',
    'StringNode',
    'ExpandableExpressionNode',
    'ConditionalNode',
    'ResultNode',
]);

/**
 * Node types that can accept connections on target handles
 */
const TARGET_NODE_TYPES_WITH_HANDLES = new Set([
    'FunctionNode',
    'ConditionalNode',
    'BinOpNode',
    'ExpandableExpressionNode',
]);

/**
 * Validates whether a source node can connect to a target handle.
 * @param sourceNode - The ReactFlow node being connected from
 * @param targetNode - The ReactFlow node being connected to
 * @param targetHandle - The handle ID on the target node (e.g., "arghandle-0")
 * @returns Validation result with isValid flag and optional error message
 */
export function validateConnection(
    sourceNode: Node,
    targetNode: Node,
    targetHandle: string | null
): ValidationResult {
    // Prevent self-connections
    if (sourceNode.id === targetNode.id) {
        return {
            isValid: false,
            errorMessage: 'Cannot connect a node to itself',
        };
    }

    // Check if source node type can produce a value
    const sourceType = sourceNode.type;
    if (!sourceType || !SOURCE_NODE_TYPES.has(sourceType)) {
        return {
            isValid: false,
            errorMessage: `Node type "${sourceType}" cannot be used as a source`,
        };
    }

    // Check if target node type accepts connections
    const targetType = targetNode.type;
    if (!targetType || !TARGET_NODE_TYPES_WITH_HANDLES.has(targetType)) {
        return {
            isValid: false,
            errorMessage: `Node type "${targetType}" does not accept connections`,
        };
    }

    // Validate handle format for function/conditional nodes
    if (targetType === 'FunctionNode' || targetType === 'ConditionalNode') {
        if (!targetHandle || !targetHandle.startsWith('arghandle-')) {
            return {
                isValid: false,
                errorMessage: 'Invalid target handle for function node',
            };
        }

        // Check if the argument index is valid
        const argIndex = parseInt(targetHandle.replace('arghandle-', ''), 10);
        if (isNaN(argIndex) || argIndex < 0) {
            return {
                isValid: false,
                errorMessage: 'Invalid argument index',
            };
        }

        // Check if we can find the AST node ID for this argument
        // Either from argAstNodeIds or constantArgs
        const argAstNodeIds = targetNode.data?.argAstNodeIds as Record<number, string> | undefined;
        const constantArgs = targetNode.data?.constantArgs as Record<number, { astNodeId: string }> | undefined;

        const hasArgInAstNodeIds = argAstNodeIds && (argIndex in argAstNodeIds || String(argIndex) in argAstNodeIds);
        const hasArgInConstantArgs = constantArgs && (argIndex in constantArgs || String(argIndex) in constantArgs);

        if (!hasArgInAstNodeIds && !hasArgInConstantArgs) {
            return {
                isValid: false,
                errorMessage: `Argument ${argIndex} not found in target node (argAstNodeIds: ${JSON.stringify(argAstNodeIds)}, constantArgs keys: ${constantArgs ? Object.keys(constantArgs) : 'none'})`,
            };
        }
    }

    // Validate handle for BinOpNode
    if (targetType === 'BinOpNode') {
        if (targetHandle !== 'operand') {
            return {
                isValid: false,
                errorMessage: 'BinOpNode only accepts connections on operand handle',
            };
        }
    }

    // Validate handle for ExpandableExpressionNode
    if (targetType === 'ExpandableExpressionNode') {
        if (!targetHandle || !targetHandle.startsWith('arghandle-')) {
            return {
                isValid: false,
                errorMessage: 'Invalid target handle for expression node',
            };
        }

        // Check if the argument index is valid
        const argIndex = parseInt(targetHandle.replace('arghandle-', ''), 10);
        if (isNaN(argIndex) || argIndex < 0) {
            return {
                isValid: false,
                errorMessage: 'Invalid argument index',
            };
        }

        // Check if we can find the AST node ID for this argument
        const argAstNodeIds = targetNode.data?.argAstNodeIds as Record<number, string> | undefined;
        const hasArgInAstNodeIds = argAstNodeIds && (argIndex in argAstNodeIds || String(argIndex) in argAstNodeIds);

        if (!hasArgInAstNodeIds) {
            return {
                isValid: false,
                errorMessage: `Argument ${argIndex} not found in expression node (argAstNodeIds: ${JSON.stringify(argAstNodeIds)})`,
            };
        }
    }

    return { isValid: true };
}
