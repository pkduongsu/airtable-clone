"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { api } from "~/trpc/react";
import { TableHeader } from "./TableHeader";
import { EditableCell } from "./EditableCell";
import { RowNumberHeader } from "./RowNumberHeader";
import Spinner from "../../icons/Spinner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AddColumnModal } from "../modals/AddColumnModal";
import { useCreateColumn } from "../hooks/useCreateColumn";
import { useCreateRow } from "../hooks/useCreateRow";
import Plus from "../../icons/Plus";

import type { Column, Cell, Row as _Record } from "@prisma/client";
import {
  useReactTable,
  type ColumnDef,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnSizingState,
} from "@tanstack/react-table";

import { type SortRule } from "../modals/SortModal";
import { ColumnContextMenuModal } from "../modals/ColumnContextMenuModal";

const PAGE_LIMIT = 100;

type SearchResult = {
  type: 'field' | 'cell';
  id: string;
  name: string;
  columnId: string;
  columnOrder: number;
  rowId: string | null;
  rowOrder: number;
};

type TableRow = {
  id: string;
  __cellIds: Record<string, string>; // Map column ID to cell ID
  [key: string]: string | undefined | Record<string, string>;
};

const columnHelper = createColumnHelper<TableRow>();

interface DataTableProps {
  tableId: string;
  onInsertRowAbove?: (tableId: string, rowId: string) => void;
  onInsertRowBelow?: (tableId: string, rowId: string) => void;
  onDeleteRow?: (tableId: string, rowId: string) => void;
  onContextMenu?: (position: { x: number; y: number }, rowId: string) => void;
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
  searchResults?: SearchResult[];
  currentSearchIndex?: number;
  searchQuery?: string;
  scrollToRowId?: string | null;
  onRenameColumn?: (columnId: string, newName: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  isApplyingFiltersOrSorts?: boolean;
  onRecordCountChange?: (count: number) => void;
}
export function DataTable({ 
  tableId, 
  onInsertRowAbove: _onInsertRowAbove, 
  onInsertRowBelow: _onInsertRowBelow, 
  onDeleteRow: _onDeleteRow, 
  onContextMenu, 
  hiddenColumns = new Set(), 
  sortRules = [], 
  filterRules = [], 
  searchResults = [], 
  currentSearchIndex = -1, 
  searchQuery: searchValue = "", 
  scrollToRowId, 
  onRenameColumn, 
  onDeleteColumn,
  onRecordCountChange
}: DataTableProps) {
  const utils = api.useUtils();
  
  // Extract parameters from props to match Table.tsx pattern

  // State management
  const [records, setRecords] = useState<_Record[]>([]); //set local records state (local = optimistic updates)
  const [columns, setColumns] = useState<Column[]>([]); //set local columns state 
  const [cells, setCells] = useState<Cell[]>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<{rowId: string, columnId: string} | null>(null);
  const [selectedCell, setSelectedCell] = useState<{rowId: string, columnId: string} | null>(null);
  const [navigatedCell, setNavigatedCell] = useState<{rowIndex: number, columnIndex: number} | null>(null);
  // Store focus state in a ref to avoid re-renders
  const focusStateRef = useRef<{
    focusedRowId: string | null;
    focusedColumnId: string | null;
    selectedRowId: string | null;
    selectedColumnId: string | null;
  }>({
    focusedRowId: null,
    focusedColumnId: null,
    selectedRowId: null,
    selectedColumnId: null,
  });
  
  // Ref to track focus timeout to avoid multiple simultaneous focuses
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to prevent navigation immediately after clicking
  const lastClickTimeRef = useRef<number>(0);
  
  // Add Column Modal state
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);

  const { handleCreateColumn } = useCreateColumn();
  
  // Add Row functionality
  const { handleCreateRow } = useCreateRow();
  
