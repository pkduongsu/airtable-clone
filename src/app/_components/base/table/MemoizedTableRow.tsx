import { memo, useMemo } from "react";
import { MemoEditableCell } from "./EditableCell";
import type {
  Row as _Record,
  Cell as Cell,
  Column as Column,
} from "@prisma/client";
import type { SortRule } from "../modals/SortModal";
import type { VirtualItem } from "@tanstack/react-virtual";


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
}) => {
const rowData: TableRow = useMemo(() => {
  // Fast path: use the per-row map
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  if (rowCells && rowCells.size) {
    return {
      id: record.id,
      __cellIds: Object.fromEntries(
        columns.map(col => [col.id, rowCells.get(col.id)?.id ?? ""])
      ),
      ...Object.fromEntries(
        columns.map(col => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const v = rowCells.get(col.id)?.value;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const display =
            v && typeof v === "object" && "text" in v
            //eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              ? (v.text ?? "")
              : (typeof v === "string" || typeof v === "number")
              ? String(v)
              : "";
          return [col.id, display];
        })
      ),
    };
  }

  // Fallback: scan the cells array
  return {
    id: record.id,
    __cellIds: Object.fromEntries(
      columns.map(col => [col.id, `cell-${record.id}-${col.id}`])
    ),
    ...Object.fromEntries(
      columns.map(col => {
        const c = cells.find(x => x.rowId === record.id && x.columnId === col.id);
        const v = c?.value;
        const display =
          v && typeof v === "object" && "text" in v
            ? (v.text ?? "")
            : (typeof v === "string" || typeof v === "number")
            ? String(v)
            : "";
        return [col.id, display];
      })
    ),
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
        
        return (
          <td
            key={tdKey}
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
              rowId={record.id}
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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