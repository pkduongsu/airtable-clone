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
import { useVirtualizer, type Virtualizer} from "@tanstack/react-virtual";
import { AddColumnModal } from "../modals/AddColumnModal";
import Plus from "../../icons/Plus";
import { CellContextMenu } from "../modals/CellContextMenu";
import { MemoizedTableRow } from "./MemoizedTableRow";

import type { Column, Cell, Row as _Record } from "@prisma/client";
import {
  useReactTable,
  type ColumnDef,
  getCoreRowModel,
  createColumnHelper,
  type ColumnSizingState,
} from "@tanstack/react-table";


import {
  keepPreviousData,
} from "@tanstack/react-query";

import { type SortRule } from "../modals/SortModal";
import { ColumnContextMenuModal } from "../modals/ColumnContextMenuModal";
import { fakeFor } from "~/lib/fakeFor";

const PAGE_LIMIT = 200;

const ROW_H = 32;
const BELT_BEHIND = 8;   // viewports kept loaded above viewport (increased for smoother scrolling)
const BELT_AHEAD  = 10;  // viewports kept loaded below viewport (increased for predictive loading)
const MAX_WINDOW  = 250; // reduced from 500 for faster queries
const SMALL_TABLE_THRESHOLD = 1000; // Tables smaller than this load all data, no sparse loading
const OVERSCAN_MULTIPLIER = 8; // increased for better prefetching
const LOADING_DEBOUNCE_MS = 25; // reduced from 100ms for faster response
const PRIORITY_LOADING_DEBOUNCE_MS = 5; // immediate loading for visible skeleton rows

  type FilterRule = {
    id: string;
    columnId: string;
    columnType: 'TEXT' | 'NUMBER';
    operator: 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals' | 'greater_than' | 'less_than';
    value?: string | number;
    logicOperator?: 'and' | 'or';
  };


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
    logicOperator?: 'and' | 'or';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EMPTY_CELL_MAP = useMemo(() => new Map<string, { id: string; value: any }>(), []);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{rowId: string, columnId: string} | null>(null);
  const [navigatedCell, setNavigatedCell] = useState<{rowIndex: number, columnIndex: number} | null>(null);
  const editedCellValuesRef = useRef<Map<string, string>>(new Map());
  // Removed updateTrigger state - using targeted memoization instead
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    rowId: string;
  } | null>(null);
  // Removed unused localRecordCount state
  const optimisticRowIdsRef = useRef<Set<string>>(new Set());
  const rowUiKeyRef = useRef<Map<string, string>>(new Map());
  const columnUiKeyRef = useRef<Map<string, string>>(new Map());

  const pendingRowIdsRef = useRef<Set<string>>(new Set());
  const pendingColumnIdsRef = useRef<Set<string>>(new Set());

  const cellsRef = useRef<Cell[]>([]);

  const getRowUiKey = (rowId: string) => rowUiKeyRef.current.get(rowId) ?? rowId;
  const getColUiKey = (colId: string) => columnUiKeyRef.current.get(colId) ?? colId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCellKey = (rowId: string, colId: string) => `${getRowUiKey(rowId)}::${getColUiKey(colId)}`;

  const getDraftValue = useCallback((rowId: string, colId: string) => {
  return editedCellValuesRef.current.get(stableCellKey(rowId, colId));
}, [stableCellKey]);

  const isSavingCell = useCallback((rowId: string, colId: string) => {
    return savingCellsRef.current.has(stableCellKey(rowId, colId));
  }, [stableCellKey]);

  const pendingSearchScrollRef = useRef<{ rowId: string; columnId?: string } | null>(null);

  const lastScrollTargetRef = useRef<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');

  const cellRenderKey = (rowId: string, columnId: string) => {
    const rk = rowUiKeyRef.current.get(rowId) ?? rowId;
    const ck = columnUiKeyRef.current.get(columnId) ?? columnId;
    return `${rk}-${ck}`;
  };

  const trpc = api.useUtils();
  const savingCellsRef = useRef<Set<string>>(new Set());

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

