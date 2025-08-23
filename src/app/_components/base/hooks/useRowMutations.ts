import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { useCreateRow } from "./useCreateRow";

export function useRowMutations() {
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const { handleCreateRow, createRowMutation } = useCreateRow();

  const bulkInsertRowsMutation = api.row.bulkInsert.useMutation({
    mutationKey: ['row', 'bulk-insert'],
    onError: () => {
      // Note: isBulkLoading state should be managed by the consuming component
    },
    onSuccess: (data, variables) => {
      // Note: isBulkLoading state should be managed by the consuming component
      // Only invalidate if this is the only bulk mutation running
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'bulk-insert'] });
      if (concurrentMutations === 1) {
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    }
  });

  const insertRowAboveMutation = api.row.insertAbove.useMutation({
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

  const insertRowBelowMutation = api.row.insertBelow.useMutation({
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

  const deleteRowMutation = api.row.delete.useMutation({
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

  // Handler functions
  const handleAddRow = async (selectedTable: string | null) => {
    if (!selectedTable) return;
    
    try {
      await handleCreateRow(selectedTable);
    } catch (error) {
      console.error('Failed to create row:', error);
    }
  };

  const handleInsertRowAbove = async (tableId: string, rowId: string) => {
    try {
      // Check if this is a temporary row ID from optimistic updates
      if (rowId.startsWith('temp-row-')) {
        // For temporary rows, find the closest real row and use its position
        const currentData = utils.table.getTableData.getInfiniteData({ 
          tableId, 
          limit: 100
        });
        
        if (currentData && currentData.pages.length > 0) {
          const allRows = currentData.pages.flatMap(page => page.rows);
          const targetRowIndex = allRows.findIndex(row => row.id === rowId);
          
          if (targetRowIndex >= 0) {
            // Find the closest real (non-temporary) row before this position
            let realRowId = null;
            for (let i = targetRowIndex - 1; i >= 0; i--) {
              if (!allRows[i]!.id.startsWith('temp-row-')) {
                realRowId = allRows[i]!.id;
                break;
              }
            }
            
            if (realRowId) {
              // Insert below the found real row (which will be above the temp row)
              await insertRowBelowMutation.mutateAsync({ tableId, targetRowId: realRowId });
              return;
            } else {
              // No real rows found above, just create a new row at the end
              await handleCreateRow(tableId);
              return;
            }
          }
        }
        
        // Fallback: create a new row at the end if we can't determine position
        await handleCreateRow(tableId);
        return;
      }
      
      await insertRowAboveMutation.mutateAsync({ tableId, targetRowId: rowId });
    } catch (error) {
      console.error('Failed to insert row above:', error);
    }
  };

  const handleInsertRowBelow = async (tableId: string, rowId: string) => {
    try {
      // Check if this is a temporary row ID from optimistic updates
      if (rowId.startsWith('temp-row-')) {
        // For temporary rows, find the closest real row and use its position
        const currentData = utils.table.getTableData.getInfiniteData({ 
          tableId, 
          limit: 100
        });
        
        if (currentData && currentData.pages.length > 0) {
          const allRows = currentData.pages.flatMap(page => page.rows);
          const targetRowIndex = allRows.findIndex(row => row.id === rowId);
          
          if (targetRowIndex >= 0) {
            // Find the closest real (non-temporary) row after this position
            let realRowId = null;
            for (let i = targetRowIndex + 1; i < allRows.length; i++) {
              if (!allRows[i]!.id.startsWith('temp-row-')) {
                realRowId = allRows[i]!.id;
                break;
              }
            }
            
            if (realRowId) {
              // Insert above the found real row (which will be below the temp row)
              await insertRowAboveMutation.mutateAsync({ tableId, targetRowId: realRowId });
              return;
            } else {
              // No real rows found below, just create a new row at the end
              await handleCreateRow(tableId);
              return;
            }
          }
        }
        
        // Fallback: create a new row at the end if we can't determine position
        await handleCreateRow(tableId);
        return;
      }
      
      await insertRowBelowMutation.mutateAsync({ tableId, targetRowId: rowId });
    } catch (error) {
      console.error('Failed to insert row below:', error);
    }
  };

  const handleDeleteRow = async (tableId: string, rowId: string) => {
    try {
      // Check if this is a temporary row ID from optimistic updates
      if (rowId.startsWith('temp-row-')) {
        // For temporary rows, just remove them from the cache without server call
        const currentData = utils.table.getTableData.getInfiniteData({ 
          tableId, 
          limit: 100
        });
        
        if (currentData && currentData.pages.length > 0) {
          // Find the target row to determine its order
          const targetRow = currentData.pages
            .flatMap(page => page.rows)
            .find(row => row.id === rowId);
          
          if (targetRow) {
            const deletedOrder = targetRow.order;
            
            // Update the cache to remove the temporary row
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
        return;
      }
      
      await deleteRowMutation.mutateAsync({ tableId, rowId });
    } catch (error) {
      console.error('Failed to delete row:', error);
    }
  };

  const handleBulkAddRows = async (selectedTable: string | null, isBulkLoading: boolean, setIsBulkLoading: (loading: boolean) => void) => {
    if (!selectedTable || isBulkLoading) return;
    
    setIsBulkLoading(true);
    try {
      await bulkInsertRowsMutation.mutateAsync({
        tableId: selectedTable,
        count: 100000,
      });
    } catch (error) {
      console.error('Failed to bulk insert rows:', error);
      setIsBulkLoading(false);
    }
  };

  return {
    // Mutations
    createRowMutation,
    bulkInsertRowsMutation,
    insertRowAboveMutation,
    insertRowBelowMutation,
    deleteRowMutation,
    
    // Handlers
    handleAddRow,
    handleInsertRowAbove,
    handleInsertRowBelow,
    handleDeleteRow,
    handleBulkAddRows,
  };
}