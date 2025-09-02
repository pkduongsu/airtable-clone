"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";

import { Sidebar } from "../_components/base/controls/Sidebar";
import { NavBar } from "../_components/base/controls/NavBar";
import { useIsMutating } from "@tanstack/react-query";
import { TableTabsBar } from "../_components/base/controls/TableTabsBar";
import  Toolbar  from "../_components/base/controls/Toolbar";
import { DataTable } from "../_components/base/table/DataTable";
import { ViewSidebar } from "../_components/base/controls/ViewSidebar";
import { SummaryBar } from "../_components/base/controls/SummaryBar";
import { type FilterRule } from "../_components/base/modals/FilterModal";  
import { type ViewConfig } from "../_components/base/modals/CreateViewModal";
import { useSortManagement } from "../_components/base/hooks/useSortManagement";
import { useFilterManagement } from "../_components/base/hooks/useFilterManagement";
import {type Column, type Row as _Record} from "@prisma/client";

type SearchResult = {
  type: 'field' | 'cell';
  id: string;
  name: string;
  columnId: string;
  columnOrder: number;
  rowId: string | null;
  rowOrder: number;
};


const TOTAL_ROWS = 100_000;
const CHUNK_SIZE = 10_000;     
const CONCURRENCY = 2;        
const CELLS_BATCH = 50_000; 

function BasePageContent() {
  const { data: session } = useSession();
  const params = useParams();
  const baseId = params?.baseId as string;
  
  
  const user = session?.user;

  
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [records, setRecords] = useState<_Record[]>([]); //set local records state (local = optimistic updates)
  const [columns, setColumns] = useState<Column[]>([]); //set local columns state 
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280); //for resizing main content area
  const [isResizing, setIsResizing] = useState(false);
  const [dataTableHandlers, setDataTableHandlers] = useState<{
  handleCreateRow: () => Promise<void>;
} | null>(null);
  

  // Bulk loading state
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkProgressText, setBulkProgressText] = useState("");
  const [fakerEnabled, setFakerEnabled] = useState(false);
  const [fakerFromOrder, setFakerFromOrder] = useState<number | null>(null);

  // Column visibility state
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

 const [totalRecordCount, setTotalRecordCount] = useState(0);
 const optimisticCountFnRef = useRef<((additional: number) => void) | null>(null);
  // Filter state will be managed by useFilterManagement hook

  // View state
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [isViewSwitching, setIsViewSwitching] = useState(false);

  const utils = api.useUtils();
  

  const getCurrentMaxOrder = api.row.getCurrentMaxOrder.useQuery(
  { tableId: selectedTable ?? "" },
  { enabled: false } // we call it imperatively
);

