import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";

export function useCreateRow() {
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  
  const createRowMutation = api.row.create.useMutation({
    mutationKey: ['row', 'create'],
    onMutate: async ({ tableId }) => {
      // Cancel any outgoing refetches that could interfere with optimistic updates
      await Promise.all([
        utils.table.getTableData.cancel({ 
          tableId, 
          limit: 100
        }),
        // Cancel cell queries that might interfere
        queryClient.cancelQueries({ 
          queryKey: ['trpc', 'cell', 'findByRowColumn']
        })
      ]);
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getInfiniteData({ 
        tableId, 
        limit: 100
      });
      
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
          utils.table.getTableData.setInfiniteData({ 
            tableId, 
            limit: 100
          }, (old) => {
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
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: variables.tableId, 
          limit: 100
        }, context.previousData);
      }
    },
    onSuccess: (data, variables, context) => {
      // Update optimistic data with real server IDs instead of invalidating
      if (context?.tempRowId && data?.id) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: variables.tableId, 
          limit: 100
        }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              rows: page.rows.map(row => 
                row.id === context.tempRowId
                  ? {
                      ...row,
                      id: data.id, // Update to real server ID
                      // Update all cell rowId references to use the real row ID
                      cells: row.cells.map(cell => ({
                        ...cell,
                        rowId: data.id,
                        // Update cell ID to reference the real row ID if it was temporary
                        id: cell.id.startsWith(`temp-cell-${context.tempRowId}-`) 
                          ? `temp-cell-${data.id}-${cell.columnId}`
                          : cell.id
                      }))
                    }
                  : row
              )
            }))
          };
        });
      }
      
      // TODO: Sync any temporary cell edits to the server in the background
      // For now, cells with temporary row/column IDs will only be saved 
      // when the user edits them again after the row/column gets real IDs
      
      // Only invalidate if there are concurrent mutations as a fallback
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'create'] });
      if (concurrentMutations > 1) {
        // There are other mutations running, invalidate to ensure consistency
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
      
      console.log('Row creation successful, updated optimistic state:', { tempRowId: context?.tempRowId, realRowId: data.id });
    }
  });

  const handleCreateRow = async (tableId: string) => {
    try {
      await createRowMutation.mutateAsync({ tableId });
    } catch (error) {
      console.error('Failed to create row:', error);
      throw error;
    }
  };

  return {
    createRowMutation,
    handleCreateRow,
    isCreating: createRowMutation.isPending,
  };
}