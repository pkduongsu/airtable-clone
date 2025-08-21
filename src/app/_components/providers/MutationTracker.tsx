"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useIsMutating } from "@tanstack/react-query";

interface MutationTrackerContextType {
  isMutating: boolean;
  isMutatingByKey: (mutationKey: string[]) => number;
}

const MutationTrackerContext = createContext<MutationTrackerContextType | undefined>(undefined);

export function MutationTrackerProvider({ children }: { children: ReactNode }) {
  // Use React Query's built-in mutation tracking - single subscription for better performance  
  const totalMutations = useIsMutating();
  const isMutating = totalMutations > 0;
  
  // For compatibility with existing code that checks specific mutation keys
  const isMutatingByKey = () => 0; // Not used in the optimized version

  return (
    <MutationTrackerContext.Provider value={{
      isMutating,
      isMutatingByKey,
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
      isMutating: false,
      isMutatingByKey: () => 0,
    };
  }
  return context;
}