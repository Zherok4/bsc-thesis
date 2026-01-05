import { type JSX, useMemo, useCallback } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import { evaluateFormula } from "../../utils";
import { getParameterName } from "../../data/functionParameters";
import EditableConstant, { type ConstantType } from "./EditableConstant";
import './ConditionalNode.css';

/**
 * Information about a constant argument for editing purposes
 */
export interface ConstantArgInfo {
    /** The AST node ID of the constant */
    astNodeId: string;
    /** The type of the constant (number or string) */
    type: ConstantType;
    /** The raw value (number for numbers, unquoted string for strings) */
    rawValue: string | number;
}

/**
 * Node type for IF and IFS conditional functions.
 * Provides specialized visualization with:
 * - Clear condition separation
 * - Auto-collapsed inactive branches
 * - Evaluated values shown per branch
 */
export type ConditionalNode = Node<
{
    funName: 'IF' | 'IFS';
    funFormula: string;
    /** For IF: [condition, value_if_true, value_if_false] */
    /** For IFS: [cond1, val1, cond2, val2, ...] */
    argFormulas: string[];
    /** Callback to toggle branch expansion */
    onToggleBranchExpand: (branchId: string) => void;
    /** Array of expansion IDs for each branch */
    branchExpansionIds: string[];
    /** Set of expanded branch indices */
    expandedBranchIndices: number[];
    /** Sheet name where this conditional resides */
    sheet: string;
    /** Map of argument index to constant info (only present for constant arguments) */
    constantArgs?: Record<number, ConstantArgInfo>;
},
'ConditionalNode'
>;

/**
 * Checks if a formula is a constant value (number or string literal).
 * Returns the constant value if it is, otherwise returns null.
 */
function getConstantValue(formula: string): string | null {
    const trimmed = formula.trim();

    // Check for number (including negatives and decimals)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return trimmed;
    }

    // Check for string literal (wrapped in double quotes)
    if (/^".*"$/.test(trimmed)) {
        return trimmed;
    }

    return null;
}

/**
 * Determines if a condition result is truthy.
 */
function isTruthyResult(result: string): boolean {
    const upper = result.toUpperCase();
    return upper === 'TRUE' || (upper !== 'FALSE' && upper !== '0' && upper !== '' && !upper.startsWith('#'));
}

/**
 * Checks if a formula is a constant (number, boolean, or string literal).
 * Constants cannot be expanded since they have no sub-expressions.
 */
function isConstantFormula(formula: string): boolean {
    const trimmed = formula.trim();

    if (!trimmed) return true;

    // Number (integer or decimal)
    if (!isNaN(Number(trimmed))) return true;

    // Boolean
    const upper = trimmed.toUpperCase();
    if (upper === 'TRUE' || upper === 'FALSE') return true;

    // String literal
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) return true;

    return false;
}

/**
 * ConditionalNode component for visualizing IF and IFS functions.
 */
export default function ConditionalNodeComponent({
    id,
    data: {
        funName,
        argFormulas,
        onToggleBranchExpand,
        branchExpansionIds,
        expandedBranchIndices,
        sheet,
        constantArgs,
    }
}: NodeProps<ConditionalNode>): JSX.Element {
    const { hfInstance }: HyperFormulaContextValue = useHyperFormula();
    const expandedSet = useMemo(() => new Set(expandedBranchIndices), [expandedBranchIndices]);

    if (funName === 'IF') {
        return (
            <IfModeContent
                nodeId={id}
                argFormulas={argFormulas}
                hfInstance={hfInstance}
                sheet={sheet}
                onToggleBranchExpand={onToggleBranchExpand}
                branchExpansionIds={branchExpansionIds}
                expandedSet={expandedSet}
                constantArgs={constantArgs}
            />
        );
    }

    // IFS mode
    return (
        <IfsModeContent
            nodeId={id}
            argFormulas={argFormulas}
            hfInstance={hfInstance}
            sheet={sheet}
            onToggleBranchExpand={onToggleBranchExpand}
            branchExpansionIds={branchExpansionIds}
            expandedSet={expandedSet}
            constantArgs={constantArgs}
        />
    );
}

