"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import Spinner from "../../icons/Spinner";
import { TableControls } from "./TableControls";
import { EditableCell } from "./EditableCell";
import { TableHeader } from "./TableHeader";
import { RowNumberHeader } from "./RowNumberHeader";
import { type SortRule } from "../modals/SortModal";
import { ColumnContextMenuModal } from "../modals/ColumnContextMenuModal";

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
  onInsertRowAbove?: (tableId: string, rowId: string) => void;
  onInsertRowBelow?: (tableId: string, rowId: string) => void;
  onDeleteRow?: (tableId: string, rowId: string) => void;
  onContextMenu?: (position: { x: number; y: number }, rowId: string) => void;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  hiddenColumns?: Set<string>;
  sortRules?: SortRule[];
  filterRules?: Array<{
    id: string;
    columnId: string;
    columnName: string;
    columnType: 'TEXT' | 'NUMBER';
    operator: 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals' | 'greater_than' | 'less_than';
    value?: string | number;
  }>;
  isTableLoading?: boolean;
  isTableStabilizing?: boolean;
  searchResults?: Array<{
    type: 'field' | 'cell';
    id: string;
    name: string;
    columnId: string;
    columnOrder: number;
    rowId: string | null;
    rowOrder: number;
  }>;
  currentSearchIndex?: number;
  searchQuery?: string;
  scrollToRowId?: string | null;
  onRenameColumn?: (columnId: string, newName: string) => void;
  onDeleteColumn?: (columnId: string) => void;
}

