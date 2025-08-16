"use client";

import { useState, useCallback } from "react";

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

  const handleToggle = useCallback((columnId: string) => {
    onToggleColumn(columnId);
  }, [onToggleColumn]);

  const visibleCount = columns.length - hiddenColumns.size;
  const hiddenCount = hiddenColumns.size;

  return (
    <div className="py-3">
      {/* Header */}
      <div className="px-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Hide fields</h3>
        <p className="text-xs text-gray-500 mt-1">
          {visibleCount} visible, {hiddenCount} hidden
        </p>
      </div>

      {/* Column list */}
      <div className="max-h-64 overflow-y-auto">
        {columns.map((column) => {
          const isHidden = hiddenColumns.has(column.id);
          const isHovered = hoveredColumn === column.id;

          return (
            <div
              key={column.id}
              className={`flex items-center px-4 py-2 cursor-pointer transition-colors duration-150 ${
                isHovered ? "bg-gray-50" : ""
              }`}
              onMouseEnter={() => setHoveredColumn(column.id)}
              onMouseLeave={() => setHoveredColumn(null)}
              onClick={() => handleToggle(column.id)}
            >
              {/* Toggle switch */}
              <div className="flex-shrink-0 mr-3">
                <button
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    !isHidden
                      ? "bg-blue-600"
                      : "bg-gray-200"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(column.id);
                  }}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                      !isHidden ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

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

              {/* Visibility indicator */}
              <div className="flex-shrink-0 ml-2">
                {isHidden ? (
                  <span className="text-xs text-gray-400">Hidden</span>
                ) : (
                  <span className="text-xs text-green-600">Visible</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 border-t border-gray-100">
        <div className="flex space-x-2">
          <button
            onClick={onHideAll}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
            disabled={hiddenCount === columns.length}
          >
            Hide all
          </button>
          <button
            onClick={onShowAll}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
            disabled={hiddenCount === 0}
          >
            Show all
          </button>
        </div>
      </div>
    </div>
  );
}