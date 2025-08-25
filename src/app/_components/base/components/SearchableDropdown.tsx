"use client";

import { useState, useMemo, useRef } from "react";
import ChevronDown from "../../icons/ChevronDown";
import { DropdownModal } from "../modals/DropdownModal";

interface DropdownOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface SearchableDropdownProps {
  value?: string;
  placeholder: string;
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  className?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  width?: number;
  maxHeight?: number;
}

export function SearchableDropdown({
  value,
  placeholder,
  options,
  onSelect,
  className = "",
  disabled = false,
  searchPlaceholder = "Search...",
  width = 240,
  maxHeight = 200,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(option => option.id === value);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    
    return options.filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const handleSelect = (option: DropdownOption) => {
    onSelect(option);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full cursor-pointer h-[28px] flex items-center box-border justify-between px-3 py-2 text-sm bg-white 
          border border-border-default rounded-[3px] text-[#1d1f25] font-family-system text-[13px] font-[400] leading-[18px]
           transition-colors duration-150 ${
          disabled 
            ? 'bg-gray-50' 
            : 'hover:bg-gray-50 focus:outline-none focus:text-blue-400'
        } ${className}`}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} color={disabled ? "#1d1f25" : "blue-500"} />
      </button>

      <DropdownModal
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={triggerRef}
        width={width}
        maxHeight={maxHeight}
        align="left"
      >
        <div className="py-1">
          {/* Search input */}
          <div className="px-1 py-1 border-b border-gray-100">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[12px] px-2 py-1 border-0 outline-0 border-gray-200 rounded-[3px] focus:outline-none text-[12px] font-family-system text-[#1d1f25] font-[400] "
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option)}
                  className={`cursor-pointer w-full px-2 py-2 text-left font-family-system text-[12px] font-[400] hover:bg-gray-50 transition-colors duration-150 ${
                    option.id === value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="truncate">{option.label}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No results
              </div>
            )}
          </div>
        </div>
      </DropdownModal>
    </>
  );
}