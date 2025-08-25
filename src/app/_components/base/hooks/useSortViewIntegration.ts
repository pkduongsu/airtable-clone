"use client";

import { useEffect, useRef, useCallback } from "react";
import { type SortRule } from "../modals/SortModal";
import { type ViewConfig } from "../modals/CreateViewModal";

interface UseSortViewIntegrationProps {
  sortRules?: SortRule[];
  onSortRulesChange?: (sortRules: SortRule[]) => void;
  currentViewId?: string | null;
  isViewSwitching?: boolean;
  onViewConfigSave?: (config: Partial<ViewConfig>) => void;
}

export function useSortViewIntegration({
  sortRules = [],
  onSortRulesChange,
  currentViewId,
  isViewSwitching,
  onViewConfigSave
}: UseSortViewIntegrationProps) {
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Trigger view save when sort rules change
  const triggerViewSave = useCallback(() => {
    if (!onViewConfigSave || isViewSwitching || !currentViewId) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save operation
    saveTimeoutRef.current = setTimeout(() => {
      onViewConfigSave({
        sortRules,
      });
    }, 500); // 500ms debounce
  }, [sortRules, onViewConfigSave, isViewSwitching, currentViewId]);

  // Auto-save sort rules when they change
  useEffect(() => {
    triggerViewSave();
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [triggerViewSave]);

  // Load sort rules from view config
  const loadViewConfig = useCallback((config: ViewConfig) => {
    if (onSortRulesChange) {
      onSortRulesChange(config.sortRules || []);
    }
  }, [onSortRulesChange]);

  // Create wrapped sort handlers that trigger view save
  const createSortHandlerWithViewSave = useCallback(<T extends unknown[]>(
    handler: (...args: T) => void
  ) => {
    return (...args: T) => {
      handler(...args);
      // Trigger view save after a short delay to ensure state has updated
      setTimeout(() => triggerViewSave(), 0);
    };
  }, [triggerViewSave]);

  return {
    triggerViewSave,
    loadViewConfig,
    createSortHandlerWithViewSave,
  };
}