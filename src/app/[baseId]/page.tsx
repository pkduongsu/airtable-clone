"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "~/trpc/react";

import { Sidebar } from "../_components/base/controls/Sidebar";
import { NavBar } from "../_components/base/controls/NavBar";
import { useMutationTracker, MutationTrackerProvider } from "../_components/providers/MutationTracker";
import { EditingStateProvider } from "../_components/providers/EditingStateProvider";
import { TableTabsBar } from "../_components/base/controls/TableTabsBar";
import  Toolbar  from "../_components/base/controls/Toolbar";
import { DataTable } from "../_components/base/table/DataTable";
import { ViewSidebar } from "../_components/base/controls/ViewSidebar";
import { SummaryBar } from "../_components/base/controls/SummaryBar";
import { CellContextMenu } from "../_components/base/modals/CellContextMenu";
import { type FilterRule } from "../_components/base/modals/FilterModal";
import { type ViewConfig } from "../_components/base/modals/CreateViewModal";
import { useSortManagement } from "../_components/base/hooks/useSortManagement";
import { useSortDataProcessor } from "../_components/base/hooks/useSortDataProcessor";
import { useSortViewIntegration } from "../_components/base/hooks/useSortViewIntegration";

type SearchResult = {
  type: 'field' | 'cell';
  id: string;
  name: string;
  columnId: string;
  columnOrder: number;
  rowId: string | null;
  rowOrder: number;
};


