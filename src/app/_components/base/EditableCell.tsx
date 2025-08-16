"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";

interface EditableCellProps {
  cellId: string;
  initialValue: string;
  className?: string;
  onNavigate?: (direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right') => void;
  shouldFocus?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onDeselect?: () => void;
}

export function EditableCell({ cellId, initialValue, className = "", onNavigate, shouldFocus, isSelected, onSelect, onDeselect: _onDeselect }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  
  const utils = api.useUtils();
  const updateCellMutation = api.table.updateCell.useMutation({
    onMutate: async ({ cellId, value: newValue }) => {
      // Cancel any outgoing refetches
      await utils.table.getTableData.cancel();
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getData();
      
      // Optimistically update the cache
      if (previousData) {
        utils.table.getTableData.setData({ tableId: previousData.id }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            rows: old.rows.map(row => ({
              ...row,
              cells: row.cells.map(cell => 
                cell.id === cellId 
                  ? { 
                      ...cell, 
                      value: typeof newValue === 'string' 
                        ? { text: newValue }
                        : typeof newValue === 'number'
                        ? { number: newValue }
                        : newValue
                    }
                  : cell
              )
            }))
          };
        });
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setData({ tableId: context.previousData.id }, context.previousData);
      }
      setValue(initialValue); // Revert local state too
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      void utils.table.getTableData.invalidate();
    }
  });

  // Debounced save function
  const debouncedSave = useCallback(async (newValue: string) => {
    if (newValue === initialValue) return;

    setIsSaving(true);
    try {
      await updateCellMutation.mutateAsync({
        cellId,
        value: newValue,
      });
      // No need to call onSave since we're using optimistic updates
    } catch (error) {
      console.error('Failed to update cell:', error);
      // Error handling is done in the mutation's onError callback
    } finally {
      setIsSaving(false);
    }
  }, [cellId, initialValue, updateCellMutation]);

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

  // Handle value changes with debouncing
  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      void debouncedSave(newValue);
    }, 1000); // Auto-save after 1 second of inactivity
  }, [debouncedSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-focus when shouldFocus prop changes
  useEffect(() => {
    if (shouldFocus && !isEditing) {
      if (isSelected) {
        setIsEditing(true);
      } else {
        onSelect?.();
      }
    }
  }, [shouldFocus, isEditing, isSelected, onSelect]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSelected) {
      // Second click on already selected cell - enter edit mode
      setIsEditing(true);
    } else {
      // First click - select the cell
      onSelect?.();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Double click always enters edit mode directly
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
      
      // No need to call onSave since we're using optimistic updates
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update cell:', error);
      // Error handling is done in the mutation's onError callback
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
      onNavigate?.('enter');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      void handleSave();
      onNavigate?.(e.shiftKey ? 'shift-tab' : 'tab');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      void handleSave();
      onNavigate?.('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      void handleSave();
      onNavigate?.('down');
    } else if (e.key === 'ArrowLeft' && inputRef.current?.selectionStart === 0) {
      e.preventDefault();
      void handleSave();
      onNavigate?.('left');
    } else if (e.key === 'ArrowRight' && inputRef.current?.selectionStart === value.length) {
      e.preventDefault();
      void handleSave();
      onNavigate?.('right');
    }
  };

  const handleBlur = () => {
    void handleSave();
  };

  if (isEditing) {
    return (
      <div className={`w-full h-full flex items-center ${className}`}>
        <div className="relative w-full h-full">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={`w-full h-full px-2 py-1 border-none bg-white focus:outline-none text-sm text-gray-900 rounded-sm border ${isSaving ? 'border-yellow-400' : 'border-blue-500'}`}
          />
          {isSaving && (
            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
              <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Determine cell styling based on state
  const getCellClassName = () => {
    const baseClasses = "w-full h-full px-2 py-1 flex items-center cursor-text text-sm text-gray-900";
    
    if (isSelected) {
      return `${baseClasses} bg-blue-50 border border-blue-500 border-solid`;
    } else {
      return `${baseClasses} hover:bg-gray-50`;
    }
  };

  return (
    <div className={`w-full h-full flex items-center ${className}`}>
      <div 
        className={getCellClassName()}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {value}
      </div>
    </div>
  );
}