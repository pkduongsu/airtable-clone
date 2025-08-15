"use client";

import { useMemo, useState, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import ChevronDown from "../icons/ChevronDown";
import { TableControls } from "./TableControls";
import { EditableCell } from "./EditableCell";

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
  __cellIds: Record<string, string>; // Map column ID to cell ID
  [key: string]: string | undefined | Record<string, string>;
};

const columnHelper = createColumnHelper<TableRow>();

interface DataTableProps {
  tableData: TableData;
  onTableDataRefresh?: () => void;
}

export function DataTable({ tableData, onTableDataRefresh }: DataTableProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [hoveredHeader, setHoveredHeader] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  
  // Reference to the scrolling container
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Transform the data structure into a format that TanStack Table can use
  const { columns, data } = useMemo(() => {
    // Create row number column
    const rowNumberColumn: ColumnDef<TableRow, string | undefined> = columnHelper.accessor('__rowNumber', {
      id: '__rowNumber',
      header: () => (
        <div className="flex items-center justify-center w-full h-full">
          <input
            type="checkbox"
            className="w-4 h-4 flex-shrink-0"
            checked={selectedRows.size === tableData.rows.length && tableData.rows.length > 0}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedRows(new Set(tableData.rows.map(row => row.id)));
              } else {
                setSelectedRows(new Set());
              }
            }}
          />
        </div>
      ),
      size: 87, // Default width for row number column
      minSize: 87, // Minimum width for row number column
      cell: (info) => {
        const rowIndex = info.row.index;
        const rowId = info.row.original.id;
        const isHovered = hoveredRowIndex === rowIndex;
        const isSelected = selectedRows.has(rowId);
        
        return (
          <div 
            className="w-full h-full flex items-center justify-center text-xs text-gray-500"
            onMouseEnter={() => setHoveredRowIndex(rowIndex)}
            onMouseLeave={() => setHoveredRowIndex(null)}
          >
            {isHovered || isSelected ? (
              <input
                type="checkbox"
                className="w-4 h-4 flex-shrink-0"
                checked={isSelected}
                onChange={(e) => {
                  const newSelectedRows = new Set(selectedRows);
                  if (e.target.checked) {
                    newSelectedRows.add(rowId);
                  } else {
                    newSelectedRows.delete(rowId);
                  }
                  setSelectedRows(newSelectedRows);
                }}
              />
            ) : (
              <span className="text-center">{rowIndex + 1}</span>
            )}
          </div>
        );
      },
    });

    // Create column definitions for data columns
    const tableColumns: ColumnDef<TableRow, string | undefined>[] = tableData.columns.map((column) =>
      columnHelper.accessor(column.id, {
        id: column.id,
        header: column.name,
        size: 179, // Fixed width for all columns
        cell: (info) => {
          const value = info.getValue()!;
          const row = info.row.original;
          const cellId = row.__cellIds[column.id]!;
          
          return (
            <EditableCell
              cellId={cellId}
              initialValue={value ?? ""}
              onSave={onTableDataRefresh}
            />
          );
        },
      })
    );

    // Combine row number column with data columns
    const allColumns = [rowNumberColumn, ...tableColumns];

    // Transform rows data into the format expected by TanStack Table
    const tableData_rows: TableRow[] = tableData.rows.map((row) => {
      const rowData: TableRow = { id: row.id, __cellIds: {} };
      
      // For each cell, map it to the column ID
      row.cells.forEach((cell) => {
        // Store cell ID for editing
        rowData.__cellIds[cell.columnId] = cell.id;
        
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
      columns: allColumns,
      data: tableData_rows,
    };
  }, [tableData, selectedRows, hoveredRowIndex, onTableDataRefresh]);

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

  const { rows } = table.getRowModel();

  // Setup virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 32, // Estimate row height (32px to match our h-8 class)
    getScrollElement: () => tableContainerRef.current,
    measureElement:
      typeof window !== 'undefined' &&
      !navigator.userAgent.includes('Firefox')
        ? element => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  });


  return (
    <div 
      ref={tableContainerRef}
      className="w-full h-full overflow-auto"
      style={{
        contain: 'strict', // CSS containment to prevent layout escape
        paddingRight: '70px',
        paddingBottom: '70px',
      }}
    >
      <div 
        style={{ 
          width: table.getCenterTotalSize() + 100,
          minWidth: '100%',
        }}
      >
        <table style={{ display: 'grid', width: '100%' }}>
            <thead
              style={{
                display: 'grid',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  style={{ display: 'flex', width: '100%' }}
                >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left p-0 text-[#1d1f25] bg-white border-b border-r border-border-default hover:bg-[#f8f8f8] relative"
                    style={{
                      display: 'flex',
                      width: header.getSize(),
                    }}
                  >
                    <div 
                      className="px-3 py-2 h-[32px] flex items-center justify-between text-xs font-family-system font-[500] text-[13px] leading-[19.5px] w-full"                     
                      onMouseEnter={() => setHoveredHeader(header.id)}
                      onMouseLeave={() => setHoveredHeader(null)}
                    >
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
          <tbody
            style={{
              display: 'grid',
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              return (
                <tr
                  data-index={virtualRow.index}
                  ref={(node) => rowVirtualizer.measureElement(node)}
                  key={row.id}
                  className="group border-b border-border-default hover:bg-[#f8f8f8] bg-white"
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    transform: `translateY(${virtualRow.start}px)`,
                    width: table.getCenterTotalSize(),
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="p-0 h-8 border-r border-border-default relative"
                      style={{
                        display: 'flex',
                        width: cell.column.getSize(),
                        alignItems: 'center',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        
      </div>

      {/* Table Controls */}
      <TableControls
        tableData={tableData}
        tableTotalWidth={table.getCenterTotalSize()}
        onTableDataRefresh={onTableDataRefresh}
      />
    </div>
  );
}