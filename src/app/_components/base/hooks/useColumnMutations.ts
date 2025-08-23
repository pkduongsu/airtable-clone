import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { type FilterRule } from "../modals/FilterModal";

type SortRule = {
  id: string;
  columnId: string;
  columnName: string;
  columnType: string;
  direction: 'asc' | 'desc';
};

interface UseColumnMutationsProps {
  selectedTable: string | null;
  triggerViewSave: (sortRules: SortRule[], filterRules: FilterRule[]) => void;
  sortRules: SortRule[];
  filterRulesRef: React.MutableRefObject<FilterRule[]>;
  hiddenColumns: Set<string>; // Used for reference in handlers
  setHiddenColumns: React.Dispatch<React.SetStateAction<Set<string>>>;
  tableData?: {
    columns: Array<{
      id: string;
      name: string;
    }>;
  } | null;
}

export function useColumnMutations({
  selectedTable,
  triggerViewSave,
  sortRules,
  filterRulesRef,
  hiddenColumns: _hiddenColumns,
  setHiddenColumns,
  tableData,
}: UseColumnMutationsProps) {
  const utils = api.useUtils();
  const queryClient = useQueryClient();

  const renameColumnMutation = api.column.rename.useMutation({
    mutationKey: ['column', 'rename'],
    onMutate: async ({ columnId, name }) => {
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
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData && selectedTable) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: selectedTable, 
          limit: 100
        }, context.previousData);
      }
    },
    onSuccess: () => {
      // Only invalidate if this is the only column mutation running to prevent over-invalidation
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['column', 'rename'] });
      if (concurrentMutations === 1 && selectedTable) {
        // Safe to invalidate related queries
        void utils.table.getTableData.invalidate({ tableId: selectedTable });
      }
    }
  });

  const deleteColumnMutation = api.column.delete.useMutation({
    mutationKey: ['column', 'delete'],
    onMutate: async ({ columnId }) => {
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
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData && selectedTable) {
        utils.table.getTableData.setInfiniteData({ 
          tableId: selectedTable, 
          limit: 100
        }, context.previousData);
      }
    },
    onSuccess: () => {
      // Only invalidate if this is the only column mutation running to prevent over-invalidation
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['column', 'delete'] });
      if (concurrentMutations === 1 && selectedTable) {
        // Safe to invalidate related queries
        void utils.table.getTableData.invalidate({ tableId: selectedTable });
      }
    }
  });

  // Handler functions
  const handleRenameColumn = async (columnId: string, newName: string) => {
    try {
      await renameColumnMutation.mutateAsync({ columnId, name: newName });
    } catch (error) {
      console.error('Failed to rename column:', error);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    try {
      await deleteColumnMutation.mutateAsync({ columnId });
    } catch (error) {
      console.error('Failed to delete column:', error);
    }
  };

  // Column visibility handlers - save immediately on user interaction
  const handleToggleColumn = (columnId: string) => {
    setHiddenColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      return newSet;
    });
    // Save view config immediately when user toggles column
    setTimeout(() => triggerViewSave(sortRules, filterRulesRef.current), 100);
  };

  const handleHideAllColumns = () => {
    if (tableData?.columns) {
      setHiddenColumns(new Set(tableData.columns.map(col => col.id)));
    }
    // Save view config immediately when user hides all columns
    setTimeout(() => triggerViewSave(sortRules, filterRulesRef.current), 100);
  };

  const handleShowAllColumns = () => {
    setHiddenColumns(new Set());
    // Save view config immediately when user shows all columns
    setTimeout(() => triggerViewSave(sortRules, filterRulesRef.current), 100);
  };

  return {
    // Mutations
    renameColumnMutation,
    deleteColumnMutation,
    
    // Handlers
    handleRenameColumn,
    handleDeleteColumn,
    handleToggleColumn,
    handleHideAllColumns,
    handleShowAllColumns,
  };
}