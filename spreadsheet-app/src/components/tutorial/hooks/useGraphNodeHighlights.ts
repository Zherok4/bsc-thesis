import { useState, useEffect, useCallback } from 'react';
import type { GraphHighlightConfig } from '../TutorialContext';

/**
 * Represents a highlighted node with its position
 */
export interface HighlightedNode {
    /** Unique identifier for the node element */
    id: string;
    /** Bounding rectangle of the node */
    rect: DOMRect;
}

/**
 * Result of the useGraphNodeHighlights hook
 */
export interface GraphNodeHighlightsResult {
    /** Array of highlighted nodes with their positions */
    highlightedNodes: HighlightedNode[];
    /** The highlight mode to apply */
    mode: 'pulse' | 'glow' | 'border';
    /** Forces a recalculation of all node positions */
    updatePositions: () => void;
}

/**
 * Builds a CSS selector string from a GraphHighlightConfig.
 * Combines nodeTypes (converted to React Flow classes) and nodeSelector.
 */
function buildSelector(config: GraphHighlightConfig): string {
    const selectors: string[] = [];

    if (config.nodeTypes && config.nodeTypes.length > 0) {
        const typeSelectors = config.nodeTypes.map(
            type => `.react-flow__node-${type}`
        );
        selectors.push(...typeSelectors);
    }

    if (config.nodeSelector) {
        selectors.push(config.nodeSelector);
    }

    return selectors.join(', ');
}

/**
 * Hook to track and highlight multiple graph nodes for the tutorial.
 * Queries nodes by type or CSS selector and tracks their positions.
 *
 * @param config - Configuration specifying which nodes to highlight, or null to clear
 * @returns Object containing highlighted nodes array, mode, and update function
 */
export function useGraphNodeHighlights(config: GraphHighlightConfig | null): GraphNodeHighlightsResult {
    const [highlightedNodes, setHighlightedNodes] = useState<HighlightedNode[]>([]);
    const mode = config?.mode ?? 'pulse';

    const updatePositions = useCallback(() => {
        if (!config) {
            setHighlightedNodes([]);
            return;
        }

        const selector = buildSelector(config);
        if (!selector) {
            setHighlightedNodes([]);
            return;
        }

        const elements = document.querySelectorAll(selector);
        const nodes: HighlightedNode[] = [];

        elements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const id = element.getAttribute('data-id') ?? `node-${index}`;
            nodes.push({ id, rect });
        });

        setHighlightedNodes(nodes);
    }, [config]);

    useEffect(() => {
        if (!config) {
            setHighlightedNodes([]);
            return;
        }

        const selector = buildSelector(config);
        if (!selector) {
            setHighlightedNodes([]);
            return;
        }

        // Initial lookup with a small delay to ensure DOM is ready
        const initialTimeout = setTimeout(() => {
            updatePositions();
        }, 50);

        // Update positions on resize and scroll
        const handleUpdate = (): void => {
            updatePositions();
        };

        window.addEventListener('resize', handleUpdate);
        window.addEventListener('scroll', handleUpdate, true);

        // Also listen for React Flow viewport changes (pan/zoom)
        const reactFlowViewport = document.querySelector('.react-flow__viewport');
        let viewportObserver: MutationObserver | null = null;

        if (reactFlowViewport) {
            viewportObserver = new MutationObserver(handleUpdate);
            viewportObserver.observe(reactFlowViewport, {
                attributes: true,
                attributeFilter: ['style', 'transform'],
            });
        }

        // Watch for DOM changes (elements being added/removed) to catch dynamically rendered elements
        const flowGraph = document.querySelector('[data-tutorial="flow-graph"]');
        let domObserver: MutationObserver | null = null;

        if (flowGraph) {
            domObserver = new MutationObserver(handleUpdate);
            domObserver.observe(flowGraph, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class'],
            });
        }

        return () => {
            clearTimeout(initialTimeout);
            window.removeEventListener('resize', handleUpdate);
            window.removeEventListener('scroll', handleUpdate, true);
            viewportObserver?.disconnect();
            domObserver?.disconnect();
        };
    }, [config, updatePositions]);

    return { highlightedNodes, mode, updatePositions };
}
