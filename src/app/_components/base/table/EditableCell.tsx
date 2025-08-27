"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";


interface EditableCellProps {
  tableId: string;
  initialValue: string | number | { text: string } | null;
  className?: string;
  onSelect?: () => void;
  onDeselect?: () => void;
  rowId: string;
  columnId: string;
  onContextMenu?: (event: React.MouseEvent, rowId: string) => void;
  hasSort: boolean;
  hasFilter: boolean;
  searchQuery?: string;
  isSearchMatch?: boolean;
  isCurrentSearchResult?: boolean;
  columnType?: string;
  onValueChange?: (rowId: string, columnId: string, value: string) => void; //immediate change
}

export function EditableCell({ 
  tableId, 
  initialValue, 
  className = "", 
  onSelect, 
  onDeselect: _onDeselect, 
  rowId, 
  columnId, 
  onContextMenu, 
  hasSort,
  hasFilter,
  searchQuery: _searchQuery, 
  isSearchMatch = false, 
  isCurrentSearchResult = false,
  columnType = "TEXT",
  onValueChange,
}: EditableCellProps) {

  
  const normalizeToString = (val: string | number | { text: string } | null): string => {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object" && val?.text) return val.text;
  return "";
};

  const [value, setValue] = useState(normalizeToString(initialValue));
  const [lastSaved, setLastSaved] = useState(normalizeToString(initialValue));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Compute states for visual highlighting
  
  const utils = api.useUtils();
  
  const updateCellMutation = api.cell.update.useMutation({
    mutationKey: ['cell', 'update', { rowId, columnId }],
    onMutate: async () => {
      await utils.table.getById.cancel();
      return { prevValue: lastSaved };
    },
    onError: (err, _, context) => {
      if (context?.prevValue) {
        setValue(context.prevValue);
        onValueChange?.(rowId, columnId, context.prevValue);
      }
    },
    onSuccess: () => {
      setLastSaved(value);
    },
    onSettled: () => {
        void utils.table.getById.invalidate({ id: tableId });
    }
  });
  

  // Debounced saving - save 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {

      if (value !== lastSaved) {
        void updateCellMutation.mutateAsync({ columnId, rowId, value: {text: value}})
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, lastSaved, columnId, rowId, updateCellMutation]);

  
  //triggers when database resets and initialValue changes to the newest in db
  useEffect(() => {
    if(initialValue !== value && value === lastSaved) {
        setValue(value);
        setLastSaved(value);
        onValueChange?.(rowId, columnId, initialValue as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const handleBlur = () => {
    if (value !== lastSaved) {
      updateCellMutation.mutate({ rowId, columnId, value });
    }
    setIsFocused(false);
  };

  // Handle input change with validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Validate number fields - only allow digits, minus sign at start, and one decimal point
    if (columnType === "NUMBER" && newValue !== "") {
      if (!/^-?\d*\.?\d*$/.test(newValue)) {
        return;
      }
    }

    setValue(newValue);
    onValueChange?.(rowId, columnId, newValue);
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