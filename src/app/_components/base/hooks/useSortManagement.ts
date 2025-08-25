"use client";

import { useState, useCallback } from "react";
import { type SortRule } from "../modals/SortModal";

interface UseSortManagementProps {
  initialSortRules?: SortRule[];
  onSortRulesChange?: (sortRules: SortRule[]) => void;
}

export function useSortManagement({ 
  initialSortRules = [], 
  onSortRulesChange 
}: UseSortManagementProps = {}) {
  const [sortRules, setSortRules] = useState<SortRule[]>(initialSortRules);

  // Update sort rule direction
  const handleUpdateSortRule = useCallback((ruleId: string, direction: 'asc' | 'desc') => {
    setSortRules(prev => {
      const newRules = prev.map(rule => 
        rule.id === ruleId ? { ...rule, direction } : rule
      );
      onSortRulesChange?.(newRules);
      return newRules;
    });
  }, [onSortRulesChange]);

  // Remove a sort rule
  const handleRemoveSortRule = useCallback((ruleId: string) => {
    setSortRules(prev => {
      const newRules = prev.filter(rule => rule.id !== ruleId);
      onSortRulesChange?.(newRules);
      return newRules;
    });
  }, [onSortRulesChange]);

  // Add a new sort rule
  const handleAddSortRule = useCallback((columnId: string, columnName: string, columnType: string) => {
    const newRule: SortRule = {
      id: `sort-${Date.now()}-${Math.random()}`,
      columnId,
      direction: 'asc',
      columnName,
      columnType,
    };
    setSortRules(prev => {
      const newRules = [...prev, newRule];
      onSortRulesChange?.(newRules);
      return newRules;
    });
  }, [onSortRulesChange]);

  // Update sort rule field (change which column is being sorted)
  const handleUpdateSortRuleField = useCallback((ruleId: string, columnId: string, columnName: string, columnType: string) => {
    setSortRules(prev => {
      const newRules = prev.map(rule => 
        rule.id === ruleId ? { ...rule, columnId, columnName, columnType } : rule
      );
      onSortRulesChange?.(newRules);
      return newRules;
    });
  }, [onSortRulesChange]);

  // Update sort rules externally (for view switching)
  const updateSortRules = useCallback((newSortRules: SortRule[]) => {
    setSortRules(newSortRules);
  }, []);

  return {
    sortRules,
    handleUpdateSortRule,
    handleRemoveSortRule,
    handleAddSortRule,
    handleUpdateSortRuleField,
    updateSortRules,
  };
}