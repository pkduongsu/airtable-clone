"use client";

import { useState, useCallback, useMemo } from "react";
import Question from "../../icons/Question";
import TextAlt from "../../icons/TextAlt";
import HashStraight from "../../icons/HashStraight";
import DotsSixVertical from "../../icons/DotsSixVertical";

interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
  width: number;
  tableId: string;
}

interface HideFieldsModalProps {
  columns: Column[];
  hiddenColumns: Set<string>;
  onToggleColumn: (columnId: string) => void;
  onHideAll: () => void;
  onShowAll: () => void;
}

export function HideFieldsModal({
  columns,
  hiddenColumns,
  onToggleColumn,
  onHideAll,
  onShowAll,
}: HideFieldsModalProps) {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggle = useCallback((columnId: string) => {
    onToggleColumn(columnId);
  }, [onToggleColumn]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return columns;
    return columns.filter(column => 
      column.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [columns, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const hiddenCount = hiddenColumns.size;

  return (
    <div className="rounded-[3px] bg-white shadow-2xl">
      {/* Header */}
      <div className="mt-2 mx-4 border-b-[2px] border-border-default flex items-center">        
        {/* Search bar */}
          <input
            type="text"
            placeholder="Find a field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-auto px-0 py-2 bg-transparent border-0 rounded-[2px] w-full focus:outline-none font-family-system text-[12px] font-[400] "
          />
          <button className="flex items-center cursor-pointer focus-visible:outline ">
            <Question size={16} color="#616670" />
          </button>
      </div>

      {/* Column list */}
      <div style={{minHeight: '100px', maxHeight: 'calc(-380px + 100vh)'}} className="overflow-y-auto px-4 py-2">
        {filteredColumns.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500 mb-4">No columns found</p>
            <button
              onClick={clearSearch}
              className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
            >
              Clear
            </button>
          </div>
        ) : (
          filteredColumns.map((column) => {
            const isHidden = hiddenColumns.has(column.id);
            const isHovered = hoveredColumn === column.id;

            return (
              <div
                key={column.id}
                className={`flex items-center mt-2 mb-1 justify-center cursor-pointer transition-colors duration-150 ${
                  isHovered ? "bg-gray-50" : ""
                }`}
                onMouseEnter={() => setHoveredColumn(column.id)}
                onMouseLeave={() => setHoveredColumn(null)}
                onClick={() => handleToggle(column.id)}
              >
                {/* Toggle switch */}
                <div className="flex flex-none items-center justify-center">
                  <button
                    className={` cursor-pointer relative inline-flex p-[2px] h-[8px] w-[12px] items-center rounded-[9999px] transition-colors duration-200 focus:outline-none border ${
                      !isHidden
                        ? "bg-[#048A0E] border-[#048A0E]"
                        : "bg-[#0000001A] border-[#00000033]"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(column.id);
                    }}
                  >
                    <span
                      className={`inline-block h-1 w-1 transform rounded-full bg-white transition-transform duration-200 ${
                        !isHidden ? "translate-x-1" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Column info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <div className="ml-4 mr-2 flex-none">
                      {column.type.toLowerCase() === 'text' ? (
                        <TextAlt size={16} color="#1d1f25" />
                      ) : column.type.toLowerCase() === 'number' ? (
                        <HashStraight size={16} color="#1d1f25" />
                      ) : (
                        <TextAlt size={16} color="#1d1f25" />
                      )}
                    </div>
                    <span className="text-[13px] font-family-system font-[400] text-[#1d1f25] truncate">
                      {column.name}
                    </span>
                  </div>
                </div>

                {/* Drag button */}
                <button className="flex items-center focus-visible:outline cursor-pointer hover:text-[#1d1f25]">
                    <DotsSixVertical size={16} color="#616670"  />
                </button>

              </div>
            );
          })
        )}
      </div>
      {/* Hide All/Show All */}
      <div className="my-2 pb-1">
        <div className="flex text-[11px] items-center justify-center text-[#1d1f25] opacity-[0.75] font-family-system font-[500] leading-[18px] px-2 my-2">
            <button 
              onClick={onHideAll}
              disabled={hiddenCount === columns.length}
              className="bg-[#0000000D] flex-1 items-center cursor-pointer focus-visible:outline py-1 mx-2 rounded-[3px]">
              Hide all
            </button>
            <button 
              onClick={onShowAll}
              disabled={hiddenCount === 0}
              className="bg-[#0000000D] flex-1 items-center cursor-pointer focus-visible:outline py-1 mx-2 rounded-[3px]">
              Show all
            </button>
        </div>
      </div>
    </div>
  );
}