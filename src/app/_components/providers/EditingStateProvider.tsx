"use client";

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";

interface EditingSession {
  cellId: string;
  sessionId: string;
  timestamp: number;
}

interface EditingStateContextType {
  isAnyCellEditing: boolean;
  isAnyCellEditingRef: () => boolean;
  startEditingSession: (cellId: string, sessionId: string) => void;
  endEditingSession: (cellId: string, sessionId: string) => void;
  isCellEditing: (cellId: string) => boolean;
  getActiveCellIds: () => string[];
}

const EditingStateContext = createContext<EditingStateContextType | null>(null);

export function EditingStateProvider({ children }: { children: React.ReactNode }) {
  const [activeSessions, setActiveSessions] = useState<Map<string, EditingSession>>(new Map());
  const sessionsRef = useRef<Map<string, EditingSession>>(new Map());

  // Keep ref in sync with state for reliable access
  const updateSessions = useCallback((updater: (sessions: Map<string, EditingSession>) => Map<string, EditingSession>) => {
    const newSessions = updater(new Map(sessionsRef.current));
    sessionsRef.current = newSessions;
    setActiveSessions(newSessions);
  }, []);

  const startEditingSession = useCallback((cellId: string, sessionId: string) => {
    updateSessions(sessions => {
      const newSessions = new Map(sessions);
      newSessions.set(cellId, {
        cellId,
        sessionId,
        timestamp: Date.now()
      });
      return newSessions;
    });
  }, [updateSessions]);

  const endEditingSession = useCallback((cellId: string, sessionId: string) => {
    updateSessions(sessions => {
      const newSessions = new Map(sessions);
      const existingSession = newSessions.get(cellId);
      
      // Only remove if the session ID matches (prevents race conditions)
      if (existingSession?.sessionId === sessionId) {
        newSessions.delete(cellId);
      }
      return newSessions;
    });
  }, [updateSessions]);

  const isCellEditing = useCallback((cellId: string) => {
    return sessionsRef.current.has(cellId);
  }, []);

  const getActiveCellIds = useCallback(() => {
    return Array.from(sessionsRef.current.keys());
  }, []);

  const isAnyCellEditingRef = useCallback(() => {
    return sessionsRef.current.size > 0;
  }, []);

  const isAnyCellEditing = activeSessions.size > 0;
  

  return (
    <EditingStateContext.Provider value={{
      isAnyCellEditing,
      isAnyCellEditingRef,
      startEditingSession,
      endEditingSession,
      isCellEditing,
      getActiveCellIds,
    }}>
      {children}
    </EditingStateContext.Provider>
  );
}

export function useEditingState() {
  const context = useContext(EditingStateContext);
  if (!context) {
    throw new Error('useEditingState must be used within an EditingStateProvider');
  }
  return context;
}