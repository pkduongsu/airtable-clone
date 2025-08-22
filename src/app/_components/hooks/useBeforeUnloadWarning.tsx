"use client";

import { useEffect, useRef } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { useEditingState } from "../providers/EditingStateProvider";

export function useBeforeUnloadWarning() {
  const isMutating = useIsMutating() > 0;
  const { isAnyCellEditingRef } = useEditingState();
  
  const isMutatingRef = useRef(isMutating);

  // Keep the ref updated
  useEffect(() => {
    isMutatingRef.current = isMutating;
  }, [isMutating]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const currentlyMutating = isMutatingRef.current;
      const isAnyCellEditing = isAnyCellEditingRef();
      
      if (currentlyMutating || isAnyCellEditing) {
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
  }, [isAnyCellEditingRef]); // Include isAnyCellEditingRef dependency
}