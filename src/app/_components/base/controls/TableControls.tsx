"use client";

import { useState } from "react";
import Plus from "../../icons/Plus";
import { AddColumnModal } from "../modals/AddColumnModal";
import { api } from "~/trpc/react";

interface TableControlsProps {
  tableData: {
    id: string;
    columns: Array<{
      id: string;
      name: string;
      type: string;
      order: number;
      width: number;
      tableId: string;
    }>;
  };
  tableTotalWidth: number;
}

export function TableControls({ 
  tableData, 
  tableTotalWidth 
}: TableControlsProps) {
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  
  const utils = api.useUtils();
  
  const createColumnMutation = api.table.createColumn.useMutation({
    onMutate: async ({ tableId, name, type }) => {
      // Cancel any outgoing refetches
      await utils.table.getTableData.cancel({ tableId });
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getData({ tableId });
      
      // Generate temporary IDs
      const tempColumnId = `temp-column-${Date.now()}`;
      
      // Optimistically update the cache
      if (previousData) {
        const maxOrder = Math.max(...previousData.columns.map(col => col.order), -1);
        const nextOrder = maxOrder + 1;
        
        const newColumn = {
          id: tempColumnId,
          name,
          type,
          order: nextOrder,
          width: 179,
          tableId,
        };
        
        // Add new column and create empty cells for all existing rows
        utils.table.getTableData.setData({ tableId }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            columns: [...old.columns, newColumn],
            rows: old.rows.map(row => ({
              ...row,
              cells: [
                ...row.cells,
                {
                  id: `temp-cell-${row.id}-${tempColumnId}`,
                  rowId: row.id,
                  columnId: tempColumnId,
                  value: { text: "" },
                  column: newColumn,
                }
              ]
            }))
          };
        });
      }
      
      return { previousData, tempColumnId };
    },
    onSuccess: (newColumn, variables, context) => {
      // Replace temporary data with real server data for columns
      if (context?.tempColumnId) {
        const { tableId } = variables;
        utils.table.getTableData.setData({ tableId }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            columns: old.columns.map(col => 
              col.id === context.tempColumnId ? newColumn : col
            ),
            rows: old.rows.map(row => ({
              ...row,
              cells: row.cells.map(cell =>
                cell.columnId === context.tempColumnId
                  ? { ...cell, columnId: newColumn.id, column: newColumn }
                  : cell
              )
            }))
          };
        });
      }
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setData({ tableId: variables.tableId }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch to ensure server state
      void utils.table.getTableData.invalidate({ tableId: variables.tableId });
    }
  });
  
  const createRowMutation = api.table.createRow.useMutation({
    onMutate: async ({ tableId }) => {
      // Cancel any outgoing refetches
      await utils.table.getTableData.cancel({ tableId });
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getData({ tableId });
      
      // Generate temporary IDs
      const tempRowId = `temp-row-${Date.now()}`;
      
      // Optimistically update the cache
      if (previousData) {
        const maxOrder = Math.max(...previousData.rows.map(row => row.order), -1);
        const nextOrder = maxOrder + 1;
        
        // Create empty cells for all existing columns
        const newCells = previousData.columns.map(column => ({
          id: `temp-cell-${tempRowId}-${column.id}`,
          rowId: tempRowId,
          columnId: column.id,
          value: { text: "" },
          column,
        }));
        
        const newRow = {
          id: tempRowId,
          tableId,
          order: nextOrder,
          cells: newCells,
        };
        
        utils.table.getTableData.setData({ tableId }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            rows: [...old.rows, newRow],
            _count: {
              ...old._count,
              rows: old._count.rows + 1,
            }
          };
        });
      }
      
      return { previousData, tempRowId };
    },
    onSuccess: (_newRow, _variables, _context) => {
      // Since the server doesn't return the full row with cells,
      // we'll let the invalidate in onSettled handle the final update
      // The optimistic update provides immediate feedback, and
      // the invalidate ensures we have the correct server state
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setData({ tableId: variables.tableId }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch to ensure server state
      void utils.table.getTableData.invalidate({ tableId: variables.tableId });
    }
  });

  const handleAddColumnClick = () => {
    setShowAddColumnModal(true);
  };

  const handleCloseModal = () => {
    setShowAddColumnModal(false);
  };

  const handleCreateField = async (name: string, type: 'TEXT' | 'NUMBER') => {
    try {
      await createColumnMutation.mutateAsync({
        tableId: tableData.id,
        name,
        type,
      });
      // No need to call onTableDataRefresh since we're using optimistic updates
    } catch (error) {
      console.error('Failed to create column:', error);
      // Error handling is done in the mutation's onError callback
    }
  };

  const handleAddRowClick = async () => {
    try {
      await createRowMutation.mutateAsync({
        tableId: tableData.id,
      });
      // No need to call onTableDataRefresh since we're using optimistic updates
    } catch (error) {
      console.error('Failed to create row:', error);
      // Error handling is done in the mutation's onError callback
    }
  };

  return (
    <>
      {/* Add row button */}
      <button 
        className="flex items-center gap-2 px-2 py-1 border-b border-r border-border-default bg-white hover:bg-[#f8f8f8] h-8 text-sm text-gray-600 hover:text-gray-800 cursor-pointer w-full"
        style={{
          width: tableTotalWidth,
        }}
        onClick={handleAddRowClick}
      >
        <Plus size={14} className="flex flex-none" />
      </button>

      {/* Add column button */}
      <button 
        className="absolute top-0 bg-white border-b border-r border-border-default hover:bg-[#f8f8f8] flex items-center justify-center cursor-pointer h-[32px] w-[94px]" 
        style={{
          left: `${tableTotalWidth}px`,
          zIndex: 11, // Above table headers
        }}
        onClick={handleAddColumnClick}
      >
        <Plus size={16} className="flex-none" />
      </button>

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={showAddColumnModal}
        onClose={handleCloseModal}
        onCreateField={handleCreateField}
        position={{ 
          top: 32, // Height of the button (32px)
          left: tableTotalWidth - 188 // Adjust for modal width
        }}
        existingColumnNames={tableData.columns.map(col => col.name)}
      />
    </>
  );
}