  const [columnModal, setColumnModal] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    column: { id: string; name: string } | null;
  }>({ isOpen: false, position: null, column: null });

  // Add Column Modal handlers
  const handleAddColumnClick = useCallback(() => {
    setShowAddColumnModal(true);
  }, []);

  const handleCloseAddColumnModal = useCallback(() => {
    setShowAddColumnModal(false);
  }, []);

  const handleCreateField = useCallback(async (name: string, type: 'TEXT' | 'NUMBER') => {
    try {
      await handleCreateColumn(tableId, name, type);
      setShowAddColumnModal(false);
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  }, [handleCreateColumn, tableId]);

  const handleAddRowClick = useCallback(async () => {
    try {
      await handleCreateRow(tableId);
    } catch (error) {
      console.error('Failed to create row:', error);
    }
  }, [handleCreateRow, tableId]);

  // Table metadata query 
  const {
    data: tableData,
    isLoading: isTablesLoading,
    refetch,
  } = api.table.getById.useQuery(
    {
      id: tableId,
    },
    { 
      enabled: !!tableId,
    }
  );

  // Records query with infinite scrolling
  const {
    data: tableRecords,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching: isRecordsFetching,
    isLoading: isRecordsLoading,
    refetch: refetchRecords,
  } = api.table.getTableData.useInfiniteQuery(
    {
      tableId: tableId,
      limit: PAGE_LIMIT,
      sortRules: sortRules.map(rule => ({
        columnId: rule.columnId,
        direction: rule.direction
      })),
      filterRules: filterRules
    },
    {
      getNextPageParam: (lastPage: any) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
    }
  );

  // Flatten all records from pages
  const allRecords = useMemo(() => {
    return tableRecords?.pages.flatMap((page: any) => page.rows) ?? [];
  }, [tableRecords]);

  // Critical state update useEffect
  useEffect(() => {
    if (tableRecords) {
      setColumns(tableRecords?.pages[0]?.columns ?? []);
      setRecords(allRecords);
      const combinedCells = allRecords.flatMap((r: any) => r.cells);
      setCells(combinedCells);
    }
  }, [tableRecords, allRecords, setColumns, setRecords]);

  // Update record count callback - use total count from tableData instead of paginated records
  useEffect(() => {
    if (onRecordCountChange && tableData?._count?.rows !== undefined) {
      onRecordCountChange(tableData._count.rows);
    }
  }, [tableData?._count?.rows, onRecordCountChange]);

  // Reference to the scrolling container
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Mutations are handled by existing components

  // Transform row data
  const rowData = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const r of records) {
      map[r.id] = { recordId: r.id };
    }
    for (const cell of cells) {
      const record = map[cell.rowId];
      if (record) {
        const value = cell.value;
        if (value && typeof value === 'object' && 'text' in value) {
          record[cell.columnId] = (value as { text: string }).text;
        } else if (typeof value === 'string') {
          record[cell.columnId] = value;
        } else {
          record[cell.columnId] = '';
        }
      }
    }
    return Object.values(map);
  }, [records, cells]);

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

    // If currentSearchIndex doesn't point to a cell result, find the actual current result
    if (!currentResult && currentSearchIndex >= 0 && searchResults[currentSearchIndex]) {
      const currentSearchResult = searchResults[currentSearchIndex];
      if (currentSearchResult && currentSearchResult.type === 'cell' && currentSearchResult.rowId) {
        currentResult = `${currentSearchResult.rowId}-${currentSearchResult.columnId}`;
      }
    }

    return { cellMatches, currentResult };
  }, [searchResults, currentSearchIndex]);

  // Calculate navigation bounds without depending on full arrays
  const navigationBounds = useMemo(() => {
    const visibleColumnCount = columns.filter(column => !hiddenColumns.has(column.id)).length;
    return {
      maxRowIndex: records.length - 1,
      maxColumnIndex: Math.max(0, visibleColumnCount - 1)
    };
  }, [records.length, columns.length, hiddenColumns]);

  // Handle cell selection (click)
  const handleCellSelection = useCallback((rowId: string, columnId: string) => {
    // Convert rowId/columnId back to indices for navigation consistency
    const rowIndex = records.findIndex(record => record.id === rowId);
    const visibleColumns = columns
      .filter(col => !hiddenColumns.has(col.id))
      .sort((a, b) => a.order - b.order);
    const columnIndex = visibleColumns.findIndex(col => col.id === columnId);
    
    // Record click time to prevent immediate keyboard navigation
    lastClickTimeRef.current = Date.now();
    
    setSelectedCell({ rowId, columnId });
    setFocusedCell({ rowId, columnId });
    setNavigatedCell({ rowIndex, columnIndex }); // Set navigation to clicked position
    
    // Update focus state ref for highlighting
    focusStateRef.current = {
      focusedRowId: rowId,
      focusedColumnId: columnId,
      selectedRowId: rowId,
      selectedColumnId: columnId,
    };
  }, [records, columns, hiddenColumns]);

  // Handle cell deselection
  const handleCellDeselection = useCallback(() => {
    setSelectedCell(null);
    setFocusedCell(null);
    setNavigatedCell(null);
  }, []);

  // Handle cell navigation with optimized dependencies
  const handleCellNavigation = useCallback((direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right', currentRowIndex: number, currentColumnIndex: number) => {
    const { maxRowIndex, maxColumnIndex } = navigationBounds;
    
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
        if (currentRowIndex < maxRowIndex) {
          newRowIndex = currentRowIndex + 1;
        }
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

    newRowIndex = Math.max(0, Math.min(newRowIndex, maxRowIndex));
    newColumnIndex = Math.max(0, Math.min(newColumnIndex, maxColumnIndex));

   const targetRowId = records[newRowIndex]?.id;
  const visibleColumns = columns
    .filter(col => !hiddenColumns.has(col.id))
    .sort((a, b) => a.order - b.order);
  const targetColumnId = visibleColumns[newColumnIndex]?.id;

  if (!targetRowId || !targetColumnId) return;

  // Update state
  setNavigatedCell({ rowIndex: newRowIndex, columnIndex: newColumnIndex });
  setSelectedCell(null);
  setFocusedCell({ rowId: targetRowId, columnId: targetColumnId });
  focusStateRef.current = {
    focusedRowId: targetRowId,
    focusedColumnId: targetColumnId,
    selectedRowId: null,
    selectedColumnId: null,
  };

  // Focus the actual input in DOM
  if (focusTimeoutRef.current) {
    clearTimeout(focusTimeoutRef.current);
  }
  focusTimeoutRef.current = setTimeout(() => {
    const cellInput = document.querySelector(
      `input[data-cell-id="${targetRowId}-${targetColumnId}"]`
    ) as HTMLInputElement;
    if (cellInput) {
      cellInput.focus();
      cellInput.select();
    }
    focusTimeoutRef.current = null;
  }, 10);

  }, [navigationBounds, hiddenColumns, records, columns]);

  // Initialize navigation to first cell if no cell is navigated or selected
  useEffect(() => {
  if (!navigatedCell) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    const active = document.activeElement as HTMLInputElement | null;
    const isInput = active && active.tagName === "INPUT";

    let { rowIndex, columnIndex } = navigatedCell;

    const move = (direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right') => {
      if (direction == 'enter') {
        handleCellDeselection();
        e.preventDefault();
        handleCellNavigation(direction, rowIndex, columnIndex);
      }
      e.preventDefault();
      handleCellNavigation(direction, rowIndex, columnIndex);
    };

    switch (e.key) {
      case "Tab":
        move(e.shiftKey ? "shift-tab" : "tab");
        break;

      case "Enter":
        move("enter");
        break;

      case "ArrowUp":
        move("up");
        break;

      case "ArrowDown":
        move("down");
        break;

      case "ArrowLeft":
        if (isInput) {
          const caret = active.selectionStart ?? 0;
          if (caret > 0) return; // allow caret movement inside input
        }
        move("left");
        break;

      case "ArrowRight":
        if (isInput) {
          const caret = active.selectionStart ?? 0;
          const len = active.value?.length ?? 0;
          if (caret < len) return; // allow caret movement inside input
        }
        move("right");
        break;

      default:
        return;
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [navigatedCell, handleCellNavigation, handleCellDeselection]);



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


  // Transform the data structure into a format that TanStack Table can use
  const { columns: allColumns, data } = useMemo(() => {
    // Create row number column
    const rowNumberColumn: ColumnDef<TableRow, string | undefined> = columnHelper.accessor('__rowNumber', {
      id: '__rowNumber',
      header: () => (
        <RowNumberHeader
          selectedRows={selectedRows}
          totalRows={records.length}
          onSelectAll={(checked) => {
            if (checked) {
              setSelectedRows(new Set(records.map(row => row.id)));
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
    const visibleColumns = columns
      .filter(column => !hiddenColumns.has(column.id))
      .sort((a, b) => a.order - b.order);
    
    const tableColumns: ColumnDef<TableRow, string | undefined>[] = visibleColumns.map((column, columnIndex) =>
      columnHelper.accessor(column.id, {
        id: column.id,
        header: column.name,
        size: 179, // Fixed width for all columns
        cell: (info) => {
          const value = info.getValue()!;
          const row = info.row.original;
          const rowIndex = info.row.index;
          
          const matchKey = `${row.id}-${column.id}`;
          const isSearchMatch = searchMatchInfo.cellMatches.has(matchKey);
          const isCurrentSearchResult = searchMatchInfo.currentResult === matchKey;

          return (
            <EditableCell
              key={`${row.id}-${column.id}`} // Stable key to preserve cell state
              tableId={tableId}
              initialValue={value ?? ""}
              onNavigate={(direction) => handleCellNavigation(direction, rowIndex, columnIndex)}
              onSelect={() => handleCellSelection(row.id, column.id)}
              onDeselect={handleCellDeselection}
              rowId={row.id}
              columnId={column.id}
              onContextMenu={handleContextMenuClick}
              filterRules={filterRules}
              searchQuery={searchValue}
              isSearchMatch={isSearchMatch}
              isCurrentSearchResult={isCurrentSearchResult}
              // Pass focus state ref for visual highlighting
              focusStateRef={focusStateRef}
              rowIndex={rowIndex}
              columnIndex={columnIndex}
              navigatedCell={navigatedCell}
              columnType={column.type}
            />
          );
        },
      })
    );

    // Combine row number column with data columns
    const allColumns = [rowNumberColumn, ...tableColumns];

    // Transform rows data into the format expected by TanStack Table
    const tableData_rows: TableRow[] = records.map((row) => {
      const rowData: TableRow = { id: row.id, __cellIds: {} };
      
      // For each cell, map it to the column ID
      cells.filter(cell => cell.rowId === row.id).forEach((cell) => {
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
  }, [records, cells, columns, selectedRows, hoveredRowIndex, hiddenColumns, searchMatchInfo ]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id, // Use stable row ID instead of array index
    state: {
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
  });

  // Handlers for table interaction

  const { rows } = table.getRowModel();

  // Intersection observer for infinite scrolling like Table.tsx
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastRowRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
  
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) {
          void fetchNextPage();
        }
        
      },
      {
        rootMargin: "200px 0px",
        threshold: 0.1,
      }
    );
  
      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

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

  // Auto-scroll to navigated cell
  useEffect(() => {
    if (navigatedCell && rowVirtualizer) {
      rowVirtualizer.scrollToIndex(navigatedCell.rowIndex, { align: 'center' });
    }
  }, [navigatedCell, rowVirtualizer]);

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

  // Data refetch when parameters change
  useEffect(() => {
    if (tableId) {
      void refetchRecords();
    }
  }, [sortRules, filterRules, searchValue, refetchRecords, tableId]);

  // Handle clicking outside cells to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on the container, not on child elements
    if (e.target === e.currentTarget) {
      handleCellDeselection();
    }
  }, [handleCellDeselection]);

  // Early return for loading or no data
  if (!tableId) {
    return <div className="flex-grow bg-white p-4">No table selected</div>;
  }
  if (isTablesLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f6f8fc]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-600 font-medium">Loading table data...</div>
        </div>
      </div>
    );
  }
  if (!tableData) {
    return (
      <div className="p-4">
        <span className="text-black font-bold text-lg">Table not found</span>
      </div>
    );
  }

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
      tabIndex={0}
      onFocus={() => {
        // Ensure we have a navigated cell when table gets focus
        if (!navigatedCell && !selectedCell && records.length > 0 && columns.length > 0) {
          setNavigatedCell({ rowIndex: 0, columnIndex: 0 });
        }
      }}
    >
      <div 
        style={{ 
          width: table.getCenterTotalSize() + 100,
          minWidth: '100%',
        }}
      >
        <table 
          key={`search-${currentSearchIndex}-${searchMatchInfo.currentResult}`}
          style={{ display: 'grid', width: '100%' }}
        >
          <TableHeader
            table={table}
            tableColumns={columns}
            onColumnAction={handleColumnAction}
            onAddColumnClick={handleAddColumnClick}
            tableData={{
              id: tableId,
              columns: columns.map(col => ({
                id: col.id,
                name: col.name,
                type: col.type,
                order: col.order,
                width: col.width,
                tableId: col.tableId
              }))
            }}
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

        {/* Sort/Filter Loading Overlay */}
        {isRecordsFetching && (
          <div
            style={{
              position: 'absolute',
              top: '40px', // Below the header
              left: '0',
              right: '0',
              bottom: '0',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <div className="flex items-center justify-center gap-3 bg-white px-6 py-4 rounded-lg shadow-md border border-gray-200">
              <Spinner size={24} color="#4A90E2" />
              <span className="text-sm text-gray-700 font-medium">
                Loading data...
              </span>
            </div>
          </div>
        )}
        
      </div>

      {/* Add Row Button */}
      {columns.length > 0 && (
        <button 
          className="flex items-center gap-2 px-2 py-1 border-b border-r border-border-default bg-white hover:bg-[#f8f8f8] h-8 text-sm text-gray-600 hover:text-gray-800 cursor-pointer w-full"
          style={{
            width: table.getCenterTotalSize(),
          }}
          onClick={handleAddRowClick}
        >
          <Plus size={14} className="flex flex-none" />
        </button>
      )}

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

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={showAddColumnModal}
        onClose={handleCloseAddColumnModal}
        onCreateField={handleCreateField}
        position={{ 
          top: 32,
          left: table.getCenterTotalSize() - 188 // Position relative to table width, adjust for modal width
        }}
        existingColumnNames={columns.map(col => col.name)}
      />

    </div>
  );
}