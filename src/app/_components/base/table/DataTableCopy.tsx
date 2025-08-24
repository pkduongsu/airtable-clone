"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { api } from "~/trpc/react";
import { TableHeader } from "./TableHeader";
import { EditableCell } from "./EditableCell";
import { TableControls } from "./TableControls";
import { RowNumberHeader } from "./RowNumberHeader";
import Spinner from "../../icons/Spinner";
import { useVirtualizer } from "@tanstack/react-virtual";

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

const FAKER_RECORDS_COUNT = 5000;
const FETCH_RECORD_LIMIT = 100;



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
}

const isFiltering = (
  colId1: string,
  colId2: string,
  filter: string,
  filterValue: string
) => {
  const matchesColId = colId1 === colId2;
  switch (filter) {
    case "contains":
    case "does not contain":
    case "is":
    case "is not":
      return matchesColId && filterValue !== "";
    case "is empty":
    case "is not empty":
      return matchesColId;
    default:
      return false;
  }
};

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
  isApplyingFiltersOrSorts = false
}: DataTableProps) {
  const utils = api.useUtils();
  
  // Extract parameters from props to match Table.tsx pattern
  const currentView = "";

  // State management like Table.tsx
  const [records, setRecords] = useState<_Record[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
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
      limit: FETCH_RECORD_LIMIT,
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

    // Debug logging
    console.log('SearchMatchInfo Update:', {
      searchResultsLength: searchResults.length,
      currentSearchIndex,
      cellMatchesSize: cellMatches.size,
      currentResult,
      currentSearchResult: searchResults[currentSearchIndex],
      currentSearchResultDetails: searchResults[currentSearchIndex] ? {
        type: searchResults[currentSearchIndex].type,
        rowId: searchResults[currentSearchIndex].rowId?.slice(-8),
        columnId: searchResults[currentSearchIndex].columnId?.slice(-8),
        name: searchResults[currentSearchIndex].name,
      } : null,
      searchResults: searchResults.slice(0, 5), // First 5 results
    });

    return { cellMatches, currentResult };
  }, [searchResults, currentSearchIndex]);

  // Handle cell selection
  const handleCellSelection = useCallback((rowIndex: number, columnIndex: number) => {
    setSelectedCell({ rowIndex, columnIndex });
    setFocusedCell({ rowIndex, columnIndex });
  }, []);

  // Handle cell deselection
  const handleCellDeselection = useCallback(() => {
    setSelectedCell(null);
    setFocusedCell(null);
  }, []);

  // Handle cell navigation
  const handleCellNavigation = useCallback((direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right', currentRowIndex: number, currentColumnIndex: number) => {
    if (!records || !columns) return;
    
    const maxRowIndex = records.length - 1;
    const visibleColumnCount = columns.filter(column => !hiddenColumns.has(column.id)).length;
    const maxColumnIndex = visibleColumnCount - 1;
    
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
      setFocusedCell({ rowIndex: newRowIndex, columnIndex: newColumnIndex });
    }
  }, [records?.length, columns, hiddenColumns]);

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
        // Start editing on any printable character
        setFocusedCell(selectedCell);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, handleCellNavigation, handleCellDeselection]);


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
    const visibleColumns = columns.filter(column => !hiddenColumns.has(column.id));
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
          
          // Debug current search result highlighting
          if (isCurrentSearchResult) {
            console.log(`Current search result cell: ${matchKey}`, {
              rowId: row.id,
              columnId: column.id,
              isSearchMatch,
              isCurrentSearchResult
            });
          }

          return (
            <EditableCell
              key={`${row.id}-${column.id}`} // Stable key for React tracking
              tableId={tableId}
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
              searchQuery={searchValue}
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
  }, [records, cells, columns, selectedRows, hoveredRowIndex, hiddenColumns, searchMatchInfo, ]);

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

  // Handlers will be managed by existing TableControls components

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

      {/* Table Controls */}
      {columns.length > 0 && (
        <TableControls
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
          tableTotalWidth={table.getCenterTotalSize()}
        />
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

    </div>
  );
}