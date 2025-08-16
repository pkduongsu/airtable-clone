"use client";

import { useState, useCallback } from "react";
import ChevronDown from "../../icons/ChevronDown";
import Trash from "../../icons/Trash";

export interface SortRule {
  id: string;
  columnId: string;
  direction: 'asc' | 'desc';
  columnName: string;
  columnType: string;
}

export type SortDirection = 'asc' | 'desc';

interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
  width: number;
  tableId: string;
}

interface SortModalProps {
  columns: Column[];
  sortRules: SortRule[];
  onUpdateSortRule: (ruleId: string, direction: SortDirection) => void;
  onRemoveSortRule: (ruleId: string) => void;
  onAddSort: () => void;
}

export function SortModal({
  columns,
  sortRules,
  onUpdateSortRule,
  onRemoveSortRule,
  onAddSort,
}: SortModalProps) {
  const [hoveredRule, setHoveredRule] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const getSortDirectionLabel = useCallback((rule: SortRule) => {
    if (rule.columnType === 'NUMBER') {
      return rule.direction === 'asc' ? 'Ascending' : 'Descending';
    } else {
      return rule.direction === 'asc' ? 'A → Z' : 'Z → A';
    }
  }, []);

  const getSortDirectionOptions = useCallback((columnType: string) => {
    if (columnType === 'NUMBER') {
      return [
        { value: 'asc' as SortDirection, label: 'Ascending' },
        { value: 'desc' as SortDirection, label: 'Descending' },
      ];
    } else {
      return [
        { value: 'asc' as SortDirection, label: 'A → Z' },
        { value: 'desc' as SortDirection, label: 'Z → A' },
      ];
    }
  }, []);

  const handleDirectionSelect = useCallback((ruleId: string, direction: SortDirection) => {
    onUpdateSortRule(ruleId, direction);
    setOpenDropdown(null);
  }, [onUpdateSortRule]);

  const availableColumns = columns.filter(col => 
    !sortRules.some(rule => rule.columnId === col.id)
  );

  return (
    <div className="py-3">
      {/* Header */}
      <div className="px-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Sort</h3>
        {sortRules.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {sortRules.length} sort rule{sortRules.length === 1 ? '' : 's'} applied
          </p>
        )}
      </div>

      {/* Sort rules list */}
      <div className="max-h-64 overflow-y-auto">
        {sortRules.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-500">No sort rules applied</p>
            <p className="text-xs text-gray-400 mt-1">Click &ldquo;Add a sort&rdquo; to get started</p>
          </div>
        ) : (
          sortRules.map((rule, index) => (
            <div
              key={rule.id}
              className={`flex items-center px-4 py-3 border-b border-gray-50 last:border-b-0 transition-colors duration-150 ${
                hoveredRule === rule.id ? "bg-gray-25" : ""
              }`}
              onMouseEnter={() => setHoveredRule(rule.id)}
              onMouseLeave={() => setHoveredRule(null)}
            >
              {/* Sort order indicator */}
              <div className="flex-shrink-0 mr-3">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">{index + 1}</span>
                </div>
              </div>

              {/* Column info */}
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {rule.columnName}
                  </span>
                  <span className="ml-2 text-xs text-gray-500 uppercase">
                    {rule.columnType}
                  </span>
                </div>
              </div>

              {/* Direction dropdown */}
              <div className="flex-shrink-0 mr-3 relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === rule.id ? null : rule.id)}
                  className="flex items-center px-2 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="mr-1">{getSortDirectionLabel(rule)}</span>
                  <ChevronDown size={12} color="#6b7280" />
                </button>

                {/* Dropdown menu */}
                {openDropdown === rule.id && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    {getSortDirectionOptions(rule.columnType).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleDirectionSelect(rule.id, option.value)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                          rule.direction === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Remove button */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => onRemoveSortRule(rule.id)}
                  className={`p-1 rounded-md transition-opacity duration-150 hover:bg-red-50 ${
                    hoveredRule === rule.id ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Trash size={14} color="#ef4444" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add sort action */}
      {availableColumns.length > 0 && (
        <div className="px-4 pt-3 border-t border-gray-100">
          <button
            onClick={onAddSort}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:underline"
          >
            + Add{sortRules.length > 0 ? ' another' : ' a'} sort
          </button>
        </div>
      )}

      {/* No more fields message */}
      {availableColumns.length === 0 && sortRules.length > 0 && (
        <div className="px-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">All fields are already being used for sorting</p>
        </div>
      )}
    </div>
  );
}