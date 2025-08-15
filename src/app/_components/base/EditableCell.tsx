"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "~/trpc/react";

interface EditableCellProps {
  cellId: string;
  initialValue: string;
  onSave?: () => void;
  className?: string;
}

export function EditableCell({ cellId, initialValue, onSave, className = "" }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const updateCellMutation = api.table.updateCell.useMutation();

  // Update local value when initialValue changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (value === initialValue) {
      // No changes made, just exit edit mode
      setIsEditing(false);
      return;
    }

    try {
      await updateCellMutation.mutateAsync({
        cellId,
        value,
      });
      
      // Call onSave callback to refresh table data
      onSave?.();
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update cell:', error);
      // Revert to original value on error
      setValue(initialValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    void handleSave();
  };

  if (isEditing) {
    return (
      <div className={`w-full h-full flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full h-full px-2 py-1 border-none bg-white focus:outline-none text-sm text-gray-900 rounded-sm border border-blue-500"
        />
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex items-center ${className}`}>
      <div 
        className="w-full h-full px-2 py-1 flex items-center cursor-text hover:bg-gray-50 text-sm text-gray-900"
        onClick={handleStartEdit}
      >
        {value}
      </div>
    </div>
  );
}