"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { api } from "~/trpc/react";
import { CreateTableModal } from "../_components/CreateTableModal";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { 
  Plus, 
  ChevronDown,
  Grid3X3,
  Eye,
  Filter,
  Group,
  ArrowUpDown,
  Palette,
  Share2,
  Search,
  History,
  ChevronUp,
} from "lucide-react";

// Types for our table data
interface TableCell {
  id: string;
  columnId: string;
  value: {
    text?: string;
    number?: number;
  };
}

interface TableRow {
  id: string;
  cells: TableCell[];
}

interface TableColumn {
  id: string;
  name: string;
  type: string;
  width: number;
}

interface TableData {
  id: string;
  name: string;
  rows: TableRow[];
  columns: TableColumn[];
}

interface FlatRow {
  id: string;
  rowIndex: number;
  [key: string]: string | number;
}


// Helper to get cell value for a row and column
const getCellValue = (row: TableRow, columnId: string): string => {
  const cell = row.cells.find(c => c.columnId === columnId);
  if (!cell?.value) return "";
  
  if (cell.value.text) return cell.value.text;
  if (cell.value.number !== undefined) return cell.value.number.toString();
  
  return "";
};

// Create flattened row data for TanStack Table
const createFlattenedRows = (tableData: TableData | undefined): FlatRow[] => {
  if (!tableData?.rows || !tableData?.columns) return [];
  
  return tableData.rows.map((row: TableRow, index: number) => {
    const flatRow: FlatRow = {
      id: row.id,
      rowIndex: index + 1,
    };
    
    // Add each column as a property
    tableData.columns.forEach((column: TableColumn) => {
      flatRow[column.id] = getCellValue(row, column.id);
    });
    
    return flatRow;
  });
};

