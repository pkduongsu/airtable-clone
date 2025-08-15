"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type ColumnSizingState,
} from "@tanstack/react-table";
import ChevronDown from "../icons/ChevronDown";
import Plus from "../icons/Plus";

// Define the types for our table data based on the actual tRPC return type
type TableData = {
  id: string;
  name: string;
  columns: Array<{
    id: string;
    name: string;
    type: string;
    order: number;
    width: number;
    tableId: string;
  }>;
  rows: Array<{
    id: string;
    order: number;
    cells: Array<{
      id: string;
      rowId: string;
      columnId: string;
      value: unknown; // JsonValue from Prisma
      column: {
        id: string;
        name: string;
        type: string;
        order: number;
        width: number;
        tableId: string;
      };
    }>;
  }>;
  _count: {
    rows: number;
  };
};

type TableRow = {
  id: string;
  [key: string]: string | undefined;
};

const columnHelper = createColumnHelper<TableRow>();

interface DataTableProps {
  tableData: TableData;
}

export function DataTable({ tableData }: DataTableProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [hoveredHeader, setHoveredHeader] = useState<string | null>(null);

  // Transform the data structure into a format that TanStack Table can use
  const { columns, data } = useMemo(() => {
    // Create column definitions
    const tableColumns: ColumnDef<TableRow, string | undefined>[] = tableData.columns.map((column) =>
      columnHelper.accessor(column.id, {
        id: column.id,
        header: column.name,
        size: 179, // Fixed width for all columns
        cell: (info) => {
          const value = info.getValue();
          return (
            <div className="w-full h-full flex items-center">
              <input 
                type="text"
                value={value ?? ""}
                onChange={(e) => {
                  // TODO: Implement cell editing
                  console.log("Cell edited:", column.name, e.target.value);
                }}
                className="w-full h-full px-2 py-1 border-none bg-transparent focus:outline-none focus:bg-white text-sm text-gray-900"
                placeholder=""
              />
            </div>
          );
        },
      })
    );

    // Transform rows data into the format expected by TanStack Table
    const tableData_rows: TableRow[] = tableData.rows.map((row) => {
      const rowData: TableRow = { id: row.id };
      
      // For each cell, map it to the column ID
      row.cells.forEach((cell) => {
        // Handle different value formats from JSON
        const value = cell.value;
        if (value && typeof value === 'object' && 'text' in value) {
          rowData[cell.columnId] = (value as { text: string }).text;
        } else if (typeof value === 'string') {
          rowData[cell.columnId] = value;
        } else {
          rowData[cell.columnId] = '';
        }
      });
      
      return rowData;
    });

    return {
      columns: tableColumns,
      data: tableData_rows,
    };
  }, [tableData]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    state: {
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
  });

  return (
    <div className="w-full h-full overflow-auto">
      <div className="inline-block relative">
        <table className="border-collapse border-spacing-0" style={{ width: table.getCenterTotalSize() }}>
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left p-0 text-[#1d1f25] bg-white border-b border-r border-border-default hover:bg-[#f8f8f8] relative"
                    style={{ width: header.getSize() }}
                  >
                    <div className="px-3 py-2 h-[30px] flex items-center justify-between text-xs font-family-system font-[500] text-[13px] leading-[19.5px]"                     
                      onMouseEnter={() => {setHoveredHeader(header.id)}}
                      onMouseLeave={() => {setHoveredHeader(null)}}>
                      <span className="truncate">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </span>
                      <button className={`ml-1 flex-shrink-0 transition-opacity duration-75 ${hoveredHeader === header.id ? 'opacity-100' : 'opacity-0'}`}>
                        <ChevronDown size={12} color="#616670"/>
                      </button>
                    </div>
                    {/* Column resize handle */}
                    <div
                      {...{
                        onDoubleClick: () => header.column.resetSize(),
                        onMouseDown: header.getResizeHandler(),
                        onTouchStart: header.getResizeHandler(),
                      }}
                      className={`absolute right-0 top-[5px] bottom-[5px] w-[1px] rounded-[2px] cursor-col-resize hover:bg-[#166ee1] transition-opacity ${
                        header.column.getIsResizing() ? 'bg-[#166ee1] opacity-100' : 'opacity-0 hover:opacity-100'
                      }`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr 
                key={row.id} 
                className="group border-b border-border-default hover:bg-[#f8f8f8] bg-white"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="p-0 h-8 border-r border-border-default relative"
                    style={{ width: cell.column.getSize()}}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Add column button - positioned at header level */}
        <div className="absolute w-[94px] h-8 top-0 bg-white border-l-0 border-t-0 border border-border-default hover:bg-[#f8f8f8] z-10" 
             style={{ left: table.getCenterTotalSize() }}>
          <div className="px-2 py-2 flex items-center justify-center">
            <button className="w-full h-full cursor-pointer flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-[#f8f8f8] rounded transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}