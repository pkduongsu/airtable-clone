"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface ColumnContextMenuModalProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  column: { id: string; name: string } | null;
  onClose: () => void;
  onRename: (columnId: string, newName: string) => void;
  onDelete: (columnId: string) => void;
}

export function ColumnContextMenuModal({
  isOpen,
  position,
  column,
  onClose,
  onRename,
  onDelete,
}: ColumnContextMenuModalProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (isOpen && column) {
      setNewName(column.name);
      setIsRenaming(false);
    }
  }, [isOpen, column]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isRenaming) {
          setIsRenaming(false);
          setNewName(column?.name ?? "");
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isRenaming, column?.name, onClose]);

  if (!isOpen || !position || !column) return null;

  const handleRenameSubmit = () => {
    if (newName.trim() && newName.trim() !== column.name) {
      onRename(column.id, newName.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewName(column.name);
  };

  const handleDelete = () => {
    onDelete(column.id);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]"
        style={{
          top: position.y,
          left: position.x,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isRenaming ? (
          <div className="px-3 py-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSubmit();
                } else if (e.key === "Escape") {
                  handleRenameCancel();
                }
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onBlur={handleRenameSubmit}
            />
          </div>
        ) : (
          <>
            <button
              onClick={() => setIsRenaming(true)}
              className="cursor-pointer w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
            >
              Rename column
            </button>
            <button
              onClick={handleDelete}
              className="cursor-pointer w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center"
            >
              Delete column
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}