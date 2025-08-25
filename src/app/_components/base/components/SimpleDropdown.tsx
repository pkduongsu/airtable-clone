"use client";

import { useState, useRef } from "react";
import ChevronDown from "../../icons/ChevronDown";
import { DropdownModal } from "../modals/DropdownModal";

interface DropdownOption {
  id: string;
  label: string;
}

interface SimpleDropdownProps {
  value?: string;
  placeholder: string;
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  className?: string;
  disabled?: boolean;
  width?: number;
  maxHeight?: number;
}

export function SimpleDropdown({
  value,
  placeholder,
  options,
  onSelect,
  className = "",
  disabled = false,
  width = 200,
  maxHeight = 200,
}: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(option => option.id === value);

  const handleSelect = (option: DropdownOption) => {
    onSelect(option);
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`cursor-pointer w-full h-[28px] flex items-center justify-between px-3 py-2 text-[13px] font-family-system font-[400] text-[#1d1f25] bg-white border border-border-default rounded-[3px] transition-colors duration-150 ${
          disabled 
            ? 'bg-gray-50 ' 
            : 'hover:bg-gray-50 focus:outline-none'
        } ${className}`}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} color={disabled ? "#1d1f25" : "#1d1f25"} />
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
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              className={`cursor-pointer w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors duration-150 ${
                option.id === value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </DropdownModal>
    </>
  );
}