"use client";

import { useState, useCallback } from "react";
import ChevronDown from "../../icons/ChevronDown";
import Trash from "../../icons/Trash";
import Plus from "../../icons/Plus";

export interface FilterRule {
  id: string;
  columnId: string;
  columnName: string;
  columnType: 'TEXT' | 'NUMBER';
  operator: FilterOperator;
  value?: string | number;
}

export type FilterOperator = 
  // Text operators
  | 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals'
  // Number operators  
  | 'greater_than' | 'less_than';

interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
  width: number;
  tableId: string;
}

interface FilterModalProps {
  columns: Column[];
  filterRules: FilterRule[];
  onUpdateFilterRule: (ruleId: string, operator: FilterOperator, value?: string | number) => void;
  onRemoveFilterRule: (ruleId: string) => void;
  onAddFilterRule: (columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => void;
  onUpdateFilterRuleField: (ruleId: string, columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => void;
}

export function FilterModal({
  columns,
  filterRules,
  onUpdateFilterRule,
  onRemoveFilterRule,
  onAddFilterRule,
  onUpdateFilterRuleField,
}: FilterModalProps) {
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openFieldDropdown, setOpenFieldDropdown] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const getOperatorLabel = useCallback((operator: FilterOperator, columnType: string) => {
    switch (operator) {
      case 'is_empty': return 'is empty';
      case 'is_not_empty': return 'is not empty';
      case 'contains': return 'contains';
      case 'not_contains': return 'does not contain';
      case 'equals': return columnType === 'NUMBER' ? 'equals' : 'is';
      case 'greater_than': return 'is greater than';
      case 'less_than': return 'is less than';
      default: return operator;
    }
  }, []);

  const getOperatorOptions = useCallback((columnType: string) => {
    if (columnType === 'NUMBER') {
      return [
        { value: 'equals' as FilterOperator, label: 'equals' },
        { value: 'greater_than' as FilterOperator, label: 'is greater than' },
        { value: 'less_than' as FilterOperator, label: 'is less than' },
        { value: 'is_empty' as FilterOperator, label: 'is empty' },
        { value: 'is_not_empty' as FilterOperator, label: 'is not empty' },
      ];
    } else {
      return [
        { value: 'contains' as FilterOperator, label: 'contains' },
        { value: 'not_contains' as FilterOperator, label: 'does not contain' },
        { value: 'equals' as FilterOperator, label: 'is' },
        { value: 'is_empty' as FilterOperator, label: 'is empty' },
        { value: 'is_not_empty' as FilterOperator, label: 'is not empty' },
      ];
    }
  }, []);

  const handleOperatorSelect = useCallback((ruleId: string, operator: FilterOperator) => {
    const currentValue = inputValues[ruleId];
    onUpdateFilterRule(ruleId, operator, currentValue);
    setOpenDropdown(null);
  }, [onUpdateFilterRule, inputValues]);

  const handleValueChange = useCallback((ruleId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [ruleId]: value }));
    
