import { useCallback, useRef } from "react";

export const useCellEditTracker = () => {
  const editingCellsRef = useRef<Map<string, string>>(new Map()); // cellId -> currentValue

  const trackCellEdit = useCallback((cellId: string, value: string) => {
    editingCellsRef.current.set(cellId, value);
  }, []);

  const untrackCellEdit = useCallback((cellId: string) => {
    editingCellsRef.current.delete(cellId);
  }, []);

  const isCellBeingEdited = useCallback((cellId: string) => {
    return editingCellsRef.current.has(cellId);
  }, []);

  const getCellEditValue = useCallback((cellId: string) => {
    return editingCellsRef.current.get(cellId);
  }, []);

  const clearAllEdits = useCallback(() => {
    editingCellsRef.current.clear();
  }, []);

  return {
    trackCellEdit,
    untrackCellEdit,
    isCellBeingEdited,
    getCellEditValue,
    clearAllEdits
  };
};