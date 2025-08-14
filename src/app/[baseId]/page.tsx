"use client";

import { useState,  useEffect, } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";

import { Sidebar } from "../_components/base/Sidebar";
import { NavBar } from "../_components/base/NavBar";
import { TableTabsBar } from "../_components/base/TableTabsBar";
import  Toolbar  from "../_components/base/Toolbar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "~/components/ui/resizable";
import Plus from "../_components/icons/Plus";
import MagnifyingGlass from "../_components/icons/MagnifyingGlass";
import Cog from "../_components/icons/Cog";
import GridFeature from "../_components/icons/GridFeature";


export default function BasePage() {
  const { data: session } = useSession();
  const params = useParams();
  const baseId = params?.baseId as string;
  
  const user = session?.user;
  
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [navVisible, setNavVisible] = useState(false); // Nav panel visibility
  const [navHovered, setNavHovered] = useState(false); // Nav hover state

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
          <Toolbar selectedTable={selectedTable} tables={tables} />
          
          {/* Content area with resizable nav and main content */}
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* Left Navigation Panel */}
              <ResizablePanel 
                className="print:hidden min-w-[280px] max-w-[720px]"
              >
                <nav className="h-full bg-white">
                  <div className="h-full flex flex-col box-border py-2.5 px-2">
                    <div className="flex flex-none flex-col justify-start pb-2">
                      <button className="h-[32px] cursor-pointer items-center justify-start box-border focus-visible:-outline rounded-[6px] bg-white hover:bg-[#0000000d] flex w-full px-3 pl-[16px]">
                        <Plus size={16} className="flex-none mr-2" color="#1d1f25"/>
                        <span className="truncate font-family-system font-[400] text-[13px] leading-[22px]">Create new...</span>
                      </button>
                      <div className="px-2 mt-1">
                        <div className="relative h-[32px]">
                          <div className="w-full h-[32px]">
                            <div className="flex items-center relative h-[32px]">
                              <input type="text" className="w-full h-[32px] px-[30px] py-[6px] font-family-system text-[13px] font-[400] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#166ee1]" placeholder="Find a view" />
                              <MagnifyingGlass size={14} color="#616670" className="flex-none absolute left-2" />
                            </div>
                          </div>
                          <div className="absolute right-1 bottom-0 flex items-center top-1/2 -translate-y-1/2">
                            <button className="w-7 h-7 rounded-[6px] flex items-center justify-center focus-visible:outline cursor-pointer toolbar-button">
                              <Cog size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-auto overflow-y-auto overflow-x-hidden">
                        <div className="h-full" />
                          <div className="flex flex-col flex-auto w-full min-h-[144px]">
                            <div className="relative flex-auto">
                              {/* If there are many views, should list all views here -> TODO */}
                              {/* For now just 1 view card*/}
                              <button className="rounded-[3px] cursor-pointer flex relative justify-center flex-col pt-2 pb-2 px-3 hover:bg-[#0000000d] w-full">
                                <div className="flex items-center">
                                  <div className="flex flex-auto items-center">
                                    <span className="flex-inline flex-none items-center mr-2">
                                      <GridFeature size={16} color="#166ee1" className="flex-none" />
                                    </span>
                                    <span className="font-family-system font-[500] text-[13px] leading-[16.25px] truncate text-[#1d1f25]">
                                      Grid view
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </div>
                          </div>
                      </div>
                  </div>
                </nav>
              </ResizablePanel>
              
              <ResizableHandle className="w-px hover:w-[3px] bg-border-default hover:bg-[#166ee1] transition-colors" />
              
              {/* Main Content Panel */}
              <ResizablePanel defaultSize={80} minSize={50}>
                <main className="h-full relative bg-[#f6f8fc] overflow-auto">
                  <div className="h-full w-full p-4">
                    {/* Your main content goes here */}
                  </div>
                </main>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

        </div>

    </div>
  </div>
  );
}