export function DataTable({ tableData, onInsertRowAbove: _onInsertRowAbove, onInsertRowBelow: _onInsertRowBelow, onDeleteRow: _onDeleteRow, onContextMenu, fetchNextPage, hasNextPage, isFetchingNextPage, hiddenColumns = new Set(), sortRules: _sortRules = [], filterRules = [], isTableLoading = false, isTableStabilizing = false, searchResults = [], currentSearchIndex = -1, searchQuery, scrollToRowId, onRenameColumn, onDeleteColumn }: DataTableProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<{rowIndex: number, columnIndex: number} | null>(null);
  const [selectedCell, setSelectedCell] = useState<{rowIndex: number, columnIndex: number} | null>(null);
  const [columnModal, setColumnModal] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    column: { id: string; name: string } | null;
  }>({ isOpen: false, position: null, column: null });

  // Reference to the scrolling container
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle cell selection
  const handleCellSelection = useCallback((rowIndex: number, columnIndex: number) => {
    setSelectedCell({ rowIndex, columnIndex });
  }, []);

  // Handle cell deselection
  const handleCellDeselection = useCallback(() => {
    setSelectedCell(null);
  }, []);


  // Handle context menu (insert row above/below)
  const handleContextMenuClick = useCallback((event: React.MouseEvent, rowId: string) => {
    event.preventDefault();
    
    if (onContextMenu) {
      onContextMenu({ x: event.clientX, y: event.clientY }, rowId);
    }
  }, [onContextMenu]);

  // Handle column actions (dropdown menu)
  const handleColumnAction = useCallback((position: { x: number; y: number }, column: { id: string; name: string }) => {
    setColumnModal({
      isOpen: true,
      position,
      column
    });
  }, []);


  // Handle cell navigation
  const handleCellNavigation = useCallback((direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right', currentRowIndex: number, currentColumnIndex: number) => {
    const maxRowIndex = tableData.rows.length - 1;
    const visibleColumnCount = tableData.columns.filter(column => !hiddenColumns.has(column.id)).length;
    const maxColumnIndex = visibleColumnCount - 1; // Excluding row number column
    
    let newRowIndex = currentRowIndex;
    let newColumnIndex = currentColumnIndex;

    switch (direction) {
      case 'tab':
        if (currentColumnIndex < maxColumnIndex) {
          newColumnIndex = currentColumnIndex + 1;
        } else if (currentRowIndex < maxRowIndex) {
          newRowIndex = currentRowIndex + 1;
          newColumnIndex = 0;
        }
        break;
      case 'shift-tab':
        if (currentColumnIndex > 0) {
          newColumnIndex = currentColumnIndex - 1;
        } else if (currentRowIndex > 0) {
          newRowIndex = currentRowIndex - 1;
          newColumnIndex = maxColumnIndex;
        }
        break;
      case 'enter':
      case 'down':
        if (currentRowIndex < maxRowIndex) {
          newRowIndex = currentRowIndex + 1;
        }
        break;
      case 'up':
        if (currentRowIndex > 0) {
          newRowIndex = currentRowIndex - 1;
        }
        break;
      case 'right':
        if (currentColumnIndex < maxColumnIndex) {
          newColumnIndex = currentColumnIndex + 1;
        }
        break;
      case 'left':
        if (currentColumnIndex > 0) {
          newColumnIndex = currentColumnIndex - 1;
        }
        break;
    }

    if (newRowIndex !== currentRowIndex || newColumnIndex !== currentColumnIndex) {
      setSelectedCell({ rowIndex: newRowIndex, columnIndex: newColumnIndex });
      // Set focusedCell to trigger shouldFocus on the new cell
      setFocusedCell({ rowIndex: newRowIndex, columnIndex: newColumnIndex });
    }
  }, [tableData.rows.length, tableData.columns, hiddenColumns]);

  // Handle keyboard events for cell selection and navigation
  useEffect(() => {
    if (!selectedCell) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard events if no input is focused
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        // Trigger focus to enter edit mode
        setFocusedCell(selectedCell);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCellDeselection();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleCellNavigation(e.shiftKey ? 'shift-tab' : 'tab', selectedCell.rowIndex, selectedCell.columnIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleCellNavigation('up', selectedCell.rowIndex, selectedCell.columnIndex);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleCellNavigation('down', selectedCell.rowIndex, selectedCell.columnIndex);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleCellNavigation('left', selectedCell.rowIndex, selectedCell.columnIndex);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleCellNavigation('right', selectedCell.rowIndex, selectedCell.columnIndex);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Start editing on any printable character - don't prevent default
        // Let the character flow through to the focused input
        setFocusedCell(selectedCell);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, handleCellNavigation, handleCellDeselection]);

  // Note: Sorting is now handled at the database level
  // The sortRules prop is kept for UI display purposes only

  // Calculate search match information
  const searchMatchInfo = useMemo(() => {
    if (!searchResults || searchResults.length === 0) {
      return { cellMatches: new Set(), currentResult: null };
    }

    const cellMatches = new Set<string>();
    let currentResult = null;

    // Add all cell search results to matches
    searchResults.forEach((result, index) => {
      if (result.type === 'cell' && result.rowId) {
        const matchKey = `${result.rowId}-${result.columnId}`;
        cellMatches.add(matchKey);
        
        if (index === currentSearchIndex) {
          currentResult = matchKey;
        }
      }
    });

    return { cellMatches, currentResult };
  }, [searchResults, currentSearchIndex]);

  // Transform the data structure into a format that TanStack Table can use
  const { columns, data } = useMemo(() => {
    // Create row number column
    const rowNumberColumn: ColumnDef<TableRow, string | undefined> = columnHelper.accessor('__rowNumber', {
      id: '__rowNumber',
      header: () => (
        <RowNumberHeader
          selectedRows={selectedRows}
          totalRows={tableData.rows.length}
          onSelectAll={(checked) => {
            if (checked) {
              setSelectedRows(new Set(tableData.rows.map(row => row.id)));
            } else {
              setSelectedRows(new Set());
            }
          }}
        />
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

    // Create column definitions for data columns (filter out hidden columns)
    const visibleColumns = tableData.columns.filter(column => !hiddenColumns.has(column.id));
    const tableColumns: ColumnDef<TableRow, string | undefined>[] = visibleColumns.map((column, columnIndex) =>
      columnHelper.accessor(column.id, {
        id: column.id,
        header: column.name,
        size: 179, // Fixed width for all columns
        cell: (info) => {
          const value = info.getValue()!;
          const row = info.row.original;
          const cellId = row.__cellIds[column.id]!;
          const rowIndex = info.row.index;
          
          const matchKey = `${row.id}-${column.id}`;
          const isSearchMatch = searchMatchInfo.cellMatches.has(matchKey);
          const isCurrentSearchResult = searchMatchInfo.currentResult === matchKey;

          return (
            <EditableCell
              key={`${row.id}-${column.id}`} // Stable key for React tracking
              cellId={cellId}
              tableId={tableData.id}
              initialValue={value ?? ""}
              onNavigate={(direction) => handleCellNavigation(direction, rowIndex, columnIndex)}
              shouldFocus={focusedCell?.rowIndex === rowIndex && focusedCell?.columnIndex === columnIndex}
              isSelected={selectedCell?.rowIndex === rowIndex && selectedCell?.columnIndex === columnIndex}
              onSelect={() => handleCellSelection(rowIndex, columnIndex)}
              onDeselect={handleCellDeselection}
              rowId={row.id}
              columnId={column.id} // Pass the real column ID directly
              onContextMenu={handleContextMenuClick}
              filterRules={filterRules}
              isTableLoading={isTableLoading}
              isTableStabilizing={isTableStabilizing}
              searchQuery={searchQuery}
              isSearchMatch={isSearchMatch}
              isCurrentSearchResult={isCurrentSearchResult}
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

    // Data is already sorted at database level
    return {
      columns: allColumns,
      data: tableData_rows,
    };
  }, [tableData, selectedRows, hoveredRowIndex, handleCellNavigation, focusedCell, selectedCell, handleCellSelection, handleCellDeselection, handleContextMenuClick, hiddenColumns, filterRules, isTableLoading, isTableStabilizing, searchMatchInfo, searchQuery]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id, // Use stable row ID instead of array index
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

  // Scroll to specific row when scrollToRowId changes
  useEffect(() => {
    if (scrollToRowId) {
      const rowIndex = data.findIndex(row => row.id === scrollToRowId);
      if (rowIndex >= 0) {
        rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' });
      }
    }
  }, [scrollToRowId, data, rowVirtualizer]);

  // Infinite scrolling logic
  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;

    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      // Trigger fetch when user has scrolled 80% of the way down
      if (scrollPercentage > 0.8) {
        fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);


  // Handle clicking outside cells to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on the container, not on child elements
    if (e.target === e.currentTarget) {
      handleCellDeselection();
    }
  }, [handleCellDeselection]);

  return (
    <div 
      ref={tableContainerRef}
      className="w-full h-full overflow-auto"
      style={{
        contain: 'strict', // CSS containment to prevent layout escape
        paddingRight: '70px',
        paddingBottom: '70px',
      }}
      onClick={handleContainerClick}
    >
      <div 
        style={{ 
          width: table.getCenterTotalSize() + 100,
          minWidth: '100%',
        }}
      >
        <table style={{ display: 'grid', width: '100%' }}>
          <TableHeader
            table={table}
            tableColumns={tableData.columns}
            onColumnAction={handleColumnAction}
          />
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
        
        {/* Loading indicator at the bottom */}
        {isFetchingNextPage && (
          <div
            style={{
              position: 'absolute',
              top: `${rowVirtualizer.getTotalSize() + 40}px`,
              width: '100%',
              padding: '16px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.95)',
              borderTop: '1px solid #e5e7eb',
              boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <Spinner size={20} color="#666" />
              <span className="text-sm text-gray-600 font-medium">
                Loading more rows...
              </span>
            </div>
          </div>
        )}
        
      </div>

      {/* Table Controls */}
      <TableControls
        tableData={tableData}
        tableTotalWidth={table.getCenterTotalSize()}
      />

      {/* Column Context Menu Modal */}
      <ColumnContextMenuModal
        isOpen={columnModal.isOpen}
        position={columnModal.position}
        column={columnModal.column}
        onClose={() => setColumnModal({ isOpen: false, position: null, column: null })}
        onRename={(columnId, newName) => {
          onRenameColumn?.(columnId, newName);
        }}
        onDelete={(columnId) => {
          onDeleteColumn?.(columnId);
        }}
      />

    </div>
  );
}