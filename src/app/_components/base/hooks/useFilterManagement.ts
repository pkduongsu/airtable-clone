import { useState, useCallback } from "react";
import { type FilterRule } from "../modals/FilterModal";

type TableRow = {
  id: string;
  order: number;
  cells: Array<{
    id: string;
    rowId: string;
    columnId: string;
    value: unknown;
    column: {
      id: string;
      name: string;
      type: string;
      order: number;
      width: number;
      tableId: string;
    };
  }>;
};

type SortRule = {
  id: string;
  columnId: string;
  columnName: string;
  columnType: string;
  direction: 'asc' | 'desc';
};

interface UseFilterManagementProps {
  triggerViewSave: (sortRules: SortRule[], filterRules: FilterRule[]) => void;
  sortRules: SortRule[];
}

export function useFilterManagement({ triggerViewSave, sortRules }: UseFilterManagementProps) {
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);

  // Client-side filtering function
  const applyClientSideFilters = useCallback((rows: TableRow[], filterRules: FilterRule[]): TableRow[] => {
    if (filterRules.length === 0) return rows;

    return rows.filter(row => {
      return filterRules.every(rule => {
        const cell = row.cells.find(cell => cell.columnId === rule.columnId);
        const cellValue = cell?.value as { text?: string } | null;
        // Extract text value from cell, handling different value formats
        let textValue = '';
        if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
          textValue = cellValue.text ?? '';
        } else if (typeof cellValue === 'string') {
          textValue = cellValue;
        } else if (cellValue !== null && cellValue !== undefined) {
          // Handle other value types safely
          textValue = typeof cellValue === 'object' ? JSON.stringify(cellValue) : String(cellValue);
        }

        switch (rule.operator) {
          case 'is_empty':
            return textValue === '';
          case 'is_not_empty':
            return textValue !== '';
          case 'contains': {
            const searchValue = typeof rule.value === 'string' ? rule.value : String(rule.value ?? '');
            return textValue.toLowerCase().includes(searchValue.toLowerCase());
          }
          case 'not_contains': {
            const searchValue = typeof rule.value === 'string' ? rule.value : String(rule.value ?? '');
            return !textValue.toLowerCase().includes(searchValue.toLowerCase());
          }
          case 'equals': {
            if (rule.columnType === 'NUMBER') {
              const numValue = parseFloat(textValue) || 0;
              const compareValue = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value ?? '0'));
              return numValue === compareValue;
            }
            const compareValue = typeof rule.value === 'string' ? rule.value : String(rule.value ?? '');
            return textValue.toLowerCase() === compareValue.toLowerCase();
          }
          case 'greater_than': {
            const greaterValue = parseFloat(textValue) || 0;
            const compareValue = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value ?? '0'));
            return greaterValue > compareValue;
          }
          case 'less_than': {
            const lessValue = parseFloat(textValue) || 0;
            const compareValue = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value ?? '0'));
            return lessValue < compareValue;
          }
          default:
            return true;
        }
      });
    });
  }, []);

  // Filter handlers - save immediately on user interaction
  const handleUpdateFilterRule = (ruleId: string, operator: FilterRule['operator'], value?: string | number) => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, operator, value } : rule
      )
    );
    // Save view config immediately when user updates filter
    setTimeout(() => {
      const updatedFilterRules = filterRules.map(rule => 
        rule.id === ruleId ? { ...rule, operator, value } : rule
      );
      triggerViewSave(sortRules, updatedFilterRules);
    }, 100);
  };

  const handleRemoveFilterRule = (ruleId: string) => {
    setFilterRules(prev => prev.filter(rule => rule.id !== ruleId));
    // Save view config immediately when user removes filter
    setTimeout(() => {
      const updatedFilterRules = filterRules.filter(rule => rule.id !== ruleId);
      triggerViewSave(sortRules, updatedFilterRules);
    }, 100);
  };

  const handleAddFilterRule = (columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => {
    const newRule: FilterRule = {
      id: `filter-${Date.now()}-${Math.random()}`,
      columnId,
      columnName,
      columnType,
      operator: (columnType === 'NUMBER' ? 'equals' : 'contains') as FilterRule['operator'],
      value: undefined,
    };
    setFilterRules(prev => [...prev, newRule]);
    // Save view config immediately when user adds filter
    setTimeout(() => {
      const updatedFilterRules = [...filterRules, newRule];
      triggerViewSave(sortRules, updatedFilterRules);
    }, 100);
  };

  const handleUpdateFilterRuleField = (ruleId: string, columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { 
          ...rule, 
          columnId, 
          columnName, 
          columnType,
          operator: (columnType === 'NUMBER' ? 'equals' : 'contains') as FilterRule['operator'], // Reset operator when changing field type
          value: undefined // Reset value when changing field
        } : rule
      )
    );
    // Save view config immediately when user updates filter field
    setTimeout(() => {
      const updatedFilterRules = filterRules.map(rule => 
        rule.id === ruleId ? { 
          ...rule, 
          columnId, 
          columnName, 
          columnType,
          operator: (columnType === 'NUMBER' ? 'equals' : 'contains') as FilterRule['operator'],
          value: undefined
        } : rule
      );
      triggerViewSave(sortRules, updatedFilterRules);
    }, 100);
  };

  const handleUpdateLogicOperator = (ruleId: string, logicOperator: 'and' | 'or') => {
    setFilterRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, logicOperator } : rule
      )
    );
    // Save view config immediately when user updates logic operator
    setTimeout(() => {
      const updatedFilterRules = filterRules.map(rule => 
        rule.id === ruleId ? { ...rule, logicOperator } : rule
      );
      triggerViewSave(sortRules, updatedFilterRules);
    }, 100);
  };

  // Update filter rules (for view changes)
  const updateFilterRules = (newFilterRules: FilterRule[]) => {
    setFilterRules(newFilterRules);
  };

  return {
    // State
    filterRules,
    
    // Functions
    applyClientSideFilters,
    updateFilterRules,
    
    // Handlers
    handleUpdateFilterRule,
    handleRemoveFilterRule,
    handleAddFilterRule,
    handleUpdateFilterRuleField,
    handleUpdateLogicOperator,
  };
}