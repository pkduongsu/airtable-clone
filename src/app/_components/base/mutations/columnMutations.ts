import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";

export const useCreateColumnMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.column.create.useMutation({
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
      const tempColumnId = crypto.randomUUID();
      
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
                    id: `temp-cell-${row.id}-${tempColumnId}`, // Keep ID for UI consistency
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
            // Update cell columnId references using composite key approach
            rows: page.rows.map(row => ({
              ...row,
              cells: row.cells.map(cell =>
                cell.columnId === context.tempColumnId
                  ? { 
                      ...cell, 
                      columnId: newColumn.id, // Update columnId reference
                      column: newColumn, // Update column reference
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
};

export const useRenameColumnMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.column.rename.useMutation({
    mutationKey: ['column', 'rename'],
    onMutate: async ({ columnId, name }) => {
      // Get current table ID from cache or pass it as parameter
      const allTableData = queryClient.getQueriesData({ 
        queryKey: ['trpc', 'table', 'getTableData'] 
      });
      
      let selectedTable: string | null = null;
      for (const [key, data] of allTableData) {
        if (data && typeof data === 'object' && 'pages' in data) {
          const pages = (data as { pages: Array<{ columns?: Array<{ id: string }> }> }).pages;
          if (pages.length > 0 && pages[0]?.columns?.some(col => col.id === columnId)) {
            // Extract table ID from query key
            const queryKeyArray = key as unknown[];
            const tableParams = queryKeyArray[2] as { tableId?: string } | undefined;
            selectedTable = tableParams?.tableId ?? null;
            break;
          }
        }
      }

      if (!selectedTable) return { previousData: undefined };

      // Cancel any outgoing refetches that could interfere with optimistic updates
      await Promise.all([
        utils.table.getTableData.cancel({ 
          tableId: selectedTable, 
          limit: 100
        }),
        // Cancel cell queries that might interfere with column renaming
        queryClient.cancelQueries({ 
          queryKey: ['trpc', 'cell', 'findByRowColumn']
        })
      ]);
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getInfiniteData({ 
        tableId: selectedTable, 
        limit: 100
      });
      
      // Optimistically update the cache
      if (previousData && previousData.pages.length > 0) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: selectedTable, 
          limit: 100
        }, (old) => {
          if (!old) return old;
          
          const updatedPages = old.pages.map(page => ({
            ...page,
            columns: page.columns.map(col => 
              col.id === columnId ? { ...col, name } : col
            ),
            rows: page.rows.map(row => ({
              ...row,
              cells: row.cells.map(cell => 
                cell.columnId === columnId 
                  ? { ...cell, column: { ...cell.column, name } }
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
      
      return { previousData, selectedTable };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData && context?.selectedTable) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: context.selectedTable, 
          limit: 100
        }, context.previousData);
      }
    },
    onSuccess: (data, variables, context) => {
      // Only invalidate if this is the only column mutation running to prevent over-invalidation
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['column', 'rename'] });
      if (concurrentMutations === 1 && context?.selectedTable) {
        // Safe to invalidate related queries
        void utils.table.getTableData.invalidate({ tableId: context.selectedTable });
      }
    }
  });
};

export const useDeleteColumnMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.column.delete.useMutation({
    mutationKey: ['column', 'delete'],
    onMutate: async ({ columnId }) => {
      // Get current table ID from cache
      const allTableData = queryClient.getQueriesData({ 
        queryKey: ['trpc', 'table', 'getTableData'] 
      });
      
      let selectedTable: string | null = null;
      for (const [key, data] of allTableData) {
        if (data && typeof data === 'object' && 'pages' in data) {
          const pages = (data as { pages: Array<{ columns?: Array<{ id: string }> }> }).pages;
          if (pages.length > 0 && pages[0]?.columns?.some(col => col.id === columnId)) {
            // Extract table ID from query key
            const queryKeyArray = key as unknown[];
            const tableParams = queryKeyArray[2] as { tableId?: string } | undefined;
            selectedTable = tableParams?.tableId ?? null;
            break;
          }
        }
      }

      if (!selectedTable) return { previousData: undefined };

      // Cancel any outgoing refetches that could interfere with optimistic updates
      await Promise.all([
        utils.table.getTableData.cancel({ 
          tableId: selectedTable, 
          limit: 100
        }),
        // Cancel cell queries that might interfere with column deletion
        queryClient.cancelQueries({ 
          queryKey: ['trpc', 'cell', 'findByRowColumn']
        })
      ]);
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getInfiniteData({ 
        tableId: selectedTable, 
        limit: 100
      });
      
      // Optimistically update the cache
      if (previousData && previousData.pages.length > 0) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: selectedTable, 
          limit: 100
        }, (old) => {
          if (!old) return old;
          
          const updatedPages = old.pages.map(page => ({
            ...page,
            columns: page.columns.filter(col => col.id !== columnId),
            rows: page.rows.map(row => ({
              ...row,
              cells: row.cells.filter(cell => cell.columnId !== columnId)
            }))
          }));
          
          return {
            ...old,
            pages: updatedPages,
          };
        });
      }
      
      return { previousData, selectedTable };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData && context?.selectedTable) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: context.selectedTable, 
          limit: 100
        }, context.previousData);
      }
    },
    onSuccess: (data, variables, context) => {
      // Only invalidate if this is the only column mutation running to prevent over-invalidation
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['column', 'delete'] });
      if (concurrentMutations === 1 && context?.selectedTable) {
        // Safe to invalidate related queries
        void utils.table.getTableData.invalidate({ tableId: context.selectedTable });
      }
    }
  });
};