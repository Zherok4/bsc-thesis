import dagre from "dagre";
import type { Node } from "@xyflow/react";
import type { Graph } from "./astToReactFlow";

export type NodeDimensionsMap = Map<string, { width: number; height: number }>;

// Estimate node dimensions based on node type and data
function getNodeDimensions(node: Node): { width: number; height: number } {
    const baseWidth = 180;
    const baseHeight = 80;

    switch (node.type) {
        case "FunctionNode": {
            const data = node.data as { argFormulas?: string[]; funFormula?: string };
            const argCount = data.argFormulas?.length || 0;
            // Function nodes need more height for each argument row (~28px per arg)
            // Plus header (~40px), formula (~35px), args label (~20px), result (~45px)
            const height = 140 + argCount * 28;
            // Width based on formula length
            const formulaLength = data.funFormula?.length || 0;
            const width = Math.max(220, Math.min(350, 180 + formulaLength * 3));
            return { width, height };
        }
        case "RangeNode": {
            // Range nodes have header + body + dimensions + footer
            return { width: 160, height: 130 };
        }
        case "ReferenceNode": {
            // Reference nodes have header + body + footer
            return { width: 145, height: 100 };
        }
        case "NumberNode":
        case "StringNode": {
            // Literal nodes are compact
            return { width: 100, height: 70 };
        }
        case "twoTextNode": {
            // Two text nodes (formula + output)
            const data = node.data as { formula?: string };
            const formulaLength = data.formula?.length || 0;
            const width = Math.max(180, Math.min(350, 150 + formulaLength * 4));
            return { width, height: 100 };
        }
        case "ExpandableExpressionNode": {
            // Expandable expression nodes have header + formula + output
            const data = node.data as { formula?: string; isExpanded?: boolean };
            const formulaLength = data.formula?.length || 0;
            const width = Math.max(180, Math.min(350, 150 + formulaLength * 4));
            // Slightly taller due to expand button header
            return { width, height: 120 };
        }
        default:
            return { width: baseWidth, height: baseHeight };
    }
}

export function applyDagreLayout(
    result: Graph,
    measuredDimensions?: NodeDimensionsMap,
) : Graph {
    const options = {
        direction: "LR",  // Left-to-Right: better for edges connecting to left-side handles
        nodeSep: 50,      // Increased vertical separation between nodes
        rankSep: 20,     // Increased horizontal separation between ranks
        edgeSep: 20,      // Increased edge separation
        align: "DL",
    };

    const {nodes, edges} = result;
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: options.direction,
        nodesep: options.nodeSep,
        ranksep: options.rankSep,
        edgesep: options.edgeSep,
    });

    // Store dimensions for each node for later positioning
    const nodeDimensions = new Map<string, { width: number; height: number }>();

    nodes.forEach((node) => {
        // Use measured dimensions if available, otherwise estimate
        const dimensions = measuredDimensions?.get(node.id) ?? getNodeDimensions(node);
        nodeDimensions.set(node.id, dimensions);
        dagreGraph.setNode(node.id, { width: dimensions.width, height: dimensions.height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const dimensions = nodeDimensions.get(node.id) || { width: 180, height: 80 };
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - dimensions.width / 2,
                y: nodeWithPosition.y - dimensions.height / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
}
