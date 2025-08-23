"use client";

import Plus from "../../icons/Plus";
import { useCreateRow } from "../hooks/useCreateRow";

interface AddRowButtonProps {
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

export function AddRowButton({ 
  tableData, 
  tableTotalWidth 
}: AddRowButtonProps) {
  const { handleCreateRow } = useCreateRow();

  const handleAddRowClick = async () => {
    try {
      await handleCreateRow(tableData.id);
      // No need to call onTableDataRefresh since we're using optimistic updates
    } catch (error) {
      console.error('Failed to create row:', error);
      // Error handling is done in the mutation's onError callback
    }
  };

  return (
    <button 
      className="flex items-center gap-2 px-2 py-1 border-b border-r border-border-default bg-white hover:bg-[#f8f8f8] h-8 text-sm text-gray-600 hover:text-gray-800 cursor-pointer w-full"
      style={{
        width: tableTotalWidth,
      }}
      onClick={handleAddRowClick}
    >
      <Plus size={14} className="flex flex-none" />
    </button>
  );
}