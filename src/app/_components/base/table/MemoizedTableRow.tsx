import { memo, useMemo } from "react";
import { MemoEditableCell } from "./EditableCell";
import type {
  Row as _Record,
  Cell as Cell,
  Column as Column,
} from "@prisma/client";
import type { SortRule } from "../modals/SortModal";
import type { VirtualItem } from "@tanstack/react-virtual";
import { fakeFor } from "~/lib/fakeFor";


type TableRow = {
  id: string;
  __cellIds: Record<string, string>; // Map column ID to cell ID
  [key: string]: string | undefined | Record<string, string>;
};

// eslint-disable-next-line react/display-name
export const MemoizedTableRow = memo<{
  virtualRow: VirtualItem;
  dbOrder: number;
  record: _Record;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowCells?: Map<string, { id: string; value: any }>;
  cells: Cell[];
  columns: Column[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flatCols: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  tableId: string;
  cellRenderKey: (rowId: string, columnId: string) => string;
  handleCellSelection: (rowId: string, columnId: string) => void;
  handleCellDeselection: () => void;
  handleContextMenuClick: (event: React.MouseEvent, rowId: string) => void;
  handleCellValueChange: (rowId: string, columnId: string, value: string) => void;
  sortRules: SortRule[];
  filterRules: Array<{
    id: string;
    columnId: string;
    columnName: string;
    columnType: 'TEXT' | 'NUMBER';
    operator: 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals' | 'greater_than' | 'less_than';
    value?: string | number;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchMatchInfo: any;
  pendingRowIdsRef: React.RefObject<Set<string>>;
  pendingColumnIdsRef: React.RefObject<Set<string>>;
  rowUiKeyRef: React.RefObject<Map<string, string>>;
  columnUiKeyRef: React.RefObject<Map<string, string>>;
  getDraftValue: (rowId: string, colId: string) => string | undefined;   
  isSavingCell: (rowId: string, colId: string) => boolean;               
}>(({
  virtualRow,
  dbOrder,
  record,
  rowCells,
  cells,
  columns,
  flatCols,
  table,
  tableId,
  cellRenderKey,
  handleCellSelection,
  handleCellDeselection,
  handleContextMenuClick,
  handleCellValueChange,
  sortRules,
  filterRules,
  searchMatchInfo,
  pendingRowIdsRef,
  pendingColumnIdsRef,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rowUiKeyRef,
  columnUiKeyRef,
  getDraftValue,
  isSavingCell
}) => {
const rowData: TableRow = useMemo(() => {
  // Fast path: use the per-row map
  const makeSeed = (rId: string, cId: string) => {
  const rk = rowUiKeyRef.current?.get(rId) ?? rId;
  const ck = columnUiKeyRef.current?.get(cId) ?? cId;
  return Math.abs((rk + "::" + ck).split("")
    .reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0));
};

const isPendingRow = pendingRowIdsRef.current?.has(record.id);
const valueMap = rowCells && rowCells.size ? rowCells : undefined;

  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
return {
  id: record.id,
  __cellIds: Object.fromEntries(columns.map(col => [col.id, (valueMap?.get(col.id)?.id) ?? `cell-${record.id}-${col.id}`])),
  ...Object.fromEntries(columns.map(col => {
    // 1) draft first
    const draft = getDraftValue(record.id, col.id);
    if (draft != null) return [col.id, draft];

    // 2) server value next
    const v = valueMap ? valueMap.get(col.id)?.value
                       : cells.find(x => x.rowId === record.id && x.columnId === col.id)?.value;
    const fromServer =
      v && typeof v === "object" && "text" in v ? (v.text ?? "")
      : (typeof v === "string" || typeof v === "number") ? String(v)
      : "";

    if (fromServer) return [col.id, fromServer];

    // 3) otherwise: if neither row nor column is pending, show a deterministic fake
    const isPendingCol = pendingColumnIdsRef.current?.has(col.id);
    if (!isPendingRow && !isPendingCol) {
      const seed = makeSeed(record.id, col.id);
      const fake = fakeFor(col.name, col.type as "TEXT" | "NUMBER", seed);
      return [col.id, String(fake)];
    }
    return [col.id, ""];
  })),
};
}, [record.id, columns, rowCells, cells]);

  const stableRowKey = `row-${record.id}`;

  return (
    <tr
      data-index={virtualRow.index}
      key={stableRowKey}
      className="group hover:bg-[#f8f8f8] bg-white transition-all duration-100"
      style={{
        display: 'flex',
        position: 'absolute',
        transform: `translate3d(0, ${virtualRow.start}px, 0)`,
        willChange: 'transform',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        width: table.getCenterTotalSize(),
        height: `${virtualRow.size}px`,
      }}
    >
      {flatCols.map((col) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const stableColKey = columnUiKeyRef.current?.get(col.id) ?? col.id;
        const tdKey = `${stableRowKey}-${stableColKey}`;
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (col.id === '__rowNumber') {
          // Render row number column
          return (
            <td
              key={tdKey}
              className="p-0 h-8 border-r border-b border-border-default relative"
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            style={{ display: 'flex', width: col.getSize(), alignItems: 'center' }}
            >
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                {dbOrder + 1}
              </div>
            </td>
          );
        }
        
        // Render data cell
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const column = columns.find(c => c.id === col.id);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
        const cellValue = (rowData[col.id] as string | undefined) || "";
        const saving = isSavingCell(record.id, col.id);
        
        return (
          <td
            key={tdKey}
            data-saving={saving ? "1" : undefined}
            className="p-0 h-8 border-r border-b border-border-default relative"
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            style={{ display: 'flex', width: col.getSize(), alignItems: 'center' }}
          >
            <MemoEditableCell
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              key={cellRenderKey(record.id, col.id)}
              _tableId={tableId}
              initialValue={cellValue}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              onSelect={() => handleCellSelection(record.id, col.id)}
              onDeselect={handleCellDeselection}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              rowId={record.id}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
              columnId={col.id}
              onContextMenu={handleContextMenuClick}
              onValueChange={handleCellValueChange}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              hasSort={sortRules.some(rule => rule.columnId === col.id)}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              hasFilter={filterRules.some(rule => rule.columnId === col.id)}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              isSearchMatch={searchMatchInfo.cellMatches.has(`${record.id}-${col.id}`)}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              isCurrentSearchResult={searchMatchInfo.currentResult === `${record.id}-${col.id}`}
              columnType={column?.type}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              canPersist={!pendingRowIdsRef.current?.has(record.id) && !pendingColumnIdsRef.current?.has(col.id)}
            />
            {saving && <span className="ml-1 inline-block animate-pulse">·</span>}
          </td>
        );
      })}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Only re-render if essential props changed
  if (
    prevProps.record?.id !== nextProps.record?.id ||
    prevProps.dbOrder !== nextProps.dbOrder ||
    prevProps.columns !== nextProps.columns ||
    prevProps.searchMatchInfo !== nextProps.searchMatchInfo
  ) {
    return false; // Props changed, re-render
  }
  
  // Check if cells for this specific row changed
  const rowId = prevProps.record?.id;
  if (!rowId) return true; // No row data, don't re-render
  
  const prevRowCells = prevProps.cells.filter(c => c.rowId === rowId);
  const nextRowCells = nextProps.cells.filter(c => c.rowId === rowId);
  
  if (prevRowCells.length !== nextRowCells.length) {
    return false; // Cell count changed, re-render
  }
  
  if (prevProps.rowCells !== nextProps.rowCells) return false;

  // Check if any cell values changed for this row
  for (let i = 0; i < prevRowCells.length; i++) {
    const prevCell = prevRowCells[i];
    const nextCell = nextRowCells[i];
    if (prevCell?.value !== nextCell?.value || prevCell?.id !== nextCell?.id) {
      return false; // Cell value changed, re-render
    }
  }
  
  return true; // No relevant changes, skip re-render
});