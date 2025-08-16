"use client";

import { useState,  useEffect, } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";

import { Sidebar } from "../_components/base/Sidebar";
import { NavBar } from "../_components/base/NavBar";
import { TableTabsBar } from "../_components/base/TableTabsBar";
import  Toolbar  from "../_components/base/Toolbar";
import { DataTable } from "../_components/base/DataTable";
import { ViewSidebar } from "../_components/base/ViewSidebar";
import { SummaryBar } from "../_components/base/SummaryBar";
import { CellContextMenu } from "../_components/base/CellContextMenu";


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

  const { data: base } = api.base.getById.useQuery(
    { id: baseId },
    { enabled: !!baseId }
  );

  const { data: tables, refetch: refetchTables } = api.table.list.useQuery(
    { baseId },
    { enabled: !!baseId }
  );

  // Get detailed table data with rows and cells
  const { data: tableData, refetch: refetchTableData } = api.table.getTableData.useQuery(
    { tableId: selectedTable! },
    { enabled: !!selectedTable }
  );

  const createTableMutation = api.table.create.useMutation();
  const updateTableMutation = api.table.update.useMutation();
  const deleteTableMutation = api.table.delete.useMutation();
  
  const utils = api.useUtils();
  
  const createRowMutation = api.table.createRow.useMutation({
    onMutate: async ({ tableId }) => {
      // Cancel any outgoing refetches
      await utils.table.getTableData.cancel({ tableId });
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getData({ tableId });
      
      // Generate temporary IDs
      const tempRowId = `temp-row-${Date.now()}`;
      
      // Optimistically update the cache
      if (previousData) {
        const maxOrder = Math.max(...previousData.rows.map(row => row.order), -1);
        const nextOrder = maxOrder + 1;
        
        // Create empty cells for all existing columns
        const newCells = previousData.columns.map(column => ({
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
        
        utils.table.getTableData.setData({ tableId }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            rows: [...old.rows, newRow],
            _count: {
              ...old._count,
              rows: old._count.rows + 1,
            }
          };
        });
      }
      
      return { previousData, tempRowId };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setData({ tableId: variables.tableId }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch to ensure server state
      void utils.table.getTableData.invalidate({ tableId: variables.tableId });
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
    onMutate: async ({ tableId, targetRowId }) => {
      await utils.table.getTableData.cancel({ tableId });
      const previousData = utils.table.getTableData.getData({ tableId });
      
      if (previousData) {
        const targetRow = previousData.rows.find(row => row.id === targetRowId);
        if (!targetRow) return { previousData };
        
        const tempRowId = `temp-row-${Date.now()}`;
        const newOrder = targetRow.order;
        
        // Create empty cells for all existing columns
        const newCells = previousData.columns.map(column => ({
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

        // Update row orders and insert new row
        utils.table.getTableData.setData({ tableId }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            rows: [
              ...old.rows.map(row => 
                row.order >= newOrder 
                  ? { ...row, order: row.order + 1 }
                  : row
              ),
              newRow
            ].sort((a, b) => a.order - b.order),
            _count: {
              ...old._count,
              rows: old._count.rows + 1,
            }
          };
        });
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        utils.table.getTableData.setData({ tableId: variables.tableId }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      void utils.table.getTableData.invalidate({ tableId: variables.tableId });
    }
  });

  const insertRowBelowMutation = api.table.insertRowBelow.useMutation({
    onMutate: async ({ tableId, targetRowId }) => {
      await utils.table.getTableData.cancel({ tableId });
      const previousData = utils.table.getTableData.getData({ tableId });
      
      if (previousData) {
        const targetRow = previousData.rows.find(row => row.id === targetRowId);
        if (!targetRow) return { previousData };
        
        const tempRowId = `temp-row-${Date.now()}`;
        const newOrder = targetRow.order + 1;
        
        // Create empty cells for all existing columns
        const newCells = previousData.columns.map(column => ({
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

        // Update row orders and insert new row
        utils.table.getTableData.setData({ tableId }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            rows: [
              ...old.rows.map(row => 
                row.order >= newOrder 
                  ? { ...row, order: row.order + 1 }
                  : row
              ),
              newRow
            ].sort((a, b) => a.order - b.order),
            _count: {
              ...old._count,
              rows: old._count.rows + 1,
            }
          };
        });
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        utils.table.getTableData.setData({ tableId: variables.tableId }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      void utils.table.getTableData.invalidate({ tableId: variables.tableId });
    }
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onMutate: async ({ tableId, rowId }) => {
      await utils.table.getTableData.cancel({ tableId });
      const previousData = utils.table.getTableData.getData({ tableId });
      
      if (previousData) {
        const targetRow = previousData.rows.find(row => row.id === rowId);
        if (!targetRow) return { previousData };
        
        const deletedOrder = targetRow.order;

        // Remove row and update orders
        utils.table.getTableData.setData({ tableId }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            rows: old.rows
              .filter(row => row.id !== rowId)
              .map(row => 
                row.order > deletedOrder 
                  ? { ...row, order: row.order - 1 }
                  : row
              ),
            _count: {
              ...old._count,
              rows: old._count.rows - 1,
            }
          };
        });
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        utils.table.getTableData.setData({ tableId: variables.tableId }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      void utils.table.getTableData.invalidate({ tableId: variables.tableId });
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

  // Select first table when tables are loaded
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0]!.id);
    }
  }, [tables, selectedTable]);


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

  // Show loading only if we have a table selected but no data yet
  if (!selectedTable || !tableData) {
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
                  tableData={tableData}
                  onInsertRowAbove={handleInsertRowAbove}
                  onInsertRowBelow={handleInsertRowBelow}
                  onDeleteRow={handleDeleteRow}
                  onContextMenu={handleContextMenu}
                />
              </main>
              <SummaryBar recordCount={tableData._count.rows} onAddRow={handleAddRow} />
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