export default function BasePage() {
  const params = useParams();
  const baseId = params?.baseId as string;
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  
  // Cell focus state for arrow key navigation
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

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

  // Select first table by default
  if (tables && tables.length > 0 && !selectedTable) {
    setSelectedTable(tables[0]!.id);
  }

  // Create columns for TanStack Table
  const columns = useMemo(() => {
    if (!tableData?.columns) return [];
    
    try {
      const columnHelper = createColumnHelper<FlatRow>();
    
    const tableColumns = [
      // Row number column
      columnHelper.display({
        id: 'rowNumber',
        header: () => (
          <div className="w-full flex items-center justify-center">
            <input type="checkbox" className="rounded" />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-center text-sm text-gray-500 w-full">
            {row.original.rowIndex}
          </div>
        ),
        size: 80,
        enableSorting: false,
        enableHiding: false,
      }),
      
      // Dynamic columns based on table data
      ...tableData.columns.map((column) =>
        columnHelper.accessor(column.id, {
          header: ({ column: col }) => (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{column.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => col.toggleSorting(col.getIsSorted() === "asc")}
              >
                {col.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-3 w-3" />
                ) : col.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3" />
                )}
              </Button>
            </div>
          ),
          cell: ({ getValue, row }) => {
            const rowIndex = row.original.rowIndex - 1; // Convert back to 0-based index
            const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell?.columnId === column.id;
            
            return (
              <Input
                type="text"
                className={`w-full h-full bg-transparent border-0 outline-none rounded px-1  py-1 ${
                  isFocused 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : 'focus:ring-2 ring-blue-500 focus:ring-blue-500'
                }`}
                placeholder={`Enter ${column.name.toLowerCase()}`}
                value={getValue() as string ?? ""}
                data-cell={`${rowIndex}-${column.id}`}
                onFocus={() => setFocusedCell({ rowIndex, columnId: column.id })}
                onBlur={() => setFocusedCell(null)}
                readOnly // Make it read-only for now, can add editing later
              />
            );
          },
          size: column.width,
          enableSorting: true,
          filterFn: "includesString",
        })
      ),
      
      // Add column button
      columnHelper.display({
        id: 'addColumn',
        header: () => (
          <div className="flex items-center justify-center">
            <Plus className="h-4 w-4 text-gray-500 cursor-pointer hover:text-gray-700" />
          </div>
        ),
        cell: () => null,
        size: 80,
        enableSorting: false,
        enableHiding: false,
      }),
    ];
    
    return tableColumns;
    } catch (error) {
      console.error('Error creating columns:', error);
      return [];
    }
  }, [tableData?.columns, focusedCell?.columnId, focusedCell?.rowIndex, setFocusedCell]);

  // Prepare data for the table
  const data = useMemo(() => createFlattenedRows(tableData as TableData), [tableData]);

  // Create the table instance
  const table = useReactTable({
    data: data ?? [],
    columns: columns ?? [],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
  });

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!focusedCell || !tableData?.columns || !data) return;
      
      const { rowIndex, columnId } = focusedCell;
      const currentColumnIndex = tableData.columns.findIndex(col => col.id === columnId);
      const totalRows = data.length;
      const totalColumns = tableData.columns.length;
      
      let newRowIndex = rowIndex;
      let newColumnIndex = currentColumnIndex;
      
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          newRowIndex = Math.min(totalRows - 1, rowIndex + 1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          newColumnIndex = Math.max(0, currentColumnIndex - 1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          newColumnIndex = Math.min(totalColumns - 1, currentColumnIndex + 1);
          break;
        default:
          return;
      }
      
      const newColumnId = tableData.columns[newColumnIndex]!.id;
      if (newColumnId) {
        setFocusedCell({ rowIndex: newRowIndex, columnId: newColumnId });
        
        // Focus the actual input element
        setTimeout(() => {
          if (tableRef.current) {
            const cellElement = tableRef.current.querySelector(
              `[data-cell="${newRowIndex}-${newColumnId}"]`
            );
            if (cellElement instanceof HTMLInputElement) {
              cellElement.focus();
              cellElement.select();
            }
          }
        }, 0);
      }
    };

    if (focusedCell) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [focusedCell, tableData?.columns, data]);

  // Early return if no selected table
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
    <div className="h-screen flex flex-col bg-white">
      {/* Top Navigation Bar */}
      <header className="h-12 border-b border-gray-200 flex items-center px-4 bg-white">
        <div className="flex items-center gap-3 flex-1">
          {/* Base Icon and Name */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-red-500 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-base font-semibold">{base?.name ?? "Loading..."}</span>
          </div>

          {/* Center Tabs */}
          <div className="flex-1 flex justify-center">
            <Tabs defaultValue="data" className="w-auto">
              <TabsList className="h-12 bg-transparent border-0 p-0">
                <TabsTrigger value="data" className="rounded-none px-4">Data</TabsTrigger>
                <TabsTrigger value="automations" className="rounded-none px-4">Automations</TabsTrigger>
                <TabsTrigger value="interfaces" className="rounded-none px-4">Interfaces</TabsTrigger>
                <TabsTrigger value="forms" className="border-none rounded-none px-4">Forms</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <History className="h-4 w-4" />
            </Button>
            <Button className="h-8 px-3 bg-red-600 hover:bg-pink-700">Share</Button>
          </div>
        </div>
      </header>

      {/* Table Tabs Bar */}
      <div className="h-10 border-b border-gray-200 flex items-center px-4 bg-gray-50">
        <div className="flex items-center gap-1">
          {/* Table Tabs */}
          {tables?.map((table) => (
            <Button
              key={table.id}
              variant={selectedTable === table.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3"
              onClick={() => setSelectedTable(table.id)}
            >
              {table.name}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          ))}

          {/* Add Table Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add or import
          </Button>
        </div>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7">
                Tools
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Extensions</DropdownMenuItem>
              <DropdownMenuItem>Automations</DropdownMenuItem>
              <DropdownMenuItem>Scripts</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-12 border-b border-gray-200 flex items-center px-4 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Grid3X3 className="h-4 w-4 mr-2" />
              Grid view
              <ChevronDown className="ml-2 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Grid view</DropdownMenuItem>
            <DropdownMenuItem>Gallery view</DropdownMenuItem>
            <DropdownMenuItem>Kanban view</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-gray-300" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <Eye className="h-4 w-4 mr-2" />
              Hide fields
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {table.getAllLeafColumns()
              .filter(column => column.getCanHide())
              .map(column => (
                <DropdownMenuItem
                  key={column.id}
                  onClick={() => column.toggleVisibility()}
                >
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={() => column.toggleVisibility()}
                    className="mr-2"
                  />
                  {(column.columnDef.header as string) ?? column.id}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8"
          onClick={() => {
            // Clear all filters
            table.resetColumnFilters();
            setGlobalFilter("");
          }}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {(columnFilters.length > 0 || globalFilter) && (
            <span className="ml-1 bg-blue-500 text-white rounded-full text-xs px-1.5 py-0.5">
              {columnFilters.length + (globalFilter ? 1 : 0)}
            </span>
          )}
        </Button>

        <Button variant="ghost" size="sm" className="h-8">
          <Group className="h-4 w-4 mr-2" />
          Group
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort
              {sorting.length > 0 && (
                <span className="ml-1 bg-blue-500 text-white rounded-full text-xs px-1.5 py-0.5">
                  {sorting.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSorting([])}>
              Clear all sorting
            </DropdownMenuItem>
            {sorting.map((sort) => (
              <DropdownMenuItem key={sort.id}>
                {sort.id}: {sort.desc ? "Descending" : "Ascending"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="h-8">
          <Palette className="h-4 w-4 mr-2" />
          Color
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8">
            <Share2 className="h-4 w-4 mr-2" />
            Share and sync
          </Button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search all..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-8 w-48"
            />
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 bg-white overflow-hidden" ref={tableRef}>
        <div className="h-full border-l border-gray-200">
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="border-b border-gray-200">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-3 py-2 border-r border-gray-200 text-left"
                        style={{
                          width: header.getSize(),
                          minWidth: header.getSize(),
                          maxWidth: header.getSize(),
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="px-3 py-3 border-r border-gray-200"
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          maxWidth: cell.column.getSize(),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                
                {/* Add Row */}
                <tr className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-3 border-r border-gray-200 text-center">
                    <Plus className="h-4 w-4 text-gray-400 mx-auto cursor-pointer hover:text-gray-600" />
                  </td>
                  <td className="px-3 py-3 border-r border-gray-200" colSpan={table.getVisibleLeafColumns().length - 1}>
                    <span className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Add record...</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="h-8 border-t border-gray-200 bg-gray-50 flex items-center px-4">
          <span className="text-xs text-gray-500">
            {table.getFilteredRowModel().rows.length} of {data?.length ?? 0} records
            {globalFilter && ` (filtered)`}
            {sorting.length > 0 && ` (sorted)`}
          </span>
        </div>
      </div>

      {/* Create Table Modal */}
      <CreateTableModal
        baseId={baseId}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          void refetchTables();
          void refetchTableData();
        }}
      />
    </div>
  );
}