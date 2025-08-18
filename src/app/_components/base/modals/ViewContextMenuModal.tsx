"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface ViewContextMenuModalProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  view: { id: string; name: string; isDefault: boolean } | null;
  onClose: () => void;
  onRename: (viewId: string, newName: string) => void;
  onDelete: (viewId: string) => void;
}

export function ViewContextMenuModal({
  isOpen,
  position,
  view,
  onClose,
  onRename,
  onDelete,
}: ViewContextMenuModalProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (isOpen && view) {
      setNewName(view.name);
      setIsRenaming(false);
    }
  }, [isOpen, view]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isRenaming) {
          setIsRenaming(false);
          setNewName(view?.name ?? "");
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isRenaming, view?.name, onClose]);

  if (!isOpen || !position || !view) return null;

  const handleRenameSubmit = () => {
    if (newName.trim() && newName.trim() !== view.name) {
      onRename(view.id, newName.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewName(view.name);
  };

  const handleDelete = () => {
    if (view.isDefault) {
      return; // Don't delete default views
    }
    onDelete(view.id);
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
            >
              Rename view
            </button>
            {!view.isDefault && (
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center"
              >
                Delete view
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}