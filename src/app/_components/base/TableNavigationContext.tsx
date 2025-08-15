"use client";

import { createContext, useContext, useCallback, useRef } from "react";

export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

export interface CellNavigationRef {
  focus: () => void;
  startEdit: () => void;
}

interface TableNavigationContextType {
  registerCell: (position: CellPosition, ref: CellNavigationRef) => void;
  unregisterCell: (position: CellPosition) => void;
  navigateToCell: (position: CellPosition) => void;
  handleNavigation: (currentPosition: CellPosition, direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'shift-tab') => void;
  totalRows: number;
  totalColumns: number;
}

const TableNavigationContext = createContext<TableNavigationContextType | null>(null);

export function useTableNavigation() {
  const context = useContext(TableNavigationContext);
  if (!context) {
    throw new Error('useTableNavigation must be used within a TableNavigationProvider');
  }
  return context;
}

interface TableNavigationProviderProps {
  children: React.ReactNode;
  totalRows: number;
  totalColumns: number;
}

export function TableNavigationProvider({ children, totalRows, totalColumns }: TableNavigationProviderProps) {
  const cellRefs = useRef<Map<string, CellNavigationRef>>(new Map());
  
  const getCellKey = useCallback((position: CellPosition) => {
    return `${position.rowIndex}-${position.columnIndex}`;
  }, []);

  const registerCell = useCallback((position: CellPosition, ref: CellNavigationRef) => {
    const key = getCellKey(position);
    cellRefs.current.set(key, ref);
  }, [getCellKey]);

  const unregisterCell = useCallback((position: CellPosition) => {
    const key = getCellKey(position);
    cellRefs.current.delete(key);
  }, [getCellKey]);

  const navigateToCell = useCallback((position: CellPosition) => {
    const key = getCellKey(position);
    const cellRef = cellRefs.current.get(key);
    if (cellRef) {
      cellRef.focus();
    }
  }, [getCellKey]);

  const handleNavigation = useCallback((currentPosition: CellPosition, direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'shift-tab') => {
    const newPosition = { ...currentPosition };

    switch (direction) {
      case 'up':
        if (currentPosition.rowIndex > 0) {
          newPosition.rowIndex = currentPosition.rowIndex - 1;
        }
        break;
      case 'down':
        if (currentPosition.rowIndex < totalRows - 1) {
          newPosition.rowIndex = currentPosition.rowIndex + 1;
        }
        break;
      case 'left':
        if (currentPosition.columnIndex > 0) {
          newPosition.columnIndex = currentPosition.columnIndex - 1;
        }
        break;
      case 'right':
        if (currentPosition.columnIndex < totalColumns - 1) {
          newPosition.columnIndex = currentPosition.columnIndex + 1;
        }
        break;
      case 'tab':
        // Tab moves right, then to next row
        if (currentPosition.columnIndex < totalColumns - 1) {
          newPosition.columnIndex = currentPosition.columnIndex + 1;
        } else if (currentPosition.rowIndex < totalRows - 1) {
          newPosition.rowIndex = currentPosition.rowIndex + 1;
          newPosition.columnIndex = 0;
        }
        break;
      case 'shift-tab':
        // Shift+Tab moves left, then to previous row
        if (currentPosition.columnIndex > 0) {
          newPosition.columnIndex = currentPosition.columnIndex - 1;
        } else if (currentPosition.rowIndex > 0) {
          newPosition.rowIndex = currentPosition.rowIndex - 1;
          newPosition.columnIndex = totalColumns - 1;
        }
        break;
    }

    // Only navigate if position actually changed
    if (newPosition.rowIndex !== currentPosition.rowIndex || newPosition.columnIndex !== currentPosition.columnIndex) {
      navigateToCell(newPosition);
    }
  }, [totalRows, totalColumns, navigateToCell]);

  const contextValue: TableNavigationContextType = {
    registerCell,
    unregisterCell,
    navigateToCell,
    handleNavigation,
    totalRows,
    totalColumns,
  };

  return (
    <TableNavigationContext.Provider value={contextValue}>
      {children}
    </TableNavigationContext.Provider>
  );
}