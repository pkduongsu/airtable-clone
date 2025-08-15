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
            <div className="flex-1 min-w-0 w-0 overflow-hidden">
              <main className="h-full relative bg-[#f6f8fc]">
                <DataTable 
                  tableData={tableData} 
                  onTableDataRefresh={refetchTableData}
                />
              </main>
            </div>
          </div>
        </div>
    </div>
  </div>
  );
}