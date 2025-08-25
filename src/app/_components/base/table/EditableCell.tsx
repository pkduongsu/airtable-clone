"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { api } from "~/trpc/react";


interface EditableCellProps {
  tableId: string;
  initialValue: string;
  className?: string;
  onNavigate?: (direction: 'tab' | 'shift-tab' | 'enter' | 'up' | 'down' | 'left' | 'right') => void;
  // Focus state ref for highlighting without re-renders
  focusStateRef?: React.RefObject<{
    focusedRowId: string | null;
    focusedColumnId: string | null;
    selectedRowId: string | null;
    selectedColumnId: string | null;
  }>;
  navigatedCell?: {rowIndex: number, columnIndex: number} | null;
  rowIndex: number;
  columnIndex: number;
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
  focusStateRef,
  navigatedCell,
  rowIndex,
  columnIndex,
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
  
  // Compute states for visual highlighting
  const isNavigated = navigatedCell?.rowIndex === rowIndex && navigatedCell?.columnIndex === columnIndex;
  const isFocusedByRef = focusStateRef?.current?.focusedRowId === rowId && focusStateRef?.current?.focusedColumnId === columnId;
  
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
    // Double click - select all text
    if (inputRef.current) {
      inputRef.current.select();
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
            className={isCurrentSearchResult ? 'bg-orange-500' : 'bg-yellow-300'}
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

  // Determine cell styling based on state
  const getCellClassName = () => {
    const baseClasses = "w-full h-full px-2 py-1 text-sm text-gray-900 cursor-text border border-transparent";
    
    if (isFocused) {
      // Editing state - strong blue border and background
      return `${baseClasses} !bg-white !border-2 !border-blue-600 shadow-sm`;
    } else if (isSearchMatch) {
      return `${baseClasses} ${isCurrentSearchResult ? '!bg-orange-300' : '!bg-yellow-100'} hover:bg-gray-50`;
    } else {
      return `${baseClasses} hover:bg-gray-50 ${getCellBackgroundColor()}`;
    }
  };

  return (
    <div className={`w-full h-full flex items-center ${className}`}>
      <div className="relative w-full h-full">
        {/* Always visible input - let it handle its own focus naturally */}
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          className={getCellClassName()}
          data-cell-id={`${rowId}-${columnId}`}
        />
      </div>
    </div>
  );
}