useEffect(() => { cellsRef.current = cells; }, [cells]); //update current edited cells

  // Ref to track focus timeout to avoid multiple simultaneous focuses
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to prevent navigation immediately after clicking
  const lastClickTimeRef = useRef<number>(0);
  
  // Add Column Modal state
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);

  const hasActiveFilterOrSort =
  (sortRules?.length ?? 0) > 0 || (filterRules?.length ?? 0) > 0;

  const hasActiveSearch = !!searchQuery && searchQuery.trim().length > 0;

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

    const [uiRecordCount, setUiRecordCount] = useState<number>(tableData?._count?.rows ?? 0);

  const cellsByRow = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byRow = new Map<string, Map<string, { id: string; value: any }>>();
    for (const c of cells) {
      let m = byRow.get(c.rowId);
      if (!m) { m = new Map(); byRow.set(c.rowId, m); }
      m.set(c.columnId, { id: c.id, value: c.value });
    }
    return byRow;
  }, [cells]);
  
    useEffect(() => {
  setUiRecordCount(tableData?._count?.rows ?? 0);
}, [tableData?._count?.rows]);
      // Records query with infinite data 
  const {
    data: tableRecords,
    isFetching: isRecordsFetching,
    refetch: refetchRecords,
    hasNextPage,
    fetchNextPage,
  } = api.table.getTableData.useInfiniteQuery(
    {
      tableId: tableId,
      limit: PAGE_LIMIT,
      sortRules,
      filterRules: filterRules,
      globalSearch: searchQuery ?? "",
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
      placeholderData: (hasActiveFilterOrSort || hasActiveSearch) ? undefined : keepPreviousData,
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
  
  const serverIds = new Set(serverColumns.map((c: Column) => c.id));
  const optimistic = columnsRef.current.filter(
    (c: Column) => pendingColumnIdsRef.current.has(c.id) && !serverIds.has(c.id)
  );
  const nextColumns: Column[] = [...serverColumns, ...optimistic];

  setColumns(nextColumns);
  columnsRef.current = nextColumns;


  // Update records - preserve optimistic ones
   setRecords(prev => {
    const serverIds = new Set(serverRecords.map(r => r.id));

    //check if filter/sorts are active:
    const hasActiveFilterOrSortOrSearch =
  (filterRules?.length ?? 0) > 0 ||
  (sortRules?.length ?? 0) > 0 ||
  (searchQuery?.trim().length ?? 0) > 0;

   const carry = hasActiveFilterOrSortOrSearch
  // when filtering/sorting/searching: ONLY keep optimistic rows we just created
  ? prev.filter(r => pendingRowIdsRef.current.has(r.id))
  // otherwise: keep previous non-duplicate local rows
  : prev.filter(r => r.tableId === tableId && !serverIds.has(r.id));

    
    const next = [...carry, ...serverRecords];

    //if no sorts are applied, restore original order
    if (!sortRules || sortRules.length === 0) {
      next.sort((a, b) => a.order - b.order);
    }


    recordsRef.current = next;
    return next;

  });

  setCells(() => {
  type CellWithColumn = Cell & { column: Column };

  // Fast lookups
  const colById = new Map(nextColumns.map(c => [c.id, c]));
  const serverCellsWithColumn: CellWithColumn[] = serverCells
   .map((c) => {
     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
     const col = (c as any).column ?? colById.get(c.columnId);
     if (!col) return null;
     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
     return { ...(c as any), column: col } as CellWithColumn;
   })
   .filter((x): x is CellWithColumn => x !== null);

  const serverCellMap = new Map<string, CellWithColumn>(
    serverCellsWithColumn.map(c => [`${c.rowId}-${c.columnId}`, c])
  );

  const lastLocal = cellsRef.current as CellWithColumn[];

  const prevMap = new Map<string, CellWithColumn>(
    lastLocal.map(c => [`${c.rowId}-${c.columnId}`, c])
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

      if (!isPending && !hasDraft) {
      // pre-seed faker draft (deterministic)
      try {
        // Derive a deterministic seed from the stable UI keys so values don't flicker
        const seed = Math.abs(
          (getRowUiKey(row.id) + '::' + getColUiKey(col.id))
            .split('')
            .reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0)
        );

        // Use your fakeFor helper (doesn't need network)
        // NOTE: column type is available on col.type ('TEXT' | 'NUMBER')
        // If your types differ, map accordingly.
        const draft = fakeFor(col.name, col.type as 'TEXT' | 'NUMBER', seed);
        editedCellValuesRef.current.set(draftKey, String(draft));
      } catch {
        // ignore faker failures and fall back to empty
      }
    }


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


const updateCellMutation = api.cell.update.useMutation({
  onMutate: ({ rowId, columnId }) => {
    savingCellsRef.current.add(stableCellKey(rowId, columnId));
  },
  onSettled: (_data, _err, vars) => {
    if (vars) savingCellsRef.current.delete(stableCellKey(vars.rowId, vars.columnId));
  },
});
  
// Track pending cell creation to prevent duplicates
const pendingCellCreation = useRef(new Set<string>());

// Ensure cell exists for sparse data before editing
const ensureCellExists = useCallback((rowId: string, columnId: string) => {
  const cellKey = `${rowId}-${columnId}`;
  const existingCell = cells.find(c => c.rowId === rowId && c.columnId === columnId);
  
  if (!existingCell && !pendingCellCreation.current.has(cellKey)) {
    // Mark as pending to prevent duplicates
    pendingCellCreation.current.add(cellKey);
    
    // Create a synthetic cell for immediate editing
    // The actual database cell will be created by the upsert in cell.update
    const syntheticCell = {
      id: `synthetic-${cellKey}`,
      rowId,
      columnId,
      value: { text: "" }
    };
    
    setCells(prev => [...prev, syntheticCell]);
    
    // Remove from pending after a short delay
    setTimeout(() => {
      pendingCellCreation.current.delete(cellKey);
    }, 1000);
  }
}, [cells, setCells]);

const handleCellValueChange = useCallback((rowId: string, columnId: string, value: string) => {
  // Ensure cell exists before editing (important for sparse data)
  ensureCellExists(rowId, columnId);
  
  const key = stableCellKey(rowId, columnId);
  editedCellValuesRef.current.set(key, value);
  
  // Check if any loading ranges affect this row
  const record = recordsRef.current.find(r => r.id === rowId);
  if (record && typeof record.order === 'number') {
    let isInLoadingRange = false;
    for (const rangeKey of loadingRangesRef.current) {
      const parts = rangeKey.split('-');
      if (parts.length === 2) {
        const start = parseInt(parts[0]!, 10);
        const end = parseInt(parts[1]!, 10);
        if (record.order >= start && record.order <= end) {
          isInLoadingRange = true;
          break;
        }
      }
    }
    
    if (isInLoadingRange) {
      // Queue the update instead of processing immediately
      const existingQueueIndex = cellUpdateQueueRef.current.findIndex(
        update => update.rowId === rowId && update.columnId === columnId
      );
      
      const queuedUpdate = {
        rowId,
        columnId,
        value,
        timestamp: Date.now()
      };
      
      if (existingQueueIndex >= 0) {
        // Update existing queue entry
        cellUpdateQueueRef.current[existingQueueIndex] = queuedUpdate;
      } else {
        // Add new queue entry
        cellUpdateQueueRef.current.push(queuedUpdate);
      }
      
      console.log(`⏳ Queued cell update for loading range: row ${rowId}, column ${columnId}`);
      return;
    }
  }
  
  // Removed setUpdateTrigger to improve performance - memoized rows will handle updates
  // setUpdateTrigger(prev => prev + 1);
}, [ensureCellExists, stableCellKey]);

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
// Removed updateTrigger dependency for better performance
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [records, cells, columns]);

const filteredData = useMemo(() => {
  if (!filterRules?.length) return rowData;

  const colTypeById = new Map(columns.map(c => [c.id, c.type as 'TEXT' | 'NUMBER']));

  const toStr = (v: unknown) =>
    v == null ? "" : typeof v === "string" || typeof v === "number" || typeof v === "boolean"
      ? String(v) : typeof v === "object" ? JSON.stringify(v) : "";

  const matchesRule = (row: Record<string, unknown>, rule: FilterRule) => {
    const raw = toStr(row[rule.columnId]).trim();
    const type = colTypeById.get(rule.columnId) ?? 'TEXT';

    switch (rule.operator) {
      case 'is_empty':       return raw === "";
      case 'is_not_empty':   return raw !== "";
      case 'contains':       return raw.toLowerCase().includes(String(rule.value ?? "").toLowerCase());
      case 'not_contains':   return !raw.toLowerCase().includes(String(rule.value ?? "").toLowerCase());
      case 'equals':
        if (type === 'NUMBER') return Number(raw || '0') === Number(rule.value);
        return raw.toLowerCase() === String(rule.value ?? '').toLowerCase();
      case 'greater_than':   return Number(raw || '0') > Number(rule.value);
      case 'less_than':      return Number(raw || '0') < Number(rule.value);
      default:               return true;
    }
  };

  // Split into OR groups: [A, B, (or), C, D, (or), E] -> [[A,B],[C,D],[E]]
  const groups: FilterRule[][] = (() => {
    const out: FilterRule[][] = [];
    let curr: FilterRule[] = [];
    filterRules.forEach((r, i) => {
      curr.push(r);
      const isOr = r.logicOperator === 'or' && i < filterRules.length - 1;
      if (isOr) { out.push(curr); curr = []; }
    });
    if (curr.length) out.push(curr);
    return out;
  })();

  return rowData.filter(row =>
    groups.some(group => group.every(rule => matchesRule(row, rule)))
  );
}, [rowData, filterRules, columns]);

const sortedData = useMemo(() => {
  if (!sortRules?.length) return filteredData;

  const colTypeById = new Map(columns.map(c => [c.id, c.type]));

  const getComparable = (row: TableRow, colId: string) => {
    const raw = row[colId];
    const type = colTypeById.get(colId) ?? 'TEXT';

    if (type === 'NUMBER') {
      const n = Number(raw);
      // Put non-numbers at the bottom for asc, top for desc (handled via comparator sign)
      return Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n;
    }
    //eslint-disable-next-line @typescript-eslint/no-base-to-string
    return (raw ?? '').toString().toLowerCase();
  };

  const out = [...filteredData];

  out.sort((a, b) => {
    for (const rule of sortRules) {
      const av = getComparable(a, rule.columnId);
      const bv = getComparable(b, rule.columnId);
      let cmp = 0;

      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        // localeCompare with numeric handles "2" < "10" sensibly for text
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      }

      if (cmp !== 0) {
        return rule.direction === 'asc' ? cmp : -cmp;
      }
    }

    // Stable tie-breaker: original loaded order
    const ai = recordsRef.current.findIndex(r => r.id === a.id);
    const bi = recordsRef.current.findIndex(r => r.id === b.id);
    return ai - bi;
  });

  return out;
}, [filteredData, sortRules, columns]);



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

      // Removed setUpdateTrigger for performance - memoized components handle updates

    } catch (error) {
      // Column creation failed - optimistic update will be reverted by server state
      console.error("Failed to create column:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },  [columns, tableId, records]);


// compute optimistic order so that it always add the row on the bottom of the table
  const getNextGlobalRowOrder = () => {
    const serverTotal = tableData?._count?.rows ?? 0; // real total from DB
    const maxLoadedOrder =
      (allRecords?.length
        ? Math.max(...allRecords.map(r => r.order ?? -1))
        : -1) + 1; // next after highest loaded

    // also offset by how many optimistic rows you’ve added but not confirmed yet
    const optimistic = pendingRowIdsRef.current.size;
    return Math.max(serverTotal, maxLoadedOrder) + optimistic;
  };
    

  const handleCreateRow = useCallback(async() => {
      const tempRowId = crypto.randomUUID();

      rowUiKeyRef.current.set(tempRowId, tempRowId);
      pendingRowIdsRef.current.add(tempRowId)

      const tempRow: _Record = {
        id: tempRowId,
        tableId: tableId,
        order: getNextGlobalRowOrder()
      };
      setRecords((old) => {
        const next = [...old, tempRow];
        recordsRef.current = next;
        return next;
      }) //add temp row to local state to display immediately

       if (onRecordCountChange) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const base = (tableData?._count?.rows ?? recordsRef.current.length);
        setUiRecordCount(c => c + 1);
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
      const created = await createRowMutation.mutateAsync({
        id: tempRowId,
        tableId: tableId, 
      });
      setRecords(curr =>
        curr
          .map(r => (r.id === tempRowId ? { ...r, order: created.order } : r))
          .sort((a,b) => a.order - b.order)
      );
    } catch (error) {
      console.error("Failed to create row:", error);
    
      
      setRecords(old => old.filter(r => r.id !== tempRowId));
      setCells(old => old.filter(c => c.rowId !== tempRowId));
      
      if (onRecordCountChange) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const base = (tableData?._count?.rows ?? recordsRef.current.length);
        onRecordCountChange(base); // rollback to baseline
      }
      }

      finally {
        pendingRowIdsRef.current.delete(tempRowId);
        void flushRow(tempRowId);
      }
      // Removed setUpdateTrigger for performance - memoized components handle updates
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
      //eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRecords((old) => {
        const next = [...updatedRecords, newRow].sort((a, b) => a.order - b.order)
        recordsRef.current = next;
        return next;
      });

      if (onRecordCountChange) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const base = (tableData?._count?.rows ?? recordsRef.current.length);
        setUiRecordCount(c => c + 1);;
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
      

      // Removed setUpdateTrigger for performance - memoized components handle updates
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
      //eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRecords((old) => {
        const next = [...updatedRecords, newRow].sort((a, b) => a.order - b.order)
        recordsRef.current = next;
        return next;
    });

      if (onRecordCountChange) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const base = (tableData?._count?.rows ?? recordsRef.current.length);
        setUiRecordCount(c => c + 1);
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

      // Removed setUpdateTrigger for performance - memoized components handle updates
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const base = (tableData?._count?.rows ?? recordsRef.current.length + 1); // +1 to mirror the just-deleted row in local buffer
        setUiRecordCount(c => Math.max(0, c - 1));
      }

      // Remove cells for deleted row
      setCells(old => old.filter(c => c.rowId !== rowId));


      await deleteRowMutation.mutateAsync({
        tableId: tableId,
        rowId: rowId
      });

      // Removed setUpdateTrigger for performance - memoized components handle updates
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

      // Removed setUpdateTrigger for performance - memoized components handle updates
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
      

      // Removed setUpdateTrigger for performance - memoized components handle updates
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

  useEffect(() => {
    setUiRecordCount(tableData?._count?.rows ?? 0);
  }, [tableData?._count?.rows]);

  useEffect(() => {
  onRecordCountChange?.(uiRecordCount);
}, [uiRecordCount, onRecordCountChange]);


  useEffect(() => {
  const flushAllEdits = async () => {
    const work: Promise<unknown>[] = [];
    for (const [key, value] of editedCellValuesRef.current.entries()) {
      const [rk, ck] = key.split("::");
      // resolve back to real ids via your ui-key maps
      const rowId = [...recordsRef.current].find(r => (rowUiKeyRef.current.get(r.id) ?? r.id) === rk)?.id;
      const colId = [...columnsRef.current].find(c => (columnUiKeyRef.current.get(c.id) ?? c.id) === ck)?.id;
      if (!rowId || !colId) continue;
      if (pendingRowIdsRef.current.has(rowId)) continue;
      if (pendingColumnIdsRef.current.has(colId)) continue;

      work.push(updateCellMutation.mutateAsync({
        rowId, columnId: colId, value: { text: value }
      }));
    }
    await Promise.allSettled(work);
  };

  const onHide = () => { void flushAllEdits(); };
  const onPageHide = () => { void flushAllEdits(); };
  const onBeforeUnload = () => { void flushAllEdits(); };

  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onBeforeUnload);

  // Periodic cleanup of stale queued updates
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds
    cellUpdateQueueRef.current = cellUpdateQueueRef.current.filter(
      update => (now - update.timestamp) < staleThreshold
    );
  }, 10000); // Clean up every 10 seconds

  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onBeforeUnload);
    clearInterval(cleanupInterval);
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  

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

  const windowForViewport = () => {
  const h = tableContainerRef.current?.clientHeight ?? 600;
  const vh = Math.ceil(h / ROW_H);
  return Math.min(MAX_WINDOW, vh * OVERSCAN_MULTIPLIER); // e.g., 5*25 = 125 rows
};



  /////////////////////////////////////////////////
            //SEARCH LOGIC HANDLING//
  ////////////////////////////////////////////////

