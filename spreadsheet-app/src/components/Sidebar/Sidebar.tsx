import { ReactFlow, Background, Controls, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../nodes/nodes.css';
import './Sidebar.css';
import type { ASTNode } from '../../parser';
import type { JSX } from 'react';
import TwoTextNodeComponent from '../nodes/TwoTextNode';
import { HyperFormulaProvider, GraphEditModeContext, type SelectedRange, ToastProvider, ConnectionDragProvider } from '../context';
import ToastContainer from '../Toast';
import { useSidebarState } from './hooks';
import type { HyperFormula } from 'hyperformula';
import ReferenceNodeComponent from '../nodes/ReferenceNode';
import RangeNodeComponent from '../nodes/RangeNode';
import NumberNodeComponent from '../nodes/NumberNode';
import StringNodeComponent from '../nodes/StringNode';
import FunctionNodeComponent from '../nodes/FunctionNode';
import ExpandableExpressionNodeComponent from '../nodes/ExpandableExpressionNode';
import ResultNodeComponent from '../nodes/ResultNode';
import BinOpNodeComponent from '../nodes/BinOpNode';
import ConditionalNodeComponent from '../nodes/ConditionalNode';
import GraphToolbar from '../GraphToolbar';
import { ConnectionDropPopover } from '../ConnectionDropPopover';

/**
 * Props for the Sidebar component that renders an AST as a ReactFlow graph.
 *
 * Note: Additional spreadsheet action callbacks (setViewedCellHighlight, clearViewedCellHighlight,
 * onNodeEdit, deselectCell) are provided via SpreadsheetActionsContext to reduce prop drilling.
 */
export interface SidebarProps {
  /** The AST to visualize. When undefined, the graph is cleared. */
  ast?: ASTNode;
  /** HyperFormula instance for formula evaluation */
  hfInstance: HyperFormula;
  /** Name of the active spreadsheet sheet */
  activeSheetName: string;
  /** Address of the currently selected cell */
  selectedCell: {row: number, col: number} | null;
  /** Currently selected range in the spreadsheet (for range editing) */
  selectedRange: SelectedRange | null;
  /** scrollToCell Callback to move viewport to corresponding cell */
  scrollToCell: (row: number, col: number, sheet?: string) => void;
  highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
  clearHighlight: () => void;
  /** Version counter that increments when sheets are added/removed (triggers graph reset) */
  sheetsVersion: number;
}

const nodeTypes = {
  TwoTextNode: TwoTextNodeComponent,
  ReferenceNode: ReferenceNodeComponent,
  RangeNode: RangeNodeComponent,
  NumberNode: NumberNodeComponent,
  StringNode: StringNodeComponent,
  FunctionNode: FunctionNodeComponent,
  ExpandableExpressionNode: ExpandableExpressionNodeComponent,
  ResultNode: ResultNodeComponent,
  BinOpNode: BinOpNodeComponent,
  ConditionalNode: ConditionalNodeComponent,
};

/**
 * Inner component that uses the composed useSidebarState hook.
 * Must be rendered within ReactFlowProvider, ToastProvider, and ConnectionDragProvider.
 */
function SidebarInner(props: SidebarProps) {
  const state = useSidebarState(props);

  return (
    <div className={`sidebar-inner ${state.isEditModeActive ? 'edit-mode-active' : 'preview-mode-active'}`}>
      <GraphEditModeContext.Provider
        value={{
          isEditModeActive: state.isEditModeActive,
          editingNodeId: state.editingNodeId,
          enterEditMode: state.enterEditMode,
          exitEditMode: state.exitEditMode,
          saveEdit: state.saveEdit,
          onUnmerge: state.handleUnmerge,
        }}
      >
        <HyperFormulaProvider
          hfInstance={state.hfInstance}
          activeSheetName={state.activeSheetName}
          selectedCell={state.selectedCell}
          selectedRange={state.selectedRange}
          scrollToCell={state.scrollToCell}
          highlightCells={state.highlightCells}
          clearHighlight={state.clearHighlight}
        >
          <ReactFlow
            nodes={state.nodes}
            edges={state.edges}
            nodeTypes={nodeTypes}
            onNodesChange={state.handleNodesChange}
            onEdgesChange={state.handleEdgesChange}
            onConnect={state.onConnect}
            onConnectStart={state.onConnectStart}
            onConnectEnd={state.onConnectEnd}
            onEdgesDelete={state.onEdgesDelete}
            onEdgeClick={state.onEdgeClick}
            onEdgeDoubleClick={state.onEdgeDoubleClick}
            isValidConnection={state.isValidConnection}
            nodesDraggable={true}
            zoomOnDoubleClick={false}
          >
            <Background />
            <Controls />
            <GraphToolbar
              currentCellAddress={state.currentCellAddress}
              currentCell={state.syncedCell}
              hasPendingSync={state.hasPendingSync}
              pendingCellAddress={state.pendingCellAddress}
              onSync={state.handleSync}
              onUndo={state.handleUndo}
              onRedo={state.handleRedo}
              canUndo={state.formulaHistory.canUndo}
              canRedo={state.formulaHistory.canRedo}
            />
          </ReactFlow>
        </HyperFormulaProvider>
      </GraphEditModeContext.Provider>
      <ToastContainer />
      {state.pendingSwap && (
        <ConnectionDropPopover
          targetNodeId={state.pendingSwap.connection.target!}
          targetHandle={state.pendingSwap.connection.targetHandle!}
          onReplace={state.handlePendingReplace}
          onSwap={state.handlePendingSwap}
          onCancel={state.handlePendingCancel}
        />
      )}
    </div>
  );
}

export default function Sidebar(props: SidebarProps): JSX.Element {
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <ConnectionDragProvider>
          <SidebarInner {...props} />
        </ConnectionDragProvider>
      </ReactFlowProvider>
    </ToastProvider>
  );
}