const insertChunk = api.row.insertEmptyRowsChunk.useMutation();
  
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
  // Note: filterRules will be passed as parameter to avoid dependency issues
  const triggerViewSave = useCallback((currentSortRules: Array<{ id: string; columnId: string; columnName: string; columnType: string; direction: 'asc' | 'desc'; }> = [], currentFilterRules: FilterRule[] = [], currentHiddenColumns?: Set<string>) => {
    if (currentViewId) {
      setTimeout(() => {
        const config: ViewConfig = {
          sortRules: currentSortRules,
          filterRules: currentFilterRules,
          hiddenColumns: Array.from(currentHiddenColumns ?? hiddenColumns),
        };
        updateViewMutationRef.current({
          id: currentViewId,
          config
        });
      }, 100);
    }
  }, [currentViewId, hiddenColumns, updateViewMutationRef]);


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
      triggerViewSave(updatedSortRules, filterRulesRef.current);
    }, 100);
  }, [originalHandleUpdateSortRule, sortRules, triggerViewSave]);

  const handleRemoveSortRule = useCallback((ruleId: string) => {
    originalHandleRemoveSortRule(ruleId);
    setTimeout(() => {
      const updatedSortRules = sortRules.filter(rule => rule.id !== ruleId);
      triggerViewSave(updatedSortRules, filterRulesRef.current);
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
      triggerViewSave(updatedSortRules, filterRulesRef.current);
    }, 100);
  }, [originalHandleAddSortRule, sortRules, triggerViewSave]);

  const handleUpdateSortRuleField = useCallback((ruleId: string, columnId: string, columnName: string, columnType: string) => {
    originalHandleUpdateSortRuleField(ruleId, columnId, columnName, columnType);
    setTimeout(() => {
      const updatedSortRules = sortRules.map(rule => 
        rule.id === ruleId ? { ...rule, columnId, columnName, columnType } : rule
      );
      triggerViewSave(updatedSortRules, filterRulesRef.current);
    }, 100);
  }, [originalHandleUpdateSortRuleField, sortRules, triggerViewSave]);

  // Filter management hook (after dependencies are defined)
  const {
    filterRules,
    // applyClientSideFilters, // Now handled by DataTable
    updateFilterRules,
    handleUpdateFilterRule,
    handleRemoveFilterRule,
    handleAddFilterRule,
    handleUpdateFilterRuleField,
    handleUpdateLogicOperator,
  } = useFilterManagement({ triggerViewSave, sortRules });

  // Create ref for filterRules to use in sort handlers
  const filterRulesRef = useRef<FilterRule[]>([]);
  filterRulesRef.current = filterRules;

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
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

  // Get table metadata including columns for the Toolbar
  const { data: tableData } = api.table.getById.useQuery(
    { id: selectedTable ?? '' },
    { enabled: !!selectedTable }
  );

  // Extract columns for the Toolbar
  const columnsToolbar = useMemo(() => {
    return tableData?.columns ?? [];
  }, [tableData]);

  // DataTable now handles its own data fetching

  // Data processing is now handled by DataTable component

  const createTableMutation = api.table.create.useMutation();
  const updateTableMutation = api.table.update.useMutation();
  const deleteTableMutation = api.table.delete.useMutation({
  // Optimistically remove the table from the list and jump to the first remaining one
  onMutate: async ({ id }) => {
    await utils.table.list.cancel({ baseId });

    const prevTables = utils.table.list.getData({ baseId }) ?? [];

    // Compute the next list and the table to show next (always first remaining)
    const nextTables = prevTables.filter(t => t.id !== id);
    const nextSelected = nextTables[0]?.id ?? null;

    // Optimistic cache update so the tab disappears immediately
    utils.table.list.setData({ baseId }, nextTables);

    // Always navigate to FIRST table (per requirement)
    setSelectedTable(nextSelected);

    // Return context for rollback on error
    return { prevTables, prevSelected: selectedTable };
  },

  // Roll back if the server delete fails
  onError: (_err, _vars, ctx) => {
    if (ctx?.prevTables) utils.table.list.setData({ baseId }, ctx.prevTables);
    if (ctx?.prevSelected !== undefined) setSelectedTable(ctx.prevSelected);
  },

  // Revalidate to ensure final server state
  onSettled: async () => {
    await utils.table.list.invalidate({ baseId });
  },
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
      
      // DataTable handles its own data refetching
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

const handleDeleteTable = (tableId: string) => {
  // Guard: don’t allow deleting the last table
  if ((tables?.length ?? 0) <= 1) {
    console.error("Cannot delete the last table in the base");
    return;
  }

  deleteTableMutation.mutate({ id: tableId });
};

  const handleBulkAddRowsWrapper = async () => {
    if (!selectedTable) return;

    setIsBulkLoading(true);
    setBulkProgress(0);
    setBulkProgressText("Initializing...");

      // Plan
    const total = TOTAL_ROWS;
    const chunk = CHUNK_SIZE;
    const chunks = Math.ceil(total / chunk);

      if (optimisticCountFnRef.current) {
    // Adds to the server baseline (0 => 100,000; N => N + 100,000)
    optimisticCountFnRef.current(total);
  } else {
    // Fallback: set to 100,000 if empty, else add
    setTotalRecordCount((curr) => (curr === 0 ? total : curr + total));
  }

    try {
    const { baseOrder } = await getCurrentMaxOrder.refetch().then(r => r.data!);

    let doneChunks = 0;
    let insertedRows = 0;
    let insertedCells = 0;

    // enable faker only for rows added at or after this order
    setFakerFromOrder(baseOrder);
    setFakerEnabled(true);

    setBulkProgressText(`Starting ${chunks} chunks…`);

    // Simple async pool for limited concurrency
    const queue = Array.from({ length: chunks }, (_, i) => i);
    const runWorker = async () => {
      for (;;) {
        const next = queue.shift();
        if (next === undefined) break;

        const size = Math.min(chunk, total - next * chunk);
        const globalOffset = next * chunk;

        try {
          const res = await insertChunk.mutateAsync({
            tableId: selectedTable,
            baseOrder,
            globalOffset,
            size,
            cellBatchSize: CELLS_BATCH,
          });

          insertedRows += res.rowsInserted;
          insertedCells += res.cellsInserted;
        } finally {
          doneChunks += 1;

          // Update progress bar
          const pct = Math.round((doneChunks / chunks) * 100);
          setBulkProgress(pct);
          setBulkProgressText(
            `Inserted ${insertedRows.toLocaleString()} / ${total.toLocaleString()} rows (${pct}%)`
            + (insertedCells ? ` • ${insertedCells.toLocaleString()} cells` : "")
          );

          // Light refresh every N chunks to keep viewport fresh without thrashing
          const N = 5;
          if (doneChunks % N === 0 || doneChunks === chunks) {
            await utils.table.getTableData.invalidate({ tableId: selectedTable });
          }
        }
      }
    };

    // Launch a few workers
    await Promise.all(Array.from({ length: CONCURRENCY }, runWorker));

    setBulkProgress(100);
    setBulkProgressText("Done!");
  } catch (err) {
    console.error("Bulk add failed:", err);
    setBulkProgressText("Failed to add rows");
    // TODO: surface a toast/snackbar if you have one
  } finally {
    // important: only stop loading when batches are actually finished (or errored)
    setTimeout(() => {
      setIsBulkLoading(false);
      setBulkProgress(0);
      setBulkProgressText("");
      setFakerEnabled(false);
      setFakerFromOrder(null);
    }, 800);
  }
};

  // Filter handlers are now provided by useFilterManagement hook

  // Search handlers
const handleSearchResultSelected = useCallback(
  (result: SearchResult, index: number) => {
    setCurrentSearchIndex(index);
  },
  []
);

const handleSearchDataUpdate = useCallback(
  (results: SearchResult[], query: string, currentIndex: number) => {
    setSearchResults(results);
    setSearchQuery(query);
    setCurrentSearchIndex(currentIndex);
  },
  []
);
const handleScrollToSearchResult = useCallback(
  (result: SearchResult, _index: number) => {
    if (result.type !== 'cell' || !result.rowId) return;
    setScrollToRowId(result.rowId);
    setTimeout(() => setScrollToRowId(null), 100);
  },
  []
);

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
    updateFilterRules(config.filterRules);
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
  }, [updateSortRules, updateFilterRules, utils, selectedTable]);

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
  }, [selectedTable, views, currentViewId, handleViewChange, isViewSwitching]);

  // Reset view when switching tables
  useEffect(() => {
    setCurrentViewId(null);
    // Don't immediately refetch views to avoid disrupting editing
    // Views will be loaded when needed
  }, [selectedTable]);

  // Data processing logic moved to DataTable component
  const handleToggleColumn = useCallback((columnId: string) => {
  setHiddenColumns(prev => {
    const newSet = new Set(prev);
    if (newSet.has(columnId)) {
      newSet.delete(columnId);
    } else {
      newSet.add(columnId);
    }
    return newSet;
  });
  
  // Move the save outside setState to avoid potential issues
  setTimeout(() => {
    const currentHidden = hiddenColumns.has(columnId) 
      ? new Set([...hiddenColumns].filter(id => id !== columnId))
      : new Set([...hiddenColumns, columnId]);
    triggerViewSave(sortRules, filterRulesRef.current, currentHidden);
  }, 100);
}, [hiddenColumns, sortRules, triggerViewSave]);

