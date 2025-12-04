import dagre from "dagre";
import type { Graph } from "./astToReactFlow";

export function applyDagreLayout(
    result: Graph,
) : Graph {
    const options = {
        direction: "TB",
        nodeWidth: 300,
        nodeHeight: 100,
        nodeSep: 50,
        rankSep: 80,
        edgeSep: 10,
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

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, {width: options.nodeWidth, height: options.nodeHeight});
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
        ...node,
        position: {
            x: nodeWithPosition.x - options.nodeWidth / 2,
            y: nodeWithPosition.y - options.nodeHeight / 2,
        },
        };
    });

    return { nodes: layoutedNodes, edges };
}
