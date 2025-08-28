"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction
} from "react";
import { api } from "~/trpc/react";
import { TableHeader } from "./TableHeader";
import { MemoEditableCell } from "./EditableCell";
import { RowNumberHeader } from "./RowNumberHeader";
import Spinner from "../../icons/Spinner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AddColumnModal } from "../modals/AddColumnModal";
import Plus from "../../icons/Plus";
import { CellContextMenu } from "../modals/CellContextMenu";

import type { Column, Cell, Row as _Record } from "@prisma/client";
import {
  useReactTable,
  type ColumnDef,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnSizingState,
} from "@tanstack/react-table";

import {
  keepPreviousData,
} from "@tanstack/react-query";

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
  isApplyingFiltersOrSorts?: boolean;
  onRecordCountChange?: (count: number) => void;
  onBulkOperationStart?: (updateRecordCount: (additionalRows: number) => void) => void;
  records: _Record[];
  setRecords: Dispatch<SetStateAction<_Record[]>>;
  columns: Column[];
  setColumns: Dispatch<SetStateAction<Column[]>>;
  onDataTableReady?: (handlers: {
    handleCreateRow: () => Promise<void>;
  }) => void;
}
export function DataTable({ 
  tableId, 
  hiddenColumns = new Set(), 
  sortRules = [], 
  filterRules = [], 
  searchResults = [], 
  currentSearchIndex = -1, 
  searchQuery: searchValue = "", 
  scrollToRowId,  
  onRecordCountChange,
  onBulkOperationStart,
  records,
  setRecords, //set local records state (local = optimistic updates)
  columns,
  setColumns, //set local columns state 
  onDataTableReady,
}: DataTableProps) {
  
  const [cells, setCells] = useState<Cell[]>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{rowId: string, columnId: string} | null>(null);
  const [navigatedCell, setNavigatedCell] = useState<{rowIndex: number, columnIndex: number} | null>(null);
  const editedCellValuesRef = useRef<Map<string, string>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    rowId: string;
  } | null>(null);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localRecordCount, setLocalRecordCount] = useState(0);
  const optimisticRowIdsRef = useRef<Set<string>>(new Set());
  const rowUiKeyRef = useRef<Map<string, string>>(new Map());
  const columnUiKeyRef = useRef<Map<string, string>>(new Map());

const pendingRowIdsRef = useRef<Set<string>>(new Set());
const pendingColumnIdsRef = useRef<Set<string>>(new Set());

const getRowUiKey = (rowId: string) => rowUiKeyRef.current.get(rowId) ?? rowId;
const getColUiKey = (colId: string) => columnUiKeyRef.current.get(colId) ?? colId;
const stableCellKey = (rowId: string, colId: string) => `${getRowUiKey(rowId)}::${getColUiKey(colId)}`;


const cellRenderKey = (rowId: string, columnId: string) => {
  const rk = rowUiKeyRef.current.get(rowId) ?? rowId;
  const ck = columnUiKeyRef.current.get(columnId) ?? columnId;
  return `${rk}-${ck}`;
};

  //fresh snapshots:
  const recordsRef = useRef(records);
useEffect(() => { recordsRef.current = records; }, [records]);

const columnsRef = useRef(columns);
useEffect(() => { columnsRef.current = columns; }, [columns]);


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

  const flushRow = async (rowId: string) => {
  // only flush into columns that are already real
  const work: Promise<unknown>[] = [];
  for (const col of columnsRef.current) {
    if (pendingColumnIdsRef.current.has(col.id)) continue;
    const k = stableCellKey(rowId, col.id);
    const v = editedCellValuesRef.current.get(k);
    if (v != null) {
      work.push(updateCellMutation.mutateAsync({
        rowId, columnId: col.id, value: { text: v }
      }));
    }
  }
  await Promise.all(work);
};

const flushColumn = async (colId: string) => {
  // only flush into rows that are already real
  const work: Promise<unknown>[] = [];
  for (const r of recordsRef.current) {
    if (pendingRowIdsRef.current.has(r.id)) continue;
    const k = stableCellKey(r.id, colId);
    const v = editedCellValuesRef.current.get(k);
    if (v != null) {
      work.push(updateCellMutation.mutateAsync({
        rowId: r.id, columnId: colId, value: { text: v }
      }));
    }
  }
  await Promise.all(work);
};

  // Ref to track focus timeout to avoid multiple simultaneous focuses
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to prevent navigation immediately after clicking
  const lastClickTimeRef = useRef<number>(0);
  
  // Add Column Modal state
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);

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
    refetch: refetchRecords,
  } = api.table.getTableData.useInfiniteQuery(
    {
      tableId: tableId,
      limit: PAGE_LIMIT,
      sortRules: sortRules.map(rule => ({
        columnId: rule.columnId,
        direction: rule.direction
      })),
      filterRules: filterRules,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    }
  );

  //this get called when first table load, or when we invalidate if we want

  // Flatten all records from pages
  const allRecords = useMemo(() => {
    return tableRecords?.pages.flatMap((page) => page.rows) ?? [];
  }, [tableRecords]);

