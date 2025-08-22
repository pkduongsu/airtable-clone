"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import { useMutationTracker } from "../../providers/MutationTracker";
import {useQueryClient} from "@tanstack/react-query";

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

export function EditableCell({ cellId, tableId, initialValue, className = "", onNavigate, shouldFocus, isSelected, onSelect, onDeselect, rowId, columnId, onContextMenu, sortRules = [], filterRules = [], isTableLoading = false, isTableStabilizing = false, searchQuery, isSearchMatch = false, isCurrentSearchResult = false }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [originalInitialValue] = useState(initialValue); // Capture the very first initialValue to detect user input
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
  const [wasEditingBeforeLoading, setWasEditingBeforeLoading] = useState(false);
  
  // Determine if editing should be disabled due to loading states
  // Allow editing for temporary cells even during loading to enable optimistic updates
  const isTemporaryCell = cellId?.startsWith('temp-cell-') ?? false;
  const isEditingDisabled = !isTemporaryCell && (isTableLoading || isTableStabilizing);
  
  const utils = api.useUtils();
  const mutationTracker = useMutationTracker();
  const queryClient = useQueryClient();
  
  const createCellMutation = api.cell.create.useMutation({
    onSuccess: (data, variables, _context) => {
      console.log('Cell created successfully');
      
      // Check if this mutation is for the current cell to prevent stale callbacks
      if (variables.rowId !== rowId || variables.columnId !== columnId) {
        console.log('Ignoring stale createCell callback for different cell');
        mutationTracker.removeMutation(`createCell-${cellId}`);
        return;
      }
      
      setHasLocalChanges(false);
      setIsSaving(false);
      setPendingValue(null);
      setEditSessionId(null);
      setSaveStatus('saved');
      
      // Delay edit lock release to avoid interfering with cell navigation
      setTimeout(() => {
        setEditLock(false);
        setEditLockStartTime(null);
        console.log('Edit lock released for created cell:', cellId);
      }, 500);
      
      // Track mutation end
      mutationTracker.removeMutation(`createCell-${cellId}`);
      
      // Clear save status after a short delay
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (error) => {
      console.error('Failed to create cell:', error);
      mutationTracker.removeMutation(`createCell-${cellId}`);
      setValue(initialValue);
      setIsSaving(false);
      setHasLocalChanges(false);
      setPendingValue(null);
      setEditSessionId(null);
      setSaveStatus('error');
      
      setTimeout(() => {
        setEditLock(false);
        setEditLockStartTime(null);
        console.log('Edit lock released after create error for cell:', cellId);
      }, 1000);
    },
  });

  const updateCellMutation = api.cell.update.useMutation({
    mutationKey: ['cell.update'],
    onMutate: async (variables) => {
      // Track mutation start
      mutationTracker.addMutation(`updateCell-${variables.cellId}`);
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
    onSuccess: (data, variables) => {
      console.log('Cell update successful');
      
      // Check if this mutation is for the current cell to prevent stale callbacks
      if (variables.cellId !== cellId) {
        console.log('Ignoring stale updateCell callback for different cell:', variables.cellId, 'current:', cellId);
        mutationTracker.removeMutation(`updateCell-${variables.cellId}`);
        return;
      }
      
      setHasLocalChanges(false);
      setIsSaving(false);
      setPendingValue(null);
      setEditSessionId(null);
      setSaveStatus('saved');
      
      // Delay edit lock release to avoid interfering with subsequent cell edits
      setTimeout(() => {
        setEditLock(false);
        setEditLockStartTime(null);
        console.log('Edit lock released for cell:', cellId);
      }, 500);
      
      // Track mutation end
      mutationTracker.removeMutation(`updateCell-${variables.cellId}`);
      
      // Clear save status after a short delay
      setTimeout(() => setSaveStatus('idle'), 2000);
      // Don't invalidate immediately - optimistic update already shows correct data
    },
    onError: (error, variables, context) => {
      console.error('Failed to update cell:', error);
      
      // Track mutation end (even on error)
      mutationTracker.removeMutation(`updateCell-${variables.cellId}`);
      
      // Check if the error is because the cell doesn't exist
      const errorMessage = error.message || '';
      if (errorMessage.includes('No record was found') || errorMessage.includes('not found')) {
        console.log('Cell not found, trying to create it instead');
        
        // Try to extract row and column IDs from a real cell ID (not temp)
        // Real cell IDs should have a format we can parse
        // For now, we'll try to create the cell using a different approach
        
        // Since we can't easily extract row/column from real cell IDs, 
        // and this error suggests the cell was expected to exist,
        // we'll just show the error for now
        console.log('Cannot create cell from updateCell failure - cell ID format unknown');
      }
      
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
      if (queryClient.isMutating() === 1) {
        queryClient.invalidateQueries({
          queryKey: ['table.getTableData', { tableId, limit: 100 }],
        })
      }
    },
  });

  // Simple save function
  const saveToServer = useCallback((newValue: string) => {
    if (newValue === initialValue || pendingMutation) {
      setHasLocalChanges(false);
      setIsSaving(false);
      return;
    }
    
    // Safety check for cellId - this should only happen during development/debugging
    if (!cellId) {
      console.warn('SaveToServer called with undefined cellId, skipping save');
      setHasLocalChanges(false);
      setIsSaving(false);
      return;
    }

    // Check if this is a temporary cell ID from optimistic updates
    if (cellId?.startsWith('temp-cell-')) {
      // For temporary cells, ALWAYS do optimistic local update first for immediate feedback
      console.log('Handling temp cell with optimistic update:', { rowId, columnId, cellId });
      
      // Update local cache immediately for instant user feedback
      setHasLocalChanges(false);
      setIsSaving(false);
      setSaveStatus('saved');
      
      // Update the optimistic cache directly using updater function to avoid race conditions
      utils.table.getTableData.setInfiniteData({ 
        tableId, 
        limit: 100
      }, (old) => {
        if (!old) return old;
        
        const updatedPages = old.pages.map(page => ({
          ...page,
          rows: page.rows.map(row => ({
            ...row,
            cells: row.cells.map(cell => 
              cell.id === cellId 
                ? { ...cell, value: { text: newValue } }
                : cell
            )
          }))
        }));
        
        return {
          ...old,
          pages: updatedPages,
        };
      });
      
      // Also update processed cache if needed
      const hasProcessingRules = sortRules.length > 0 || filterRules.length > 0;
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
        
        // Update processed cache directly using updater function to avoid race conditions
        utils.table.getTableData.setInfiniteData(processedQueryKey, (old) => {
          if (!old) return old;
          
          const updatedPages = old.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => ({
              ...row,
              cells: row.cells.map(cell => 
                cell.id === cellId 
                  ? { ...cell, value: { text: newValue } }
                  : cell
              )
            }))
          }));
          
          return {
            ...old,
            pages: updatedPages,
          };
        });
      }
      
      // After optimistic update, try background sync for real entities
      if (rowId && columnId && !rowId.startsWith('temp-') && !columnId.startsWith('temp-')) {
        // Background sync for real row/column - don't block user interaction
        console.log('Starting background sync for real entities');
        
        // Look up existing cell in background
        utils.cell.findByRowColumn.fetch({
          rowId,
          columnId,
        }).then((existingCell: { id: string } | null) => {
          if (existingCell) {
            // Cell exists, update it silently in background
            console.log('Background: Found existing cell, updating it:', existingCell.id);
            updateCellMutation.mutate({
              cellId: existingCell.id,
              value: newValue,
            });
          } else {
            // Cell doesn't exist, create it silently in background
            console.log('Background: Cell not found, creating new cell');
            createCellMutation.mutate({
              rowId,
              columnId,
              value: newValue,
            });
          }
        }).catch((error: unknown) => {
          console.error('Background sync error (non-blocking):', error);
        });
      }
      
      // Clear save status after showing feedback
      setTimeout(() => setSaveStatus('idle'), 1000);
      return;
    }

    // For regular cells, ALSO do immediate cache update first for true optimistic experience
    console.log('Updating regular cell with immediate cache update:', { cellId, newValue });
    
    // Update local cache immediately before database mutation
    // Use the updater function directly to avoid race conditions between multiple cell edits
    utils.table.getTableData.setInfiniteData({ 
      tableId, 
      limit: 100
    }, (old) => {
      if (!old) return old;
      
      const updatedPages = old.pages.map(page => ({
        ...page,
        rows: page.rows.map(row => ({
          ...row,
          cells: row.cells.map(cell => 
            cell.id === cellId 
              ? { ...cell, value: { text: newValue } }
              : cell
          )
        }))
      }));
      
      return {
        ...old,
        pages: updatedPages,
      };
    });
    
    // Also update processed cache if needed
    const hasProcessingRules = sortRules.length > 0 || filterRules.length > 0;
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
      
      // Update processed cache directly using updater function to avoid race conditions
      utils.table.getTableData.setInfiniteData(processedQueryKey, (old) => {
        if (!old) return old;
        
        const updatedPages = old.pages.map(page => ({
          ...page,
          rows: page.rows.map(row => ({
            ...row,
            cells: row.cells.map(cell => 
              cell.id === cellId 
                ? { ...cell, value: { text: newValue } }
                : cell
            )
          }))
        }));
        
        return {
          ...old,
          pages: updatedPages,
        };
      });
    }
    
    // Show immediate feedback to user
    setIsSaving(true);
    setSaveStatus('saving');
    
    // Now start the database mutation (onMutate will also update cache as backup)
    setPendingMutation(true);
    updateCellMutation.mutate({
      cellId,
      value: newValue,
    });
  }, [cellId, initialValue, updateCellMutation, pendingMutation, tableId, utils, sortRules, filterRules, createCellMutation, columnId, rowId]);


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
    // 8. For temporary cells, be even more conservative to prevent data loss during column creation
    // 9. NEVER override user input during active editing sessions (additional safety)
    const additionalGracePeriod = isTemporaryCell ? 5000 : 0; // Extra 5 seconds for temporary cells
    const extendedEditLockActive = editLock || (editLockStartTime && Date.now() - editLockStartTime < (2000 + additionalGracePeriod));
    
    // Extra safety: if user has typed anything different from the ORIGINAL initialValue, preserve it
    // This prevents cache updates from other cells from overriding user input
    const hasUserInput = value !== originalInitialValue;
    const isActivelyEditing = isEditing || hasLocalChanges || !!editSessionId || !!pendingValue;
    
    if (!hasLocalChanges && !isEditing && !pendingMutation && !editSessionId && !pendingValue && !extendedEditLockActive && !isActivelyEditing) {
      // Additional check: only update if the new value is actually different and user hasn't typed anything
      if (initialValue !== value && !hasUserInput) {
        console.log('Updating initialValue for cell:', cellId, 'from', value, 'to', initialValue);
        setValue(initialValue);
        latestValueRef.current = initialValue;
      } else if (hasUserInput) {
        console.log('Preserving user input for cell:', cellId, 'user value:', value, 'original:', originalInitialValue, 'new initialValue:', initialValue);
      }
    }
  }, [initialValue, hasLocalChanges, isEditing, pendingMutation, editSessionId, pendingValue, value, editLock, editLockStartTime, isTemporaryCell, cellId, originalInitialValue]);

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
      // Always clear timeouts to prevent memory leaks
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (editLockTimeoutRef.current) {
        clearTimeout(editLockTimeoutRef.current);
      }
      
      // Log cleanup for debugging, but don't interfere with ongoing mutations
      if (editSessionId || editLock) {
        console.log('Cleaning up edit session and lock on unmount for cell:', cellId);
        
        // If we have unsaved changes and no pending mutation, trigger a final save
        if (latestValueRef.current !== initialValue && !pendingMutation && !isSaving) {
          console.log('Final save on unmount for cell:', cellId, 'value:', latestValueRef.current);
          
          // Perform immediate cache update to ensure data persistence
          utils.table.getTableData.setInfiniteData({ 
            tableId, 
            limit: 100
          }, (old) => {
            if (!old) return old;
            
            const updatedPages = old.pages.map(page => ({
              ...page,
              rows: page.rows.map(row => ({
                ...row,
                cells: row.cells.map(cell => 
                  cell.id === cellId 
                    ? { ...cell, value: { text: latestValueRef.current } }
                    : cell
                )
              }))
            }));
            
            return {
              ...old,
              pages: updatedPages,
            };
          });
        }
        
        // Don't clear edit locks/sessions on unmount if there are pending mutations
        // The mutations will handle their own cleanup with proper timing
      }
    };
  }, [cellId, editSessionId, editLock, initialValue, isSaving, pendingMutation, tableId, utils.table.getTableData]);

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
    if (shouldFocus && !isEditing && !isEditingDisabled) {
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
    } else if (shouldFocus && isEditingDisabled) {
      console.log('Focus editing disabled due to loading state for cell:', cellId);
    }
  }, [shouldFocus, isEditing, isSelected, onSelect, editSessionId, editLock, cellId, isEditingDisabled]);

  // Track editing state transitions during loading
  useEffect(() => {
    if (isEditingDisabled && isEditing) {
      // Loading started while editing - remember this state
      setWasEditingBeforeLoading(true);
      console.log('Preserving edit state during loading for cell:', cellId);
    } else if (!isEditingDisabled && wasEditingBeforeLoading) {
      // Loading completed and we were editing before - restore edit state
      setWasEditingBeforeLoading(false);
      console.log('Restoring edit state after loading for cell:', cellId);
      
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
      console.log('Editing disabled due to loading state for cell:', cellId);
      return;
    }
    
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
    
    // Prevent editing during loading states
    if (isEditingDisabled) {
      console.log('Double-click editing disabled due to loading state for cell:', cellId);
      return;
    }
    
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
        console.log('Navigation blur: ensuring data persistence for value:', latestValueRef.current);
        
        // Clear any pending auto-save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // ALWAYS save on navigation, even if pendingMutation exists
        // The immediate cache update in saveToServer ensures data persistence
        setIsSaving(true);
        saveToServer(latestValueRef.current);
        
        // DON'T clear edit lock immediately - let the mutation callback handle it with delay
        // This prevents the race condition where the lock is cleared before navigation completes
      } else {
        // No changes, but still delay edit lock release to prevent navigation interference
        setTimeout(() => {
          setEditLock(false);
          setEditLockStartTime(null);
        }, 300);
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
            disabled={isEditingDisabled}
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
          {/* Save status indicator */}
          {!isEditingDisabled && saveStatus === 'saving' && (
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