const matchedRowIds = useMemo(() => {
  if (!hasActiveSearch || !searchResults?.length) return null;
  const s = new Set<string>();
  for (const r of searchResults) {
    if (r.type === 'cell' && r.rowId) s.add(r.rowId);
  }
  return s;
}, [hasActiveSearch, searchResults]);

// Only show rows that matched when searching
const visibleRecords = useMemo(() => {
  if (!matchedRowIds) return records;
  return records.filter(r => matchedRowIds.has(r.id));
}, [records, matchedRowIds]);

  useEffect(() => {
  setSearchQuery(searchValue ?? "");
}, [searchValue]);

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
      maxRowIndex: visibleRecords.length - 1,
      maxColumnIndex: Math.max(0, visibleColumnCount - 1)
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, records.length, hiddenColumns]);
  

  // Handle cell selection (click)
  const handleCellSelection = useCallback((rowId: string, columnId: string) => {
    // Convert rowId/columnId back to indices for navigation consistency
    const rowIndex = visibleRecords.findIndex(record => record.id === rowId);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { columns: allColumns } = useMemo(() => {
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

        const rec = recordsRef.current.find(r => r.id === rowId);
        const absoluteIndex = typeof rec?.order === 'number' ? rec.order + 1 : rowIndex + 1;
        
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
              <span className="text-center">{absoluteIndex}</span>
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
              key={cellRenderKey(rowId, columnId)} // Stable key to preserve cell state
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, cells, columns, selectedRows, hoveredRowIndex, hiddenColumns, searchMatchInfo, sortRules, filterRules]);

  const table = useReactTable({
    data: sortedData,
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

  const visibleColumnIds = columns
  .filter(c => !hiddenColumns.has(c.id))
  .map(c => c.id);

const upsertRecords = useCallback((incoming: Array<{ id: string; order: number }>) => {
  if (!incoming?.length) return;
  
  // Progressive rendering: update records in batches for smoother UI
  const batchSize = 50;
  const batches: Array<Array<{ id: string; order: number }>> = [];
  for (let i = 0; i < incoming.length; i += batchSize) {
    batches.push(incoming.slice(i, i + batchSize));
  }
  
  const processBatch = (batchIndex: number) => {
    if (batchIndex >= batches.length) return;
    
    const batch = batches[batchIndex]!;
    setRecords(prev => {
      const byId = new Map(prev.map(r => [r.id, r]));
      for (const r of batch) {
        byId.set(r.id, { ...(byId.get(r.id) ?? { tableId }), ...r });
      }
      const next = Array.from(byId.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      recordsRef.current = next;
      return next;
    });
    
    // Process next batch in next frame for smooth rendering
    if (batchIndex < batches.length - 1) {
      requestAnimationFrame(() => processBatch(batchIndex + 1));
    }
  };
  
  // Start processing from first batch
  processBatch(0);
}, [setRecords, tableId]);


const upsertCells = useCallback(
  (incoming: Array<{ rowId: string; columnId: string; value: unknown; id?: string }>) => {
    if (!incoming?.length) return;

    // Progressive cell updates for smoother rendering
    const batchSize = 100;
    const batches: Array<Array<{ rowId: string; columnId: string; value: unknown; id?: string }>> = [];
    for (let i = 0; i < incoming.length; i += batchSize) {
      batches.push(incoming.slice(i, i + batchSize));
    }
    
    const processCellBatch = (batchIndex: number) => {
      if (batchIndex >= batches.length) return;
      
      const batch = batches[batchIndex]!;
      setCells(prev => {
        // key builder for existing cells
        const key = (c: { rowId: string; columnId: string }) => `${c.rowId}-${c.columnId}`;
        const byKey = new Map(prev.map(c => [key(c), c]));

        for (const c of batch) {
          const k = key(c);
          const existing = byKey.get(k);
          
          // Use provided ID from server, existing ID, or create synthetic ID
          const cellId = c.id ?? existing?.id ?? `synthetic-${c.rowId}-${c.columnId}`;

          byKey.set(k, {
            id: cellId,
            rowId: c.rowId,
            columnId: c.columnId,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            value: c.value as any
          });
        }

        return Array.from(byKey.values());
      });
      
      // Process next batch in next frame for smooth rendering
      if (batchIndex < batches.length - 1) {
        requestAnimationFrame(() => processCellBatch(batchIndex + 1));
      }
    };
    
    // Start processing from first batch
    processCellBatch(0);
  },
  [setCells]
);

const suppressRestoreRef = useRef(false);

const loadEpochRef = useRef(0);

// Track which row ranges are currently being loaded to prevent race conditions
const loadingRangesRef = useRef<Set<string>>(new Set());

// Queue for cell updates that occur during data loading
const cellUpdateQueueRef = useRef<Array<{
  rowId: string;
  columnId: string;
  value: string;
  timestamp: number;
}>>([]);

// Scroll tracking for predictive loading
const scrollTrackingRef = useRef({
  lastScrollTop: 0,
  lastScrollTime: Date.now(),
  velocity: 0,
  direction: 0, // 1 for down, -1 for up, 0 for no movement
});


const ensureWindowLoaded = useCallback(async (startOrder: number, endOrder: number, opts?: { restore?: boolean }) => {

  const callEpoch = loadEpochRef.current;
  const restore = opts?.restore ?? !suppressRestoreRef.current;
  const total = tableData?._count?.rows ?? 0;
  if (!total) return;

  const s = Math.max(0, Math.min(startOrder, endOrder));
  const e = Math.min(total - 1, Math.max(startOrder, endOrder));

  // cap huge requests
  if (e - s + 1 > MAX_WINDOW) {
    return; // Skip overly large requests
  }
  
  // Check if we already have this range loaded
  const have = new Set(recordsRef.current.map(r => r.order ?? -1));
  let needsLoading = false;
  for (let i = s; i <= e; i++) { 
    if (!have.has(i)) { 
      needsLoading = true; 
      break; 
    } 
  }
  if (!needsLoading) return;

  // Create a unique key for this loading range
  const rangeKey = `${s}-${e}`;
  
  // Check if this range is already being loaded
  if (loadingRangesRef.current.has(rangeKey)) {
    return; // Skip if already loading this range
  }
  
  // Mark this range as being loaded
  loadingRangesRef.current.add(rangeKey);

  // Preserve scroll position and anchor point for stability
  const scrollContainer = tableContainerRef.current;
  const scrollTop = scrollContainer?.scrollTop ?? 0;
  const visibleItems = rowVirtualizer.getVirtualItems();
  const anchorItem = visibleItems[0]; // Use first visible item as anchor

  try {
    // Load the requested range
    const res = await trpc.row.listRowsWithCellsByOrderRange.fetch({
      tableId,
      startOrder: s,
      endOrder: e,
      columnIds: visibleColumnIds,
    });

    if (res?.rows?.length) {
      upsertRecords(res.rows);
    }
    if (res?.cells?.length) {
      upsertCells(res.cells);
    }

    // Process any queued cell updates for the loaded range
    const now = Date.now();
    const queuedUpdates = cellUpdateQueueRef.current.filter(update => {
      // Find the record for this update in the loaded range
      const record = res?.rows?.find(r => r.id === update.rowId);
      return record && record.order >= s && record.order <= e && (now - update.timestamp) < 5000; // Only process recent updates
    });

    // Remove processed updates from queue
    cellUpdateQueueRef.current = cellUpdateQueueRef.current.filter(update => 
      !queuedUpdates.some(queued => queued.rowId === update.rowId && queued.columnId === update.columnId)
    );

    // Process queued updates
    for (const update of queuedUpdates) {
      try {
        await updateCellMutation.mutateAsync({
          rowId: update.rowId,
          columnId: update.columnId,
          value: { text: update.value }
        });
        console.log(`✅ Processed queued cell update for row ${update.rowId}, column ${update.columnId}`);
      } catch (error) {
        console.error(`❌ Failed to process queued cell update:`, error);
      }
    }

    if (!restore) return;

    // Restore scroll position with improved stability
    requestAnimationFrame(() => {
       if (!restore) return;
      if (callEpoch !== loadEpochRef.current) return; // <-- skip stale restore

      if (scrollContainer) {
        const currentScrollTop = scrollContainer.scrollTop;
        const scrollDelta = Math.abs(currentScrollTop - scrollTop);
        
        // Only restore scroll if it changed significantly (avoid minor adjustments)
        if (scrollDelta > 10) {
          scrollContainer.scrollTop = scrollTop;
          
          // If we have an anchor item, try to maintain its relative position
          if (anchorItem) {
            const newVisibleItems = rowVirtualizer.getVirtualItems();
            const newAnchorItem = newVisibleItems.find(item => item.index === anchorItem.index);
            if (newAnchorItem && Math.abs(newAnchorItem.start - anchorItem.start) > 5) {
              const adjustment = anchorItem.start - newAnchorItem.start;
              scrollContainer.scrollTop = scrollTop + adjustment;
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to load data range:', error);
  } finally {
    // Clean up loading state
    loadingRangesRef.current.delete(rangeKey);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [trpc, tableId, tableData?._count?.rows, visibleColumnIds, upsertRecords, upsertCells, recordsRef, updateCellMutation]);
  
  // Data refetch when parameters change
  useEffect(() => {
    if (tableId) {
      void refetchRecords();
    }
  }, [filterRules, sortRules, searchValue, refetchRecords, tableId]);

  // Handle clicking outside cells to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on the container, not on child elements
    if (e.target === e.currentTarget) {
      handleCellDeselection();
    }
  }, [handleCellDeselection]);

  // Handlers for table interaction

  // const { rows } = table.getRowModel(); // unused

  // Determine if we should use listing mode (loads all data via infinite query) 
  // vs sparse DB-ORDER mode (loads data on demand)
  const totalDbRows = tableData?._count?.rows ?? 0;
  const isSmallTable = totalDbRows <= SMALL_TABLE_THRESHOLD;
  
  const usingOrderListing = isSmallTable || // Small tables always use full data loading
    (sortRules?.length ?? 0) > 0 ||
    (filterRules?.length ?? 0) > 0 ||
    hasActiveSearch;

  // Calculate record counts (needed by recordsByOrder)
  const localRecordCount = records.length;
  const databaseRecordCount = Math.max(tableData?._count?.rows ?? 0, uiRecordCount);
  
  // For small tables using listing mode, use actual records count
  // For large tables using sparse mode, use database count as virtual total
  const totalRecordCount = usingOrderListing 
    ? localRecordCount  // Use actual loaded records for small tables
    : Math.max(localRecordCount, databaseRecordCount); // Use database count for sparse loading

  // Create sparse record lookup: virtual index (db order) -> loaded record
  const recordsByOrder = useMemo(() => {
  const m = new Map<number, _Record>();
  let missingOrderCount = 0;
  
  // First pass: map records with valid orders
  for (const r of records) {
    if (typeof r.order === 'number') {
      m.set(r.order, r);
    } else {
      missingOrderCount++;
    }
  }
  
  // Second pass: map records without orders to the end
  let nextAvailableIndex = totalRecordCount - missingOrderCount;
  for (const r of records) {
    if (typeof r.order !== 'number') {
      m.set(nextAvailableIndex, r);
      nextAvailableIndex++;
    }
  }
  
  return m;
}, [records, totalRecordCount]); 
  

  // For listing mode, use local records which include optimistic additions
  const listedRows = useMemo(
  () =>
    usingOrderListing
      ? (hasActiveSearch ? visibleRecords  // Search results from local records
                         : records)        // Local records include optimistic additions
      : [],
  [usingOrderListing, hasActiveSearch, visibleRecords, records]
);

const scrollToFn = (
  offset: number,
  options: { behavior?: ScrollBehavior; adjustments?: number },
  instance: Virtualizer<HTMLDivElement, Element>
) => {
  const el = instance.scrollElement as HTMLElement | Window | null;
  if (!el) return;

  const adjustments = options?.adjustments ?? 0;
  // eslint-disable-next-line prefer-const
  let behavior: ScrollBehavior = options?.behavior ?? 'auto';

  

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ('scrollTo' in (el as any)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (el as any).scrollTo({ top: offset + adjustments, behavior });
  } else {
    (el as HTMLElement).scrollTop = offset + adjustments;
  }
};

useEffect(() => {
  const target = scrollToRowId ?? null;
  if (!target || lastScrollTargetRef.current === target) return;

  // resolve the absolute order of the target row (fast path)
  const rec = recordsRef.current.find(r => r.id === target);
  if (!rec || typeof rec.order !== 'number') return;

  const items = rowVirtualizer.getVirtualItems();
  if (items.length) {
    const first = items[0]!.index;
    const last  = items[items.length - 1]!.index;
    // If already visible, don't move the viewport
    if (rec.order >= first && rec.order <= last) {
      lastScrollTargetRef.current = target;
      return;
    }
  }

  lastScrollTargetRef.current = target;
  void scrollToIndexLoaded(rec.order, 'center');
  // NOTE: no other deps on purpose – we do not re-run due to data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [scrollToRowId]);

// rowCount calculation - now uses totalRecordCount consistently
// const rowCount = usingOrderListing
//   ? (listedRows.length + (hasNextPage ? 1 : 0)) // reserve one "loader" row
//   : Math.max(totalRecordCount, 2);


  // Setup virtualizer for rows
  const virtualizerCount = usingOrderListing
    ? Math.max(listedRows.length + (hasNextPage ? 1 : 0), 2)
    : Math.max(totalRecordCount, 2);
    
  const rowVirtualizer = useVirtualizer({
    count: virtualizerCount,
    estimateSize: () => 32, // Estimate row height (32px to match our h-8 class)
    getScrollElement: () => tableContainerRef.current,
    overscan: 30, // Increased overscan for smoother scrolling and fewer skeleton rows
    scrollToFn,
    // Enable scroll margin for better performance
    scrollMargin: 0,
  });

  // Removed unused virtualItems variable

  useEffect(() => {
  const total = tableData?._count?.rows ?? 0;
  if (!total || records.length > 0) return; // Don't reload if data already exists

  // Only use sparse loading for large tables
  // Small tables rely on infinite query to load all data
  if (total > SMALL_TABLE_THRESHOLD) {
    // Load initial chunk from the beginning for sparse virtual scrolling
    const INITIAL_LOAD_SIZE = 500;
    void ensureWindowLoaded(0, Math.min(total - 1, INITIAL_LOAD_SIZE - 1), {restore: false});
  }
  // Small tables will be loaded automatically via the infinite query system
}, [tableData?._count?.rows, ensureWindowLoaded, records.length]);


 const ensureLoadedAndScrollTo = useCallback(async (rowId: string, rowOrder?: number, columnId?: string) => {
  const rec = recordsRef.current.find(r => r.id === rowId);
  const absolute = typeof rowOrder === 'number' ? rowOrder : rec?.order;

  if (typeof absolute === 'number') {
    // if not loaded, prefetch a band around it without restoring
    await ensureWindowLoaded(absolute - 200, absolute + 200, { restore: false });
    rowVirtualizer.scrollToIndex(absolute, { align: 'center' });
    requestAnimationFrame(() => {
      const el = tableContainerRef.current?.querySelector<HTMLInputElement>(`[data-cell-id="${rowId}-${columnId ?? ''}"]`);
      el?.scrollIntoView({ block: 'center', inline: 'center' });
      el?.focus({ preventScroll: true });
    });
  }
}, [ensureWindowLoaded, rowVirtualizer]);

useEffect(() => {
  const result = searchResults[currentSearchIndex];
  if (!result || result.type !== 'cell' || !result.rowId) return;

  pendingSearchScrollRef.current = { rowId: result.rowId, columnId: result.columnId };
  void ensureLoadedAndScrollTo(result.rowId, result.rowOrder, result.columnId);
}, [currentSearchIndex, searchResults, ensureLoadedAndScrollTo]);



  // Dynamic loading based on skeleton rows in viewport
  const handleScroll = useCallback(() => {
    if (suppressRestoreRef.current) return;
    
    // Update scroll tracking for predictive loading
    const scrollContainer = tableContainerRef.current;
    if (scrollContainer) {
      const currentScrollTop = scrollContainer.scrollTop;
      const currentTime = Date.now();
      const scrollDelta = currentScrollTop - scrollTrackingRef.current.lastScrollTop;
      const timeDelta = currentTime - scrollTrackingRef.current.lastScrollTime;
      
      if (timeDelta > 0) {
        const velocity = scrollDelta / timeDelta; // pixels per millisecond
        scrollTrackingRef.current.velocity = velocity;
        scrollTrackingRef.current.direction = scrollDelta > 0 ? 1 : scrollDelta < 0 ? -1 : 0;
        scrollTrackingRef.current.lastScrollTop = currentScrollTop;
        scrollTrackingRef.current.lastScrollTime = currentTime;
      }
    }
    
    // LISTING MODE: load more pages near the end
  if (usingOrderListing) {
    const items = rowVirtualizer.getVirtualItems();
    if (!items.length) return;
    const last = items[items.length - 1]!.index;

    // if near the end of what we have, ask for next page
    if (hasNextPage && !isRecordsFetching && last >= listedRows.length - 100) {
      void fetchNextPage();
    }
    return;
  }

  // DB-ORDER MODE: find unloaded ranges and window-load by order
  const items = rowVirtualizer.getVirtualItems();
  if (!items.length || !totalRecordCount) return;

  const unloadedRanges: Array<{start: number, end: number}> = [];
  let rangeStart: number | null = null;

  for (const item of items) {
    const dbOrder = item.index;
    const isLoaded = recordsByOrder.has(dbOrder);
    if (!isLoaded && rangeStart === null) rangeStart = dbOrder;
    if ((isLoaded || item === items[items.length - 1]) && rangeStart !== null) {
      const end = isLoaded ? dbOrder - 1 : dbOrder;
      unloadedRanges.push({ start: rangeStart, end });
      rangeStart = null;
    }
  }

  const W = windowForViewport();
  const half = Math.floor(W / 2);

  // Calculate predictive loading expansion based on scroll velocity
  const { velocity, direction } = scrollTrackingRef.current;
  const isScrollingFast = Math.abs(velocity) > 0.5; // pixels per ms threshold for fast scrolling
  const predictiveMultiplier = isScrollingFast ? 2 : 1; // load more aggressively when scrolling fast
  
  // Prioritize loading: viewport ranges first, then extended ranges
  const viewportRanges: Array<{start: number, end: number, priority: 'viewport' | 'extended'}> = [];
  const extendedRanges: Array<{start: number, end: number, priority: 'viewport' | 'extended'}> = [];
  
  unloadedRanges.forEach(({ start, end }) => {
    // Check if this range intersects with the current viewport
    const firstVisible = items[0]!.index;
    const lastVisible = items[items.length - 1]!.index;
    const isViewportRange = !(end < firstVisible || start > lastVisible);
    
    if (isViewportRange) {
      // Priority loading for visible skeleton rows
      viewportRanges.push({ start, end, priority: 'viewport' });
    }
    
    // Extended range for predictive loading
    let expandedStart = Math.max(0, start - half * predictiveMultiplier);
    let expandedEnd = Math.min(totalRecordCount - 1, end + half * predictiveMultiplier);
    
    // Bias expansion in scroll direction for predictive loading
    if (isScrollingFast && direction !== 0) {
      const extraExpansion = Math.floor(W * 0.5); // extra half window in scroll direction
      if (direction > 0) { // scrolling down
        expandedEnd = Math.min(totalRecordCount - 1, expandedEnd + extraExpansion);
      } else { // scrolling up
        expandedStart = Math.max(0, expandedStart - extraExpansion);
      }
    }
    
    // Only add to extended if it's different from the original range
    if (expandedStart < start || expandedEnd > end) {
      extendedRanges.push({ start: expandedStart, end: expandedEnd, priority: 'extended' });
    }
  });
  
  // Load viewport ranges immediately
  viewportRanges.forEach(({ start, end }) => {
    void ensureWindowLoaded(start, end, { restore: false });
  });
  
  // Load extended ranges with slight delay to prioritize viewport
  if (extendedRanges.length > 0) {
    setTimeout(() => {
      extendedRanges.forEach(({ start, end }) => {
        void ensureWindowLoaded(start, end, { restore: false });
      });
    }, isScrollingFast ? 10 : 50); // shorter delay when scrolling fast
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  usingOrderListing,
  rowVirtualizer,
  totalDbRows,
  recordsByOrder,
  ensureWindowLoaded,
  listedRows.length,
  hasNextPage,
  isRecordsFetching,
  fetchNextPage,
]);
  
  // Removed timeout cleanup as we simplified scroll handling


// Monitor viewport for skeleton rows and trigger loading
useEffect(() => {
  const items = rowVirtualizer.getVirtualItems();
  if (!items.length) return;
  
  // Check if there are visible skeleton rows (priority loading)
  let hasVisibleSkeletons = false;
  if (!usingOrderListing) {
    for (const item of items) {
      const record = recordsByOrder.get(item.index);
      if (!record) {
        hasVisibleSkeletons = true;
        break;
      }
    }
  }
  
  // Use shorter debounce for visible skeletons, longer for predictive loading
  const debounceMs = hasVisibleSkeletons ? PRIORITY_LOADING_DEBOUNCE_MS : LOADING_DEBOUNCE_MS;
  
  const timeoutId = setTimeout(() => {
    handleScroll();
  }, debounceMs);
  
  return () => clearTimeout(timeoutId);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [rowVirtualizer.getVirtualItems(), handleScroll, usingOrderListing, recordsByOrder]);

const scrollToIndexLoaded = useCallback(async (index: number, align: 'start'|'center'|'end'='center') => {
  suppressRestoreRef.current = true;
  try {
    rowVirtualizer.scrollToIndex(index, { align });
    await new Promise(requestAnimationFrame); // <-- add this line
    const el = tableContainerRef.current;
    const vh = Math.ceil((el?.clientHeight ?? 600) / ROW_H);
    await ensureWindowLoaded(index - vh * BELT_BEHIND, index + vh * BELT_AHEAD, { restore: false });
  } finally {
    suppressRestoreRef.current = false;
  }
}, [rowVirtualizer, ensureWindowLoaded]);





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
      className="relative w-full h-full overflow-auto"
      style={{
        contain: 'strict', // CSS containment to prevent layout escape
        paddingRight: '70px',
        paddingBottom: '70px',
      }}
      onClick={handleContainerClick}
      onScroll={handleScroll}
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
        {/* Sort/Filter Loading Overlay */}
        {isRecordsFetching && (
          <div className="sticky top-0 left-0 right-0 z-20 h-1.5 w-full">
            <div className="relative w-full h-full overflow-hidden bg-blue-200/60">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-blue-500 dt-anim-progress" />
            </div>
          </div>
        )}
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
              // Virtual index directly maps to database row order
              const idx = virtualRow.index;
              const flatCols = table.getVisibleFlatColumns();

              // LISTING MODE: take row by ranked index (already filtered/sorted by server)
              if (usingOrderListing) {
                const record = listedRows[idx];

                // Show a slim loader row for the reserved "load more" slot
                if (!record) {
                  return (
                    <tr
                      key={`loader-${idx}`}
                      data-index={idx}
                      style={{
                        position: 'absolute',
                        transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                        height: `${virtualRow.size}px`,
                        display: 'flex',
                        width: table.getCenterTotalSize(),
                      }}
                      className="bg-white"
                    >
                      <td className="px-2 py-1 text-sm text-gray-500">
                        Loading…
                      </td>
                    </tr>
                  );
                }

                
                // Render a real row (use listing index for the row-number column)
                return (
                  <MemoizedTableRow
                    key={`row-${idx}-${record.id}`}
                    virtualRow={virtualRow}
                    dbOrder={typeof record.order === 'number' ? record.order : idx}                           // display index in listing
                    record={record}
                    rowCells={cellsByRow.get(record.id) ?? EMPTY_CELL_MAP}
                    cells={cells}
                    columns={columns}
                    flatCols={flatCols}
                    table={table}
                    tableId={tableId}
                    cellRenderKey={cellRenderKey}
                    handleCellSelection={handleCellSelection}
                    handleCellDeselection={handleCellDeselection}
                    handleContextMenuClick={handleContextMenuClick}
                    handleCellValueChange={handleCellValueChange}
                    sortRules={sortRules}
                    filterRules={filterRules}
                    searchMatchInfo={searchMatchInfo}
                    pendingRowIdsRef={pendingRowIdsRef}
                    pendingColumnIdsRef={pendingColumnIdsRef}
                    rowUiKeyRef={rowUiKeyRef}
                    columnUiKeyRef={columnUiKeyRef}
                    getDraftValue={getDraftValue}
                    isSavingCell={isSavingCell}
                  />
                );
              }

              // DB-ORDER MODE: resolve by sparse order→record map
              const dbOrder = idx;
              const record = recordsByOrder.get(dbOrder);
            
              if (!record) {
                // For small tables, don't render skeleton rows - they should have all data loaded
                if (isSmallTable) {
                  console.warn(`Small table missing record at index ${dbOrder}, skipping skeleton row`);
                  return null; // Don't render anything for missing records in small tables
                }
                
                // Render skeleton for unloaded data (large tables only)
                const stableRowKey = `skeleton-${dbOrder}`;
                return (
                  <tr
                    key={stableRowKey}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                      height: `${virtualRow.size}px`,
                      display: 'flex',
                      willChange: 'transform',
                    }}
                    className="group bg-white hover:bg-[#f8f8f8]"
                  >
                    {flatCols.map((col) => {
                      const isRowNumber = col.id === '__rowNumber';
                      return (
                        <td
                          key={`skeleton-${stableRowKey}-${col.id}`}
                          className="p-0 h-8 border-r border-b border-border-default relative"
                          style={{ display: 'flex', width: col.getSize(), alignItems: 'center' }}
                        >
                          {isRowNumber ? (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                              {dbOrder + 1}
                            </div>
                          ) : (
                            <div className="mx-2 w-3/4 h-3 rounded animate-pulse bg-gray-200" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }

              // Render actual data using memoized component
              return (
                <MemoizedTableRow
                  key={`row-${dbOrder}-${record.id}`}
                  virtualRow={virtualRow}
                  dbOrder={dbOrder}
                  record={record}
                  rowCells={cellsByRow.get(record.id) ?? EMPTY_CELL_MAP}
                  cells={cells}
                  columns={columns}
                  flatCols={flatCols}
                  table={table}
                  tableId={tableId}
                  cellRenderKey={cellRenderKey}
                  handleCellSelection={handleCellSelection}
                  handleCellDeselection={handleCellDeselection}
                  handleContextMenuClick={handleContextMenuClick}
                  handleCellValueChange={handleCellValueChange}
                  sortRules={sortRules}
                  filterRules={filterRules}
                  searchMatchInfo={searchMatchInfo}
                  pendingRowIdsRef={pendingRowIdsRef}
                  pendingColumnIdsRef={pendingColumnIdsRef}
                  rowUiKeyRef={rowUiKeyRef}
                  columnUiKeyRef={columnUiKeyRef}
                  getDraftValue={getDraftValue}
                  isSavingCell={isSavingCell}
                />
              );
            })}
          </tbody>
        </table>
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