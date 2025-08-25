"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Field types available for new columns (matching Prisma schema)
const FIELD_TYPES = [
  { id: 'TEXT', name: 'Text'},
  { id: 'NUMBER', name: 'Number' },
] as const;

type FieldType = typeof FIELD_TYPES[number]['id'];
type AddColumnStep = 'type-selection' | 'field-config';

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateField: (name: string, type: FieldType) => void;
  position: { top: number; left?: number; right?: number };
  existingColumnNames: string[];
}

export function AddColumnModal({ 
  isOpen, 
  onClose, 
  onCreateField, 
  position,
  existingColumnNames 
}: AddColumnModalProps) {
  const [addColumnStep, setAddColumnStep] = useState<AddColumnStep>('type-selection');
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType>('TEXT');
  const [fieldName, setFieldName] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  const generateDefaultFieldName = () => {
    const existingLabels = existingColumnNames
      .filter(name => name.startsWith('Label'))
      .map(name => {
        const match = /^Label(?:\s(\d+))?$/.exec(name);
        return match ? (match[1] ? parseInt(match[1]) : 1) : 0;
      })
      .filter(num => num > 0);
    
    const nextNumber = existingLabels.length === 0 ? 1 : Math.max(...existingLabels) + 1;
    return nextNumber === 1 ? 'Label' : `Label ${nextNumber}`;
  };

  const handleFieldTypeSelect = (type: FieldType) => {
    setSelectedFieldType(type);
    setAddColumnStep('field-config');
    setFieldName('');
  };

  const handleCancel = useCallback(() => {
    setAddColumnStep('type-selection');
    setSelectedFieldType('TEXT');
    setFieldName('');
    onClose();
  }, [onClose]);

  const handleCreateField = () => {
    const finalFieldName = fieldName.trim() || generateDefaultFieldName();
    onCreateField(finalFieldName, selectedFieldType);
    handleCancel();
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAddColumnStep('type-selection');
      setSelectedFieldType('TEXT');
      setFieldName('');
    }
  }, [isOpen]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleCancel]);

  if (!isOpen) return null;

  return (
    <div 
      ref={modalRef}
      className="absolute bg-white border border-border-default rounded-[6px] z-20 min-w-[280px]"
      style={{ 
        top: `${position.top}px`, 
        ...(position.left !== undefined && { left: `${position.left}px` }),
        ...(position.right !== undefined && { right: `${position.right}px` })
      }}
    >
      {addColumnStep === 'type-selection' && (
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Standard fields</h3>
          <div className="space-y-1">
            {FIELD_TYPES.map((fieldType) => (
              <button
                key={fieldType.id}
                className="w-full cursor-pointer text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-3"
                onClick={() => handleFieldTypeSelect(fieldType.id)}
              >
                <span className="text-sm text-gray-900">{fieldType.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {addColumnStep === 'field-config' && (
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Configure field</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Field name
              </label>
              <input
                type="text"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 font-family-system rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Field name (optional)"
              />
            </div>
            
            <div>
              <label className="block font-family-system text-xs font-medium text-gray-700 mb-1">
                Field type
              </label>
              <select
                value={selectedFieldType}
                onChange={(e) => setSelectedFieldType(e.target.value as FieldType)}
                className="w-full px-3 font-family-system py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map((fieldType) => (
                  <option key={fieldType.id} value={fieldType.id}>
                    {fieldType.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="cursor-pointer font-family-system px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateField}
              className="cursor-pointer font-family-system px-3 py-1.5 font-[500] text-sm text-white bg-[#166EE1] hover:bg-blue-700 rounded-[6px]"
            >
              Create field
            </button>
          </div>
        </div>
      )}
    </div>
  );
}