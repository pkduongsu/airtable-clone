"use client";

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { api } from "~/trpc/react";
import { useTableNavigation, type CellPosition, type CellNavigationRef } from "./TableNavigationContext";

interface EditableCellProps {
  cellId: string;
  initialValue: string;
  onSave?: () => void;
  className?: string;
  position: CellPosition;
}

export const EditableCell = forwardRef<CellNavigationRef, EditableCellProps>(
  ({ cellId, initialValue, onSave, className = "", position }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const cellRef = useRef<HTMLDivElement>(null);
    
    const updateCellMutation = api.table.updateCell.useMutation();
    const { registerCell, unregisterCell, handleNavigation } = useTableNavigation();

    // Expose focus and startEdit methods to parent
    useImperativeHandle(ref, () => ({
      focus: () => {
        setIsFocused(true);
        if (cellRef.current) {
          cellRef.current.focus();
        }
      },
      startEdit: () => {
        setIsEditing(true);
      },
    }), []);

    // Register this cell with the navigation context
    useEffect(() => {
      const cellNavRef: CellNavigationRef = {
        focus: () => {
          setIsFocused(true);
          if (cellRef.current) {
            cellRef.current.focus();
          }
        },
        startEdit: () => {
          setIsEditing(true);
        },
      };
      
      registerCell(position, cellNavRef);
      
      return () => {
        unregisterCell(position);
      };
    }, [position, registerCell, unregisterCell]);

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
    if (isEditing) {
      // In edit mode, handle save/cancel
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        void handleSave();
        // Navigate after saving
        setTimeout(() => {
          if (e.shiftKey) {
            handleNavigation(position, 'shift-tab');
          } else {
            handleNavigation(position, 'tab');
          }
        }, 0);
      }
    } else {
      // In view mode, handle navigation and edit start
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsEditing(true);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          handleNavigation(position, 'shift-tab');
        } else {
          handleNavigation(position, 'tab');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigation(position, 'up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNavigation(position, 'down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigation(position, 'left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigation(position, 'right');
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        // Start editing with the typed character
        setValue(e.key);
        setIsEditing(true);
      }
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
        ref={cellRef}
        className={`w-full h-full px-2 py-1 flex items-center cursor-text hover:bg-gray-50 text-sm text-gray-900 ${isFocused ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}
        onClick={handleStartEdit}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        tabIndex={0}
      >
        {value}
      </div>
    </div>
  );
});

EditableCell.displayName = 'EditableCell';