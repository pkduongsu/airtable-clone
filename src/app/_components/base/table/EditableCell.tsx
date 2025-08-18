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
  sortRules?: Array<{
    columnId: string;
    direction: 'asc' | 'desc';
  }>;
  filterRules?: Array<{
    id: string;
    columnId: string;
    columnName: string;
    columnType: 'TEXT' | 'NUMBER';
    operator: 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals' | 'greater_than' | 'less_than';
    value?: string | number;
  }>;
}

export function EditableCell({ cellId, tableId, initialValue, className = "", onNavigate, shouldFocus, isSelected, onSelect, onDeselect, rowId, onContextMenu, sortRules = [], filterRules = [] }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestValueRef = useRef<string>(initialValue);
  const [pendingMutation, setPendingMutation] = useState(false);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [editLock, setEditLock] = useState(false);
  const [editLockStartTime, setEditLockStartTime] = useState<number | null>(null);
  const editLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  
  const utils = api.useUtils();
  const updateCellMutation = api.table.updateCell.useMutation({
    onMutate: async (variables) => {
      // Determine if we need to update processed query cache
      const hasProcessingRules = sortRules.length > 0 || filterRules.length > 0;
      
      // Cancel outgoing refetches for both base and processed queries
      await utils.table.getTableData.cancel({ tableId, limit: 100 });
      
      let previousProcessedData;
      if (hasProcessingRules) {
        const processedQueryKey = { 
          tableId, 
          limit: 100,
          ...(sortRules.length > 0 && {
            sortRules: sortRules.map(rule => ({
              columnId: rule.columnId,
              direction: rule.direction
            }))
          }),
          ...(filterRules.length > 0 && {
            filterRules: filterRules.map(rule => ({
              id: rule.id,
              columnId: rule.columnId,
              columnName: rule.columnName,
              columnType: rule.columnType,
              operator: rule.operator,
              value: rule.value
            }))
          })
        };
        
        await utils.table.getTableData.cancel(processedQueryKey);
        previousProcessedData = utils.table.getTableData.getInfiniteData(processedQueryKey);
      }
      
      // Snapshot current data for rollback
      const previousData = utils.table.getTableData.getInfiniteData({ tableId, limit: 100 });
      
      // Helper function to update cache data
      const updateCacheData = (old: typeof previousData) => {
        if (!old) return old;
        
        const updatedPages = old.pages.map(page => ({
          ...page,
          rows: page.rows.map(row => ({
            ...row,
            cells: row.cells.map(cell => 
              cell.id === variables.cellId 
                ? { 
                    ...cell, 
                    value: { text: typeof variables.value === 'string' ? variables.value : JSON.stringify(variables.value) }
                  }
                : cell
            )
          }))
        }));
        
        return {
          ...old,
          pages: updatedPages,
        };
      };
      
      // Update base query cache
      utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, updateCacheData);
      
      // Update processed query cache if processing rules exist
      if (hasProcessingRules && previousProcessedData) {
        const processedQueryKey = { 
          tableId, 
          limit: 100,
          ...(sortRules.length > 0 && {
            sortRules: sortRules.map(rule => ({
              columnId: rule.columnId,
              direction: rule.direction
            }))
          }),
          ...(filterRules.length > 0 && {
            filterRules: filterRules.map(rule => ({
              id: rule.id,
              columnId: rule.columnId,
              columnName: rule.columnName,
              columnType: rule.columnType,
              operator: rule.operator,
              value: rule.value
            }))
          })
        };
        
        utils.table.getTableData.setInfiniteData(processedQueryKey, updateCacheData);
      }
      
      return { previousData, previousProcessedData, hasProcessingRules };
    },
    onSuccess: () => {
      console.log('Cell update successful');
      setHasLocalChanges(false);
      setIsSaving(false);
      setPendingValue(null);
      setEditSessionId(null);
      setSaveStatus('saved');
      
      // Clear edit lock with a delay to ensure stability
      setEditLock(false);
      setEditLockStartTime(null);
      console.log('Edit lock released for cell:', cellId);
      
      // Clear save status after a short delay
      setTimeout(() => setSaveStatus('idle'), 2000);
      // Don't invalidate immediately - optimistic update already shows correct data
    },
    onError: (error, variables, context) => {
      console.error('Failed to update cell:', error);
      // Rollback optimistic updates for both caches
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, context.previousData);
      }
      
      if (context?.hasProcessingRules && context?.previousProcessedData) {
        const processedQueryKey = { 
          tableId, 
          limit: 100,
          ...(sortRules.length > 0 && {
            sortRules: sortRules.map(rule => ({
              columnId: rule.columnId,
              direction: rule.direction
            }))
          }),
          ...(filterRules.length > 0 && {
            filterRules: filterRules.map(rule => ({
              id: rule.id,
              columnId: rule.columnId,
              columnName: rule.columnName,
              columnType: rule.columnType,
              operator: rule.operator,
              value: rule.value
            }))
          })
        };
        
        utils.table.getTableData.setInfiniteData(processedQueryKey, context.previousProcessedData);
      }
      
      setValue(initialValue); // Revert local state
      setIsSaving(false);
      setHasLocalChanges(false);
      setPendingValue(null);
      setEditSessionId(null);
      setSaveStatus('error');
      
      // Keep edit lock for a short period on error to prevent further overwrites
      setTimeout(() => {
        setEditLock(false);
        setEditLockStartTime(null);
        console.log('Edit lock released after error for cell:', cellId);
      }, 1000);
    },
    onSettled: () => {
      setPendingMutation(false);
      // No invalidation needed - optimistic updates handle UI consistency
      // The server save already completed successfully
    },
  });

  // Simple save function
  const saveToServer = useCallback((newValue: string) => {
    if (newValue === initialValue || pendingMutation) {
      setHasLocalChanges(false);
      setIsSaving(false);
      return;
    }

    setPendingMutation(true);
    setIsSaving(true);
    setSaveStatus('saving');
    updateCellMutation.mutate({
      cellId,
      value: newValue,
    });
  }, [cellId, initialValue, updateCellMutation, pendingMutation]);


  // Update local value when initialValue changes, but STRONGLY preserve user edits
  useEffect(() => {
    // Only update if ALL conditions are met:
    // 1. No local changes
    // 2. Not actively editing
    // 3. No pending mutation
    // 4. No active edit session
    // 5. No pending value waiting to be saved
    // 6. No active edit lock
    // 7. If edit lock exists, ensure minimum grace period has passed
    const editLockActive = editLock || (editLockStartTime && Date.now() - editLockStartTime < 2000); // 2 second grace period
    
    if (!hasLocalChanges && !isEditing && !pendingMutation && !editSessionId && !pendingValue && !editLockActive) {
      // Additional check: only update if the new value is actually different
      if (initialValue !== value) {
        setValue(initialValue);
        latestValueRef.current = initialValue;
      }
    }
  }, [initialValue, hasLocalChanges, isEditing, pendingMutation, editSessionId, pendingValue, value, editLock, editLockStartTime]);

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
    setPendingValue(newValue);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Immediately start edit session and edit lock on first keystroke
    if (!editSessionId) {
      const sessionId = `edit-${cellId}-${Date.now()}`;
      setEditSessionId(sessionId);
      console.log('Started edit session:', sessionId);
    }
    
    // Immediately activate edit lock to prevent external overwrites
    if (!editLock) {
      setEditLock(true);
      setEditLockStartTime(Date.now());
      console.log('Edit lock activated for cell:', cellId);
    }
    
    // Clear any existing edit lock timeout
    if (editLockTimeoutRef.current) {
      clearTimeout(editLockTimeoutRef.current);
    }

    // Set new timeout for deferred server save
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      saveToServer(newValue);
    }, 500); // Faster response while still allowing smooth typing
  }, [saveToServer, editSessionId, cellId, editLock]);

  // Cleanup timeouts on unmount and handle orphaned edit sessions
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (editLockTimeoutRef.current) {
        clearTimeout(editLockTimeoutRef.current);
      }
      
      // Log cleanup for debugging
      if (editSessionId || editLock) {
        console.log('Cleaning up edit session and lock on unmount for cell:', cellId);
      }
    };
  }, [cellId, editSessionId, editLock]);

  // Failsafe cleanup for orphaned edit locks
  useEffect(() => {
    if (editLock && editLockStartTime) {
      // Set a maximum edit lock duration of 30 seconds as failsafe
      const maxLockDuration = 30000;
      const elapsed = Date.now() - editLockStartTime;
      
      if (elapsed >= maxLockDuration) {
        console.warn('Edit lock exceeded maximum duration, clearing lock for cell:', cellId);
        setEditLock(false);
        setEditLockStartTime(null);
      } else {
        // Set timeout for remaining time
        editLockTimeoutRef.current = setTimeout(() => {
          console.warn('Edit lock timeout reached, clearing lock for cell:', cellId);
          setEditLock(false);
          setEditLockStartTime(null);
        }, maxLockDuration - elapsed);
      }
    }
    
    return () => {
      if (editLockTimeoutRef.current) {
        clearTimeout(editLockTimeoutRef.current);
      }
    };
  }, [editLock, editLockStartTime, cellId]);

  // Auto-focus when shouldFocus prop changes
  useEffect(() => {
    if (shouldFocus && !isEditing) {
      if (isSelected) {
        setIsEditing(true);
        
        // Immediately start edit session and lock when entering edit mode via keyboard
        if (!editSessionId) {
          const sessionId = `edit-${cellId}-${Date.now()}`;
          setEditSessionId(sessionId);
          console.log('Started edit session on focus:', sessionId);
        }
        
        if (!editLock) {
          setEditLock(true);
          setEditLockStartTime(Date.now());
          console.log('Edit lock activated on focus for cell:', cellId);
        }
      } else {
        onSelect?.();
      }
    }
  }, [shouldFocus, isEditing, isSelected, onSelect, editSessionId, editLock, cellId]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSelected && !isEditing) {
      // Second click on already selected cell - enter edit mode
      setIsEditing(true);
      
      // Immediately start edit session and lock to prevent data loss
      if (!editSessionId) {
        const sessionId = `edit-${cellId}-${Date.now()}`;
        setEditSessionId(sessionId);
        console.log('Started edit session on click:', sessionId);
      }
      
      if (!editLock) {
        setEditLock(true);
        setEditLockStartTime(Date.now());
        console.log('Edit lock activated on click for cell:', cellId);
      }
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
    
    // Immediately start edit session and lock to prevent data loss
    if (!editSessionId) {
      const sessionId = `edit-${cellId}-${Date.now()}`;
      setEditSessionId(sessionId);
      console.log('Started edit session on double-click:', sessionId);
    }
    
    if (!editLock) {
      setEditLock(true);
      setEditLockStartTime(Date.now());
      console.log('Edit lock activated on double-click for cell:', cellId);
    }
  };

  const handleSave = async () => {
    if (value === initialValue) {
      // No changes made, just exit edit mode and clear locks
      setHasLocalChanges(false);
      setIsEditing(false);
      setEditLock(false);
      setEditLockStartTime(null);
      return;
    }

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Save immediately - this is a user-initiated save so it should be immediate
    setIsEditing(false);
    setIsSaving(true);
    
    // Use the mutation directly for immediate save
    setPendingMutation(true);
    setSaveStatus('saving');
    updateCellMutation.mutate({
      cellId,
      value: latestValueRef.current,
    });
  };

  const handleCancel = () => {
    setValue(initialValue);
    setHasLocalChanges(false);
    setIsEditing(false);
    
    // Clear edit locks and session on cancel
    setEditLock(false);
    setEditLockStartTime(null);
    setEditSessionId(null);
    setPendingValue(null);
    
    // Clear any pending timeouts
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (editLockTimeoutRef.current) {
      clearTimeout(editLockTimeoutRef.current);
    }
  };

  const handleSaveAndNavigate = (direction: 'tab' | 'shift-tab' | 'enter' ) => {
    // If no changes, just exit edit mode, clear locks and navigate
    if (value === initialValue) {
      setHasLocalChanges(false);
      setIsEditing(false);
      setEditLock(false);
      setEditLockStartTime(null);
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
    
    // Save immediately using direct mutation for reliability
    setPendingMutation(true);
    setIsSaving(true);
    setSaveStatus('saving');
    updateCellMutation.mutate({
      cellId,
      value: latestValueRef.current,
    });
    
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
      if (latestValueRef.current !== initialValue && !pendingMutation) {
        // Clear any pending auto-save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        // Save immediately using direct mutation for reliability
        setPendingMutation(true);
        setIsSaving(true);
        setSaveStatus('saving');
        updateCellMutation.mutate({
          cellId,
          value: latestValueRef.current,
        });
      } else if (latestValueRef.current === initialValue) {
        // No changes, safe to clear edit lock immediately
        setEditLock(false);
        setEditLockStartTime(null);
      }
    } else {
      // Normal blur behavior - only save if not already saving
      if (!pendingMutation) {
        void handleSave();
      }
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
          {/* Save status indicator */}
          {saveStatus === 'saving' && (
            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" title="Saving..."></div>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
              <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center" title="Saved">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
              <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center" title="Save failed">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
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