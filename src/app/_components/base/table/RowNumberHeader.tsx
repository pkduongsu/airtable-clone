"use client";

interface RowNumberHeaderProps {
  selectedRows: Set<string>;
  totalRows: number;
  onSelectAll: (checked: boolean) => void;
}

export function RowNumberHeader({ 
  selectedRows, 
  totalRows, 
  onSelectAll 
}: RowNumberHeaderProps) {
  const isAllSelected = selectedRows.size === totalRows && totalRows > 0;

  return (
    <div className="flex items-center justify-center w-full h-full">
      <input
        type="checkbox"
        className="w-4 h-4 flex-shrink-0"
        checked={isAllSelected}
        onChange={(e) => onSelectAll(e.target.checked)}
      />
    </div>
  );
}