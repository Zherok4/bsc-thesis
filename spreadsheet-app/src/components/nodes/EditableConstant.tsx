import { useState, useCallback, useRef, useEffect, type JSX } from 'react';
import { useGraphEditMode, type GraphEditModeContextValue } from '../context';
import type { SourceCell } from '../context/GraphEditModeContext';
import './EditableConstant.css';

/**
 * Represents the type of constant being edited
 */
export type ConstantType = 'number' | 'string';

/**
 * Layout variant for the editable constant
 * - 'default': Column layout with input and buttons below (like ReferenceNode)
 * - 'popover': Floating popover outside the node (for compact nodes like BinOpNode)
 */
export type EditableConstantVariant = 'default' | 'popover';

/**
 * Props for the EditableConstant component
 */
export interface EditableConstantProps {
    /** The displayed value (may include quotes for strings) */
    displayValue: string;
    /** The raw value without formatting (no quotes for strings) */
    rawValue: string | number;
    /** The type of constant */
    type: ConstantType;
    /** AST node ID for identifying this constant during edits */
    astNodeId: string;
    /** Unique identifier for this editable constant within the node */
    editId: string;
    /** Optional CSS class name for styling */
    className?: string;
    /** Optional title/tooltip text */
    title?: string;
    /** Layout variant - 'default' for column layout, 'popover' for floating outside node */
    variant?: EditableConstantVariant;
    /** Source cell for nodes within expanded branches (for edit routing) */
    sourceCell?: SourceCell;
}

/**
 * Parses user input and validates it against the expected type.
 * Returns the parsed value and any validation error.
 */
function parseAndValidate(
    input: string,
    expectedType: ConstantType
): { value: number | string; error: string | null } {
    const trimmed = input.trim();

    if (expectedType === 'number') {
        // Try to parse as a number
        const num = Number(trimmed);
        if (isNaN(num)) {
            return { value: 0, error: 'Invalid number' };
        }
        return { value: num, error: null };
    }

    // For strings, accept the raw input (will be wrapped in quotes when serialized)
    // Remove surrounding quotes if user added them
    let strValue = trimmed;
    if ((strValue.startsWith('"') && strValue.endsWith('"')) ||
        (strValue.startsWith("'") && strValue.endsWith("'"))) {
        strValue = strValue.slice(1, -1);
    }
    return { value: strValue, error: null };
}

/**
 * A reusable component for editing constant values (numbers or strings) inline.
 * Displays as an input-like field to hint at editability.
 * Double-click to enter edit mode, with input and action buttons.
 */
export default function EditableConstant({
    displayValue,
    rawValue,
    type,
    astNodeId,
    editId,
    className = '',
    title,
    variant = 'default',
    sourceCell,
}: EditableConstantProps): JSX.Element {
    const { editingNodeId, enterEditMode, exitEditMode, saveEdit }: GraphEditModeContextValue = useGraphEditMode();
    const isThisConstantBeingEdited = editingNodeId === editId;

    const [inputValue, setInputValue] = useState<string>(String(rawValue));
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset input value when entering edit mode
    useEffect(() => {
        if (isThisConstantBeingEdited) {
            setInputValue(String(rawValue));
            setError(null);
        }
    }, [isThisConstantBeingEdited, rawValue]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isThisConstantBeingEdited && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isThisConstantBeingEdited]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        enterEditMode(editId);
    }, [enterEditMode, editId]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        // Validate as user types
        const { error: validationError } = parseAndValidate(newValue, type);
        setError(validationError);
    }, [type]);

    const handleSave = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();

        const { value, error: validationError } = parseAndValidate(inputValue, type);

        if (validationError) {
            setError(validationError);
            return;
        }

        if (type === 'number') {
            saveEdit({
                type: 'number',
                astNodeIds: [astNodeId],
                newValue: value as number,
                sourceCell,
            });
        } else {
            saveEdit({
                type: 'string',
                astNodeIds: [astNodeId],
                newValue: value as string,
                sourceCell,
            });
        }
    }, [inputValue, type, astNodeId, saveEdit, sourceCell]);

    const handleCancel = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        setInputValue(String(rawValue));
        setError(null);
        exitEditMode();
    }, [rawValue, exitEditMode]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            handleSave(e);
        } else if (e.key === 'Escape') {
            handleCancel(e);
        }
    }, [handleSave, handleCancel]);

    // Preview mode - input-like appearance
    if (!isThisConstantBeingEdited) {
        return (
            <span
                className={`editable-constant ${className}`}
                onDoubleClick={handleDoubleClick}
                title={title || 'Double-click to edit'}
            >
                {displayValue}
            </span>
        );
    }

    // Edit mode - popover variant (positioned above the anchor)
    if (variant === 'popover') {
        return (
            <div className={`editable-constant-wrapper popover ${className}`}>
                <span className="editable-constant-anchor">{displayValue}</span>
                <div className="editable-constant-popover">
                    <input
                        ref={inputRef}
                        type="text"
                        className={`constant-input ${error ? 'has-error' : ''}`}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onClick={e => e.stopPropagation()}
                    />
                    {error && <span className="constant-error">{error}</span>}
                    <div className="constant-edit-actions">
                        <button
                            className="constant-action-btn save-btn"
                            onClick={handleSave}
                            disabled={!!error}
                            title="Save (Enter)"
                        >
                            ✓
                        </button>
                        <button
                            className="constant-action-btn cancel-btn"
                            onClick={handleCancel}
                            title="Cancel (Esc)"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default variant - column layout (like ReferenceNode)
    return (
        <div className={`editable-constant-wrapper default ${className}`}>
            <input
                ref={inputRef}
                type="text"
                className={`constant-input ${error ? 'has-error' : ''}`}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
            />
            {error && <span className="constant-error">{error}</span>}
            <div className="constant-edit-actions">
                <button
                    className="constant-action-btn save-btn"
                    onClick={handleSave}
                    disabled={!!error}
                    title="Save (Enter)"
                >
                    ✓
                </button>
                <button
                    className="constant-action-btn cancel-btn"
                    onClick={handleCancel}
                    title="Cancel (Esc)"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
