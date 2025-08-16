"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import Plus from "../../icons/Plus";
import ChevronDown from "../../icons/ChevronDown";

interface Table {
  id: string;
  name: string;
  baseId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TableTabsBarProps {
  tables?: Table[];
  selectedTable: string | null;
  onSelectTable: (tableId: string) => void;
  onCreateTable: () => Promise<void>;
  onRenameTable: (tableId: string, newName: string) => Promise<void>;
  onDeleteTable: (tableId: string) => Promise<void>;
}

export function TableTabsBar({ 
  tables, 
  selectedTable, 
  onSelectTable, 
  onCreateTable,
  onRenameTable,
  onDeleteTable
}: TableTabsBarProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingTableId, setRenamingTableId] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState("");
  
  const handleAddTable = async () => {
    try {
      await onCreateTable();
    } catch (error) {
      console.error('Failed to create table:', error);
    }
  };

  const handleStartRename = (table: Table) => {
    setIsRenaming(true);
    setRenamingTableId(table.id);
    setNewTableName(table.name);
    onSelectTable(table.id);
  };

  const handleSaveRename = async () => {
    if (!renamingTableId || !newTableName.trim()) return;
    
    try {
      await onRenameTable(renamingTableId, newTableName.trim());
      setIsRenaming(false);
      setRenamingTableId(null);
      setNewTableName("");
    } catch (error) {
      console.error('Failed to rename table:', error);
    }
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenamingTableId(null);
    setNewTableName("");
  };

  const handleDeleteTable = async (table: Table) => {
    try {
      // Show confirmation dialog
      if (window.confirm(`Are you sure you want to delete "${table.name}"? This action cannot be undone.`)) {
        await onDeleteTable(table.id);
      }
    } catch (error) {
      console.error('Failed to delete table:', error);
    }
  };

  return (
    <div className="relative print:hidden">
      <div className="flex relative z-1 bg-[#FCF3FF] transition-[width] duration-300 ease-in-out w-[calc(100vw-56px)] h-8 mb-[-1px]">
        <div className="flex flex-auto relative">
          <div className="absolute inset-0">
            <div className="flex flex-auto overflow-x-auto overflow-y-hidden scrollbar-hidden pt-1 pl-1 -mt-1 -ml-1">
              <nav className="flex flex-none">
                <div className="flex h-[32px]">
                  {tables?.map((table) => (
                    <div key={table.id} className="flex relative flex-none">
                      <div 
                        data-tab-id={table.id}
                        className={`flex flex-auto relative focus-within:outline-none  border-r focus-within:ring-2 rounded-tr-[3px] cursor-pointer font-bold transition-colors duration-200 ${
                        selectedTable === table.id 
                          ? 'bg-white z-30 h-[33px] border-b-0' 
                          : 'bg-[#FCF3FF] hover:bg-gray-200'
                      }`}>
                        <div>
                          <a 
                            className={`h-full flex flex-auto items-center select-none max-w-[512px] focus:outline-none focus:ring-2 focus:ring-offset-[-5px] text-inherit ${
                              selectedTable === table.id 
                                ? 'pl-3 pr-8 justify-start' 
                                : 'px-3 justify-center'
                            }`}
                            onClick={() => onSelectTable(table.id)}
                          >
                            <span className={`whitespace-pre truncate font-family-system font-[500] text-[13px] leading-[18px] ${selectedTable === table.id ? 'text-[#1d1f25]' : 'text-[#616670]' } hover:text-[#1d1f25]`}>
                              {table.name}
                            </span> 
                          </a>
                          {selectedTable === table.id && (
                            <div className="absolute top-0 bottom-0 flex items-center select-none right-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="cursor-pointer flex-none focus:outline-none ml-2 flex items-center group">
                                    <ChevronDown size={16} className="text-[#616670] group-hover:text-[#1d1f25] transition-colors duration-200" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleStartRename(table)}>
                                    Rename table
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => handleDeleteTable(table)}
                                    disabled={tables?.length === 1}
                                  >
                                    Delete table
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </nav>
              {/* another chevron down- click to open find a table section , TODO */}
              <div className="flex">
                  <button className="h-[32px] flex cursor-pointer flex-none justify-center items-center focus:outline-none px-3 text-[#616670] hover:text-[#1d1f25] ">
                    <ChevronDown size={16} />
                  </button>
              </div>
              {/* Add or import table */}
              <div className="flex-none flex relative">
                  <button 
                    className="group flex cursor-pointer items-center flex-none rounded-[3px] h-[32px] px-3 focus:outline-none text-[#000000a6] hover:text-[#000000d9]"
                    onClick={handleAddTable}
                  >
                    <Plus size={16} className="flex flex-none my-1 text-[#616670] group-hover:text-[#1d1f25] transition-colors duration-200"/>
                    <p className="font-family-system text-[13px] font-[400] leading-[16.25px] ml-2">Add or import</p>
                  </button>
              </div>
            </div>
          </div>
        </div>
        {/* Tools */}
        <div className="px-2 rounded-tr-[6px]"></div>
        <div className="flex-none flex items-center select-none ml-2">
            <div className="flex z2 h-[32px]">
               <div className="flex">
                  <button className="group flex items-center cursor-pointer px-3 h-[32px]">
                    <div className="pr-1 text-[13px] font-[400] leading-[18px] font-family-system text-[#616670] group-hover:text-[#1d1f25] transition-colors duration-200">Tools</div>
                    <ChevronDown size={16} className="flex-none text-[#616670] group-hover:text-[#1d1f25] transition-colors duration-200" />
                  </button>
               </div>
            </div>
        </div>

      </div>
      
      {/* Table Rename Card */}
      {isRenaming && renamingTableId && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-lg rounded-b-md z-50">
          <div className="p-4">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table name
              </label>
              <Input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSaveRename();
                  } else if (e.key === 'Escape') {
                    handleCancelRename();
                  }
                }}
              />
            </div>
            <div className="cursor-pointer flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelRename}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRename}
                disabled={!newTableName.trim()}
                className="cursor-pointer"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}