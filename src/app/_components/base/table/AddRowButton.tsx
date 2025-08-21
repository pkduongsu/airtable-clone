"use client";

import { useQueryClient } from "@tanstack/react-query";
import Plus from "../../icons/Plus";
import { api } from "~/trpc/react";

interface AddRowButtonProps {
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

export function AddRowButton({ 
  tableData, 
  tableTotalWidth 
}: AddRowButtonProps) {
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  
  const createRowMutation = api.row.create.useMutation({
    mutationKey: ['row', 'create'],
    onMutate: async ({ tableId }) => {
      // Cancel any outgoing refetches that could interfere with optimistic updates
      await Promise.all([
        utils.table.getTableData.cancel({ tableId, limit: 100 }),
        // Cancel cell queries that might interfere
        queryClient.cancelQueries({ 
          queryKey: ['trpc', 'cell', 'findByRowColumn']
        })
      ]);
      
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
    onSuccess: (newRow, variables, context) => {
      // Update the temporary row ID with the real server ID
      if (context?.tempRowId && newRow) {
        const { tableId } = variables;
        
        utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, (old) => {
          if (!old) return old;
          
          const updatedPages = old.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
              if (row.id === context.tempRowId) {
                // Update the row with the real server ID
                return {
                  ...row,
                  id: newRow.id,
                  // Update all cell rowId references to use the real row ID
                  cells: row.cells.map(cell => ({
                    ...cell,
                    rowId: newRow.id,
                    // Update cell ID to reference the real row ID if it was temporary
                    id: cell.id.startsWith(`temp-cell-${context.tempRowId}-`) 
                      ? `temp-cell-${newRow.id}-${cell.columnId}`
                      : cell.id
                  }))
                };
              }
              return row;
            })
          }));
          
          return {
            ...old,
            pages: updatedPages,
          };
        });
      }
      
      // Only invalidate if there are concurrent mutations as a fallback
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'create'] });
      if (concurrentMutations > 1) {
        // There are other mutations running, invalidate to ensure consistency
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    },
    onError: (err, variables, context) => {
      console.error('Failed to create row:', err);
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ tableId: variables.tableId, limit: 100 }, context.previousData);
      }
    }
  });

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
    <button 
      className="flex items-center gap-2 px-2 py-1 border-b border-r border-border-default bg-white hover:bg-[#f8f8f8] h-8 text-sm text-gray-600 hover:text-gray-800 cursor-pointer w-full"
      style={{
        width: tableTotalWidth,
      }}
      onClick={handleAddRowClick}
    >
      <Plus size={14} className="flex flex-none" />
    </button>
  );
}