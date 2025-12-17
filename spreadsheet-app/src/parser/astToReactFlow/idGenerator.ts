/**
 * Module for generating unique node IDs for ReactFlow nodes.
 * Uses an incrementing counter that can be reset between graph builds.
 */

let nodeIdCounter: number = 0;

/**
 * Generates a unique node ID
 * @returns A unique string ID in format "node_{counter}"
 */
export function generateNodeId(): string {
    return `node_${nodeIdCounter++}`;
}

/**
 * Resets the node ID counter to 0.
 * Should be called before building a new graph to ensure consistent IDs.
 */
export function resetNodeIdCounter(): void {
    nodeIdCounter = 0;
}

/**
 * Gets the current value of the node ID counter.
 * Useful for calculating positions based on node count.
 * @returns Current counter value
 */
export function getNodeIdCounter(): number {
    return nodeIdCounter;
}
