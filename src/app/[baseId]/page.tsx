"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";

import { Sidebar } from "../_components/base/controls/Sidebar";
import { NavBar } from "../_components/base/controls/NavBar";
import { TableTabsBar } from "../_components/base/controls/TableTabsBar";
import  Toolbar  from "../_components/base/controls/Toolbar";
import { DataTable } from "../_components/base/table/DataTable";
import { ViewSidebar } from "../_components/base/controls/ViewSidebar";
import { SummaryBar } from "../_components/base/controls/SummaryBar";
import { CellContextMenu } from "../_components/base/modals/CellContextMenu";
import { type SortRule } from "../_components/base/modals/SortModal";


export default function BasePage() {
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

  // Background query for server-side sorted data (when sort rules exist)
  const {
    data: sortedInfiniteTableData,
    refetch: refetchSortedData
  } = api.table.getTableData.useInfiniteQuery(
    { 
      tableId: selectedTable!, 
      limit: 100,
      sortRules: sortRules.map(rule => ({
        columnId: rule.columnId,
        direction: rule.direction
      }))
    },
    {
      enabled: !!selectedTable && sortRules.length > 0,
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

  // Server-side sorted data (when available)
  const serverSortedTableData = useMemo(() => {
    return sortedInfiniteTableData?.pages[0] ? {
      ...sortedInfiniteTableData.pages[0], // Get table metadata from first page
      rows: sortedInfiniteTableData.pages.flatMap(page => page.rows), // Flatten all rows
    } : undefined;
  }, [sortedInfiniteTableData]);

  const createTableMutation = api.table.create.useMutation();
  const updateTableMutation = api.table.update.useMutation();
  const deleteTableMutation = api.table.delete.useMutation();
  
  const utils = api.useUtils();
  
  const createRowMutation = api.table.createRow.useMutation({
    onMutate: async ({ tableId }) => {
      // Cancel any outgoing refetches for base query
      await utils.table.getTableData.cancel({ 
        tableId, 
        limit: 100
      });
      
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
    onSettled: (data, error, variables) => {
      // Invalidate both base and sorted queries
      void utils.table.getTableData.invalidate({ 
        tableId: variables.tableId, 
        limit: 100
      });
      // Also clear persisted data to force fresh load
      lastKnownTableDataRef.current = undefined;
    }
  });

  const bulkInsertRowsMutation = api.table.bulkInsertRows.useMutation({
    onError: () => {
      setIsBulkLoading(false);
    },
    onSuccess: () => {
      setIsBulkLoading(false);
    },
    onSettled: (data, error, variables) => {
      void utils.table.getTableData.invalidate({ 
        tableId: variables.tableId, 
        limit: 100
      });
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

  const insertRowAboveMutation = api.table.insertRowAbove.useMutation({
    onSettled: (data, error, variables) => {
      void utils.table.getTableData.invalidate({ 
        tableId: variables.tableId, 
        limit: 100
      });
    }
  });

  const insertRowBelowMutation = api.table.insertRowBelow.useMutation({
    onSettled: (data, error, variables) => {
      void utils.table.getTableData.invalidate({ 
        tableId: variables.tableId, 
        limit: 100
      });
    }
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onSettled: (data, error, variables) => {
      void utils.table.getTableData.invalidate({ 
        tableId: variables.tableId, 
        limit: 100
      });
    }
  });

  const handleInsertRowAbove = async (tableId: string, rowId: string) => {
    try {
      await insertRowAboveMutation.mutateAsync({ tableId, targetRowId: rowId });
    } catch (error) {
      console.error('Failed to insert row above:', error);
    }
  };

  const handleInsertRowBelow = async (tableId: string, rowId: string) => {
    try {
      await insertRowBelowMutation.mutateAsync({ tableId, targetRowId: rowId });
    } catch (error) {
      console.error('Failed to insert row below:', error);
    }
  };

  const handleDeleteRow = async (tableId: string, rowId: string) => {
    try {
      await deleteRowMutation.mutateAsync({ tableId, rowId });
    } catch (error) {
      console.error('Failed to delete row:', error);
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
  };

  const handleHideAllColumns = () => {
    if (tableData?.columns) {
      setHiddenColumns(new Set(tableData.columns.map(col => col.id)));
    }
  };

  const handleShowAllColumns = () => {
    setHiddenColumns(new Set());
  };

  // Sort handlers
  const handleUpdateSortRule = (ruleId: string, direction: 'asc' | 'desc') => {
    setSortRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, direction } : rule
      )
    );
  };

  const handleRemoveSortRule = (ruleId: string) => {
    setSortRules(prev => prev.filter(rule => rule.id !== ruleId));
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
  };

  const handleUpdateSortRuleField = (ruleId: string, columnId: string, columnName: string, columnType: string) => {
    setSortRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, columnId, columnName, columnType } : rule
      )
    );
  };

  // Select first table when tables are loaded
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0]!.id);
    }
  }, [tables, selectedTable]);

  // Reset hidden columns and sort rules when switching tables
  useEffect(() => {
    setHiddenColumns(new Set());
    setSortRules([]);
  }, [selectedTable]);

  // Get the best available data source for sorting
  const getBaseDataForSorting = useCallback(() => {
    // Priority: current tableData > lastKnownTableData > null
    return tableData ?? lastKnownTableDataRef.current;
  }, [tableData]);

  // Optimistically apply sorting without full invalidation
  const optimisticTableData = useMemo(() => {
    const baseData = getBaseDataForSorting();
    
    if (!baseData || !sortRules.length) {
      // If we have server-side sorted data and no sort rules, prefer server data
      return serverSortedTableData ?? baseData;
    }
    
    // If we have server-side sorted data that matches current sort rules, use it
    if (serverSortedTableData && sortRules.length > 0) {
      return serverSortedTableData;
    }
    
    // Otherwise, create optimistic client-side sorted data
    const sortedRows = [...baseData.rows].sort((a, b) => {
      for (const rule of sortRules) {
        const cellA = a.cells.find(cell => cell.columnId === rule.columnId);
        const cellB = b.cells.find(cell => cell.columnId === rule.columnId);
        
        const valueA = cellA?.value as { text?: string } | null;
        const valueB = cellB?.value as { text?: string } | null;
        
        const textA = valueA?.text ?? '';
        const textB = valueB?.text ?? '';
        
        // Determine column type
        const column = baseData.columns.find(col => col.id === rule.columnId);
        const isNumber = column?.type === 'NUMBER';
        
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

    return {
      ...baseData,
      rows: sortedRows,
    };
  }, [getBaseDataForSorting, sortRules, serverSortedTableData]);

  // Background sync for server-side sorted data
  const handleSortRulesChange = useCallback(() => {
    if (selectedTable && sortRules.length > 0) {
      // Trigger background fetch of server-side sorted data
      void refetchSortedData();
    }
  }, [selectedTable, sortRules.length, refetchSortedData]);

  useEffect(() => {
    handleSortRulesChange();
  }, [handleSortRulesChange]);

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

  // Show loading only if we have a table selected but absolutely no data available
  if (!selectedTable || !displayTableData) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading table data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-auto">
      
      <Sidebar user={user} />

      {/* Main Content */}
      <div className="box-border flex flex-col flex-auto h-full [--omni-app-frame-min-width:600px] [--omni-app-frame-transition-duration:300ms] bg-white ">
        <NavBar base={base} />

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
                />
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