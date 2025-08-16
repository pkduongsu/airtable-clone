"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";

interface EditableCellProps {
  cellId: string;
  tableId: string;
  initialValue: string;
  className?: string;
  onNavigate?: (direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right') => void;
  shouldFocus?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onDeselect?: () => void;
  rowId?: string;
  onContextMenu?: (event: React.MouseEvent, rowId: string) => void;
}

export function EditableCell({ cellId, tableId, initialValue, className = "", onNavigate, shouldFocus, isSelected, onSelect, onDeselect, rowId, onContextMenu }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestValueRef = useRef<string>(initialValue);
  
  const utils = api.useUtils();
  const updateCellMutation = api.table.updateCell.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches for this specific table
      await utils.table.getTableData.cancel({ tableId, limit: 100 });
      
      // Snapshot the previous value for error recovery
      const previousData = utils.table.getTableData.getInfiniteData({ tableId, limit: 100 });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, context.previousData);
      }
      setValue(initialValue); // Revert local state too
      setIsSaving(false); // Clear saving state on error
      console.error('Failed to update cell:', err);
    },
    onSettled: () => {
      // Always refetch to ensure server state after mutation completes
      void utils.table.getTableData.invalidate({ tableId, limit: 100 });
    },
  });

  // Server save function (just server sync, cache already updated)
  const saveToServer = useCallback((newValue: string) => {
    if (newValue === initialValue) {
      setHasLocalChanges(false);
      setIsSaving(false);
      return;
    }

    // Don't set isSaving here - it's already set in handleValueChange
    updateCellMutation.mutate({
      cellId,
      value: newValue,
    }, {
      onSuccess: () => {
        setHasLocalChanges(false);
        setIsSaving(false);
      },
      onError: (error) => {
        console.error('Failed to update cell:', error);
        setIsSaving(false);
        // Keep hasLocalChanges true so user can retry
      }
    });
  }, [cellId, initialValue, updateCellMutation]);

  // Function to update cache immediately (used for navigation persistence)
  const updateCacheImmediately = useCallback((newValue: string) => {
    utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, (old) => {
      if (!old) return old;
      
      // Find and update the specific cell across all pages
      let cellFound = false;
      const updatedPages = old.pages.map(page => {
        if (cellFound) return page; // Skip if we already found and updated the cell
        
        const hasTargetCell = page.rows.some(row => 
          row.cells.some(cell => cell.id === cellId)
        );
        
        if (!hasTargetCell) return page;
        
        cellFound = true;
        return {
          ...page,
          rows: page.rows.map(row => ({
            ...row,
            cells: row.cells.map(cell => 
              cell.id === cellId 
                ? { 
                    ...cell, 
                    value: { text: newValue }
                  }
                : cell
            )
          }))
        };
      });
      
      return {
        ...old,
        pages: updatedPages,
      };
    });
  }, [utils.table.getTableData, tableId, cellId]);

  // Update local value when initialValue changes, but only if we don't have pending local changes
  useEffect(() => {
    if (!hasLocalChanges && !isEditing) {
      setValue(initialValue);
      latestValueRef.current = initialValue;
    }
  }, [initialValue, hasLocalChanges, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle value changes with deferred optimistic update
  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue);
    setHasLocalChanges(true);
    latestValueRef.current = newValue;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for deferred cache update and server save
    saveTimeoutRef.current = setTimeout(() => {
      // Update cache after user stops typing
      updateCacheImmediately(newValue);
      setIsSaving(true);
      saveToServer(newValue);
    }, 500); // Shorter delay for cache update, longer total for server save
  }, [saveToServer, updateCacheImmediately]);

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
    
    if (isSelected && !isEditing) {
      // Second click on already selected cell - enter edit mode
      setIsEditing(true);
    } else if (!isSelected) {
      // First click - select the cell
      onSelect?.();
    }
  };

  const handleMouseDown = (_e: React.MouseEvent) => {
    // On mousedown, immediately select the cell for faster response
    if (!isSelected) {
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
      setHasLocalChanges(false);
      setIsEditing(false);
      return;
    }

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Update cache immediately and save
    updateCacheImmediately(latestValueRef.current);
    setIsEditing(false);
    setIsSaving(true);
    saveToServer(latestValueRef.current);
  };

  const handleCancel = () => {
    setValue(initialValue);
    setHasLocalChanges(false);
    setIsEditing(false);
  };

  const handleSaveAndNavigate = (direction: 'tab' | 'shift-tab' | 'enter' ) => {
    // If no changes, just exit edit mode and navigate
    if (value === initialValue) {
      setHasLocalChanges(false);
      setIsEditing(false);
      // Use setTimeout to ensure the input loses focus before navigation
      setTimeout(() => onNavigate?.(direction), 0);
      return;
    }

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Exit edit mode immediately for smooth navigation
    setIsEditing(false);
    
    // Update cache immediately and save
    updateCacheImmediately(latestValueRef.current);
    setIsSaving(true);
    saveToServer(latestValueRef.current);
    
    // Navigate immediately after exiting edit mode
    setTimeout(() => onNavigate?.(direction), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveAndNavigate('enter');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSaveAndNavigate(e.shiftKey ? 'shift-tab' : 'tab');
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if we're blurring to focus on another editable cell
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isClickingOnAnotherCell = relatedTarget && 
      (relatedTarget.closest('[data-cell]') !== null ||
       relatedTarget.closest('td') !== null ||
       relatedTarget.classList.contains('cursor-text'));
    
    if (isClickingOnAnotherCell) {
      // If clicking on another cell, exit edit mode immediately and save in background
      setIsEditing(false);
      
      // Immediately deselect this cell to allow the new cell to be selected
      // Use setTimeout to ensure this happens after the current event loop
      setTimeout(() => onDeselect?.(), 0);
      
      // Ensure data persists by updating cache immediately before navigation
      if (latestValueRef.current !== initialValue) {
        // Clear any pending auto-save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        // Update cache immediately to ensure persistence
        updateCacheImmediately(latestValueRef.current);
        setIsSaving(true);
        saveToServer(latestValueRef.current);
      }
    } else {
      // Normal blur behavior
      void handleSave();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (rowId && onContextMenu) {
      onContextMenu(e, rowId);
    }
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
      return `${baseClasses} hover:bg-[#f8f8f8]`;
    }
  };

  return (
    <div className={`w-full h-full flex items-center ${className}`}>
      <div 
        className={getCellClassName()}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-cell="true"
      >
        {value}
      </div>
    </div>
  );
}