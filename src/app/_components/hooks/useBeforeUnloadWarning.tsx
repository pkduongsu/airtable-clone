"use client";

import { useEffect, useRef } from "react";
import { useMutationTracker } from "../providers/MutationTracker";

export function useBeforeUnloadWarning() {
  const { isMutating } = useMutationTracker();
  
  const isMutatingRef = useRef(isMutating);

  // Keep the ref updated
  useEffect(() => {
    isMutatingRef.current = isMutating;
  }, [isMutating]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const currentlyMutating = isMutatingRef.current;
      
      if (currentlyMutating) {
        // Set the returnValue to trigger the browser's confirmation dialog
        event.returnValue = "Changes that you made may not be saved.";
        
        // For older browsers, return the message
        return "Changes that you made may not be saved.";
      }
    };

    // Add the event listener
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup function
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []); // Empty dependency array since we use ref
}