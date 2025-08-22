"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { useQueryClient } from "@tanstack/react-query";

// Global debounced invalidation to prevent multiple overlapping table refreshes
const globalInvalidationTimers = new Map<string, ReturnType<typeof setTimeout>>();

const createDebouncedTableInvalidation = (utils: any, tableId: string) => {
  return () => {
    // Cancel any existing timer for this table
    const existingTimer = globalInvalidationTimers.get(tableId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        // Universal detection: any table cell OR any modal/input context
        const anyCellFocused = document.querySelector('[data-cell] input:focus');
        const anyModalOpen = document.querySelector('[role="dialog"], [aria-modal="true"], [class*="Modal"]');
        const anyModalInputFocused = document.querySelector('[role="dialog"] input:focus, [aria-modal="true"] input:focus, [class*="Modal"] input:focus');
        const anyToolbarInputFocused = document.querySelector('[role="toolbar"] input:focus, [data-toolbar] input:focus');
        
        if (!anyCellFocused && !anyModalOpen && !anyModalInputFocused && !anyToolbarInputFocused) {
          void utils.table.getTableData.invalidate({ tableId });
        }
      });
    }, 1000);
    
    globalInvalidationTimers.set(tableId, timer);
  };
};

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
  columnId?: string;
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
  searchQuery?: string;
  isSearchMatch?: boolean;
  isCurrentSearchResult?: boolean;
  columnType?: string;
  isTableLoading?: boolean;
  isTableStabilizing?: boolean;
}