// Updated useEffect for syncing with tableRecords
useEffect(() => {
  if (!tableRecords) return;

  const serverRecords = allRecords;
  const serverCells = allRecords.flatMap(r => r.cells);
  const serverColumns = tableRecords?.pages[0]?.columns ?? [];
  
  // Preserve both optimistic columns AND their edited values
  setColumns(prev => {
    const serverColumnIds = new Set(serverColumns.map(c => c.id));
    const optimisticColumns = prev.filter(c => 
      pendingColumnIdsRef.current.has(c.id) && !serverColumnIds.has(c.id)
    );
    return [...serverColumns, ...optimisticColumns];
  });

  // Update records - preserve optimistic ones
   setRecords(prev => {
    const serverIds = new Set(serverRecords.map(r => r.id));
    const carry = prev.filter(
      r => r.tableId === tableId && !serverIds.has(r.id)
    );
    
    const next = [...carry, ...serverRecords];
    recordsRef.current = next;
    return next;

  });

  setCells(prev => {
  type CellWithColumn = Cell & { column: Column };

  // Fast lookups
  const colById = new Map(columnsRef.current.map(c => [c.id, c]));
  const serverCellsWithColumn: CellWithColumn[] = serverCells.map((c) => {
    // If Prisma already included the relation, keep it; otherwise attach from map
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const col = (c as any).column ?? colById.get(c.columnId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!col) return { ...(c as any), column: { name: "", id: c.columnId, tableId, type: "TEXT", order: 0, width: 179 } } as CellWithColumn; // fallback to satisfy TS, but ideally never hits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    return { ...(c as any), column: col } as CellWithColumn;
  });

  const serverCellMap = new Map<string, CellWithColumn>(
    serverCellsWithColumn.map(c => [`${c.rowId}-${c.columnId}`, c])
  );
  const prevMap = new Map<string, CellWithColumn>(
    (prev as CellWithColumn[]).map(c => [`${c.rowId}-${c.columnId}`, c])
  );

  const synthesized: CellWithColumn[] = [];

  const rows = recordsRef.current;
  const cols = columnsRef.current;

  for (const row of rows) {
    for (const col of cols) {
      const presentKey = `${row.id}-${col.id}`;      // server identity
      if (serverCellMap.has(presentKey)) continue;   // server already has it

      //if a local cell already exists from the previous synth, keep the cell, regardless of pending draft
      const existingCell = prevMap.get(presentKey);
      if (existingCell) {synthesized.push(existingCell); continue;} 

      //only when we don't have local cell, decide whether to create one
      const draftKey = stableCellKey(row.id, col.id); // UI-stable draft key
      const hasDraft = editedCellValuesRef.current.has(draftKey);
      const isPending =
        pendingRowIdsRef.current.has(row.id) ||
        pendingColumnIdsRef.current.has(col.id);

      if (!isPending && !hasDraft) continue;


        synthesized.push({
          id: `synthetic-${presentKey}`,   // deterministic (no flicker/remount)
          rowId: row.id,
          columnId: col.id,
          value: hasDraft
            ? { text: editedCellValuesRef.current.get(draftKey)! }
            : { text: "" },
          column: colById.get(col.id)!,
        });
      }
    }


  // Merge: server wins; add synthesized only for missing pairs
  const merged: CellWithColumn[] = [...serverCellsWithColumn];
  const mergedKeys = new Set(merged.map(c => `${c.rowId}-${c.columnId}`));
  for (const c of synthesized) {
    const k = `${c.rowId}-${c.columnId}`;
    if (!mergedKeys.has(k)) merged.push(c);
  }
  return merged;
});
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [tableId, tableRecords, allRecords]); //if i add records and columns, maximum depth reached error appears

  //update records count: 
  useEffect(() => {
  const newCount = records.length;
  setLocalRecordCount(newCount);
  if (onRecordCountChange) {
    onRecordCountChange(newCount);
  }
}, [records.length, onRecordCountChange]);

const updateCellMutation = api.cell.update.useMutation();
  
const handleCellValueChange = useCallback((rowId: string, columnId: string, value: string) => {
    const key = stableCellKey(rowId, columnId);
    editedCellValuesRef.current.set(key, value);
    //let Editable Cell handle debounced state
    setUpdateTrigger(prev => prev + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Updated rowData to handle missing cells gracefully
const rowData = useMemo(() => {
  const map: Record<string, TableRow> = {};
  
  // Initialize rows
  for (const r of records) {
    map[r.id] = { id: r.id, __cellIds: {} };
  }

  // Process actual cells
  for (const c of cells) {
    const row = map[c.rowId];
    if (!row) continue;

    row.__cellIds[c.columnId] = c.id;
    const editKey = stableCellKey(c.rowId, c.columnId);

    if (editedCellValuesRef.current.has(editKey)) {
      row[c.columnId] = editedCellValuesRef.current.get(editKey)!;
    } else {
      const v = c.value as { text?: string; number?: number | null } | string | number | null;
      row[c.columnId] = v && typeof v === "object" && "text" in v
        ? v.text ?? ""
        : v && typeof v === "object" && "number" in v
        ? (v.number != null ? String(v.number) : "")
        : typeof v === "string" || typeof v === "number"
        ? String(v)
        : "";
    }
  }

  // Synthesize missing cells for optimistic columns
  Object.values(map).forEach(row => {
    columns.forEach(col => {
      if (!(col.id in row)) {
        const editKey = stableCellKey(row.id, col.id);
        // Check if we have an edited value for this missing cell
        if (editedCellValuesRef.current.has(editKey)) {
          row[col.id] = editedCellValuesRef.current.get(editKey)!;
          row.__cellIds[col.id] = `synthetic-${row.id}-${col.id}`;
        } else {
          row[col.id] = "";
          row.__cellIds[col.id] = `synthetic-${row.id}-${col.id}`;
        }
      }
    });
  });

  return Object.values(map);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [records, cells, columns]);


  const createColumnMutation = api.column.create.useMutation(
    {
      onSuccess: async() => {
        console.log("column created");
      },
      onError: async() => {
      //await refetch();
    }
    }
  );

  const createRowMutation = api.row.create.useMutation({
    onSuccess: async() => {
      console.log("row created");
    },
    onError: async() => {
      //await refetch();
    }
  });

  const insertRowAboveMutation = api.row.insertAbove.useMutation({
    onSuccess: async() => {
      console.log("above row created.")
    },
    onError: async() => {
      //await refetch();
    }
  });

  const insertRowBelowMutation = api.row.insertBelow.useMutation({
    onSuccess: async() => {
      console.log("row below created");
    },
    onError: async() => {
     // await refetch();
    }
  });

  const deleteRowMutation = api.row.delete.useMutation({
    onSuccess: async() => {
      console.log("row deleted.");
    },
    onError: async() => {
      //await refetch();
    }
  });
  
  const renameColumnMutation = api.column.rename.useMutation({
    onSuccess: async() => {
      console.log("row deleted.");
    },
    onError: async() => {
      //await refetch();
    }
  });

  const deleteColumnMutation = api.column.delete.useMutation({
    onSuccess: async() => {
      console.log("row deleted.");
    },
    onError: async() => {
      //await refetch();
    }
  });

  const handleCreateColumn = useCallback(async(name:string, type: 'TEXT' | 'NUMBER') => {
    try{
      const tempColId = crypto.randomUUID();

      pendingColumnIdsRef.current.add(tempColId);

      columnUiKeyRef.current.set(tempColId, tempColId);

      const tempColumn: Column = {
        tableId: tableId,
        type: type,
        name: name,
        id: tempColId, 
        order: columns.length,
        width: 179     
      };

      setColumns((old) => {
        const next = [...old, tempColumn];
        columnsRef.current = next;
        return next;
      }); //optimistically add columns
    
      const tempCells = records.map((row) => ({
        id: crypto.randomUUID(),
        rowId: row.id,
        columnId: tempColId, 
        value: { text: ""},
      }));
    
      setCells((old) => [...old, ...tempCells]);

      //problem is edits happen between here

      //create mutation calls -> reset all cells
      //is it because setColumns was called?

      // Pass the ID to the server //create actual column and when create, invalidate
      try {
      await createColumnMutation.mutateAsync({
        tableId: tableId,
        type: type,
        name: name,
        id: tempColId, 
      });
    } finally {
      pendingColumnIdsRef.current.delete(tempColId);
      void flushColumn(tempColId);
    }

      setUpdateTrigger(prev => prev + 1);

    } catch (error) {
      // Column creation failed - optimistic update will be reverted by server state
      console.error("Failed to create column:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },  [columns, tableId, records]);

  const handleCreateRow = useCallback(async() => {
      const tempRowId = crypto.randomUUID();

      rowUiKeyRef.current.set(tempRowId, tempRowId);
      pendingRowIdsRef.current.add(tempRowId)

      const tempRow: _Record = {
        id: tempRowId,
        tableId: tableId,
        order: records.length
      };
      setRecords((old) => {
        const next = [...old, tempRow];
        recordsRef.current = next;
        return next;
      }) //add temp row to local state to display immediately

       if (onRecordCountChange) {
        onRecordCountChange(records.length + 1);
      }

      optimisticRowIdsRef.current.add(tempRowId);

      const newCells = columns.map(col => ({
      id: crypto.randomUUID(), // local id
      rowId: tempRowId,
      columnId: col.id,
      value: { text: "" },
      tableId,
    }));
    setCells(old => [...old, ...newCells]); //optimistically add cells for edit, if i stop here, nothing disappears

    //but then , if i want the cells to actually be saved, we need a real record
    //so what if I just create a record and does not invalidate?

   
    try{
      await createRowMutation.mutateAsync({
        id: tempRowId,
        tableId: tableId, 
      });
    } catch (error) {
      console.error("Failed to create row:", error);
    
      
      setRecords(old => old.filter(r => r.id !== tempRowId));
      setCells(old => old.filter(c => c.rowId !== tempRowId));
      
      if (onRecordCountChange) {
        onRecordCountChange(records.length);
      }
      }

      finally {
        pendingRowIdsRef.current.delete(tempRowId);
        void flushRow(tempRowId);
      }
      setUpdateTrigger(prev => prev + 1);
      //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [records.length, columns, tableId]);


    useEffect(() => {
  if (!onDataTableReady) return;
  onDataTableReady({ handleCreateRow });
}, [onDataTableReady, handleCreateRow]);


  //handle insert above/below, delete, rename
   const handleInsertRowAbove = async(targetRowId: string) => {
    try {
      const targetRow = records.find(r => r.id === targetRowId);
      if (!targetRow) return;

      const tempRowId = crypto.randomUUID();

      pendingRowIdsRef.current.add(tempRowId);
      rowUiKeyRef.current.set(tempRowId, tempRowId);

      const newOrder = targetRow.order;

      // Update orders for existing rows optimistically
      const updatedRecords = records.map(r => 
        r.order >= newOrder ? { ...r, order: r.order + 1 } : r
      );

      

      // Create new row
      const newRow: _Record = {
        id: tempRowId,
        tableId: tableId,
        order: newOrder
      };

      // Add new row and sort
      setRecords((old) => {
        const next = [...updatedRecords, newRow].sort((a, b) => a.order - b.order)
        recordsRef.current = next;
        return next;
      });

       if (onRecordCountChange) {
        onRecordCountChange(records.length + 1);
      }

      // Create cells for new row
      const newCells = columns.map(col => ({
        id: crypto.randomUUID(),
        rowId: tempRowId,
        columnId: col.id,
        value: { text: "" },
        tableId,
      }));
      setCells(old => [...old, ...newCells]);


      try {
        await insertRowAboveMutation.mutateAsync({
          tableId: tableId,
          targetRowId: targetRowId,
          id: tempRowId // Pass the temp ID to maintain consistency
      });
    } finally {
        pendingRowIdsRef.current.delete(tempRowId);
        void flushRow(tempRowId);
    };
      

      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to insert row above:', error);
      // Revert optimistic update on error
      await refetch();
    }
  }

  const handleInsertRowBelow = async(targetRowId: string) => {
    try {
      const targetRow = records.find(r => r.id === targetRowId);
      if (!targetRow) return;

      const tempRowId = crypto.randomUUID();
      const newOrder = targetRow.order + 1;

      pendingRowIdsRef.current.add(tempRowId);
      rowUiKeyRef.current.set(tempRowId, tempRowId);

      // Update orders for existing rows optimistically
      const updatedRecords = records.map(r => 
        r.order >= newOrder ? { ...r, order: r.order + 1 } : r
      );

      // Create new row
      const newRow: _Record = {
        id: tempRowId,
        tableId: tableId,
        order: newOrder
      };

      // Add new row and sort
      setRecords((old) => {
        const next = [...updatedRecords, newRow].sort((a, b) => a.order - b.order)
        recordsRef.current = next;
        return next;
    });

       if (onRecordCountChange) {
        onRecordCountChange(records.length + 1);
      }
      // Create cells for new row
      const newCells = columns.map(col => ({
        id: crypto.randomUUID(),
        rowId: tempRowId,
        columnId: col.id,
        value: { text: "" },
        tableId,
      }));
      setCells(old => [...old, ...newCells]);

      // Call parent mutation if provided, otherwise use local mutation

      try {await insertRowBelowMutation.mutateAsync({
        tableId: tableId,
        targetRowId: targetRowId,
        id: tempRowId
      });
    } finally {
        pendingRowIdsRef.current.delete(tempRowId);
        void flushRow(tempRowId);
    };

      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to insert row below:', error);
      await refetch();
    }
  }

  const handleDeleteRow = async(rowId: string) => {
    try {
      const targetRow = records.find(r => r.id === rowId);
      if (!targetRow) return;

      const deletedOrder = targetRow.order;

      // Remove row and update orders optimistically
      const updatedRecords = records
        .filter(r => r.id !== rowId)
        .map(r => r.order > deletedOrder ? { ...r, order: r.order - 1 } : r);

      setRecords(updatedRecords);

      if (onRecordCountChange) {
        onRecordCountChange(updatedRecords.length);
      }

      // Remove cells for deleted row
      setCells(old => old.filter(c => c.rowId !== rowId));


      await deleteRowMutation.mutateAsync({
        tableId: tableId,
        rowId: rowId
      });

      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to delete row:', error);
      await refetch();
    }
  }

  const handleRenameColumn = async(columnId: string, newName: string) => {
    try {

      // Optimistically update column name
      setColumns(old => old.map(col => 
        col.id === columnId ? { ...col, name: newName } : col
      ));


      await renameColumnMutation.mutateAsync({
        columnId: columnId,
        name: newName
      });

      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to rename column:', error);
      await refetch();
    }
  }

  const handleDeleteColumn = async(columnId: string) => {
    try {

      // Optimistically remove column
      setColumns(old => old.filter(col => col.id !== columnId));

      // Remove cells for deleted column
      setCells(old => old.filter(c => c.columnId !== columnId));


      await deleteColumnMutation.mutateAsync({
        columnId: columnId
      });
      

      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to delete column:', error);
      await refetch();
    }
  }


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



  // Update record count callback - use total count from tableData instead of paginated records
  useEffect(() => {
    if (onRecordCountChange && tableData?._count?.rows !== undefined) {
      onRecordCountChange(tableData._count.rows);
    }
  }, [tableData?._count?.rows, onRecordCountChange]);

  // Helper function for optimistic record count updates during bulk operations
  const updateRecordCountOptimistically = useCallback((additionalRows: number) => {
    if (onRecordCountChange && tableData?._count?.rows !== undefined) {
      const newCount = tableData._count.rows + additionalRows;
      onRecordCountChange(newCount);
    }
  }, [onRecordCountChange, tableData?._count?.rows]);

  // Provide the optimistic update function to parent component
  useEffect(() => {
    if (onBulkOperationStart) {
      onBulkOperationStart(updateRecordCountOptimistically);
    }
  }, [onBulkOperationStart, updateRecordCountOptimistically]);

  // Reference to the scrolling container
  const tableContainerRef = useRef<HTMLDivElement>(null);


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
  }, [columns, records.length, hiddenColumns]);

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
    //eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const cellInput = document.querySelector(
      `input[data-cell-id="${targetRowId}-${targetColumnId}"]`
    ) as HTMLInputElement | null;
    if (cellInput) {
      cellInput.focus({ preventScroll: true });
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

    const { rowIndex, columnIndex } = navigatedCell;

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
    event.stopPropagation();

    const rect = tableContainerRef.current?.getBoundingClientRect();

    setContextMenu({
      isOpen: true,
      position: { 
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),  
       },
      rowId,
    });
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

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

    
    const tableColumns: ColumnDef<TableRow, string | undefined>[] = visibleColumns.map((column, _columnIndex) =>
      columnHelper.accessor(column.id, {
        id: column.id,
        header: column.name,
        size: 179, // Fixed width for all columns
        cell: (info) => {
          const value = info.getValue()!;
          const row = info.row.original;

          const rowId = row.id;
          const columnId = column.id;

          
     const renderKey = cellRenderKey(rowId, columnId);
     const canPersist =
       !pendingRowIdsRef.current.has(rowId) &&
       !pendingColumnIdsRef.current.has(columnId);
          
          const matchKey = `${rowId}-${columnId}`;
          const isSearchMatch = searchMatchInfo.cellMatches.has(matchKey);
          const isCurrentSearchResult = searchMatchInfo.currentResult === matchKey;
          const hasSort = sortRules.some(rule => rule.columnId === columnId);
          const hasFilter = filterRules.some(rule => rule.columnId === columnId);

          return (
            <MemoEditableCell
              key={renderKey} // Stable key to preserve cell state
              _tableId={tableId}
              initialValue={value ?? ""}
              onSelect={() => handleCellSelection(rowId, columnId)}
              onDeselect={handleCellDeselection}
              rowId={rowId}
              columnId={columnId}
              onContextMenu={handleContextMenuClick}
              onValueChange={handleCellValueChange}
              hasSort={hasSort}
              hasFilter={hasFilter}
              isSearchMatch={isSearchMatch}
              isCurrentSearchResult={isCurrentSearchResult}
              columnType={column.type}
              canPersist={canPersist}
            />
          );
        },
      })
    );

    // Combine row number column with data columns
    const allColumns = [rowNumberColumn, ...tableColumns];

    //

    return {
      columns: allColumns,
      data: rowData, //uses this so that it merges record and cells in render time, whereas if separate, cells get rendered after.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, cells, columns, selectedRows, hoveredRowIndex, hiddenColumns, searchMatchInfo]);

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
    autoResetAll: false,
    autoResetPageIndex: false,
    autoResetExpanded: false,
  });


  
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

  // Handlers for table interaction

  const { rows } = table.getRowModel();

  // Setup virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 32, // Estimate row height (32px to match our h-8 class)
    getScrollElement: () => tableContainerRef.current,
    overscan: 24 // Optimized for better performance and smoother scrolling
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

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
  const endIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;
  const loaded = tableRecords?.pages.flatMap(p => p.rows).length ?? 0;

  if (!hasNextPage || isFetchingNextPage || !endIndex) return;

  if (endIndex >= records.length -1 ) 
  {
    
      void fetchNextPage();
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [virtualItems, hasNextPage, isFetchingNextPage, records]);



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
      onFocus={(e) => {

        //prevent jumping to row 0
        if (e.target !== e.currentTarget) return;
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
          style={{ display: 'grid', width: '100%' }}
        >
          <TableHeader
            table={table}
            tableColumns={columns}
            onColumnAction={handleColumnAction}
            onAddColumnClick={handleAddColumnClick}
          />
          <tbody
            style={{
              display: 'grid',
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              
              if (!row) return null; //removed skeleton rows.

              const stableRowKey = rowUiKeyRef.current.get(row?.original?.id) ?? row?.original?.id;
              

              return (
                <tr
                  data-index={virtualRow.index}
                  key={stableRowKey}
                  className="group border-b border-border-default hover:bg-[#f8f8f8] bg-white"
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                    willChange: 'transform',
                    width: table.getCenterTotalSize(),
                    height: `${virtualRow.size}px`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => {

                    const stableColKey = columnUiKeyRef.current.get(cell.column.id) ?? cell.column.id;
                    const tdKey = `${stableRowKey}-${stableColKey}`
                    return (
                    <td
                      key={tdKey}
                      className="p-0 h-8 border-r border-border-default relative"
                      style={{
                        display: 'flex',
                        width: cell.column.getSize(),
                        alignItems: 'center',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        

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
          onClick={handleCreateRow}
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
        onRename={handleRenameColumn}
        onDelete={handleDeleteColumn}
      />

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={showAddColumnModal}
        onClose={handleCloseAddColumnModal}
        onCreateField={handleCreateColumn}
        position={{ 
          top: 32,
          left: table.getCenterTotalSize() - 188 // Position relative to table width, adjust for modal width
        }}
        existingColumnNames={columns.map(col => col.name)}
      />

  
    {/* Context Menu - rendered outside all containers to avoid positioning issues */}
    {contextMenu && (
      <CellContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={handleContextMenuClose}
        onInsertRowAbove={() => handleInsertRowAbove(contextMenu.rowId)}
        onInsertRowBelow={() => handleInsertRowBelow(contextMenu.rowId)}
        onDeleteRow={() => handleDeleteRow(contextMenu.rowId)}
      />
    )}

    </div>
  );
}