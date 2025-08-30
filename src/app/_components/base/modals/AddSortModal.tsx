"use client";

import { useState } from "react";

interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
  width: number;
  tableId: string;
}

interface AddSortModalProps {
  columns: Column[];
  onSelectColumn: (column: Column) => void;
  onClose: () => void;
}

export function AddSortModal({
  columns,
  onSelectColumn,
  onClose,
}: AddSortModalProps) {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  const handleColumnSelect = (column: Column) => {
    onSelectColumn(column);
    onClose();
  };

  return (
    <div className="py-3">
      {/* Header */}
      <div className="px-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Add sort</h3>
        <p className="text-xs text-gray-500 mt-1">
          Choose a field to sort by
        </p>
      </div>

      {/* Column list */}
      <div className="max-h-64 overflow-y-auto">
        {columns.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-500">No available fields</p>
            <p className="text-xs text-gray-400 mt-1">All fields are already being used for sorting</p>
          </div>
        ) : (
          [...columns].sort((a, b) => a.order - b.order).map((column) => (
            <button
              key={column.id}
              onClick={() => handleColumnSelect(column)}
              className={`w-full flex items-center px-4 py-3 text-left transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                hoveredColumn === column.id ? "bg-gray-25" : ""
              }`}
              onMouseEnter={() => setHoveredColumn(column.id)}
              onMouseLeave={() => setHoveredColumn(null)}
            >
              {/* Column info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {column.name}
                  </span>
                  <span className="ml-2 text-xs text-gray-500 uppercase">
                    {column.type}
                  </span>
                </div>
              </div>

              {/* Hover indicator */}
              {hoveredColumn === column.id && (
                <div className="flex-shrink-0 ml-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Cancel action */}
      <div className="px-4 pt-3 border-t border-gray-100">
        <button
          onClick={onClose}
          className="text-sm text-gray-600 hover:text-gray-700 font-medium focus:outline-none focus:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}