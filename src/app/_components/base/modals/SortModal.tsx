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
  onAddSortRule: (columnId: string, columnName: string, columnType: string) => void;
  onUpdateSortRuleField: (ruleId: string, columnId: string, columnName: string, columnType: string) => void;
}

export function SortModal({
  columns,
  sortRules,
  onUpdateSortRule,
  onRemoveSortRule,
  onAddSortRule,
  onUpdateSortRuleField,
}: SortModalProps) {
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openFieldDropdown, setOpenFieldDropdown] = useState<string | null>(null);

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

  const handleFieldSelect = useCallback((column: Column) => {
    onAddSortRule(column.id, column.name, column.type);
  }, [onAddSortRule]);

  const handleFieldChange = useCallback((ruleId: string, column: Column) => {
    onUpdateSortRuleField(ruleId, column.id, column.name, column.type);
    setOpenFieldDropdown(null);
  }, [onUpdateSortRuleField]);

  const getSortRuleForColumn = useCallback((columnId: string) => {
    return sortRules.find(rule => rule.columnId === columnId);
  }, [sortRules]);

  const getAvailableFieldsForRule = useCallback((currentRuleId: string) => {
    return columns.filter(col => {
      // Include current field or fields not used by other rules
      const rule = sortRules.find(r => r.columnId === col.id);
      return !rule || rule.id === currentRuleId;
    });
  }, [columns, sortRules]);

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

      {/* Fields list with sort rules */}
      <div className="max-h-80 overflow-y-auto">
        {columns.map((column) => {
          const sortRule = getSortRuleForColumn(column.id);
          const ruleIndex = sortRule ? sortRules.findIndex(r => r.id === sortRule.id) : -1;
          
          return (
            <div key={column.id} className="border-b border-gray-50 last:border-b-0">
              {/* Field header - always visible */}
              <div
                className={`flex items-center px-4 py-3 cursor-pointer transition-colors duration-150 ${
                  hoveredField === column.id ? "bg-gray-50" : ""
                } ${sortRule ? "bg-blue-25" : ""}`}
                onMouseEnter={() => setHoveredField(column.id)}
                onMouseLeave={() => setHoveredField(null)}
                onClick={() => !sortRule && handleFieldSelect(column)}
              >
                {/* Sort order indicator (only if sorted) */}
                {sortRule && (
                  <div className="flex-shrink-0 mr-3">
                    <span className="text-sm font-medium text-blue-600">
                      {ruleIndex === 0 ? 'Sort by' : 'then by'}
                    </span>
                  </div>
                )}

                {/* Field name and type */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <span className={`text-sm font-medium truncate ${
                      sortRule ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {column.name}
                    </span>
                    <span className={`ml-2 text-xs uppercase ${
                      sortRule ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {column.type}
                    </span>
                  </div>
                </div>

                {/* Sort indicator or add indicator */}
                {sortRule ? (
                  <div className="flex items-center">
                    <span className="text-xs text-blue-600 font-medium mr-2">
                      {getSortDirectionLabel(sortRule)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span className="text-xs text-gray-400">Click to sort</span>
                  </div>
                )}
              </div>

              {/* Sort rule configuration (only if sorted) */}
              {sortRule && (
                <div className="px-4 pb-3 bg-blue-25 border-t border-blue-100">
                  <div className="flex items-center gap-2 pt-3">
                    {/* Field dropdown */}
                    <div className="flex-1 relative">
                      <button
                        onClick={() => setOpenFieldDropdown(openFieldDropdown === sortRule.id ? null : sortRule.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <span className="truncate">{sortRule.columnName}</span>
                        <ChevronDown size={12} color="#6b7280" />
                      </button>

                      {/* Field dropdown menu */}
                      {openFieldDropdown === sortRule.id && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {getAvailableFieldsForRule(sortRule.id).map((field) => (
                            <button
                              key={field.id}
                              onClick={() => handleFieldChange(sortRule.id, field)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                                field.id === sortRule.columnId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                              }`}
                            >
                              <div className="flex items-center">
                                <span className="truncate">{field.name}</span>
                                <span className="ml-2 text-xs text-gray-500 uppercase">{field.type}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Direction dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === sortRule.id ? null : sortRule.id)}
                        className="flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <span className="mr-1">{getSortDirectionLabel(sortRule)}</span>
                        <ChevronDown size={12} color="#6b7280" />
                      </button>

                      {/* Direction dropdown menu */}
                      {openDropdown === sortRule.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                          {getSortDirectionOptions(sortRule.columnType).map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleDirectionSelect(sortRule.id, option.value)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                                sortRule.direction === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => onRemoveSortRule(sortRule.id)}
                      className="p-2 rounded-md hover:bg-red-50 transition-colors duration-150"
                    >
                      <Trash size={14} color="#ef4444" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}