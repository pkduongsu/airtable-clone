import { memo, useMemo } from "react";
import { MemoEditableCell } from "./EditableCell";

type TableRow = {
  id: string;
  __cellIds: Record<string, string>; // Map column ID to cell ID
  [key: string]: string | undefined | Record<string, string>;
};

export const MemoizedTableRow = memo<{
  virtualRow: any;
  dbOrder: number;
  record: any;
  cells: any[];
  columns: any[];
  flatCols: any[];
  table: any;
  tableId: string;
  cellRenderKey: (rowId: string, columnId: string) => string;
  handleCellSelection: (rowId: string, columnId: string) => void;
  handleCellDeselection: () => void;
  handleContextMenuClick: (event: React.MouseEvent, rowId: string) => void;
  handleCellValueChange: (rowId: string, columnId: string, value: string) => void;
  sortRules: any[];
  filterRules: any[];
  searchMatchInfo: any;
  pendingRowIdsRef: React.RefObject<Set<string>>;
  pendingColumnIdsRef: React.RefObject<Set<string>>;
  rowUiKeyRef: React.RefObject<Map<string, string>>;
  columnUiKeyRef: React.RefObject<Map<string, string>>;
}>(({
  virtualRow,
  dbOrder,
  record,
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
  rowUiKeyRef,
  columnUiKeyRef,
}: {
  virtualRow: any;
  dbOrder: number;
  record: any;
  cells: any[];
  columns: any[];
  flatCols: any[];
  table: any;
  tableId: string;
  cellRenderKey: (rowId: string, columnId: string) => string;
  handleCellSelection: (rowId: string, columnId: string) => void;
  handleCellDeselection: () => void;
  handleContextMenuClick: (event: React.MouseEvent, rowId: string) => void;
  handleCellValueChange: (rowId: string, columnId: string, value: string) => void;
  sortRules: any[];
  filterRules: any[];
  searchMatchInfo: any;
  pendingRowIdsRef: React.RefObject<Set<string>>;
  pendingColumnIdsRef: React.RefObject<Set<string>>;
  rowUiKeyRef: React.RefObject<Map<string, string>>;
  columnUiKeyRef: React.RefObject<Map<string, string>>;
}) => {
  // Debug logging for row ID mapping in component
  if (record?.order >= 99990 && record?.order <= 100000) {
    console.log(`🔍 MemoizedTableRow Debug - DBOrder: ${dbOrder}, RecordID: ${record?.id}, RecordOrder: ${record?.order}`);
  }

  // Create sparse row data with memoization per row
  const sparseRowData: TableRow = useMemo(() => {
    return {
      id: record.id,
      __cellIds: Object.fromEntries(
        columns.map(col => [col.id, `cell-${record.id}-${col.id}`])
      ),
      ...Object.fromEntries(
        columns.map(col => {
          const cell = cells.find(c => c.rowId === record.id && c.columnId === col.id);
          const value = cell?.value;
          // Extract text from value object or use as string
          const displayValue = value && typeof value === "object" && "text" in value 
            ? value.text ?? ""
            : typeof value === "string" || typeof value === "number"
            ? String(value)
            : "";
          return [col.id, displayValue];
        })
      )
    };
  }, [record, cells, columns]);

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
        width: table.getCenterTotalSize(),
        height: `${virtualRow.size}px`,
      }}
    >
      {flatCols.map((col) => {
        const stableColKey = columnUiKeyRef.current?.get(col.id) ?? col.id;
        const tdKey = `${stableRowKey}-${stableColKey}`;
        
        if (col.id === '__rowNumber') {
          // Render row number column
          return (
            <td
              key={tdKey}
              className="p-0 h-8 border-r border-b border-border-default relative"
              style={{ display: 'flex', width: col.getSize(), alignItems: 'center' }}
            >
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                {dbOrder + 1}
              </div>
            </td>
          );
        }
        
        // Render data cell
        const column = columns.find(c => c.id === col.id);
        const cellValue = (sparseRowData[col.id] as string | undefined) || "";
        
        return (
          <td
            key={tdKey}
            className="p-0 h-8 border-r border-b border-border-default relative"
            style={{ display: 'flex', width: col.getSize(), alignItems: 'center' }}
          >
            <MemoEditableCell
              key={cellRenderKey(record.id, col.id)}
              _tableId={tableId}
              initialValue={cellValue}
              onSelect={() => handleCellSelection(record.id, col.id)}
              onDeselect={handleCellDeselection}
              rowId={record.id}
              columnId={col.id}
              onContextMenu={handleContextMenuClick}
              onValueChange={handleCellValueChange}
              hasSort={sortRules.some(rule => rule.columnId === col.id)}
              hasFilter={filterRules.some(rule => rule.columnId === col.id)}
              isSearchMatch={searchMatchInfo.cellMatches.has(`${record.id}-${col.id}`)}
              isCurrentSearchResult={searchMatchInfo.currentResult === `${record.id}-${col.id}`}
              columnType={column?.type}
              canPersist={!pendingRowIdsRef.current?.has(record.id) && !pendingColumnIdsRef.current?.has(col.id)}
            />
          </td>
        );
      })}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Debug memo comparison for our target rows
  if (prevProps.record?.order >= 99990 && prevProps.record?.order <= 100000) {
    console.log(`🔄 Memo Check - PrevID: ${prevProps.record?.id}, NextID: ${nextProps.record?.id}, PrevDBOrder: ${prevProps.dbOrder}, NextDBOrder: ${nextProps.dbOrder}`);
  }
  
  // Only re-render if essential props changed
  if (
    prevProps.record?.id !== nextProps.record?.id ||
    prevProps.dbOrder !== nextProps.dbOrder ||
    prevProps.columns !== nextProps.columns ||
    prevProps.searchMatchInfo !== nextProps.searchMatchInfo
  ) {
    if (prevProps.record?.order >= 99990 && prevProps.record?.order <= 100000) {
      console.log(`🔄 Memo: Props changed, re-rendering`);
    }
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