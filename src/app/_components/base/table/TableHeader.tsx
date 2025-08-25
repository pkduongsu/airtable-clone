"use client";

import { type Table } from "@tanstack/react-table";
import { ColumnHeader } from "./ColumnHeader";
import Plus from "../../icons/Plus";

type TableRow = {
  id: string;
  __cellIds: Record<string, string>;
  [key: string]: string | undefined | Record<string, string>;
};

interface TableHeaderProps {
  table: Table<TableRow>;
  tableColumns: Array<{
    id: string;
    name: string;
    type: string;
    order: number;
    width: number;
    tableId: string;
  }>;
  onColumnAction?: (position: { x: number; y: number }, column: { id: string; name: string }) => void;
  onAddColumnClick?: () => void;
}

export function TableHeader({ 
  table, 
  tableColumns, 
  onColumnAction,
  onAddColumnClick
}: TableHeaderProps) {

  return (
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
            <ColumnHeader
              key={header.id}
              header={header}
              onColumnAction={onColumnAction}
              tableColumns={tableColumns}
            />
          ))}
          {/* Add Column Button */}
          <th
            style={{
              display: 'flex',
              width: '94px',
              minWidth: '94px',
            }}
          >
            <button 
              className="w-full h-[32px] bg-white border-b border-r border-border-default hover:bg-[#f8f8f8] flex items-center justify-center cursor-pointer" 
              onClick={onAddColumnClick}
              title="Add column"
            >
              <Plus size={16} className="flex-none" />
            </button>
          </th>
        </tr>
      ))}
    </thead>
  );
}