const handleHideAllColumns = useCallback(() => {
  if (tableData?.columns) {
    const allColumnIds = new Set(tableData.columns.map(col => col.id));
    setHiddenColumns(allColumnIds);
    setTimeout(() => triggerViewSave(sortRules, filterRulesRef.current, allColumnIds), 100);
  }
}, [tableData?.columns, sortRules, triggerViewSave]);

const handleShowAllColumns = useCallback(() => {
  const emptySet = new Set<string>();
  setHiddenColumns(emptySet);
  setTimeout(() => triggerViewSave(sortRules, filterRulesRef.current, emptySet), 100);
}, [sortRules, triggerViewSave]);
  // Row type is defined in the useFilterManagement hook

  // Client-side filtering function is now provided by useFilterManagement hook

  // All data processing is now handled by DataTable component

  // NO AUTO-SAVE: Sort integration disabled to prevent automatic saves
  // useSortViewIntegration - DISABLED

  // Server-side data processing is now handled by DataTable

  // Track all pending mutations for navbar saving indicator
  const hasActiveMutations = useIsMutating() > 0;
  
  const isAnythingSaving = useMemo(() => {
    // Check specific table-level mutations
    const tableOperationsPending = createTableMutation.isPending ||
                                  updateTableMutation.isPending ||
                                  deleteTableMutation.isPending ||
                                  updateViewMutation.isPending ||
                                  isBulkLoading;
    // Check global mutation tracker for cell operations and other tracked mutations
    return tableOperationsPending || hasActiveMutations;
  }, [
    createTableMutation.isPending,
    updateTableMutation.isPending,
    deleteTableMutation.isPending,
    isBulkLoading,
    updateViewMutation.isPending,
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

  // Loading states are now managed by DataTable component



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
            columns={columnsToolbar}
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
                {/* DataTable now handles its own loading states */}

                {/* DataTable now handles its own loading states */}
                {selectedTable ? (
                  <DataTable 
                    tableId={selectedTable}
                    hiddenColumns={hiddenColumns}
                    sortRules={sortRules}
                    filterRules={filterRules}
                    searchResults={searchResults}
                    currentSearchIndex={currentSearchIndex}
                    searchQuery={searchQuery}
                    scrollToRowId={scrollToRowId}
                    onDataTableReady={setDataTableHandlers}
                    onRecordCountChange={setTotalRecordCount}
                    onBulkOperationStart={(fn) => { optimisticCountFnRef.current = fn; }}
                    records={records}
                    setRecords={setRecords}
                    columns={columns}
                    setColumns={setColumns}
                    fakerEnabled={fakerEnabled}
                    fakerFromOrder={fakerFromOrder}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#f6f8fc] z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="text-gray-600 font-medium">Loading...</div>
                    </div>
                  </div>
                )}
              </main>
              <SummaryBar 
                recordCount={totalRecordCount} 
                onAddRow={() => dataTableHandlers?.handleCreateRow()} 
                onBulkAddRows={handleBulkAddRowsWrapper}
                isBulkLoading={isBulkLoading}
                bulkProgress={bulkProgress}
                bulkProgressText={bulkProgressText}
              />
            </div>
          </div>
        </div>
    </div>
  </div>
  );
}

export default function BasePage() {
  return <BasePageContent />;
}