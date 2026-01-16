import type { Node } from '@xyflow/react';

/**
 * Returns all target handle IDs for a given node based on its type and data.
 * Used for computing valid connection targets during edge dragging.
 *
 * @param node - The React Flow node to get handles for
 * @returns Array of handle IDs that can accept incoming connections
 */
export function getTargetHandlesForNode(node: Node): string[] {
    const handles: string[] = [];

    switch (node.type) {
        case 'FunctionNode':
        case 'ConditionalNode': {
            const argFormulas = node.data?.argFormulas as string[] | undefined;
            if (argFormulas) {
                argFormulas.forEach((_, idx) => handles.push(`arghandle-${idx}`));
            }
            break;
        }

        case 'BinOpNode': {
            const leftConstant = node.data?.leftConstant;
            const rightConstant = node.data?.rightConstant;

            // Only add handles for non-constant operands
            if (leftConstant === undefined || leftConstant === null) {
                handles.push('left-operand');
            }
            if (rightConstant === undefined || rightConstant === null) {
                handles.push('right-operand');
            }
            break;
        }

        case 'ExpandableExpressionNode': {
            const args = node.data?.arguments as Array<{ constantValue?: unknown }> | undefined;
            if (args) {
                args.forEach((arg, idx) => {
                    // Only add handle if argument is not a constant
                    if (arg.constantValue === undefined) {
                        handles.push(`arghandle-${idx}`);
                    }
                });
            }
            break;
        }

        // These node types don't accept incoming connections
        case 'ReferenceNode':
        case 'RangeNode':
        case 'NumberNode':
        case 'StringNode':
        case 'ResultNode':
        default:
            break;
    }

    return handles;
}

/**
 * Checks if a node type can be a source for edge connections.
 * @param nodeType - The React Flow node type
 * @returns true if the node can be dragged from to create connections
 */
export function isSourceNodeType(nodeType: string | undefined): boolean {
    if (!nodeType) return false;

    const sourceTypes = new Set([
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

    return sourceTypes.has(nodeType);
}
