"use client";

import { useState, useEffect } from "react";

export interface ViewConfig {
  sortRules: Array<{
    id: string;
    columnId: string;
    columnName: string;
    columnType: string;
    direction: 'asc' | 'desc';
  }>;
  filterRules: Array<{
    id: string;
    columnId: string;
    columnName: string;
    columnType: 'TEXT' | 'NUMBER';
    operator: 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals' | 'greater_than' | 'less_than';
    value?: string | number;
  }>;
  hiddenColumns: string[];
}

interface CreateViewModalProps {
  defaultName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  isCreating?: boolean;
}

export function CreateViewModal({
  defaultName,
  onSave,
  onCancel,
  isCreating = false
}: CreateViewModalProps) {
  const [viewName, setViewName] = useState(defaultName);

  useEffect(() => {
    setViewName(defaultName);
  }, [defaultName]);

  const handleSave = () => {
    if (viewName.trim()) {
      onSave(viewName.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="py-4">
      {/* Header */}
      <div className="px-4 pb-4 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Create new view</h3>
        <p className="text-xs text-gray-500 mt-1">
          Save your current sorting and filtering configuration as a new view.
        </p>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="view-name" className="block text-xs font-medium text-gray-700 mb-2">
              View name
            </label>
            <input
              id="view-name"
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter view name"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              disabled={isCreating}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 border-t border-gray-100">
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isCreating}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!viewName.trim() || isCreating}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create view"}
          </button>
        </div>
      </div>
    </div>
  );
}