import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";

export function useCreateColumn() {
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
    onSuccess: () => {
      // Update column metadata and fix cell columnId references to maintain __cellIds mapping
      void utils.table.getTableData.invalidate();
    },
    onError: (err, variables, context) => {
      console.error('Failed to create column:', err);
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ tableId: variables.tableId, limit: 100 }, context.previousData);
      }
    }
  });

  const handleCreateColumn = async (tableId: string, name: string, type: 'TEXT' | 'NUMBER') => {
    try {
      await createColumnMutation.mutateAsync({ tableId, name, type });
    } catch (error) {
      console.error('Failed to create column:', error);
      throw error;
    }
  };

  return {
    createColumnMutation,
    handleCreateColumn,
    isCreating: createColumnMutation.isPending,
  };
}