import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";

export const useCreateRowMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.row.create.useMutation({
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
};

export const useInsertRowAboveMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.row.insertAbove.useMutation({
    mutationKey: ['row', 'insert'],
    onMutate: async ({ tableId, targetRowId }) => {
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
      const tempRowId = `temp-row-above-${Date.now()}`;
      
      // Optimistically update the cache
      if (previousData && previousData.pages.length > 0) {
        const firstPage = previousData.pages[0];
        if (firstPage) {
          // Find the target row to determine its order
          const targetRow = previousData.pages
            .flatMap(page => page.rows)
            .find(row => row.id === targetRowId);
          
          if (targetRow) {
            const newOrder = targetRow.order;
            
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
              order: newOrder,
              cells: newCells,
            };
            
            // Update all pages to insert the row and adjust orders
            utils.table.getTableData.setInfiniteData({ 
              tableId, 
              limit: 100
            }, (old) => {
              if (!old) return old;
              
              const updatedPages = old.pages.map(page => ({
                ...page,
                rows: page.rows.map(row => 
                  row.order >= newOrder 
                    ? { ...row, order: row.order + 1 }
                    : row
                ).concat(newRow).sort((a, b) => a.order - b.order),
                _count: {
                  ...page._count,
                  rows: page._count.rows + 1,
                }
              }));
              
              return {
                ...old,
                pages: updatedPages,
              };
            });
          }
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
                      // Update all cell rowId references
                      cells: row.cells.map(cell => ({
                        ...cell,
                        rowId: data.id,
                        // Update cell ID if it was temporary
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
      
      // Only invalidate if there are concurrent mutations as a fallback
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'insert'] });
      if (concurrentMutations > 1) {
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    }
  });
};

export const useInsertRowBelowMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.row.insertBelow.useMutation({
    mutationKey: ['row', 'insert'],
    onMutate: async ({ tableId, targetRowId }) => {
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
      const tempRowId = `temp-row-below-${Date.now()}`;
      
      // Optimistically update the cache
      if (previousData && previousData.pages.length > 0) {
        const firstPage = previousData.pages[0];
        if (firstPage) {
          // Find the target row to determine its order
          const targetRow = previousData.pages
            .flatMap(page => page.rows)
            .find(row => row.id === targetRowId);
          
          if (targetRow) {
            const newOrder = targetRow.order + 1;
            
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
              order: newOrder,
              cells: newCells,
            };
            
            // Update all pages to insert the row and adjust orders
            utils.table.getTableData.setInfiniteData({ 
              tableId, 
              limit: 100
            }, (old) => {
              if (!old) return old;
              
              const updatedPages = old.pages.map(page => ({
                ...page,
                rows: page.rows.map(row => 
                  row.order >= newOrder 
                    ? { ...row, order: row.order + 1 }
                    : row
                ).concat(newRow).sort((a, b) => a.order - b.order),
                _count: {
                  ...page._count,
                  rows: page._count.rows + 1,
                }
              }));
              
              return {
                ...old,
                pages: updatedPages,
              };
            });
          }
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
                      // Update all cell rowId references
                      cells: row.cells.map(cell => ({
                        ...cell,
                        rowId: data.id,
                        // Update cell ID if it was temporary
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
      
      // Only invalidate if there are concurrent mutations as a fallback
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'insert'] });
      if (concurrentMutations > 1) {
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    }
  });
};

export const useDeleteRowMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.row.delete.useMutation({
    mutationKey: ['row', 'delete'],
    onMutate: async ({ tableId, rowId }) => {
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
      
      // Optimistically update the cache
      if (previousData && previousData.pages.length > 0) {
        // Find the target row to determine its order
        const targetRow = previousData.pages
          .flatMap(page => page.rows)
          .find(row => row.id === rowId);
        
        if (targetRow) {
          const deletedOrder = targetRow.order;
          
          // Update all pages to remove the row and adjust orders
          utils.table.getTableData.setInfiniteData({ 
            tableId, 
            limit: 100
          }, (old) => {
            if (!old) return old;
            
            const updatedPages = old.pages.map(page => ({
              ...page,
              rows: page.rows
                .filter(row => row.id !== rowId)
                .map(row => 
                  row.order > deletedOrder 
                    ? { ...row, order: row.order - 1 }
                    : row
                ),
              _count: {
                ...page._count,
                rows: Math.max(0, page._count.rows - 1),
              }
            }));
            
            return {
              ...old,
              pages: updatedPages,
            };
          });
        }
      }
      
      return { previousData };
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
    onSuccess: (data, variables) => {
      // Only invalidate if this is the only row mutation running to prevent over-invalidation
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'delete'] });
      if (concurrentMutations === 1) {
        // Safe to invalidate related queries
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    }
  });
};

export const useBulkInsertRowsMutation = () => {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  return api.row.bulkInsert.useMutation({
    mutationKey: ['row', 'bulk-insert'],
    onError: () => {
      // Handle error
    },
    onSuccess: (data, variables) => {
      // Only invalidate if this is the only bulk mutation running
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'bulk-insert'] });
      if (concurrentMutations === 1) {
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    }
  });
};