"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface MutationTrackerContextType {
  activeMutations: Set<string>;
  addMutation: (id: string) => void;
  removeMutation: (id: string) => void;
  isMutating: boolean;
}

const MutationTrackerContext = createContext<MutationTrackerContextType | undefined>(undefined);

export function MutationTrackerProvider({ children }: { children: ReactNode }) {
  const [activeMutations, setActiveMutations] = useState<Set<string>>(new Set());

  const addMutation = useCallback((id: string) => {
    setActiveMutations(prev => new Set(prev).add(id));
  }, []);

  const removeMutation = useCallback((id: string) => {
    setActiveMutations(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const isMutating = activeMutations.size > 0;

  return (
    <MutationTrackerContext.Provider value={{
      activeMutations,
      addMutation,
      removeMutation,
      isMutating,
    }}>
      {children}
    </MutationTrackerContext.Provider>
  );
}

export function useMutationTracker() {
  const context = useContext(MutationTrackerContext);
  if (context === undefined) {
    // Return a safe default instead of throwing
    return {
      activeMutations: new Set<string>(),
      addMutation: () => { /* no-op */ },
      removeMutation: () => { /* no-op */ },
      isMutating: false,
    };
  }
  return context;
}