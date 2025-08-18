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
  
  const createColumnMutation = api.column.create.useMutation({
    onMutate: async ({ tableId, name, type }) => {
      // Cancel any outgoing refetches for base query
      await utils.table.getTableData.cancel({ tableId, limit: 100 });
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getInfiniteData({ tableId, limit: 100 });
      
      // Generate temporary IDs
      const tempColumnId = `temp-column-${Date.now()}`;
      
      // Optimistically update the cache
      if (previousData) {
        const firstPage = previousData.pages[0];
        if (firstPage) {
          const maxOrder = Math.max(...firstPage.columns.map(col => col.order), -1);
          const nextOrder = maxOrder + 1;
          
          const newColumn = {
            id: tempColumnId,
            name,
            type,
            order: nextOrder,
            width: 179,
            tableId,
          };
          
          // Add new column and create empty cells for all existing rows across all pages
          utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, (old) => {
            if (!old) return old;
            
            const updatedPages = old.pages.map(page => ({
              ...page,
              columns: [...page.columns, newColumn],
              rows: page.rows.map(row => ({
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
            }));
            
            return {
              ...old,
              pages: updatedPages,
            };
          });
        }
      }
      
      return { previousData, tempColumnId };
    },
    onSuccess: (newColumn, variables, context) => {
      // Update column metadata and fix cell columnId references to maintain __cellIds mapping
      if (context?.tempColumnId) {
        const { tableId } = variables;
        
        utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, (old) => {
          if (!old) return old;
          
          const updatedPages = old.pages.map(page => ({
            ...page,
            // Update the column metadata
            columns: page.columns.map(col => 
              col.id === context.tempColumnId ? newColumn : col
            ),
            // Update cell columnId references so __cellIds mapping works correctly
            // But keep the temporary cell IDs to preserve user data and avoid React remounts
            rows: page.rows.map(row => ({
              ...row,
              cells: row.cells.map(cell =>
                cell.columnId === context.tempColumnId
                  ? { 
                      ...cell, 
                      columnId: newColumn.id, // Update columnId reference
                      column: newColumn, // Update column reference
                      // Keep original cell.id to avoid React remount issues
                    }
                  : cell
              )
            }))
          }));
          
          return {
            ...old,
            pages: updatedPages,
          };
        });
      }
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ tableId: variables.tableId, limit: 100 }, context.previousData);
      }
    },
    onSettled: (_data, _error, _variables) => {
      // Don't invalidate immediately to avoid disrupting user interaction with the new column
      // The optimistic update already provides the correct UI state
      // Server sync happens in the background via the onSuccess handler
    }
  });
  
  const createRowMutation = api.row.create.useMutation({
    onMutate: async ({ tableId }) => {
      // Cancel any outgoing refetches
      await utils.table.getTableData.cancel({ tableId, limit: 100 });
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getInfiniteData({ tableId, limit: 100 });
      
      // Generate temporary IDs
      const tempRowId = `temp-row-${Date.now()}`;
      
      // Optimistically update the cache
      if (previousData && previousData.pages.length > 0) {
        const firstPage = previousData.pages[0];
        if (firstPage) {
          // Find the maximum order across all pages
          const allOrders = previousData.pages.flatMap(page => page.rows.map(row => row.order));
          const maxOrder = Math.max(...allOrders, -1);
          const nextOrder = maxOrder + 1;
          
          // Create empty cells for all existing columns
          const newCells = firstPage.columns.map(column => ({
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
          
          // Add the new row to the last page (most recent)
          utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, (old) => {
            if (!old) return old;
            
            const updatedPages = [...old.pages];
            const lastPageIndex = updatedPages.length - 1;
            
            if (lastPageIndex >= 0 && updatedPages[lastPageIndex]) {
              const lastPage = updatedPages[lastPageIndex];
              updatedPages[lastPageIndex] = {
                ...lastPage,
                rows: [...lastPage.rows, newRow],
                _count: {
                  ...lastPage._count,
                  rows: lastPage._count.rows + 1,
                }
              };
            }
            
            return {
              ...old,
              pages: updatedPages,
            };
          });
        }
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
        utils.table.getTableData.setInfiniteData({ tableId: variables.tableId, limit: 100 }, context.previousData);
      }
    },
    onSettled: (_data, _error, _variables) => {
      // Don't invalidate immediately to avoid disrupting user interaction with the new row
      // The optimistic update already provides the correct UI state
      // Server sync happens naturally without forcing a refetch
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