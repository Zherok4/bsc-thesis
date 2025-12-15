import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export interface GraphEditModeContextValue {
    /** indicates wheter the user is in editing mode and can actively change values of nodes */
    isEditModeActive: boolean;
    /** changes the edit mode true indicates active false indicates inactive */
    setEditMode: Dispatch<SetStateAction<boolean>>;
    // TODO: maybe better way to reference ref Cells ==> also consider cells with same address but different sheet
    /** the address of the cell Address we are editing if EditMode is inactive editingNodeId should always be null */
    editingNodeId: string | null;
    setEditingNodeId: Dispatch<SetStateAction<string | null>>;
}

const GraphEditModeContext = createContext<GraphEditModeContextValue | undefined>(undefined);

export function useGraphEditMode(): GraphEditModeContextValue {
    const context = useContext(GraphEditModeContext);
    if (context === undefined) {
        throw new Error('useGraphEditMode must be used within a GraphEditModeContext.Provider');
    }
    return context;
}

export { GraphEditModeContext };
