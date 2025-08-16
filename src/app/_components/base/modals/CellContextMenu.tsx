"use client";

import { useEffect, useRef, useCallback } from "react";
import ArrowUp from "../../icons/ArrowUp";
import ArrowDown from "../../icons/ArrowDown";
import Trash from "../../icons/Trash";

interface CellContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onDeleteRow: () => void;
}

export function CellContextMenu({
  isOpen,
  onClose,
  position,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteRow,
}: CellContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleInsertRowAbove = useCallback(() => {
    onInsertRowAbove();
    onClose();
  }, [onInsertRowAbove, onClose]);

  const handleInsertRowBelow = useCallback(() => {
    onInsertRowBelow();
    onClose();
  }, [onInsertRowBelow, onClose]);

  const handleDeleteRow = useCallback(() => {
    onDeleteRow();
    onClose();
  }, [onDeleteRow, onClose]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Use position directly - top-left corner of menu at click position
  const menuPosition = { x: position.x, y: position.y };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-border-default rounded-[6px] shadow-lg z-50 py-1 min-w-[180px]"
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
      }}
    >
      <button
        onClick={handleInsertRowAbove}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-3 font-family-system text-sm cursor-pointer"
      >
        <ArrowUp size={14} color="#374151" />
        <span className="text-gray-900">Insert row above</span>
      </button>
      
      <button
        onClick={handleInsertRowBelow}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-3 font-family-system text-sm cursor-pointer"
      >
        <ArrowDown size={14} color="#374151" />
        <span className="text-gray-900">Insert row below</span>
      </button>
      
      <div className="border-t border-gray-200 my-1" />
      
      <button
        onClick={handleDeleteRow}
        className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-3 font-family-system text-sm cursor-pointer"
      >
        <Trash size={14} color="#DC2626" />
        <span className="text-red-600">Delete row</span>
      </button>
    </div>
  );
}