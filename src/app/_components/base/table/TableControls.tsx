"use client";

import { AddRowButton } from "./AddRowButton";

interface TableControlsProps {
  tableData: {
    id: string;
    columns: Array<{
      id: string;
      name: string;
      type: string;
      order: number;
      width: number;
      tableId: string;
    }>;
  };
  tableTotalWidth: number;
}

export function TableControls({ 
  tableData, 
  tableTotalWidth 
}: TableControlsProps) {
  return (
    <>
      <AddRowButton tableData={tableData} tableTotalWidth={tableTotalWidth} />
    </>
  );
}