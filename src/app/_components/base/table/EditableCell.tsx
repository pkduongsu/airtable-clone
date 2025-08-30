"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";


interface EditableCellProps {
  _tableId: string;
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
  onValueChange?: (rowId: string, columnId: string, value: string) => void; //immediate change,
  canPersist?: boolean;
}

function EditableCell({ 
  _tableId, 
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
  canPersist = true,
}: EditableCellProps) {

  // Debug logging for EditableCell props
  if (rowId.includes('cmex5q5d4yb8')) {
    console.log(`🔍 EditableCell Debug - RowID received: ${rowId}, ColumnID: ${columnId}`);
  }
  
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
      return { prevValue: lastSaved };
    },
    onError: (err, _, context) => {
     
      const code = err?.data?.code ?? err?.message;
      if (code === 'PRECONDITION_FAILED') {
        // queue a retry shortly (or after your next records/columns refetch)
        setTimeout(() => {
          updateCellMutation.mutate({ rowId, columnId, value: { text: value } });
        }, 250);
        return;
      }
  if (context?.prevValue) {
    setValue(context.prevValue);
    onValueChange?.(rowId, columnId, context.prevValue);
  }
    },
    onSuccess: (data) => {
      console.log(`✅ Frontend: Mutation success - RowID: ${rowId}, ColumnID: ${columnId}, CellID: ${data?.id}`);
      setLastSaved(value);
    },
    onSettled: () => {
      console.log(`🏁 Frontend: Mutation settled - RowID: ${rowId}, ColumnID: ${columnId}`);
      //  void utils.table.getById.invalidate({ id: tableId });
    }
  });
  

  // Debounced saving - save 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {

      if (value !== lastSaved && canPersist) {
        console.log(`🚀 Frontend: Calling cell.update mutation - RowID: ${rowId}, ColumnID: ${columnId}, Value: ${value}`, {
          columnId, 
          rowId, 
          value: {text: value},
          canPersist,
          lastSaved
        });
        
        void updateCellMutation.mutateAsync({ columnId, rowId, value: {text: value}})
          .then((result) => {
            console.log(`✅ Frontend: mutateAsync resolved`, result);
          })
          .catch((error) => {
            console.log(`❌ Frontend: mutateAsync rejected`, error);
          });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, lastSaved, columnId, rowId, updateCellMutation, canPersist]);

  
  //triggers when database resets and initialValue changes to the newest in db
  useEffect(() => {
  const next = normalizeToString(initialValue);

  if(!isFocused)
  {
    setValue(next);
    setLastSaved(next);
  }
   //onValueChange?.(rowId, columnId, next);
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [initialValue]);

   const handleBlur = () => {
   if (canPersist && value !== lastSaved) {
     console.log(`🚀 Frontend: Calling cell.update mutation on blur - RowID: ${rowId}, ColumnID: ${columnId}, Value: ${value}`, {
       columnId, 
       rowId, 
       value: {text: value},
       canPersist,
       lastSaved
     });
     updateCellMutation.mutate({ rowId, columnId, value: { text: value } });
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
    // Debug logging for cell focus
    if (rowId.includes('cmex5q5d4yb8')) {
      console.log(`🎯 Cell Focus Debug - RowID: ${rowId}, ColumnID: ${columnId}`);
    }
    
    if (!isFocused) {
      setIsFocused(true);
    }
  };
  
  const handleClick = () => {
    // Debug logging for cell clicks
    if (rowId.includes('cmex5q5d4yb8')) {
      console.log(`🖱️ Cell Click Debug - RowID: ${rowId}, ColumnID: ${columnId}`);
    }
    
    // Always call onSelect to handle cell selection and deselection of other cells
    onSelect?.();
    inputRef.current?.focus({preventScroll: true});
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
    const baseClasses = "w-full h-full px-2 py-1 text-sm text-gray-900 cursor-text border-transparent";
    
    if (isFocused) {
      // Editing state - strong blue border and background
      return `${baseClasses} !bg-white ring-2 ring-blue-500 ring-inset outline-none shadow-sm`;
    } else if (isSearchMatch) {
      return `${baseClasses} ${isCurrentSearchResult ? '!bg-orange-300' : '!bg-yellow-100'} hover:bg-gray-50 border-border-default border`;
    } else {
      return `${baseClasses} hover:bg-gray-50 !border-b border-border-default ${getCellBackgroundColor()}`;
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

export const MemoEditableCell = React.memo(
  EditableCell,
  (prev, next) => {
    return (
      prev.initialValue === next.initialValue &&
      prev.rowId === next.rowId &&
      prev.columnId === next.columnId &&
      prev.hasSort === next.hasSort &&
      prev.hasFilter === next.hasFilter &&
      prev.isSearchMatch === next.isSearchMatch &&
      prev.isCurrentSearchResult === next.isCurrentSearchResult &&
      prev.columnType === next.columnType &&
      prev.canPersist === next.canPersist
    );
  }
);