"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Plus from "../../icons/Plus";
import { AddColumnModal } from "../modals/AddColumnModal";
import { api } from "~/trpc/react";

interface AddColumnButtonProps {
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

export function AddColumnButton({ 
  tableData, 
  tableTotalWidth 
}: AddColumnButtonProps) {
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  
  const createColumnMutation = api.column.create.useMutation({
    mutationKey: ['column', 'create'],
    onMutate: async ({ tableId, name, type }) => {
      // Cancel any outgoing refetches that could interfere with optimistic updates
      await Promise.all([
        utils.table.getTableData.cancel({ tableId, limit: 100 }),
        // Cancel cell queries that might interfere with column creation
        queryClient.cancelQueries({ 
          queryKey: ['trpc', 'cell', 'findByRowColumn']
        })
      ]);
      
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
      
      // Only invalidate if there are concurrent mutations as a fallback
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['column', 'create'] });
      if (concurrentMutations > 1) {
        // There are other mutations running, invalidate to ensure consistency
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    },
    onError: (err, variables, context) => {
      console.error('Failed to create column:', err);
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ tableId: variables.tableId, limit: 100 }, context.previousData);
      }
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

  return (
    <>
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