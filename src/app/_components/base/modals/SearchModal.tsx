"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import X from "../../icons/X";
import ChevronDown from "../../icons/ChevronDown";
import ChevronUp from "../../icons/ChevronUp";

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
  onScrollToResult?: (result: SearchResult, index: number) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function SearchModal({
  isOpen,
  onClose,
  tableId,
  onResultSelected: _onResultSelected,
  onSearchDataUpdate,
  onScrollToResult,
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
    const newIndex = direction === 'up' 
      ? (currentResultIndex > 0 ? currentResultIndex - 1 : Math.max(0, results.length - 1))
      : (currentResultIndex < results.length - 1 ? currentResultIndex + 1 : 0);
    
    setCurrentResultIndex(newIndex);
    
    // Trigger scroll to result if callback is provided
    if (onScrollToResult && results[newIndex]) {
      onScrollToResult(results[newIndex], newIndex);
    }
    
    // Notify parent of the current index change
    if (onSearchDataUpdate) {
      onSearchDataUpdate(results, debouncedQuery, newIndex);
    }
  }, [currentResultIndex, results, onScrollToResult, onSearchDataUpdate, debouncedQuery]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed flex z-50 flex-col mr-2 bg-white border-l-2 rounded-[3px] border-r-2 border-b-2 border-t-0 border-border-default w-[300px] h-[74px]"
      style={{
        transform: isOpen ? "scale(1)" : "scale(0.95)",
        opacity: isOpen ? 1 : 0,
      }}
    >
      {/* Search Input */}
      <div className="flex items-center px-2 border-2-[transparent] border-transparent bg-transparent py-2 h-[38px]">
        <input
          ref={inputRef}
          type="text"
          placeholder="Find in view"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 text-[13px] placeholder:font-[620] font-[500] text-[#1d1f25] font-family-system outline-none placeholder:text-gray-500"
        />
        
        {/* Navigation and Close */}
        <div className="flex items-center pr-2">
          {results.length > 0 && (
            <>
              <span className="flex pr-2 items-center text-[11px] opacity-[0.5] font-[400] flex-none text-[#1d1f25] font-family-system whitespace-nowrap">
                {currentResultIndex + 1} of {results.length}
              </span>
              
              {/* Up/Down arrows */}
              <div className="flex py-2">
                <button
                  onClick={() => navigateResult('up')}
                  className="cursor-pointer bg-gray-200 hover:bg-gray-100 rounded-tl-[3px] rounded-bl-[3px] w-[20px] h-[22px] flex items-center justify-center"
                  disabled={results.length === 0}
                >
                  <ChevronUp size={16} color={results.length === 0 ? "#ccc" : "#1d1f25"} className="" />
                </button>
                <button
                  onClick={() => navigateResult('down')}
                  className="cursor-pointer bg-gray-200 hover:bg-gray-100 rounded-tr-[3px] rounded-br-[3px] w-[20px] h-[22px] flex items-center justify-center"
                  disabled={results.length === 0}
                >
                  <ChevronDown size={16} color={results.length === 0 ? "#ccc" : "#1d1f25"} />
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
            className="p-1 rounded text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex px-3 py-2 border-t border-border-default bg-[#0000000D] h-[34px]">
      {/* Statistics */}
      {debouncedQuery && !isLoading && (
          <div className="text-[11px] text-[#1d1f25] font-[400] opacity-[0.75] font-family-system">
            Found <span className={statistics.fieldCount === 0 ? "font-[400]" : "font-[700]"}>{statistics.fieldCount === 0 ? 'no' : statistics.fieldCount}</span> field{statistics.fieldCount === 1 ? '' : 's'} and{' '}
            <span className={statistics.cellCount === 0 ? "font-[400]" : "font-[700]"}>{statistics.cellCount}</span> cell{statistics.cellCount === 1 ? '' : 's'}{' '}
            (within <span className={statistics.recordCount === 0 ? "font-[400]" : "font-[700]"}>{statistics.recordCount}</span> record{statistics.recordCount === 1 ? '' : 's'})
          </div>
      )}
      </div>
    </div>
  );
}