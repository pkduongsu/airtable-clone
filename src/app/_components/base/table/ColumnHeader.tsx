"use client";

import { useState } from "react";
import { flexRender, type Header } from "@tanstack/react-table";
import ChevronDown from "../../icons/ChevronDown";
import TextAlt from "../../icons/TextAlt";
import HashStraight from "../../icons/HashStraight";

type TableRow = {
  id: string;
  __cellIds: Record<string, string>;
  [key: string]: string | undefined | Record<string, string>;
};

interface ColumnHeaderProps {
  header: Header<TableRow, unknown>;
  onColumnAction?: (position: { x: number; y: number }, column: { id: string; name: string }) => void;
  tableColumns: Array<{
    id: string;
    name: string;
    type: string;
    order: number;
    width: number;
    tableId: string;
  }>;
}

export function ColumnHeader({ 
  header, 
  onColumnAction, 
  tableColumns 
}: ColumnHeaderProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const column = tableColumns.find(col => col.id === header.id);
    if (column && onColumnAction) {
      onColumnAction(
        { x: rect.left, y: rect.bottom + 5 },
        { id: column.id, name: column.name }
      );
    }
  };

  return (
    <th
      key={header.id}
      className="text-left p-0 text-[#1d1f25] bg-white border-b border-r border-border-default hover:bg-[#f8f8f8] relative"
      style={{
        display: 'flex',
        width: header.getSize(),
      }}
    >
      <div 
        className="px-3 py-2 h-[32px] flex items-center justify-between text-xs font-family-system font-[500] text-[13px] leading-[19.5px] w-full"                     
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="truncate flex items-center gap-1">
          {header.isPlaceholder ? null : (
            <>
              {/* Column type indicator */}
              {header.id !== '__rowNumber' && (() => {
                const column = tableColumns.find(col => col.id === header.id);
                if (column?.type === 'NUMBER') {
                  return <HashStraight size={16} color="#1d1f25" />;
                } else if (column?.type === 'TEXT') {
                  return <TextAlt size={16} color="#1d1f25" />;
                }
                return null;
              })()}
              {flexRender(
                header.column.columnDef.header,
                header.getContext()
              )}
            </>
          )}
        </span>
        {header.id !== '__rowNumber' && (
          <button 
            className={`ml-1 cursor-pointer flex-shrink-0 transition-opacity duration-75 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleDropdownClick}
          >
            <ChevronDown size={16} color="#616670" className="hover:text-[#1d1f25]"/>
          </button>
        )}
      </div>
      {/* Column resize handle */}
      <div
        {...{
          onDoubleClick: () => header.column.resetSize(),
          onMouseDown: header.getResizeHandler(),
          onTouchStart: header.getResizeHandler(),
        }}
        className={`absolute right-0 top-[5px] bottom-[5px] w-[1px] rounded-[2px] cursor-col-resize hover:bg-[#166ee1] transition-opacity ${
          header.column.getIsResizing() ? 'bg-[#166ee1] opacity-100' : 'opacity-0 hover:opacity-100'
        }`}
      />
    </th>
  );
}