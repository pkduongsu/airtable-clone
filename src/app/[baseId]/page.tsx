"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";
import { 
  useCreateRowMutation, 
  useInsertRowAboveMutation, 
  useInsertRowBelowMutation, 
  useDeleteRowMutation, 
  useBulkInsertRowsMutation 
} from "../_components/base/mutations/rowMutations";
import { useRenameColumnMutation, useDeleteColumnMutation } from "../_components/base/mutations/columnMutations";

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
import { type SortRule } from "../_components/base/modals/SortModal";
import { type FilterRule } from "../_components/base/modals/FilterModal";
import { type ViewConfig } from "../_components/base/modals/CreateViewModal";

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

  // Sort state
  const [sortRules, setSortRules] = useState<SortRule[]>([]);

  // Filter state
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);

  // View state
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [isViewSwitching, setIsViewSwitching] = useState(false);

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
  
  const utils = api.useUtils();
  
  const createRowMutation = useCreateRowMutation();

  const bulkInsertRowsMutation = useBulkInsertRowsMutation();

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

  const insertRowAboveMutation = useInsertRowAboveMutation();

  const insertRowBelowMutation = useInsertRowBelowMutation();

  const deleteRowMutation = useDeleteRowMutation();

  const renameColumnMutation = useRenameColumnMutation();

  const deleteColumnMutation = useDeleteColumnMutation();

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
      setIsBulkLoading(false);
    } catch (error) {
      console.error('Failed to bulk insert rows:', error);
      setIsBulkLoading(false);
    }
  };

  // Column visibility handlers
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
    // Trigger immediate save for instant feedback
    triggerViewSave();
  };

  // Manual trigger for immediate view saves (separate from auto-save)
  const triggerViewSave = () => {
    if (currentViewId) {
      // Use setTimeout to ensure state updates have been applied
      setTimeout(() => {
        const config: ViewConfig = {
          sortRules,
          filterRules,
          hiddenColumns: Array.from(hiddenColumns),
        };
        console.log('Manual view save triggered for:', currentViewId);
        updateViewMutationRef.current({
          id: currentViewId,
          config
        });
      }, 100);
    }
  };

  const handleHideAllColumns = () => {
    if (tableData?.columns) {
      setHiddenColumns(new Set(tableData.columns.map(col => col.id)));
    }
    triggerViewSave();
  };

  const handleShowAllColumns = () => {
    setHiddenColumns(new Set());
    triggerViewSave();
  };

  // Sort handlers
  const handleUpdateSortRule = (ruleId: string, direction: 'asc' | 'desc') => {
    setSortRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, direction } : rule
      )
    );
    triggerViewSave();
    // Trigger immediate save for explicit user actions
  };

  const handleRemoveSortRule = (ruleId: string) => {
    setSortRules(prev => prev.filter(rule => rule.id !== ruleId));
    triggerViewSave();
  };

  const handleAddSortRule = (columnId: string, columnName: string, columnType: string) => {
    const newRule: SortRule = {
      id: `sort-${Date.now()}-${Math.random()}`,
      columnId,
      direction: 'asc',
      columnName,
      columnType,
    };
    setSortRules(prev => [...prev, newRule]);
    triggerViewSave();
  };

  const handleUpdateSortRuleField = (ruleId: string, columnId: string, columnName: string, columnType: string) => {
    setSortRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, columnId, columnName, columnType } : rule
      )
    );
    triggerViewSave();
  };

  // Filter handlers
  const handleUpdateFilterRule = (ruleId: string, operator: FilterRule['operator'], value?: string | number) => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, operator, value } : rule
      )
    );
    triggerViewSave();
  };

  const handleRemoveFilterRule = (ruleId: string) => {
    setFilterRules(prev => prev.filter(rule => rule.id !== ruleId));
    triggerViewSave();
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
    triggerViewSave();
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
    triggerViewSave();
  };

  const handleUpdateLogicOperator = (ruleId: string, logicOperator: 'and' | 'or') => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, logicOperator } : rule
      )
    );
    triggerViewSave();
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

  // Auto-save current view state when changes are made
  const updateViewMutation = api.view.update.useMutation({
    onSuccess: () => {
      console.log('View config saved successfully');
      // Immediately invalidate view list for instant feedback
      void utils.view.list.invalidate({ tableId: selectedTable! });
    },
    onError: (error) => {
      console.error('Failed to save view config:', error);
    }
  });
  
  // Use a ref to store the latest mutation function to avoid dependency issues
  const updateViewMutationRef = useRef(updateViewMutation.mutate);
  updateViewMutationRef.current = updateViewMutation.mutate;



  // Get views for selected table
  const { data: views, refetch: refetchViews } = api.view.list.useQuery(
    { tableId: selectedTable! },
    { enabled: !!selectedTable }
  );




  // Auto-save view configuration with long debounce to avoid editing interference
  useEffect(() => {
    if (isViewSwitching || !currentViewId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const config: ViewConfig = {
        sortRules,
        filterRules,
        hiddenColumns: Array.from(hiddenColumns),
      };

      console.log('Auto-saving view config for:', currentViewId, config);
      updateViewMutationRef.current({
        id: currentViewId,
        config
      });
    }, 1000); // 1 second - much faster response for view changes

    return () => {
      clearTimeout(timeoutId);
    };
  }, [sortRules, filterRules, hiddenColumns, isViewSwitching, currentViewId]);

  // View handlers
  const handleViewChange = useCallback((viewId: string | null, config: ViewConfig) => {
    console.log('Manual view change to:', viewId);
    
    setIsViewSwitching(true);
    setCurrentViewId(viewId);
    
    // Apply the new view configuration
    setSortRules(config.sortRules);
    setFilterRules(config.filterRules);
    setHiddenColumns(new Set(config.hiddenColumns));
    
    // Re-enable auto-save after a very short delay
    setTimeout(() => {
      setIsViewSwitching(false);
    }, 50);
  }, []); // Keep empty dependencies to avoid auto-select loops

  // Select first table when tables are loaded
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0]!.id);
    }
  }, [tables, selectedTable]);

  // Auto-select default view when table changes or views are loaded (only when no view is selected)
  useEffect(() => {
    if (!selectedTable || !views || views.length === 0 || isViewSwitching || currentViewId !== null) return;

    // Only auto-select when we don't have a current view selected
    const defaultView = views.find(view => view.isDefault) ?? views[0];
    if (defaultView) {
      console.log('Auto-selecting default view:', defaultView.name, 'ID:', defaultView.id);
      handleViewChange(defaultView.id, defaultView.config as unknown as ViewConfig);
    }
  }, [selectedTable, views, isViewSwitching, currentViewId, handleViewChange]);

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

  // Client-side sorting function
  const applyClientSideSorting = useCallback((rows: TableRow[], sortRules: SortRule[]): TableRow[] => {
    if (sortRules.length === 0) return rows;

    return [...rows].sort((a, b) => {
      for (const rule of sortRules) {
        const cellA = a.cells.find(cell => cell.columnId === rule.columnId);
        const cellB = b.cells.find(cell => cell.columnId === rule.columnId);
        
        const valueA = cellA?.value as { text?: string } | null;
        const valueB = cellB?.value as { text?: string } | null;
        
        const textA = valueA?.text ?? '';
        const textB = valueB?.text ?? '';
        
        // Determine column type from the first sort rule's column
        const isNumber = rule.columnType === 'NUMBER';
        
        let comparison = 0;
        
        if (isNumber) {
          const numA = parseFloat(textA) || 0;
          const numB = parseFloat(textB) || 0;
          comparison = numA - numB;
        } else {
          comparison = textA.toLowerCase().localeCompare(textB.toLowerCase());
        }
        
        if (comparison !== 0) {
          return rule.direction === 'desc' ? -comparison : comparison;
        }
      }
      
      // If all sort rules are equal, fall back to row order
      return a.order - b.order;
    });
  }, []);

  // Optimistically apply filtering and sorting without full invalidation
  const optimisticTableData = useMemo(() => {
    const baseData = getBaseDataForProcessing();
    
    if (!baseData) return undefined;
    
    // If we have no processing rules, return base data or server data
    if (sortRules.length === 0 && filterRules.length === 0) {
      return serverProcessedTableData ?? baseData;
    }
    
    // If we have server-side processed data that matches current rules, prefer it
    if (serverProcessedTableData && (sortRules.length > 0 || filterRules.length > 0)) {
      return serverProcessedTableData;
    }
    
    // Otherwise, create optimistic client-side processed data
    // Step 1: Apply filters
    const filteredRows = applyClientSideFilters(baseData.rows, filterRules);
    
    // Step 2: Apply sorting
    const processedRows = applyClientSideSorting(filteredRows, sortRules);

    return {
      ...baseData,
      rows: processedRows,
    };
  }, [getBaseDataForProcessing, sortRules, filterRules, serverProcessedTableData, applyClientSideFilters, applyClientSideSorting]);

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

  // Disable background sync temporarily to ensure stable editing
  // TODO: Implement smarter background sync that detects editing state
  // useEffect(() => {
  //   if (!selectedTable) return;
  //   const interval = setInterval(() => {
  //     // Background sync logic
  //   }, 30000);
  //   return () => clearInterval(interval);
  // }, [selectedTable]);

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
                // Safe to refetch views immediately - doesn't affect table data
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