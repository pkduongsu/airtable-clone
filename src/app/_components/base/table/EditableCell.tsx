"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { useEditingState } from "../../providers/EditingStateProvider";


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
  columnId?: string; // Add columnId prop for direct access
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
  isTableLoading?: boolean;
  isTableStabilizing?: boolean;
  searchQuery?: string;
  isSearchMatch?: boolean;
  isCurrentSearchResult?: boolean;
}

export function EditableCell({ cellId, tableId, initialValue, className = "", onNavigate, shouldFocus, isSelected, onSelect, onDeselect, rowId, columnId: _columnId, onContextMenu, sortRules = [], filterRules = [], isTableLoading = false, isTableStabilizing = false, searchQuery, isSearchMatch = false, isCurrentSearchResult = false }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestValueRef = useRef<string>(initialValue);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Use refs to avoid adding to useEffect dependencies
  const isSavingRef = useRef(isSaving);
  const saveStatusRef = useRef(saveStatus);
  
  // Keep refs in sync
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);
  
  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);
  const [editLock, setEditLock] = useState(false);
  const [editLockStartTime, setEditLockStartTime] = useState<number | null>(null);
  const editLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [wasEditingBeforeLoading, setWasEditingBeforeLoading] = useState(false);
  
  // Determine if editing should be disabled due to loading states
  // Allow editing for temporary cells even during loading to enable optimistic updates
  const isTemporaryCell = cellId?.startsWith('temp-cell-') ?? false;
  const isEditingDisabled = !isTemporaryCell && (isTableLoading || isTableStabilizing);
  
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const { startEditingSession, endEditingSession, isCellEditing, isAnyCellEditing, isAnyCellEditingRef } = useEditingState();
  
  const createCellMutation = api.cell.create.useMutation({
    mutationKey: ['cell', 'create'],
    onMutate: async ({ rowId, columnId, value: newValue }) => {
      // Cancel any outgoing refetches that could interfere with optimistic updates
      await Promise.all([
        utils.table.getTableData.cancel({ 
          tableId, 
          limit: 100
        }),
        // Cancel other cell queries that might interfere
        queryClient.cancelQueries({ 
          queryKey: ['trpc', 'cell', 'findByRowColumn']
        })
      ]);
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getInfiniteData({ 
        tableId, 
        limit: 100
      });
      
      // Optimistically update the cache with new cell
      utils.table.getTableData.setInfiniteData({ 
        tableId, 
        limit: 100
      }, (old) => {
        if (!old) return old;
        
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
              // Find the row that needs this cell
              if (row.id === rowId) {
                // Check if cell already exists (shouldn't happen but be safe)
                const existingCell = row.cells.find(cell => cell.columnId === columnId);
                if (existingCell) {
                  // Update existing cell
                  return {
                    ...row,
                    cells: row.cells.map(cell => 
                      cell.columnId === columnId 
                        ? { ...cell, value: { text: newValue } }
                        : cell
                    )
                  };
                } else {
                  // Add new cell
                  const column = page.columns.find(col => col.id === columnId);
                  return {
                    ...row,
                    cells: [
                      ...row.cells,
                      {
                        id: `temp-cell-${rowId}-${columnId}`,
                        rowId,
                        columnId,
                        value: { text: newValue },
                        column: column ?? { id: columnId, name: 'Unknown', type: 'TEXT', order: 0, width: 179, tableId }
                      }
                    ]
                  };
                }
              }
              return row;
            })
          }))
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ 
          tableId, 
          limit: 100
        }, context.previousData);
      }
      
      // Handle UI state
      setIsSaving(false);
      setSaveStatus('error');
    },
    onSuccess: () => {
      // Only invalidate if this is the only cell mutation running to prevent over-invalidation
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['cell', 'create'] });
      if (concurrentMutations === 1) {
        // Safe to invalidate related queries
        void utils.table.getTableData.invalidate({ tableId });
      }
      
      setIsSaving(false);
      setSaveStatus('saved');
      setHasLocalChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  });

  const updateCellMutation = api.cell.update.useMutation({
    mutationKey: ['cell', 'update'],
    onMutate: async ({ cellId, value: newValue }) => {      
      // Cancel any outgoing refetches that could interfere with optimistic updates
      await Promise.all([
        utils.table.getTableData.cancel({ 
          tableId, 
          limit: 100
        }),
        // Cancel any other table-related queries that might conflict
        queryClient.cancelQueries({ 
          queryKey: ['trpc', 'table', 'getTableData'],
          predicate: (query) => {
            const queryData = query.queryKey[2] as { input?: { tableId?: string } } | undefined;
            return queryData?.input?.tableId === tableId;
          }
        })
      ]);
      
      // Snapshot the previous value
      const previousData = utils.table.getTableData.getInfiniteData({ 
        tableId, 
        limit: 100
      });
      
      // Optimistically update the cache with targeted cell update
      utils.table.getTableData.setInfiniteData({ 
        tableId, 
        limit: 100
      }, (old) => {
        if (!old) return old;
        
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
              // Find the row containing this cell
              const targetCell = row.cells.find(cell => cell.id === cellId);
              if (!targetCell) return row;
              
              // Update only the specific cell value
              return {
                ...row,
                cells: row.cells.map(cell => 
                  cell.id === cellId 
                    ? { ...cell, value: { text: newValue } }
                    : cell
                )
              };
            })
          }))
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert to the previous value on error
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ 
          tableId, 
          limit: 100
        }, context.previousData);
      }
      
      // Handle UI state
      setIsSaving(false);
      setSaveStatus('error');
      setValue(initialValue);
      setHasLocalChanges(false);
    },
    onSuccess: () => {
      // Only invalidate queries if this is the only mutation running to prevent over-invalidation
      const concurrentMutations = queryClient.isMutating({ mutationKey: ['cell', 'update'] });
      if (concurrentMutations === 1) {
        // This is the last cell mutation completing, safe to invalidate related queries
        void utils.table.getTableData.invalidate({ tableId });
      }
      
      setIsSaving(false);
      setSaveStatus('saved');
      setHasLocalChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  });

  // Save function using optimistic mutations
  const saveToServer = useCallback((newValue: string) => {
    if (newValue === initialValue) {
      return;
    }
    
    if (!cellId) {
      return;
    }

    
    // Check if this is a temporary cell ID
    if (cellId.startsWith('temp-cell-')) {
      // For temporary cells, we need to check if the cell exists and create/update accordingly
      if (rowId && _columnId) {
        setIsSaving(true);
        setSaveStatus('saving');
        setHasLocalChanges(false);
        
        // First show optimistic update immediately
        utils.table.getTableData.setInfiniteData({ 
          tableId, 
          limit: 100
        }, (old) => {
          if (!old) return old;
          
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              rows: page.rows.map(row => {
                // Find the row containing this cell (could be temporary row ID)
                const targetCell = row.cells.find(cell => cell.id === cellId);
                if (!targetCell) return row;
                
                return {
                  ...row,
                  cells: row.cells.map(cell => 
                    cell.id === cellId 
                      ? { ...cell, value: { text: newValue } }
                      : cell
                  )
                };
              })
            }))
          };
        });
        
        // Check if rowId or columnId are temporary (newly created row/column)
        const isTemporaryRow = rowId.startsWith('temp-row-');
        const isTemporaryColumn = _columnId.startsWith('temp-column-');
        
        if (isTemporaryRow || isTemporaryColumn) {
          // Skip server call for temporary row/column IDs, just show optimistic update
          setIsSaving(false);
          setSaveStatus('saved');
          setHasLocalChanges(false);
          setTimeout(() => setSaveStatus('idle'), 2000);
          return;
        }
        
        // For real IDs, try to find if the cell exists on server
        utils.cell.findByRowColumn.fetch({
          rowId,
          columnId: _columnId,
        }).then((existingCell) => {
          if (existingCell) {
            // Cell exists, update it
            updateCellMutation.mutate({
              cellId: existingCell.id,
              value: newValue,
            });
          } else {
            // Cell doesn't exist, create it
            createCellMutation.mutate({
              rowId,
              columnId: _columnId,
              value: newValue,
            });
          }
        }).catch(() => {
          // If find fails, assume cell doesn't exist and create it
          createCellMutation.mutate({
            rowId,
            columnId: _columnId,
            value: newValue,
          });
        });
      }
      return;
    }
    
    // For regular cells, use optimistic mutation
    updateCellMutation.mutate({
      cellId,
      value: newValue,
    });
    
    setIsSaving(true);
    setSaveStatus('saving');
    setHasLocalChanges(false);
  }, [cellId, initialValue, updateCellMutation, createCellMutation, utils, tableId, rowId, _columnId]);


  // Update local value when initialValue changes, but preserve user edits
  useEffect(() => {
    // Only update if not actively editing and no pending changes
    // Additionally, don't update if a mutation is in flight to prevent disrupting optimistic updates
    const isMutationInProgress = updateCellMutation.isPending;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const hasActiveEditingState = isEditing || hasLocalChanges || editSessionId || pendingValue || editLock;
    const isCellCurrentlyEditing = isCellEditing(cellId);
    
    // Prevent updates during any active editing state
    // Also prevent updates if there are pending save operations
    const hasPendingSave = isSavingRef.current || saveStatusRef.current === 'saving';
    if (!hasActiveEditingState && !isMutationInProgress && !isCellCurrentlyEditing && !hasPendingSave) {
      if (initialValue !== value) {
        setValue(initialValue);
        latestValueRef.current = initialValue;
      }
    } else if (isMutationInProgress || hasActiveEditingState || isCellCurrentlyEditing || hasPendingSave) {
    }
  }, [initialValue, isEditing, hasLocalChanges, editSessionId, pendingValue, editLock, value, cellId, updateCellMutation.isPending, isCellEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle value changes with 500ms save delay after stopping typing
  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue);
    setHasLocalChanges(true);
    latestValueRef.current = newValue;
    setPendingValue(newValue);
    
    // Clear existing save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Start edit session and edit lock on first keystroke
    if (!editSessionId) {
      const sessionId = `edit-${cellId}-${Date.now()}`;
      setEditSessionId(sessionId);
      startEditingSession(cellId, sessionId);
    }
    
    if (!editLock) {
      setEditLock(true);
      setEditLockStartTime(Date.now());
    }
    
    // Clear any existing edit lock timeout
    if (editLockTimeoutRef.current) {
      clearTimeout(editLockTimeoutRef.current);
    }

    // Set 500ms timeout to save after user stops typing
    saveTimeoutRef.current = setTimeout(() => {
      saveToServer(newValue);
    }, 500);
  }, [saveToServer, cellId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear timeouts to prevent memory leaks
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (editLockTimeoutRef.current) {
        clearTimeout(editLockTimeoutRef.current);
      }
    };
  }, []);

  // Failsafe cleanup for orphaned edit locks
  useEffect(() => {
    if (editLock && editLockStartTime) {
      // Set a maximum edit lock duration of 30 seconds as failsafe
      const maxLockDuration = 30000;
      const elapsed = Date.now() - editLockStartTime;
      
      if (elapsed >= maxLockDuration) {
        setEditLock(false);
        setEditLockStartTime(null);
      } else {
        // Set timeout for remaining time
        editLockTimeoutRef.current = setTimeout(() => {
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
    if (shouldFocus && !isEditing && !isEditingDisabled) {
      if (isSelected) {
        setIsEditing(true);
        
        // Immediately start edit session and lock when entering edit mode via keyboard
        if (!editSessionId) {
          const sessionId = `edit-${cellId}-${Date.now()}`;
          setEditSessionId(sessionId);
          startEditingSession(cellId, sessionId);
        }
        
        if (!editLock) {
          setEditLock(true);
          setEditLockStartTime(Date.now());
        }
      } else {
        onSelect?.();
      }
    } else if (shouldFocus && isEditingDisabled) {
    }
  }, [shouldFocus, isEditing, isSelected, onSelect, editSessionId, editLock, cellId, isEditingDisabled]);

  // Track editing state transitions during loading
  useEffect(() => {
    if (isEditingDisabled && isEditing) {
      // Loading started while editing - remember this state
      setWasEditingBeforeLoading(true);
    } else if (!isEditingDisabled && wasEditingBeforeLoading) {
      // Loading completed and we were editing before - restore edit state
      setWasEditingBeforeLoading(false);
      
      // Re-focus the input to ensure smooth transition
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Restore cursor position to end of text
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 50); // Small delay to ensure DOM is ready
    }
  }, [isEditingDisabled, isEditing, wasEditingBeforeLoading, cellId]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent editing during loading states
    if (isEditingDisabled) {
      return;
    }
    
    if (isSelected && !isEditing) {
      // Second click on already selected cell - enter edit mode
      setIsEditing(true);
      
      // Immediately start edit session and lock to prevent data loss
      if (!editSessionId) {
        const sessionId = `edit-${cellId}-${Date.now()}`;
        setEditSessionId(sessionId);
        startEditingSession(cellId, sessionId);
      }
      
      if (!editLock) {
        setEditLock(true);
        setEditLockStartTime(Date.now());
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
    
    // Prevent editing during loading states
    if (isEditingDisabled) {
      return;
    }
    
    
    // Double click always enters edit mode directly
    setIsEditing(true);
    
    // Immediately start edit session and lock to prevent data loss
    if (!editSessionId) {
      const sessionId = `edit-${cellId}-${Date.now()}`;
      setEditSessionId(sessionId);
      startEditingSession(cellId, sessionId);
    }
    
    if (!editLock) {
      setEditLock(true);
      setEditLockStartTime(Date.now());
    }
  };

  const handleSave = async () => {
    if (value === initialValue) {
      // No changes made, just exit edit mode and clear locks
      setHasLocalChanges(false);
      setIsEditing(false);
      setEditLock(false);
      setEditLockStartTime(null);
      
      // End editing session
      if (editSessionId) {
        endEditingSession(cellId, editSessionId);
        setEditSessionId(null);
      }
      return;
    }

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Save immediately - this is a user-initiated save so it should be immediate
    setIsEditing(false);
    setIsSaving(true);
    
    // Use saveToServer to handle both regular and temporary cells
    saveToServer(latestValueRef.current);
  };

  const handleCancel = () => {
    setValue(initialValue);
    setHasLocalChanges(false);
    setIsEditing(false);
    
    // Clear edit locks and session on cancel
    setEditLock(false);
    setEditLockStartTime(null);
    
    // End editing session
    if (editSessionId) {
      endEditingSession(cellId, editSessionId);
    }
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
      
      // End editing session
      if (editSessionId) {
        endEditingSession(cellId, editSessionId);
        setEditSessionId(null);
      }
      
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
    
    // Save immediately using saveToServer to handle both regular and temporary cells
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
    const isMovingToAnotherCell = relatedTarget && 
      (relatedTarget.closest('[data-cell]') !== null ||
       relatedTarget.closest('td') !== null ||
       relatedTarget.classList.contains('cursor-text'));
    
    if (isMovingToAnotherCell) {
      // User is navigating to another cell - exit edit mode and save immediately
      setIsEditing(false);
      onDeselect?.();
      
      // Save changes immediately when navigating to another cell
      if (latestValueRef.current !== initialValue) {
        // Clear the 500ms auto-save timeout since we're saving immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        saveToServer(latestValueRef.current);
      }
      
      // Release edit lock quickly to allow new cell to function
      setTimeout(() => {
        setEditLock(false);
        setEditLockStartTime(null);
        
        // End editing session when moving to another cell
        if (editSessionId) {
          endEditingSession(cellId, editSessionId);
          setEditSessionId(null);
        }
      }, 50);
    } else {
      // Normal blur behavior (clicking outside table, etc.) - save normally
      if (!updateCellMutation.isPending) {
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
            disabled={isEditingDisabled}
            data-cell="true"
            data-cell-id={cellId}
            className={`w-full h-full px-2 py-1 border-none bg-white focus:outline-none text-sm text-gray-900 rounded-sm border ${
              isEditingDisabled 
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                : isSaving 
                  ? 'border-yellow-400' 
                  : 'border-blue-500'
            }`}
          />
          {/* Loading state indicator */}
          {isEditingDisabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" title="Loading..."></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Function to highlight search text
  const highlightSearchText = (text: string, query: string) => {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span 
            key={index} 
            className={`${isCurrentSearchResult ? 'bg-orange-300' : 'bg-yellow-200'}`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Determine cell styling based on state
  const getCellClassName = () => {
    const baseClasses = "w-full h-full px-2 py-1 flex items-center text-sm text-gray-900";
    
    if (isEditingDisabled) {
      return `${baseClasses} cursor-not-allowed bg-gray-50 text-gray-500`;
    } else if (isSelected) {
      return `${baseClasses} cursor-text bg-blue-50 border border-blue-500 border-solid`;
    } else if (isSearchMatch) {
      return `${baseClasses} cursor-text ${isCurrentSearchResult ? 'bg-orange-100' : 'bg-yellow-100'} hover:bg-[#f8f8f8]`;
    } else {
      return `${baseClasses} cursor-text hover:bg-[#f8f8f8]`;
    }
  };

  return (
    <div className={`w-full h-full flex items-center ${className}`}>
      <div className="relative w-full h-full">
        <div 
          className={getCellClassName()}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          data-cell="true"
          data-cell-id={cellId}
        >
          {searchQuery && isSearchMatch ? highlightSearchText(value, searchQuery) : value}
        </div>
        {/* Loading indicator for non-editing state */}
        {isEditingDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" title="Loading..."></div>
          </div>
        )}
      </div>
    </div>
  );
}