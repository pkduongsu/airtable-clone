"use client";

import { useState, useCallback, useMemo } from "react";
import Plus from "../../icons/Plus";
import X from "../../icons/X";
import { SearchableDropdown } from "../components/SearchableDropdown";
import { SimpleDropdown } from "../components/SimpleDropdown";
import { Toggle } from "../components/Toggle";
import Question from "../../icons/Question";
import MagnifyingGlass from "../../icons/MagnifyingGlass";
import TextAlt from "../../icons/TextAlt";
import HashStraight from "../../icons/HashStraight";

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
  autoSortEnabled?: boolean;
  onToggleAutoSort?: (enabled: boolean) => void;
  onCancel?: () => void;
  onApplySort?: () => void;
}

export function SortModal({
  columns,
  sortRules,
  onUpdateSortRule,
  onRemoveSortRule,
  onAddSortRule,
  onUpdateSortRuleField,
  autoSortEnabled = true,
  onToggleAutoSort,
  onCancel,
  onApplySort,
}: SortModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Convert columns to dropdown options, sorted by column order
  const columnOptions = useMemo(() => {
    return columns
      .sort((a, b) => a.order - b.order)
      .map(column => ({
        id: column.id,
        label: column.name,
        subtitle: column.type.toUpperCase(),
      }));
  }, [columns]);

  // Filter columns based on search query, keeping them sorted by order
  const filteredColumns = useMemo(() => {
    const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
    if (!searchQuery.trim()) return sortedColumns;
    
    return sortedColumns.filter(column =>
      column.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [columns, searchQuery]);

  // Get available columns for a rule (exclude columns already used by other rules)
  const getAvailableColumnsForRule = useCallback((currentRuleId: string) => {
    return columnOptions.filter(option => {
      const rule = sortRules.find(r => r.columnId === option.id);
      return !rule || rule.id === currentRuleId;
    });
  }, [columnOptions, sortRules]);

  // Get sort direction options based on column type
  const getSortDirectionOptions = useCallback((columnType: string) => {
    if (columnType === 'NUMBER') {
      return [
        { id: 'asc', label: 'Increasing' },
        { id: 'desc', label: 'Decreasing' },
      ];
    } else {
      return [
        { id: 'asc', label: 'A → Z' },
        { id: 'desc', label: 'Z → A' },
      ];
    }
  }, []);


  // Handle field selection for new rule
  const handleFieldSelect = useCallback((option: { id: string; label: string; subtitle?: string }) => {
    const column = columns.find(col => col.id === option.id);
    if (column) {
      onAddSortRule(column.id, column.name, column.type);
    }
  }, [columns, onAddSortRule]);

  // Handle field change for existing rule
  const handleFieldChange = useCallback((ruleId: string, option: { id: string; label: string; subtitle?: string }) => {
    const column = columns.find(col => col.id === option.id);
    if (column) {
      onUpdateSortRuleField(ruleId, column.id, column.name, column.type);
    }
  }, [columns, onUpdateSortRuleField]);

  // Handle direction change
  const handleDirectionChange = useCallback((ruleId: string, option: { id: string; label: string }) => {
    onUpdateSortRule(ruleId, option.id as SortDirection);
  }, [onUpdateSortRule]);

  return (
    <div className="overflow-y-auto">
    <div className="p-3 shadow-2xl bg-white">
      {/* Header */}
      <div className="flex justify-between mx-2 items-center">
        <div className="flex items-center">
          <p className="font-family-system text-[13px] leading-[19.5px] font-[500] text-[#616670]  ">Sort by</p>
          <button className="flex items-center cursor-pointer focus-visible:outline ml-1 hover:text-[#1d1f25]">
            <Question size={16} color="#616670" />
          </button>
        </div>
        {sortRules.length === 0 && (
          <div>
            <button className="cursor-pointer focus-visible:outline-none border-0 text-[11px] text-[#1d1f25] font-[400] opacity-[0.75] hover:opacity-[1] transition-opacity duration-200">
              Copy from a view
            </button>
          </div>
        )}
      </div>
      
      <hr className="border-b-0 border-border-default mx-2 my-2"></hr>

      {/* Content area */}
      <div className="px-2 py-1">
        {sortRules.length === 0 ? (
          /* No rules state - show field selection */
          <div>
            {/* Search bar */}
            <div className="flex items-center">
              <MagnifyingGlass 
                size={16} 
                color={isSearchFocused ? "#2563eb" : "#1d1f25"} 
                className={`flex-none transition-all duration-200 ${isSearchFocused ? "opacity-100" : "opacity-[0.5]"}`} 
              />
              <input
                type="text"
                placeholder="Find a field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="flex-auto outline-0 border-0 pl-3 box-border py-1 pr-1 rounded-[2px] text-[#1d1f25] font-family-system text-[13px] font-400 leading-[18px] "
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-[3px] transition-colors duration-150"
                  title="Clear search"
                >
                  <X size={12} color="#6b7280" />
                </button>
              )}
            </div>

            {/* Fields list */}
            <div className="mt-2 max-h-64 overflow-y-auto">
                {filteredColumns.length > 0 ? (
                  filteredColumns.map((column) => (
                    <button
                      key={column.id}
                      onClick={() => handleFieldSelect({
                        id: column.id,
                        label: column.name,
                        subtitle: column.type.toUpperCase()
                      })}
                      className="w-full flex items-center px-2 py-1 rounded-[3px] cursor-pointer bg-white hover:bg-[#0000000d]"
                    >
                      <div className="mr-2 flex-none">
                        {column.type.toLowerCase() === 'text' ? (
                          <TextAlt size={16} color="#1d1f25" />
                        ) : column.type.toLowerCase() === 'number' ? (
                          <HashStraight size={16} color="#1d1f25" />
                        ) : (
                          <TextAlt size={16} color="#1d1f25" />
                        )}
                      </div>
                      <span className="font-family-system text-[#1d1f25] text-[13px] font-[400] leading-[18px] box-border">{column.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center text-gray-500 text-sm">
                    No results
                  </div>
                )}
            </div>
          </div>
        ) : (
          /* Rules state - show sort rules */
          <div className="max-h-64 overflow-y-auto">
            <div className="space-y-2 pt-2">
              {sortRules.map((rule, _index) => {
                const availableColumns = getAvailableColumnsForRule(rule.id);
                const directionOptions = getSortDirectionOptions(rule.columnType);
                
                return (
                  <div key={rule.id} className="flex items-center gap-2 px-2">
                    {/* Field dropdown */}
                    <div className="flex-1 min-w-0">
                      <SearchableDropdown
                        value={rule.columnId}
                        placeholder="Select field"
                        options={availableColumns}
                        onSelect={(option) => handleFieldChange(rule.id, option)}
                        searchPlaceholder="Find a field"
                        width={200}
                      />
                    </div>

                    {/* Direction dropdown */}
                    <div className="w-24">
                      <SimpleDropdown
                        value={rule.direction}
                        placeholder="Direction"
                        options={directionOptions}
                        onSelect={(option) => handleDirectionChange(rule.id, option)}
                        width={96}
                      />
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => onRemoveSortRule(rule.id)}
                      className="flex-shrink-0 flex cursor-pointer items-center justify-center rounded-[3px] w-7 h-7 hover:bg-gray-100"
                      title="Remove sort rule"
                    >
                      <X size={14} color="#1d1f25" className="opacity-[0.5]" />
                    </button>
                  </div>
                );
              })}

              {/* Add another sort button */}
              <div className="flex flex-auto">
                <div className="flex flex-auto relative">
                  <button
                    onClick={() => {
                      // Find the first available column not already used, ordered by column order
                      const usedColumnIds = sortRules.map(rule => rule.columnId);
                      const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
                      const availableColumn = sortedColumns.find(col => !usedColumnIds.includes(col.id));
                      if (availableColumn) {
                        onAddSortRule(availableColumn.id, availableColumn.name, availableColumn.type);
                      }
                    }}
                    disabled={sortRules.length >= columns.length}
                    className="flex items-center cursor-pointer font-[500] font-family-system text-[13px] leading-[18px] h-[32px] opacity-[0.75] hover:opacity-[1]"
                  >
                    <div className="truncate flex-auto text-right">
                      <div className="flex items-center ml-2">
                        <Plus size={16} color="#1d1f25" className="flex-none mr-3 opacity-[0.75]"/>
                        <p className="font-family-system leading-[19.5px] font-[400] text-[13px] opacity-[0.75]">Add another sort</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Footer - only show when there are sort rules */}
      {sortRules.length > 0 && (
        <div className="mt-auto bg-[#f2f4f8] border-t border-border-default w-full h-[45px] flex-shrink-0">
          <div className="flex justify-between items-center px-4 h-full">
            {/* Auto-sort toggle */}
            <div>
              <Toggle
                enabled={autoSortEnabled}
                onToggle={onToggleAutoSort ?? (() => undefined)}
                label="Automatically sort records"
              />
            </div>

            {/* Manual mode buttons */}
            {!autoSortEnabled && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onCancel}
                  className="cursor-pointer px-2 py-1 font-family-system text-[#1d1f25] font-[400] text-[13px] opacity-[0.75] hover:opacity-[1] rounded-[3px] transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  onClick={onApplySort}
                  className="cursor-pointer flex items-center text-[13px] font-family-system box-border focus-visible:outline rounded-[6px] border-none text-white font-[500] leading-[22px] shadow-md px-2 flex-inline bg-[#166EE1] h-[28px] "
                >
                  Sort
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}