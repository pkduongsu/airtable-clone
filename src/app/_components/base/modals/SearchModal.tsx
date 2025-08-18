"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "~/trpc/react";

interface SearchResult {
  type: 'field' | 'cell';
  id: string;
  name: string;
  columnId: string;
  columnOrder: number;
  rowId: string | null;
  rowOrder: number;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  onResultSelected?: (result: SearchResult, index: number) => void;
  onSearchDataUpdate?: (results: SearchResult[], query: string, currentIndex: number) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function SearchModal({
  isOpen,
  onClose,
  tableId,
  onResultSelected: _onResultSelected,
  onSearchDataUpdate,
  triggerRef,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Search query
  const { data: searchData, isLoading } = api.table.searchTable.useQuery(
    {
      tableId,
      query: debouncedQuery,
    },
    {
      enabled: debouncedQuery.length > 0,
    }
  );

  const results = useMemo(() => searchData?.results ?? [], [searchData?.results]);
  const statistics = useMemo(() => searchData?.statistics ?? { fieldCount: 0, cellCount: 0, recordCount: 0 }, [searchData?.statistics]);

  // Reset current index when results change
  useEffect(() => {
    setCurrentResultIndex(0);
  }, [results]);

  // Update parent component with search data
  useEffect(() => {
    if (onSearchDataUpdate) {
      onSearchDataUpdate(results, debouncedQuery, currentResultIndex);
    }
  }, [results, debouncedQuery, currentResultIndex, onSearchDataUpdate]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setCurrentResultIndex(0);
      // Clear search data when closing
      if (onSearchDataUpdate) {
        onSearchDataUpdate([], "", 0);
      }
    }
  }, [isOpen, onSearchDataUpdate]);

  // Handle positioning
  const updatePosition = useCallback(() => {
    if (!isOpen || !triggerRef.current || !modalRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const modal = modalRef.current;
    
    // Position below the trigger button with a small gap
    const top = triggerRect.bottom + 8;
    let left = triggerRect.left - 200; // Offset to the left since search dropdown is wider

    // Ensure the modal stays within the viewport
    const viewportWidth = window.innerWidth;
    const modalWidth = 300;
    
    // Adjust horizontal position if modal would overflow
    if (left + modalWidth > viewportWidth - 16) {
      left = viewportWidth - modalWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    modal.style.top = `${top}px`;
    modal.style.left = `${left}px`;
  }, [isOpen, triggerRef]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentResultIndex(prev => 
          prev > 0 ? prev - 1 : Math.max(0, results.length - 1)
        );
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentResultIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, results.length]);

  // Handle outside clicks
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the trigger button or the modal itself
      if (
        modalRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      
      onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  // Update position when modal opens or window resizes
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      
      const handleResize = () => updatePosition();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [isOpen, updatePosition]);

  // Navigate to next/previous result
  const navigateResult = useCallback((direction: 'up' | 'down') => {
    if (direction === 'up') {
      setCurrentResultIndex(prev => 
        prev > 0 ? prev - 1 : Math.max(0, results.length - 1)
      );
    } else {
      setCurrentResultIndex(prev => 
        prev < results.length - 1 ? prev + 1 : 0
      );
    }
  }, [results.length]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-[300px]"
      style={{
        transform: isOpen ? "scale(1)" : "scale(0.95)",
        opacity: isOpen ? 1 : 0,
      }}
    >
      {/* Search Input */}
      <div className="flex items-center px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 text-sm outline-none placeholder-gray-500"
        />
        
        {/* Navigation and Close */}
        <div className="flex items-center gap-2 ml-3">
          {results.length > 0 && (
            <>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {currentResultIndex + 1} of {results.length}
              </span>
              
              {/* Up/Down arrows */}
              <div className="flex">
                <button
                  onClick={() => navigateResult('up')}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={results.length === 0}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M6 3.5L2.5 7H9.5L6 3.5Z"
                      fill={results.length === 0 ? "#ccc" : "#666"}
                    />
                  </svg>
                </button>
                <button
                  onClick={() => navigateResult('down')}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={results.length === 0}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M6 8.5L9.5 5H2.5L6 8.5Z"
                      fill={results.length === 0 ? "#ccc" : "#666"}
                    />
                  </svg>
                </button>
              </div>
            </>
          )}
          
          {/* Loading spinner */}
          {isLoading && debouncedQuery && (
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            </div>
          )}
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Statistics */}
      {debouncedQuery && !isLoading && (
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600">
            Found {statistics.fieldCount} field{statistics.fieldCount === 1 ? '' : 's'} and{' '}
            {statistics.cellCount} cell{statistics.cellCount === 1 ? '' : 's'}{' '}
            (within {statistics.recordCount} record{statistics.recordCount === 1 ? '' : 's'})
          </div>
        </div>
      )}
    </div>
  );
}