interface IfModeProps {
    nodeId: string;
    argFormulas: string[];
    hfInstance: HyperFormulaContextValue['hfInstance'];
    sheet: string;
    onToggleBranchExpand: (branchId: string) => void;
    branchExpansionIds: string[];
    expandedSet: Set<number>;
    constantArgs?: Record<number, ConstantArgInfo>;
}

/**
 * IF mode rendering - condition with true/false branches.
 */
function IfModeContent({
    nodeId,
    argFormulas,
    hfInstance,
    sheet,
    onToggleBranchExpand,
    branchExpansionIds,
    expandedSet,
    constantArgs,
}: IfModeProps): JSX.Element {

    const residingSheet = sheet;

    const conditionResult = useMemo(
        () => evaluateFormula(argFormulas[0], hfInstance, residingSheet),
        [argFormulas, hfInstance, residingSheet]
    );

    const isTruthy = useMemo(() => isTruthyResult(conditionResult), [conditionResult]);

    // Evaluate each branch's value
    const trueBranchValue = useMemo(
        () => evaluateFormula(argFormulas[1] || '', hfInstance, residingSheet),
        [argFormulas, hfInstance, residingSheet]
    );
    const falseBranchValue = useMemo(
        () => evaluateFormula(argFormulas[2] || '', hfInstance, residingSheet),
        [argFormulas, hfInstance, residingSheet]
    );

    // Active branch: 0 = true branch, 1 = false branch
    const activeBranchIndex = isTruthy ? 0 : 1;

    const handleTrueToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (branchExpansionIds[0]) {
            onToggleBranchExpand(branchExpansionIds[0]);
        }
    }, [onToggleBranchExpand, branchExpansionIds]);

    const handleFalseToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (branchExpansionIds[1]) {
            onToggleBranchExpand(branchExpansionIds[1]);
        }
    }, [onToggleBranchExpand, branchExpansionIds]);

    const isTrueBranchExpanded = expandedSet.has(0);
    const isFalseBranchExpanded = expandedSet.has(1);

    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="conditional-node if-mode">
                {/* Header */}
                <div className="node-header">
                    <div className="header-left">
                        <span className="func-symbol">f|</span>
                        <span className="func-name">IF</span>
                    </div>
                </div>

                <div className="node-body">
                    {/* Condition Section */}
                    <div className="condition-section">
                        <div className="condition-row">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id="arghandle-0"
                                className="arg-handle condition-handle"
                            />
                            <span className="arg-label">{getParameterName('IF', 0)}</span>
                            <span className={`condition-badge ${isTruthy ? 'truthy' : 'falsy'}`}>
                                {conditionResult}
                            </span>
                        </div>
                    </div>

                    {/* Branches Section */}
                    <div className="branches-section">
                        {/* True Branch */}
                        <div className={`branch ${activeBranchIndex === 0 ? 'branch-active-true' : 'branch-inactive'}`}>
                            {!isConstantFormula(argFormulas[1]) && activeBranchIndex !== 0 && (
                                <button
                                    className={`expand-toggle ${isTrueBranchExpanded ? 'expanded' : ''}`}
                                    onClick={handleTrueToggle}
                                    title={isTrueBranchExpanded ? 'Collapse' : 'Expand'}
                                >
                                    {isTrueBranchExpanded ? '−' : '+'}
                                </button>
                            )}
                            <Handle
                                type="target"
                                position={Position.Left}
                                id="arghandle-1"
                                className="arg-handle"
                            />
                            <span className="arg-label">{getParameterName('IF', 1)}</span>
                            {(() => {
                                const constantValue = getConstantValue(argFormulas[1] || '');
                                const constantInfo = constantArgs?.[1];
                                // Editable constant - always show
                                if (constantValue && constantInfo) {
                                    return (
                                        <EditableConstant
                                            displayValue={constantValue}
                                            rawValue={constantInfo.rawValue}
                                            type={constantInfo.type}
                                            astNodeId={constantInfo.astNodeId}
                                            editId={`${nodeId}-arg-1`}
                                            className="arg-value"
                                        />
                                    );
                                }
                                // Non-editable constant - always show
                                if (constantValue) {
                                    return <span className="arg-value">{constantValue}</span>;
                                }
                                // Reference/formula: show value only when collapsed (not active and not expanded)
                                const isBranchCollapsed = activeBranchIndex !== 0 && !isTrueBranchExpanded;
                                if (isBranchCollapsed) {
                                    return <span className="arg-value">{trueBranchValue || '—'}</span>;
                                }
                                return null;
                            })()}
                            {activeBranchIndex === 0 && (
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    className="value-handle branch-result-handle"
                                />
                            )}
                        </div>

                        {/* False Branch */}
                        <div className={`branch ${activeBranchIndex === 1 ? 'branch-active-false' : 'branch-inactive'}`}>
                            {!isConstantFormula(argFormulas[2]) && activeBranchIndex !== 1 && (
                                <button
                                    className={`expand-toggle ${isFalseBranchExpanded ? 'expanded' : ''}`}
                                    onClick={handleFalseToggle}
                                    title={isFalseBranchExpanded ? 'Collapse' : 'Expand'}
                                >
                                    {isFalseBranchExpanded ? '−' : '+'}
                                </button>
                            )}
                            <Handle
                                type="target"
                                position={Position.Left}
                                id="arghandle-2"
                                className="arg-handle"
                            />
                            <span className="arg-label">{getParameterName('IF', 2)}</span>
                            {(() => {
                                const constantValue = getConstantValue(argFormulas[2] || '');
                                const constantInfo = constantArgs?.[2];
                                // Editable constant - always show
                                if (constantValue && constantInfo) {
                                    return (
                                        <EditableConstant
                                            displayValue={constantValue}
                                            rawValue={constantInfo.rawValue}
                                            type={constantInfo.type}
                                            astNodeId={constantInfo.astNodeId}
                                            editId={`${nodeId}-arg-2`}
                                            className="arg-value"
                                        />
                                    );
                                }
                                // Non-editable constant - always show
                                if (constantValue) {
                                    return <span className="arg-value">{constantValue}</span>;
                                }
                                // Reference/formula: show value only when collapsed (not active and not expanded)
                                const isBranchCollapsed = activeBranchIndex !== 1 && !isFalseBranchExpanded;
                                if (isBranchCollapsed) {
                                    return <span className="arg-value">{falseBranchValue || '—'}</span>;
                                }
                                return null;
                            })()}
                            {activeBranchIndex === 1 && (
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    className="value-handle branch-result-handle"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface IfsModeProps {
    nodeId: string;
    argFormulas: string[];
    hfInstance: HyperFormulaContextValue['hfInstance'];
    sheet: string;
    onToggleBranchExpand: (branchId: string) => void;
    branchExpansionIds: string[];
    expandedSet: Set<number>;
    constantArgs?: Record<number, ConstantArgInfo>;
}

/**
 * IFS mode rendering - multiple condition-value pairs.
 */
function IfsModeContent({
    nodeId,
    argFormulas,
    hfInstance,
    sheet,
    onToggleBranchExpand,
    branchExpansionIds,
    expandedSet,
    constantArgs,
}: IfsModeProps): JSX.Element {
    // Build condition-value pairs
    const pairs = useMemo(() => {
        const result: Array<{ condition: string; value: string; conditionIndex: number; valueIndex: number }> = [];
        for (let i = 0; i < argFormulas.length; i += 2) {
            result.push({
                condition: argFormulas[i],
                value: argFormulas[i + 1] || '',
                conditionIndex: i,
                valueIndex: i + 1,
            });
        }
        return result;
    }, [argFormulas]);

    const residingSheet = sheet;

    // Evaluate conditions to find first truthy
    const conditionResults = useMemo(() => {
        return pairs.map(pair => evaluateFormula(pair.condition, hfInstance, residingSheet));
    }, [pairs, hfInstance, residingSheet]);

    // Evaluate each value
    const valueResults = useMemo(() => {
        return pairs.map(pair => evaluateFormula(pair.value, hfInstance, residingSheet));
    }, [pairs, hfInstance, residingSheet]);

    const activePairIndex = useMemo(() => {
        return conditionResults.findIndex(result => isTruthyResult(result));
    }, [conditionResults]);

    const handleToggle = useCallback((index: number) => (e: React.MouseEvent) => {
        e.stopPropagation();
        if (branchExpansionIds[index]) {
            onToggleBranchExpand(branchExpansionIds[index]);
        }
    }, [onToggleBranchExpand, branchExpansionIds]);

    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="conditional-node ifs-mode">
                {/* Header */}
                <div className="node-header">
                    <div className="header-left">
                        <span className="func-symbol">f|</span>
                        <span className="func-name">IFS</span>
                    </div>
                </div>

                <div className="node-body">
                    {/* Condition-Value Pairs */}
                    <div className="ifs-pairs">
                        {pairs.map((pair, pairIndex) => {
                            const isActive = pairIndex === activePairIndex;
                            const isAfterActive = activePairIndex >= 0 && pairIndex > activePairIndex;
                            const isFalsyBeforeActive = !isActive && !isAfterActive && activePairIndex >= 0;
                            const isExpanded = expandedSet.has(pairIndex);

                            return (
                                <div
                                    key={pairIndex}
                                    className={`ifs-pair ${isActive ? 'pair-active' : ''} ${isFalsyBeforeActive ? 'pair-falsy' : ''} ${isAfterActive ? 'pair-inactive' : ''}`}
                                >
                                    {/* Condition */}
                                    <div className="ifs-condition">
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={`arghandle-${pair.conditionIndex}`}
                                            className="arg-handle condition-handle"
                                        />
                                        <span className="arg-label">{getParameterName('IFS', pair.conditionIndex)}</span>
                                        <span className={`condition-badge ${isAfterActive ? 'skipped' : (isTruthyResult(conditionResults[pairIndex]) ? 'truthy' : 'falsy')}`}>
                                            {conditionResults[pairIndex]}
                                        </span>
                                    </div>

                                    {/* Value */}
                                    <div className="ifs-value">
                                        {!isConstantFormula(pair.value) && !isActive && (
                                            <button
                                                className={`expand-toggle ${isExpanded ? 'expanded' : ''}`}
                                                onClick={handleToggle(pairIndex)}
                                                title={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                {isExpanded ? '−' : '+'}
                                            </button>
                                        )}
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={`arghandle-${pair.valueIndex}`}
                                            className="arg-handle"
                                        />
                                        <span className="arg-label">{getParameterName('IFS', pair.valueIndex)}</span>
                                        {(() => {
                                            const constantValue = getConstantValue(pair.value);
                                            const constantInfo = constantArgs?.[pair.valueIndex];
                                            // Editable constant - always show
                                            if (constantValue && constantInfo) {
                                                return (
                                                    <EditableConstant
                                                        displayValue={constantValue}
                                                        rawValue={constantInfo.rawValue}
                                                        type={constantInfo.type}
                                                        astNodeId={constantInfo.astNodeId}
                                                        editId={`${nodeId}-arg-${pair.valueIndex}`}
                                                        className="arg-value"
                                                    />
                                                );
                                            }
                                            // Non-editable constant - always show
                                            if (constantValue) {
                                                return <span className="arg-value">{constantValue}</span>;
                                            }
                                            // Reference/formula: show value only when collapsed (not active and not expanded)
                                            const isBranchCollapsed = !isActive && !isExpanded;
                                            if (isBranchCollapsed) {
                                                return <span className="arg-value">{valueResults[pairIndex] || '—'}</span>;
                                            }
                                            return null;
                                        })()}
                                        {isActive && (
                                            <Handle
                                                type="source"
                                                position={Position.Right}
                                                className="value-handle branch-result-handle"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