export function EditableCell({ 
  cellId, 
  tableId, 
  initialValue, 
  className = "", 
  onNavigate, 
  shouldFocus, 
  isSelected, 
  onSelect, 
  onDeselect, 
  rowId, 
  columnId, 
  onContextMenu, 
  sortRules = [], 
  filterRules = [], 
  searchQuery, 
  isSearchMatch = false, 
  isCurrentSearchResult = false,
  columnType = "TEXT",
  isTableLoading: _isTableLoading = false,
  isTableStabilizing: _isTableStabilizing = false
}: EditableCellProps) {
  const [value, setValue] = useState(initialValue);
  const [lastSaved, setLastSaved] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  
  // Use global debounced invalidation shared across all cells
  const debouncedInvalidateTable = useCallback(
    createDebouncedTableInvalidation(utils, tableId),
    [utils, tableId]
  );
  
  // Determine if we need to create a new cell
  const shouldCreateCell = cellId?.startsWith('temp-cell-') ?? false;
  
  const updateCellMutation = api.cell.update.useMutation({
    mutationKey: ['cell', 'update'],
    onMutate: async ({ value: newValue }) => {
      await utils.table.getTableData.cancel({ tableId, limit: 100 });
      
      // Optimistically update the cache
      const previousData = utils.table.getTableData.getInfiniteData({ tableId, limit: 100 });
      
      utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, (old) => {
        if (!old) return old;
        
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
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
      
      return { previousData, prevValue: lastSaved };
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        utils.table.getTableData.setInfiniteData({ tableId, limit: 100 }, context.previousData);
      }
      if (context?.prevValue) {
        setValue(context.prevValue);
        setLastSaved(context.prevValue);
      }
    },
    onSuccess: () => {
      // Use debounced invalidation to prevent multiple overlapping calls
      debouncedInvalidateTable();
    },
  });
  
  const createCellMutation = api.cell.create.useMutation({
    onMutate: async ({ value: newValue }) => {
      await utils.table.getTableData.cancel({ tableId, limit: 100 });
      
      // For create, just preserve the local state
      return { prevValue: lastSaved };
    },
    onError: (err, _, context) => {
      if (context?.prevValue) {
        setValue(context.prevValue);
        setLastSaved(context.prevValue);
      }
    },
    onSuccess: () => {
      // Use debounced invalidation to prevent multiple overlapping calls
      debouncedInvalidateTable();
    },
  });

  // Save function with server logic
  const saveToServer = useCallback(async (newValue: string) => {
    if (newValue === lastSaved || !cellId || !rowId || !columnId) {
      return;
    }
    
    // Skip saving for temporary/invalid IDs that don't exist in database
    const isTemporaryRow = rowId.startsWith('temp-row-');
    const isTemporaryColumn = columnId.startsWith('temp-column-');
    
    if (isTemporaryRow || isTemporaryColumn) {
      // Just update local state for temporary entities
      setLastSaved(newValue);
      return;
    }
    
    if (shouldCreateCell) {
      // For new cells, try to find existing cell first
      try {
        const existingCell = await utils.cell.findByRowColumn.fetch({ rowId, columnId });
        if (existingCell) {
          await updateCellMutation.mutateAsync({ cellId: existingCell.id, value: newValue });
        } else {
          // Validate that row and column exist before creating cell
          await createCellMutation.mutateAsync({ rowId, columnId, value: newValue });
        }
      } catch (error) {
        // If find or create fails due to FK constraint, just update local state
        console.warn('Failed to save cell - row or column may not exist:', error);
        setLastSaved(newValue);
        return;
      }
    } else {
      // Update existing cell
      try {
        await updateCellMutation.mutateAsync({ cellId, value: newValue });
      } catch (error) {
        console.warn('Failed to update cell:', error);
        setLastSaved(newValue);
        return;
      }
    }
    
    setLastSaved(newValue);
  }, [lastSaved, cellId, rowId, columnId, shouldCreateCell, utils.cell.findByRowColumn, updateCellMutation, createCellMutation]);

  // Update value when initialValue changes (external data updates)
  // Only update if:
  // 1. Cell is not currently focused (user not actively editing)
  // 2. No unsaved changes (value equals lastSaved)
  // 3. No pending mutations (not currently saving)
  useEffect(() => {
    const hasUnsavedChanges = value !== lastSaved;
    const isSaving = updateCellMutation.isPending || createCellMutation.isPending;
    
    if (!isFocused && !hasUnsavedChanges && !isSaving && initialValue !== value) {
      setValue(initialValue);
      setLastSaved(initialValue);
    }
  }, [initialValue, isFocused, value, lastSaved, updateCellMutation.isPending, createCellMutation.isPending]);

  // Cleanup global timer on unmount
  useEffect(() => {
    return () => {
      const timer = globalInvalidationTimers.get(tableId);
      if (timer) {
        clearTimeout(timer);
        globalInvalidationTimers.delete(tableId);
      }
    };
  }, [tableId]);

  // Focus cell when it becomes selected (click) or when shouldFocus is set (keyboard)
  useEffect(() => {
    if (isSelected && inputRef.current && !isFocused) {
      // Use requestAnimationFrame to ensure DOM has settled after potential modal opening
      requestAnimationFrame(() => {
        // Universal modal detection - don't auto-focus if any modal is open or modal input is focused
        const anyModalOpen = document.querySelector('[role="dialog"], [aria-modal="true"], [class*="Modal"]');
        const anyModalInputFocused = document.querySelector('[role="dialog"] input:focus, [aria-modal="true"] input:focus, [class*="Modal"] input:focus');
        const anyToolbarInputFocused = document.querySelector('[role="toolbar"] input:focus, [data-toolbar] input:focus');
        const activeElement = document.activeElement;
        const isInputElement = activeElement && activeElement.tagName === 'INPUT';
        
        // Don't steal focus from any input or if any modal is open
        if (!anyModalOpen && !anyModalInputFocused && !anyToolbarInputFocused && !isInputElement) {
          if (shouldFocus) {
            // Keyboard navigation - select all text
            inputRef.current?.focus();
            inputRef.current?.select();
          } else {
            // Click navigation - just focus
            inputRef.current?.focus();
          }
        }
      });
    }
  }, [isSelected, shouldFocus, isFocused]);

  // Debounced saving - save 500ms after user stops typing
  useEffect(() => {
    if (value === lastSaved || value === initialValue) return;
    
    const timer = setTimeout(() => {
      void saveToServer(value);
    }, 500);

    return () => clearTimeout(timer);
  }, [value, lastSaved, initialValue, saveToServer]);

  // Handle input change with validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Validate number fields
    if (columnType === "NUMBER" && newValue !== "" && !/^\d*\.?\d*$/.test(newValue)) {
      return;
    }

    setValue(newValue);
  };

  const handleFocus = () => {
    if (!isFocused) {
      setIsFocused(true);
    }
  };
  
  const handleClick = () => {
    // Always call onSelect to handle cell selection and deselection of other cells
    onSelect?.();
  };
  
  const handleDoubleClick = () => {
    // Double click - select and focus for editing
    if (!isSelected) {
      onSelect?.();
    }
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        inputRef.current?.blur();
        onNavigate?.('enter');
        break;
      case 'Tab':
        e.preventDefault();
        inputRef.current?.blur();
        onNavigate?.(e.shiftKey ? 'shift-tab' : 'tab');
        break;
      case 'Escape':
        e.preventDefault();
        setValue(lastSaved);
        inputRef.current?.blur();
        break;
      case 'ArrowUp':
        e.preventDefault();
        inputRef.current?.blur();
        onNavigate?.('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        inputRef.current?.blur();
        onNavigate?.('down');
        break;
      case 'ArrowLeft':
        // Only navigate if cursor is at the beginning
        const input = e.currentTarget as HTMLInputElement;
        if (input.selectionStart === 0) {
          e.preventDefault();
          inputRef.current?.blur();
          onNavigate?.('left');
        }
        break;
      case 'ArrowRight':
        // Only navigate if cursor is at the end
        const inputRight = e.currentTarget as HTMLInputElement;
        if (inputRight.selectionStart === inputRight.value.length) {
          e.preventDefault();
          inputRef.current?.blur();
          onNavigate?.('right');
        }
        break;
    }
  };

  // Color cell based on filters and sorts (not search - that's handled separately)
  const getCellBackgroundColor = () => {
    const hasSort = sortRules.some(rule => rule.columnId === columnId);
    const hasFilter = filterRules.some(rule => rule.columnId === columnId);
    
    if (hasSort && hasFilter) {
      return 'bg-[#EBE6A7]';
    }
    if (hasFilter) {
      return 'bg-[#EBFBEC]';
    }
    if (hasSort) {
      return 'bg-[#FFF2EA]';
    }
    
    return '';
  };

  // Highlight search text within cell value
  const highlightSearchText = (text: string, query: string) => {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span 
            key={index} 
            className={isCurrentSearchResult ? 'bg-orange-300' : 'bg-yellow-300'}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (rowId && onContextMenu) {
      onContextMenu(e, rowId);
    }
  };

  // Determine cell styling based on state (original approach)
  const getCellClassName = () => {
    const baseClasses = "w-full h-full px-2 py-1 flex items-center text-sm text-gray-900";
    
    if (isSelected) {
      return `${baseClasses} cursor-text bg-blue-50 border border-blue-500 border-solid`;
    } else if (isSearchMatch) {
      return `${baseClasses} cursor-text ${isCurrentSearchResult ? 'bg-orange-100' : 'bg-yellow-100'} hover:bg-[#f8f8f8]`;
    } else {
      return `${baseClasses} cursor-text hover:bg-[#f8f8f8] ${getCellBackgroundColor()}`;
    }
  };

  return (
    <div className={`w-full h-full flex items-center ${className}`}>
      <div className="relative w-full h-full">
        <div 
          className={getCellClassName()}
          onClick={handleClick} // Click to select and focus input
          onDoubleClick={handleDoubleClick} // Double click to focus input  
          onContextMenu={handleContextMenu}
          data-cell="true"
          data-cell-id={cellId}
        >
          <span className={`${(updateCellMutation.isPending || createCellMutation.isPending) ? 'opacity-70' : ''}`}>
            {searchQuery && isSearchMatch ? highlightSearchText(value, searchQuery) : value}
          </span>
          {(updateCellMutation.isPending || createCellMutation.isPending) && (
            <span className="ml-1 text-xs text-gray-400">Saved</span>
          )}
        </div>
        {/* Hidden input for editing */}
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 w-full h-full px-2 py-1 text-sm text-gray-900 bg-transparent border-none focus:outline-none focus:bg-white focus:border focus:border-blue-500 focus:border-solid"
          style={{
            opacity: isFocused ? 1 : 0,
            pointerEvents: isFocused ? 'auto' : 'none'
          }}
        />
      </div>
    </div>
  );
}