    // Find the rule to get its operator and column type
    const rule = filterRules.find(r => r.id === ruleId);
    if (rule) {
      const processedValue = rule.columnType === 'NUMBER' ? parseFloat(value) || 0 : value;
      onUpdateFilterRule(ruleId, rule.operator, processedValue);
    }
  }, [onUpdateFilterRule, filterRules]);

  const handleFieldSelect = useCallback((column: Column) => {
    onAddFilterRule(column.id, column.name, column.type as 'TEXT' | 'NUMBER');
  }, [onAddFilterRule]);

  const handleFieldChange = useCallback((ruleId: string, column: Column) => {
    onUpdateFilterRuleField(ruleId, column.id, column.name, column.type as 'TEXT' | 'NUMBER');
    setOpenFieldDropdown(null);
  }, [onUpdateFilterRuleField]);

  const getFilterRuleForColumn = useCallback((columnId: string) => {
    return filterRules.find(rule => rule.columnId === columnId);
  }, [filterRules]);

  const getAvailableFieldsForRule = useCallback((currentRuleId: string) => {
    return columns.filter(col => {
      // Include current field or fields not used by other rules
      const rule = filterRules.find(r => r.columnId === col.id);
      return !rule || rule.id === currentRuleId;
    });
  }, [columns, filterRules]);

  const needsValueInput = useCallback((operator: FilterOperator) => {
    return !['is_empty', 'is_not_empty'].includes(operator);
  }, []);

  const getFilterText = useCallback((filterRules: FilterRule[]) => {
    if (filterRules.length === 0) return "Filter";
    if (filterRules.length <= 4) {
      const names = filterRules.map(rule => rule.columnName);
      return `Filtered by ${names.join(', ')}`;
    }
    const firstName = filterRules[0]?.columnName ?? '';
    const otherCount = filterRules.length - 1;
    return `Filtered by ${firstName} and ${otherCount} other field${otherCount === 1 ? '' : 's'}`;
  }, []);

  return (
    <div className="py-3">
      {/* Header */}
      <div className="px-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Filter</h3>
        {filterRules.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {getFilterText(filterRules)}
          </p>
        )}
      </div>

      {/* Fields list with filter rules */}
      <div className="max-h-80 overflow-y-auto">
        {columns.map((column) => {
          const filterRule = getFilterRuleForColumn(column.id);
          const ruleIndex = filterRule ? filterRules.findIndex(r => r.id === filterRule.id) : -1;
          
          return (
            <div key={column.id} className="border-b border-gray-50 last:border-b-0">
              {/* Field header - always visible */}
              <div
                className={`flex items-center px-4 py-3 cursor-pointer transition-colors duration-150 ${
                  hoveredField === column.id ? "bg-gray-50" : ""
                } ${filterRule ? "bg-green-25" : ""}`}
                onMouseEnter={() => setHoveredField(column.id)}
                onMouseLeave={() => setHoveredField(null)}
                onClick={() => !filterRule && handleFieldSelect(column)}
              >
                {/* Filter order indicator (only if filtered) */}
                {filterRule && (
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-green-600">{ruleIndex + 1}</span>
                    </div>
                  </div>
                )}

                {/* Field name and type */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <span className={`text-sm font-medium truncate ${
                      filterRule ? 'text-green-900' : 'text-gray-900'
                    }`}>
                      {column.name}
                    </span>
                    <span className={`ml-2 text-xs uppercase ${
                      filterRule ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {column.type}
                    </span>
                  </div>
                </div>

                {/* Filter indicator or add indicator */}
                {filterRule ? (
                  <div className="flex items-center">
                    <span className="text-xs text-green-600 font-medium mr-2">
                      {getOperatorLabel(filterRule.operator, filterRule.columnType)}
                      {needsValueInput(filterRule.operator) && filterRule.value !== undefined && (
                        <span className="ml-1">&quot;{filterRule.value}&quot;</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span className="text-xs text-gray-400">Click to filter</span>
                  </div>
                )}
              </div>

              {/* Filter rule configuration (only if filtered) */}
              {filterRule && (
                <div className="px-4 pb-3 bg-green-25 border-t border-green-100">
                  <div className="flex items-center gap-2 pt-3">
                    {/* Field dropdown */}
                    <div className="flex-1 relative">
                      <button
                        onClick={() => setOpenFieldDropdown(openFieldDropdown === filterRule.id ? null : filterRule.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <span className="truncate">{filterRule.columnName}</span>
                        <ChevronDown size={12} color="#6b7280" />
                      </button>

                      {/* Field dropdown menu */}
                      {openFieldDropdown === filterRule.id && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {getAvailableFieldsForRule(filterRule.id).map((field) => (
                            <button
                              key={field.id}
                              onClick={() => handleFieldChange(filterRule.id, field)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                                field.id === filterRule.columnId ? 'bg-green-50 text-green-700' : 'text-gray-700'
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

                    {/* Operator dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === filterRule.id ? null : filterRule.id)}
                        className="flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 min-w-[120px]"
                      >
                        <span className="mr-1 truncate">{getOperatorLabel(filterRule.operator, filterRule.columnType)}</span>
                        <ChevronDown size={12} color="#6b7280" />
                      </button>

                      {/* Operator dropdown menu */}
                      {openDropdown === filterRule.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                          {getOperatorOptions(filterRule.columnType).map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleOperatorSelect(filterRule.id, option.value)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                                filterRule.operator === option.value ? 'bg-green-50 text-green-700' : 'text-gray-700'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Value input (if needed) */}
                    {needsValueInput(filterRule.operator) && (
                      <div className="flex-1">
                        <input
                          type={filterRule.columnType === 'NUMBER' ? 'number' : 'text'}
                          value={inputValues[filterRule.id] ?? filterRule.value ?? ''}
                          onChange={(e) => handleValueChange(filterRule.id, e.target.value)}
                          placeholder={filterRule.columnType === 'NUMBER' ? 'Enter number' : 'Enter text'}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        />
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={() => onRemoveFilterRule(filterRule.id)}
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

      {/* Add condition button */}
      {filterRules.length < columns.length && (
        <div className="px-4 pt-3">
          <button 
            onClick={() => {
              // Find the first unused column
              const usedColumnIds = new Set(filterRules.map(rule => rule.columnId));
              const availableColumn = columns.find(col => !usedColumnIds.has(col.id));
              if (availableColumn) {
                handleFieldSelect(availableColumn);
              }
            }}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors duration-150"
          >
            <Plus size={14} color="#6b7280" className="mr-2" />
            Add condition
          </button>
        </div>
      )}
    </div>
  );
}