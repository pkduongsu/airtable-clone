"use client";

import { useMemo, useCallback } from "react";
import { type SortRule } from "../modals/SortModal";

// Use the actual data types from the parent
type TableData = {
  id: string;
  name: string;
  columns: Array<{
    id: string;
    name: string;
    type: string;
    order: number;
    width: number;
    tableId: string;
  }>;
  rows: Array<{
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
  }>;
  _count: {
    rows: number;
  };
};

interface UseSortDataProcessorProps {
  baseData: TableData | null;
  sortRules: SortRule[];
  serverProcessedData?: TableData | null;
}

export function useSortDataProcessor({
  baseData,
  sortRules,
  serverProcessedData
}: UseSortDataProcessorProps) {
  
  // Client-side sorting function
  const applyClientSideSorting = useCallback((rows: TableData['rows'], sortRules: SortRule[]): TableData['rows'] => {
    if (sortRules.length === 0) return rows;

    return [...rows].sort((a, b) => {
      for (const rule of sortRules) {
        const cellA = a.cells.find(cell => cell.columnId === rule.columnId);
        const cellB = b.cells.find(cell => cell.columnId === rule.columnId);
        
        const valueA = cellA?.value as { text?: string } | null;
        const valueB = cellB?.value as { text?: string } | null;
        
        const textA = valueA?.text ?? '';
        const textB = valueB?.text ?? '';
        
        // Determine column type from the first sort rule's column
        const isNumber = rule.columnType === 'NUMBER';
        
        let comparison = 0;
        
        if (isNumber) {
          // For NUMBER columns, try to parse as numbers first
          const numA = parseFloat(textA) || 0;
          const numB = parseFloat(textB) || 0;
          
          // Handle empty strings as 0 for number comparison
          const finalA = textA === '' ? 0 : numA;
          const finalB = textB === '' ? 0 : numB;
          
          comparison = finalA - finalB;
        } else {
          // For TEXT columns, use string comparison
          comparison = textA.localeCompare(textB);
        }
        
        if (comparison !== 0) {
          return rule.direction === 'asc' ? comparison : -comparison;
        }
      }
      
      // If all sort rules are equal, fall back to row order
      return a.order - b.order;
    });
  }, []);

  // Process table data with sorting
  const processedTableData = useMemo(() => {
    if (!baseData) return null;
    
    // If we have no sort rules, return base data or server data
    if (sortRules.length === 0) {
      return serverProcessedData ?? baseData;
    }
    
    // If we have server-side processed data that matches current rules, prefer it
    if (serverProcessedData && sortRules.length > 0) {
      return serverProcessedData;
    }
    
    // Apply client-side sorting to base data
    const sortedRows = applyClientSideSorting(baseData.rows, sortRules);

    return {
      ...baseData,
      rows: sortedRows,
    };
  }, [baseData, sortRules, serverProcessedData, applyClientSideSorting]);

  // Check if we're currently processing sorts
  const isProcessingSorts = useMemo(() => {
    return sortRules.length > 0 && !serverProcessedData && !!baseData;
  }, [sortRules.length, serverProcessedData, baseData]);

  return {
    processedTableData,
    isProcessingSorts,
    applyClientSideSorting,
  };
}