"use client";

import { type Table } from "@tanstack/react-table";
import { ColumnHeader } from "./ColumnHeader";

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
}

export function TableHeader({ 
  table, 
  tableColumns, 
  onColumnAction 
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
        </tr>
      ))}
    </thead>
  );
}