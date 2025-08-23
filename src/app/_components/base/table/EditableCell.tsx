"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";


interface EditableCellProps {
  tableId: string;
  initialValue: string;
  className?: string;
  onNavigate?: (direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right') => void;
  shouldFocus?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onDeselect?: () => void;
  rowId: string;
  columnId: string;
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
  tableId, 
  initialValue, 
  className = "", 
  onNavigate, 
  shouldFocus, 
  isSelected, 
  onSelect, 
  onDeselect: _onDeselect, 
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
  isTableStabilizing: _isTableStabilizing = false,
}: EditableCellProps) {
  const [value, setValue] = useState(initialValue);
  const [lastSaved, setLastSaved] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [isSavingCell, setIsSavingCell] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const utils = api.useUtils();

  
  const updateCellMutation = api.cell.update.useMutation({
    mutationKey: ['cell', 'update', { rowId, columnId }],
    onMutate: async () => {
      setIsSavingCell(true);
      await utils.table.getById.cancel();
      await utils.cell.findByRowColumn.cancel();

      return { prevValue: lastSaved };
    },
    onError: (err, _, context) => {
      if (context?.prevValue) {
        setValue(context.prevValue);
      }
      setIsSavingCell(false);
    },
    onSuccess: () => {
      setIsSavingCell(false);
      setLastSaved(value);
    },
    onSettled: () => {
      setTimeout(() => {
        if (rowId && columnId) {
          void utils.cell.findByRowColumn.invalidate({ rowId, columnId });
        }
        void utils.table.getById.invalidate({ id: tableId });
      }, 1000); // Delay invalidation by 1 second
    }
  });
  
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
        
        // Allow focus if it's a direct navigation action (keyboard)
        if (shouldFocus && !anyModalOpen && !anyModalInputFocused && !anyToolbarInputFocused && !isInputElement) {
          inputRef.current?.focus();
        } else if (!shouldFocus && !isInputElement) {
          // Click navigation - just focus without selecting
          inputRef.current?.focus();
        }
        
      });
    }
  }, [isSelected, shouldFocus, isFocused]);

  // Debounced saving - save 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== lastSaved) {
        void updateCellMutation.mutateAsync({ columnId, rowId, value})
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, lastSaved, columnId, rowId, updateCellMutation]);

  
  //triggers when database resets and initialValue changes to the newest in db
  useEffect(() => {
    setValue(initialValue);
    setLastSaved(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    setIsFocused(false);
  };

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
          onDoubleClick={handleDoubleClick} 
          onContextMenu={handleContextMenu}
          data-cell="true"
        >
          <span className={`${(updateCellMutation.isPending ) ? 'opacity-70' : ''}`}>
            {searchQuery && isSearchMatch ? highlightSearchText(value, searchQuery) : value}
          </span>
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