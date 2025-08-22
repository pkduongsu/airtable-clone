"use client";

import { useState } from "react";
import Plus from "../../icons/Plus";
import { AddColumnModal } from "../modals/AddColumnModal";
import { api } from "~/trpc/react";
import { useCreateColumnMutation } from "../mutations/columnMutations";
import { useCreateRowMutation } from "../mutations/rowMutations";


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
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  
  const utils = api.useUtils();
  
  const createColumnMutation = useCreateColumnMutation();
  
  const createRowMutation = useCreateRowMutation();

  const handleAddColumnClick = () => {
    setShowAddColumnModal(true);
  };

  const handleCloseModal = () => {
    setShowAddColumnModal(false);
  };

  const handleCreateField = async (name: string, type: 'TEXT' | 'NUMBER') => {
    try {
      await createColumnMutation.mutateAsync({
        tableId: tableData.id,
        name,
        type,
      });
      // No need to call onTableDataRefresh since we're using optimistic updates
    } catch (error) {
      console.error('Failed to create column:', error);
      // Error handling is done in the mutation's onError callback
    }
  };

  const handleAddRowClick = async () => {
    try {
      await createRowMutation.mutateAsync({
        tableId: tableData.id,
      });
      // No need to call onTableDataRefresh since we're using optimistic updates
    } catch (error) {
      console.error('Failed to create row:', error);
      // Error handling is done in the mutation's onError callback
    }
  };

  return (
    <>
      {/* Add row button */}
      <button 
        className="flex items-center gap-2 px-2 py-1 border-b border-r border-border-default bg-white hover:bg-[#f8f8f8] h-8 text-sm text-gray-600 hover:text-gray-800 cursor-pointer w-full"
        style={{
          width: tableTotalWidth,
        }}
        onClick={handleAddRowClick}
      >
        <Plus size={14} className="flex flex-none" />
      </button>

      {/* Add column button */}
      <button 
        className="absolute top-0 bg-white border-b border-r border-border-default hover:bg-[#f8f8f8] flex items-center justify-center cursor-pointer h-[32px] w-[94px]" 
        style={{
          left: `${tableTotalWidth}px`,
          zIndex: 11, // Above table headers
        }}
        onClick={handleAddColumnClick}
      >
        <Plus size={16} className="flex-none" />
      </button>

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={showAddColumnModal}
        onClose={handleCloseModal}
        onCreateField={handleCreateField}
        position={{ 
          top: 32, // Height of the button (32px)
          left: tableTotalWidth - 188 // Adjust for modal width
        }}
        existingColumnNames={tableData.columns.map(col => col.name)}
      />
    </>
  );
}