function BasePageContent() {
  const { data: session } = useSession();
  const params = useParams();
  const baseId = params?.baseId as string;
  
  
  const user = session?.user;
  
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280); //for resizing main content area
  const [isResizing, setIsResizing] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    rowId: string;
  } | null>(null);

  // Bulk loading state
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Column visibility state
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  // Filter state
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);

  // View state
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [isViewSwitching, setIsViewSwitching] = useState(false);

  const utils = api.useUtils();
  const queryClient = useQueryClient();
  
  // View update mutation
  const updateViewMutation = api.view.update.useMutation({
    onSuccess: () => {
      // Refresh view list after successful save to ensure latest configs are loaded
      if (selectedTable) {
        setTimeout(() => {
          void utils.view.list.invalidate({ tableId: selectedTable });
        }, 300);
      }
    },
    onError: (error) => {
      console.error('Failed to save view config:', error);
    }
  });
  
  const updateViewMutationRef = useRef(updateViewMutation.mutate);
  updateViewMutationRef.current = updateViewMutation.mutate;

  // Manual trigger for immediate view saves (view list refresh handled by mutation)
  const triggerViewSave = useCallback((currentSortRules: any[] = []) => {
    if (currentViewId) {
      setTimeout(() => {
        const config: ViewConfig = {
          sortRules: currentSortRules,
          filterRules,
          hiddenColumns: Array.from(hiddenColumns),
        };
        updateViewMutationRef.current({
          id: currentViewId,
          config
        });
      }, 100);
    }
  }, [currentViewId, filterRules, hiddenColumns, updateViewMutationRef]);

  // Specialized function for user-initiated view config updates
  const triggerViewSaveWithRefresh = () => {
    triggerViewSave(sortRules);
  };

  // Sort management hooks with save trigger
  const {
    sortRules,
    handleUpdateSortRule: originalHandleUpdateSortRule,
    handleRemoveSortRule: originalHandleRemoveSortRule,
    handleAddSortRule: originalHandleAddSortRule,
    handleUpdateSortRuleField: originalHandleUpdateSortRuleField,
    updateSortRules,
  } = useSortManagement();

  // Wrap sort handlers to include immediate view config saves
  const handleUpdateSortRule = useCallback((ruleId: string, direction: 'asc' | 'desc') => {
    originalHandleUpdateSortRule(ruleId, direction);
    // Use setTimeout to get updated sortRules after state change
    setTimeout(() => {
      const updatedSortRules = sortRules.map(rule => 
        rule.id === ruleId ? { ...rule, direction } : rule
      );
      triggerViewSave(updatedSortRules);
    }, 100);
  }, [originalHandleUpdateSortRule, sortRules, triggerViewSave]);

  const handleRemoveSortRule = useCallback((ruleId: string) => {
    originalHandleRemoveSortRule(ruleId);
    setTimeout(() => {
      const updatedSortRules = sortRules.filter(rule => rule.id !== ruleId);
      triggerViewSave(updatedSortRules);
    }, 100);
  }, [originalHandleRemoveSortRule, sortRules, triggerViewSave]);

  const handleAddSortRule = useCallback((columnId: string, columnName: string, columnType: string) => {
    originalHandleAddSortRule(columnId, columnName, columnType);
    setTimeout(() => {
      const newRule = {
        id: `sort-${Date.now()}-${Math.random()}`,
        columnId,
        direction: 'asc' as const,
        columnName,
        columnType,
      };
      const updatedSortRules = [...sortRules, newRule];
      triggerViewSave(updatedSortRules);
    }, 100);
  }, [originalHandleAddSortRule, sortRules, triggerViewSave]);

  const handleUpdateSortRuleField = useCallback((ruleId: string, columnId: string, columnName: string, columnType: string) => {
    originalHandleUpdateSortRuleField(ruleId, columnId, columnName, columnType);
    setTimeout(() => {
      const updatedSortRules = sortRules.map(rule => 
        rule.id === ruleId ? { ...rule, columnId, columnName, columnType } : rule
      );
      triggerViewSave(updatedSortRules);
    }, 100);
  }, [originalHandleUpdateSortRuleField, sortRules, triggerViewSave]);

  // Search state
  const [searchResults, setSearchResults] = useState<Array<{
    type: 'field' | 'cell';
    id: string;
    name: string;
    columnId: string;
    columnOrder: number;
    rowId: string | null;
    rowOrder: number;
  }>>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrollToRowId, setScrollToRowId] = useState<string | null>(null);


  const { data: base } = api.base.getById.useQuery(
    { id: baseId },
    { enabled: !!baseId }
  );

  const { data: tables, refetch: refetchTables } = api.table.list.useQuery(
    { baseId },
    { enabled: !!baseId }
  );

  // Get detailed table data with rows and cells using infinite query (stable base query without sorting)
  const {
    data: infiniteTableData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingTableData,
    isFetching: isFetchingTableData,
    refetch: refetchTableData
  } = api.table.getTableData.useInfiniteQuery(
    { 
      tableId: selectedTable!, 
      limit: 100
      // Note: No sortRules here - keeping query stable
    },
    {
      enabled: !!selectedTable,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Background query for server-side processed data (when sort or filter rules exist)
  const {
    data: processedInfiniteTableData,
    isLoading: isLoadingProcessedData,
    isFetching: isFetchingProcessedData,
    refetch: refetchProcessedData
  } = api.table.getTableData.useInfiniteQuery(
    { 
      tableId: selectedTable!, 
      limit: 100,
      ...(sortRules.length > 0 && {
        sortRules: sortRules.map(rule => ({
          columnId: rule.columnId,
          direction: rule.direction
        }))
      }),
      ...(filterRules.length > 0 && {
        filterRules: filterRules.map(rule => ({
          id: rule.id,
          columnId: rule.columnId,
          columnName: rule.columnName,
          columnType: rule.columnType,
          operator: rule.operator,
          value: rule.value
        }))
      })
    },
    {
      enabled: !!selectedTable && (sortRules.length > 0 || filterRules.length > 0),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Data persistence to prevent loading states
  const lastKnownTableDataRef = useRef<typeof tableData>(undefined);

  // Flatten the paginated data into a single tableData object
  const tableData = useMemo(() => {
    const data = infiniteTableData?.pages[0] ? {
      ...infiniteTableData.pages[0], // Get table metadata from first page
      rows: infiniteTableData.pages.flatMap(page => page.rows), // Flatten all rows
    } : undefined;
    
    // Store the data if it exists
    if (data) {
      lastKnownTableDataRef.current = data;
    }
    
    return data;
  }, [infiniteTableData]);

  // Server-side processed data (when available)
  const serverProcessedTableData = useMemo(() => {
    return processedInfiniteTableData?.pages[0] ? {
      ...processedInfiniteTableData.pages[0], // Get table metadata from first page
      rows: processedInfiniteTableData.pages.flatMap(page => page.rows), // Flatten all rows
    } : undefined;
  }, [processedInfiniteTableData]);

  const createTableMutation = api.table.create.useMutation();
  const updateTableMutation = api.table.update.useMutation();
  const deleteTableMutation = api.table.delete.useMutation();
  
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

  const bulkInsertRowsMutation = api.row.bulkInsert.useMutation({
    mutationKey: ['row', 'bulk-insert'],
    onError: () => {
      setIsBulkLoading(false);
    },
    onSuccess: (data, variables) => {
      setIsBulkLoading(false);
      // Only invalidate if this is the only bulk mutation running
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['row', 'bulk-insert'] });
      if (concurrentMutations === 1) {
        void utils.table.getTableData.invalidate({ tableId: variables.tableId });
      }
    }
  });

  const handleCreateTable = async () => {
    try {
      const tableNumber = (tables?.length ?? 0) + 1;
      const newTable = await createTableMutation.mutateAsync({
        baseId,
        name: `Table ${tableNumber}`,
        generateSampleData: true,
      });
      
      // Refetch tables to include the new table
      await refetchTables();
      
      // Select the newly created table
      setSelectedTable(newTable.id);
      
      // Refetch table data for the new table
      await refetchTableData();
    } catch (error) {
      console.error('Failed to create table:', error);
      throw error;
    }
  };

  const handleRenameTable = async (tableId: string, newName: string) => {
    try {
      await updateTableMutation.mutateAsync({
        id: tableId,
        name: newName,
      });
      
      // Refetch tables to reflect the new name
      await refetchTables();
    } catch (error) {
      console.error('Failed to rename table:', error);
      throw error;
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      // Prevent deleting the last table
      if (tables && tables.length <= 1) {
        throw new Error("Cannot delete the last table in the base");
      }

      await deleteTableMutation.mutateAsync({
        id: tableId,
      });
      
      // If the deleted table was selected, select the first remaining table
      if (selectedTable === tableId) {
        const remainingTables = tables?.filter(t => t.id !== tableId) ?? [];
        if (remainingTables.length > 0) {
          setSelectedTable(remainingTables[0]!.id);
        }
      }
      
      // Refetch tables to reflect the deletion
      await refetchTables();
    } catch (error) {
      console.error('Failed to delete table:', error);
      throw error;
    }
  };

  const handleAddRow = async () => {
    if (!selectedTable) return;
    
    try {
      await createRowMutation.mutateAsync({
        tableId: selectedTable,
      });
    } catch (error) {
      console.error('Failed to create row:', error);
    }
  };

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
              await createRowMutation.mutateAsync({ tableId });
              return;
            }
          }
        }
        
        // Fallback: create a new row at the end if we can't determine position
        await createRowMutation.mutateAsync({ tableId });
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
              await createRowMutation.mutateAsync({ tableId });
              return;
            }
          }
        }
        
        // Fallback: create a new row at the end if we can't determine position
        await createRowMutation.mutateAsync({ tableId });
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

  const handleContextMenu = (position: { x: number; y: number }, rowId: string) => {
    setContextMenu({
      isOpen: true,
      position,
      rowId,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleBulkAddRows = async () => {
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
    setTimeout(() => triggerViewSave(sortRules), 100);
  };

  // triggerViewSave moved up before sort handlers

  const handleHideAllColumns = () => {
    if (tableData?.columns) {
      setHiddenColumns(new Set(tableData.columns.map(col => col.id)));
    }
    // Save view config immediately when user hides all columns
    setTimeout(() => triggerViewSave(sortRules), 100);
  };

  const handleShowAllColumns = () => {
    setHiddenColumns(new Set());
    // Save view config immediately when user shows all columns
    setTimeout(() => triggerViewSave(sortRules), 100);
  };


  // Filter handlers - save immediately on user interaction
  const handleUpdateFilterRule = (ruleId: string, operator: FilterRule['operator'], value?: string | number) => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, operator, value } : rule
      )
    );
    // Save view config immediately when user updates filter
    setTimeout(() => triggerViewSave(sortRules), 100);
  };

  const handleRemoveFilterRule = (ruleId: string) => {
    setFilterRules(prev => prev.filter(rule => rule.id !== ruleId));
    // Save view config immediately when user removes filter
    setTimeout(() => triggerViewSave(sortRules), 100);
  };

  const handleAddFilterRule = (columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => {
    const newRule: FilterRule = {
      id: `filter-${Date.now()}-${Math.random()}`,
      columnId,
      columnName,
      columnType,
      operator: columnType === 'NUMBER' ? 'equals' : 'contains',
      value: undefined,
    };
    setFilterRules(prev => [...prev, newRule]);
    // Save view config immediately when user adds filter
    setTimeout(() => triggerViewSave(sortRules), 100);
  };

  const handleUpdateFilterRuleField = (ruleId: string, columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { 
          ...rule, 
          columnId, 
          columnName, 
          columnType,
          operator: columnType === 'NUMBER' ? 'equals' : 'contains', // Reset operator when changing field type
          value: undefined // Reset value when changing field
        } : rule
      )
    );
    // Save view config immediately when user updates filter field
    setTimeout(() => triggerViewSave(sortRules), 100);
  };

  const handleUpdateLogicOperator = (ruleId: string, logicOperator: 'and' | 'or') => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, logicOperator } : rule
      )
    );
    // Save view config immediately when user updates logic operator
    setTimeout(() => triggerViewSave(sortRules), 100);
  };

  // Search handlers
  const handleSearchResultSelected = useCallback((result: SearchResult, index: number) => {
    setCurrentSearchIndex(index);
  }, []);

  const handleSearchDataUpdate = useCallback((results: SearchResult[], query: string, currentIndex: number) => {
    setSearchResults(results);
    setSearchQuery(query);
    setCurrentSearchIndex(currentIndex);
  }, []);

  const handleScrollToSearchResult = useCallback(async (result: SearchResult, _index: number) => {
    if (result.type !== 'cell' || !result.rowId) return;
    
    // Find the row in currently loaded data
    const allLoadedRows = infiniteTableData?.pages.flatMap(page => page.rows) ?? [];
    const targetRow = allLoadedRows.find(row => row.id === result.rowId);
    
    if (targetRow) {
      // Row is already loaded, trigger scroll
      setScrollToRowId(result.rowId);
      // Clear the scroll target after a brief delay to allow for re-scrolling
      setTimeout(() => setScrollToRowId(null), 100);
    } else {
      // Row is not loaded, need to fetch more data
      // Keep fetching until we find the row or reach the end
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loop
      
      while (attempts < maxAttempts && hasNextPage && !isFetchingNextPage) {
        await fetchNextPage();
        attempts++;
        
        // Check if the row is now loaded
        const updatedRows = infiniteTableData?.pages.flatMap(page => page.rows) ?? [];
        const foundRow = updatedRows.find(row => row.id === result.rowId);
        
        if (foundRow) {
          // Row found, trigger scroll
          setScrollToRowId(result.rowId);
          // Clear the scroll target after a brief delay
          setTimeout(() => setScrollToRowId(null), 100);
          break;
        }
      }
      
      if (attempts >= maxAttempts) {
        console.warn(`Could not find row ${result.rowId} after ${maxAttempts} attempts`);
      }
    }
  }, [infiniteTableData, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // updateViewMutation moved up before sort handlers



  // Get views for selected table - only called on initial load and explicit user interactions
  const { data: views, refetch: refetchViews } = api.view.list.useQuery(
    { tableId: selectedTable! },
    { 
      enabled: !!selectedTable,
      // Only refetch when window gains focus if user has been away
      refetchOnWindowFocus: true,
      // Don't auto-refetch in background to prevent constant calls
      refetchInterval: false,
    }
  );




  // NO AUTO-SAVE: View configurations will only be saved on explicit user interactions

  // View handlers
  const handleViewChange = useCallback((viewId: string | null, config: ViewConfig) => {
    setIsViewSwitching(true);
    setCurrentViewId(viewId);
    
    // Apply the new view configuration
    updateSortRules(config.sortRules);
    setFilterRules(config.filterRules);
    setHiddenColumns(new Set(config.hiddenColumns));
    
    // Refresh view list when switching views with delay to allow saves to complete
    if (selectedTable) {
      setTimeout(() => {
        void utils.view.list.invalidate({ tableId: selectedTable });
      }, 500);
    }
    
    // Re-enable auto-save after a short delay
    setTimeout(() => {
      setIsViewSwitching(false);
    }, 50);
  }, [updateSortRules, utils, selectedTable]);

  // Select first table when tables are loaded
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0]!.id);
    }
  }, [tables, selectedTable]);

  // Auto-select default view only on initial table load when no view is selected
  useEffect(() => {
    if (!selectedTable || !views || views.length === 0 || isViewSwitching || currentViewId !== null) return;

    // Only auto-select when we don't have a current view selected
    const defaultView = views.find(view => view.isDefault) ?? views[0];
    if (defaultView) {
      handleViewChange(defaultView.id, defaultView.config as unknown as ViewConfig);
    }
  }, [selectedTable, views]);

  // Reset view when switching tables
  useEffect(() => {
    setCurrentViewId(null);
    // Don't immediately refetch views to avoid disrupting editing
    // Views will be loaded when needed
  }, [selectedTable]);

  // Get the best available data source for processing
  const getBaseDataForProcessing = useCallback(() => {
    // Priority: current tableData > lastKnownTableData > null
    return tableData ?? lastKnownTableDataRef.current;
  }, [tableData]);

  // Define proper row type for client-side processing
  type TableRow = NonNullable<typeof tableData>['rows'][0];

  // Client-side filtering function
  const applyClientSideFilters = useCallback((rows: TableRow[], filterRules: FilterRule[]): TableRow[] => {
    if (filterRules.length === 0) return rows;

    return rows.filter(row => {
      return filterRules.every(rule => {
        const cell = row.cells.find(cell => cell.columnId === rule.columnId);
        const cellValue = cell?.value as { text?: string } | null;
        const textValue = cellValue?.text ?? '';

        switch (rule.operator) {
          case 'is_empty':
            return textValue === '';
          case 'is_not_empty':
            return textValue !== '';
          case 'contains':
            return textValue.toLowerCase().includes((rule.value as string)?.toLowerCase() ?? '');
          case 'not_contains':
            return !textValue.toLowerCase().includes((rule.value as string)?.toLowerCase() ?? '');
          case 'equals':
            if (rule.columnType === 'NUMBER') {
              const numValue = parseFloat(textValue) || 0;
              return numValue === (rule.value as number);
            }
            return textValue.toLowerCase() === ((rule.value as string)?.toLowerCase() ?? '');
          case 'greater_than':
            const greaterValue = parseFloat(textValue) || 0;
            return greaterValue > (rule.value as number);
          case 'less_than':
            const lessValue = parseFloat(textValue) || 0;
            return lessValue < (rule.value as number);
          default:
            return true;
        }
      });
    });
  }, []);


  // Process table data with sorting and filtering
  const baseTableData = useMemo(() => {
    const baseData = getBaseDataForProcessing();
    if (!baseData) return null;
    
    // Apply client-side filtering first
    const filteredRows = applyClientSideFilters(baseData.rows, filterRules);
    
    return {
      ...baseData,
      rows: filteredRows,
    };
  }, [getBaseDataForProcessing, filterRules, applyClientSideFilters]);

  // Use sort data processor for sorting logic
  const { processedTableData: optimisticTableData } = useSortDataProcessor({
    baseData: baseTableData,
    sortRules,
    serverProcessedData: serverProcessedTableData,
  });

  // NO AUTO-SAVE: Sort integration disabled to prevent automatic saves
  // useSortViewIntegration - DISABLED

  // Background sync for server-side processed data
  const handleRulesChange = useCallback(() => {
    if (selectedTable && (sortRules.length > 0 || filterRules.length > 0)) {
      // Trigger background fetch of server-side processed data
      void refetchProcessedData();
    }
  }, [selectedTable, sortRules.length, filterRules.length, refetchProcessedData]);

  useEffect(() => {
    handleRulesChange();
  }, [handleRulesChange]);

  // Track all pending mutations for navbar saving indicator
  const { isMutating: hasActiveMutations } = useMutationTracker();
  
  const isAnythingSaving = useMemo(() => {
    // Check specific table-level mutations
    const tableOperationsPending = createTableMutation.isPending ||
                                  updateTableMutation.isPending ||
                                  deleteTableMutation.isPending ||
                                  createRowMutation.isPending ||
                                  insertRowAboveMutation.isPending ||
                                  insertRowBelowMutation.isPending ||
                                  deleteRowMutation.isPending ||
                                  bulkInsertRowsMutation.isPending ||
                                  updateViewMutation.isPending ||
                                  renameColumnMutation.isPending ||
                                  deleteColumnMutation.isPending;
    
    // Check global mutation tracker for cell operations and other tracked mutations
    return tableOperationsPending || hasActiveMutations;
  }, [
    createTableMutation.isPending,
    updateTableMutation.isPending,
    deleteTableMutation.isPending,
    createRowMutation.isPending,
    insertRowAboveMutation.isPending,
    insertRowBelowMutation.isPending,
    deleteRowMutation.isPending,
    bulkInsertRowsMutation.isPending,
    updateViewMutation.isPending,
    renameColumnMutation.isPending,
    deleteColumnMutation.isPending,
    hasActiveMutations,
  ]);

  // Warn user before reloading when mutations are in progress
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isAnythingSaving) {
        // For modern browsers, just set returnValue
        event.returnValue = 'You have unsaved changes that will be lost if you leave this page.';
        // Some browsers also require preventDefault
        event.preventDefault();
        // Return value for older browsers  
        return 'You have unsaved changes that will be lost if you leave this page.';
      }
    };

    // Add event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup event listener
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAnythingSaving]);

  // Early return if no session or no selected table
  if (!session || !user) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading session...</div>
        </div>
      </div>
    );
  }

  // Use optimistic data if available, otherwise fall back to any available data
  const displayTableData = optimisticTableData ?? tableData ?? lastKnownTableDataRef.current;

  // Determine loading state
  const isInitialLoading = Boolean(isLoadingTableData || (
    !displayTableData && selectedTable && !lastKnownTableDataRef.current
  ));
  
  const isTableStabilizing = isFetchingTableData || (
    (sortRules.length > 0 || filterRules.length > 0) && 
    (isLoadingProcessedData || isFetchingProcessedData)
  );



  return (
    <div className="h-screen flex flex-auto">
      
      <Sidebar user={user} />

      {/* Main Content */}
      <div className="box-border flex flex-col flex-auto h-full [--omni-app-frame-min-width:600px] [--omni-app-frame-transition-duration:300ms] bg-white ">
        <NavBar base={base} isSaving={isAnythingSaving} />

        <TableTabsBar 
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={setSelectedTable}
          onCreateTable={handleCreateTable}
          onRenameTable={handleRenameTable}
          onDeleteTable={handleDeleteTable}
        />

        <div className="flex h-full flex-col items-stretch z-1 left-0">
          {/* Toolbar */}
          <Toolbar 
            selectedTable={selectedTable} 
            tables={tables}
            onSidebarHover={() => {
              setSidebarHovered(true);
            }}
            onSidebarLeave={() => {
              setSidebarHovered(false);
            }}
            onSidebarClick={() => {
              setSidebarExpanded(!sidebarExpanded);
            }}
            columns={displayTableData?.columns ?? []}
            hiddenColumns={hiddenColumns}
            onToggleColumn={handleToggleColumn}
            onHideAllColumns={handleHideAllColumns}
            onShowAllColumns={handleShowAllColumns}
            sortRules={sortRules}
            onUpdateSortRule={handleUpdateSortRule}
            onRemoveSortRule={handleRemoveSortRule}
            onAddSortRule={handleAddSortRule}
            onUpdateSortRuleField={handleUpdateSortRuleField}
            filterRules={filterRules}
            onUpdateFilterRule={handleUpdateFilterRule}
            onRemoveFilterRule={handleRemoveFilterRule}
            onAddFilterRule={handleAddFilterRule}
            onUpdateFilterRuleField={handleUpdateFilterRuleField}
            onUpdateLogicOperator={handleUpdateLogicOperator}
            tableId={selectedTable ?? ''}
            onSearchResultSelected={handleSearchResultSelected}
            onSearchDataUpdate={handleSearchDataUpdate}
            onScrollToSearchResult={handleScrollToSearchResult}
          />
          
          {/* Content area with custom resizable nav and main content */}
          <div className="flex-1 overflow-hidden flex relative">
            
            <ViewSidebar
              isExpanded={sidebarExpanded}
              isHovered={sidebarHovered}
              onHover={() => setSidebarHovered(true)}
              onLeave={() => setSidebarHovered(false)}
              onWidthChange={(width) => setSidebarWidth(width)}
              onResizeStart={() => setIsResizing(true)}
              onResizeEnd={() => setIsResizing(false)}
              selectedTable={selectedTable}
              currentView={currentViewId}
              onViewChange={handleViewChange}
              currentSortRules={sortRules}
              currentFilterRules={filterRules}
              currentHiddenColumns={Array.from(hiddenColumns)}
              views={views}
              onRefetchViews={() => {
                void refetchViews();
              }}
            />

            {/* Spacer to push main content when sidebar is visible */}
            <div 
              className={isResizing ? '' : 'transition-all duration-300 ease-in-out'}
              style={{
                width: sidebarExpanded || sidebarHovered ? `${sidebarWidth}px` : '0px'
              }}
            />
            
            {/* Main Content Panel */}
            <div className="flex-1 min-w-0 w-0 overflow-hidden flex flex-col">
              <main className="flex-1 h-full relative bg-[#f6f8fc]">
                {/* Loading overlay for table stabilization */}
                {isTableStabilizing && (
                  <div className="absolute top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-200">
                    <div className="flex items-center justify-center py-2 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-gray-600 font-medium">
                          {sortRules.length > 0 || filterRules.length > 0 ? 'Processing filters & sorting...' : 'Refreshing data...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Initial loading state - only covers main content */}
                {(!selectedTable || isInitialLoading || !displayTableData) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#f6f8fc] z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="text-gray-600 font-medium">Loading table data...</div>
                    </div>
                  </div>
                ) : (
                  <DataTable 
                    tableData={displayTableData}
                    onInsertRowAbove={handleInsertRowAbove}
                    onInsertRowBelow={handleInsertRowBelow}
                    onDeleteRow={handleDeleteRow}
                    onContextMenu={handleContextMenu}
                    fetchNextPage={fetchNextPage}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    hiddenColumns={hiddenColumns}
                    sortRules={sortRules}
                    filterRules={filterRules}
                    isTableLoading={isInitialLoading}
                    isTableStabilizing={isTableStabilizing}
                    searchResults={searchResults}
                    currentSearchIndex={currentSearchIndex}
                    searchQuery={searchQuery}
                    scrollToRowId={scrollToRowId}
                    onRenameColumn={handleRenameColumn}
                    onDeleteColumn={handleDeleteColumn}
                  />
                )}
              </main>
              <SummaryBar 
                recordCount={displayTableData?._count.rows ?? 0} 
                onAddRow={handleAddRow} 
                onBulkAddRows={handleBulkAddRows}
                isBulkLoading={isBulkLoading}
              />
            </div>
          </div>
        </div>
    </div>

    {/* Context Menu - rendered outside all containers to avoid positioning issues */}
    {contextMenu && (
      <CellContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={handleContextMenuClose}
        onInsertRowAbove={() => handleInsertRowAbove(selectedTable ?? '', contextMenu.rowId)}
        onInsertRowBelow={() => handleInsertRowBelow(selectedTable ?? '', contextMenu.rowId)}
        onDeleteRow={() => handleDeleteRow(selectedTable ?? '', contextMenu.rowId)}
      />
    )}
  </div>
  );
}

export default function BasePage() {
  return (
    <MutationTrackerProvider>
      <EditingStateProvider>
        <BasePageContent />
      </EditingStateProvider>
    </MutationTrackerProvider>
  );
}