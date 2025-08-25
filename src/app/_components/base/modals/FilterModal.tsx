"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ChevronDown from "../../icons/ChevronDown";
import Trash from "../../icons/Trash";
import Plus from "../../icons/Plus";
import Question from "../../icons/Question";
import DotsSixVertical from "../../icons/DotsSixVertical";
import { createPortal } from "react-dom";

export interface FilterRule {
  id: string;
  columnId: string;
  columnName: string;
  columnType: 'TEXT' | 'NUMBER';
  operator: FilterOperator;
  value?: string | number;
  logicOperator?: 'and' | 'or';
}

export type FilterOperator = 
  // Text operators
  | 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals'
  // Number operators  
  | 'greater_than' | 'less_than';

interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
  width: number;
  tableId: string;
}

interface FilterModalProps {
  columns: Column[];
  filterRules: FilterRule[];
  onUpdateFilterRule: (ruleId: string, operator: FilterOperator, value?: string | number) => void;
  onRemoveFilterRule: (ruleId: string) => void;
  onAddFilterRule: (columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => void;
  onUpdateFilterRuleField: (ruleId: string, columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => void;
  onUpdateLogicOperator: (ruleId: string, logicOperator: 'and' | 'or') => void;
}

export function FilterModal({
  columns,
  filterRules,
  onUpdateFilterRule,
  onRemoveFilterRule,
  onAddFilterRule,
  onUpdateFilterRuleField,
  onUpdateLogicOperator,
}: FilterModalProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openFieldDropdown, setOpenFieldDropdown] = useState<string | null>(null);
  const [openLogicDropdown, setOpenLogicDropdown] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  // Modal positioning state
  const [fieldModalPosition, setFieldModalPosition] = useState<{top: number, left: number, width: number} | null>(null);
  const [operatorModalPosition, setOperatorModalPosition] = useState<{top: number, left: number, width: number} | null>(null);
  const [logicModalPosition, setLogicModalPosition] = useState<{top: number, left: number, width: number} | null>(null);
  
  // Refs for button positioning
  const fieldButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const operatorButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const logicButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const getOperatorLabel = useCallback((operator: FilterOperator, columnType: string) => {
    switch (operator) {
      case 'is_empty': return 'is empty';
      case 'is_not_empty': return 'is not empty';
      case 'contains': return 'contains';
      case 'not_contains': return 'does not contain';
      case 'equals': return columnType === 'NUMBER' ? 'equals' : 'is';
      case 'greater_than': return 'is greater than';
      case 'less_than': return 'is less than';
      default: return operator;
    }
  }, []);

  const getOperatorOptions = useCallback((columnType: string) => {
    if (columnType === 'NUMBER') {
      return [
        { value: 'equals' as FilterOperator, label: 'equals' },
        { value: 'greater_than' as FilterOperator, label: 'is greater than' },
        { value: 'less_than' as FilterOperator, label: 'is less than' },
        { value: 'is_empty' as FilterOperator, label: 'is empty' },
        { value: 'is_not_empty' as FilterOperator, label: 'is not empty' },
      ];
    } else {
      return [
        { value: 'contains' as FilterOperator, label: 'contains' },
        { value: 'not_contains' as FilterOperator, label: 'does not contain' },
        { value: 'equals' as FilterOperator, label: 'is' },
        { value: 'is_empty' as FilterOperator, label: 'is empty' },
        { value: 'is_not_empty' as FilterOperator, label: 'is not empty' },
      ];
    }
  }, []);

  const handleOperatorSelect = useCallback((ruleId: string, operator: FilterOperator) => {
    const currentValue = inputValues[ruleId];
    onUpdateFilterRule(ruleId, operator, currentValue);
    setOpenDropdown(null);
  }, [onUpdateFilterRule, inputValues]);

  const validateInput = useCallback((value: string, columnType: 'TEXT' | 'NUMBER') => {
    if (columnType === 'NUMBER') {
      // Check if it's a valid number (including empty string which is valid)
      return value === '' || !isNaN(Number(value));
    }
    // Text inputs are always valid
    return true;
  }, []);

  const handleValueChange = useCallback((ruleId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [ruleId]: value }));
    
    // Find the rule to get its operator and column type
    const rule = filterRules.find(r => r.id === ruleId);
    if (rule) {
      // Validate input
      const isValid = validateInput(value, rule.columnType);
      setInputErrors(prev => ({ ...prev, [ruleId]: !isValid }));
      
      // Only process valid values
      if (isValid || value === '') {
        const processedValue = rule.columnType === 'NUMBER' ? (value === '' ? '' : parseFloat(value) || 0) : value;
        onUpdateFilterRule(ruleId, rule.operator, processedValue);
      }
    }
  }, [onUpdateFilterRule, filterRules, validateInput]);

  const handleFieldSelect = useCallback((column: Column) => {
    onAddFilterRule(column.id, column.name, column.type as 'TEXT' | 'NUMBER');
  }, [onAddFilterRule]);

  const handleFieldChange = useCallback((ruleId: string, column: Column) => {
    onUpdateFilterRuleField(ruleId, column.id, column.name, column.type as 'TEXT' | 'NUMBER');
    setOpenFieldDropdown(null);
  }, [onUpdateFilterRuleField]);

  const handleLogicOperatorChange = useCallback((ruleId: string, logicOperator: 'and' | 'or') => {
    onUpdateLogicOperator(ruleId, logicOperator);
    setOpenLogicDropdown(null);
  }, [onUpdateLogicOperator]);

  // Modal positioning functions
  const openFieldModal = useCallback((ruleId: string) => {
    const button = fieldButtonRefs.current[ruleId];
    if (button) {
      const rect = button.getBoundingClientRect();
      setFieldModalPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
      setOpenFieldDropdown(ruleId);
    }
  }, []);

  const openOperatorModal = useCallback((ruleId: string) => {
    const button = operatorButtonRefs.current[ruleId];
    if (button) {
      const rect = button.getBoundingClientRect();
      setOperatorModalPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
      setOpenDropdown(ruleId);
    }
  }, []);

  const openLogicModal = useCallback((ruleId: string) => {
    const button = logicButtonRefs.current[ruleId];
    if (button) {
      const rect = button.getBoundingClientRect();
      setLogicModalPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
      setOpenLogicDropdown(ruleId);
    }
  }, []);

  const closeAllModals = useCallback(() => {
    setOpenFieldDropdown(null);
    setOpenDropdown(null);
    setOpenLogicDropdown(null);
    setFieldModalPosition(null);
    setOperatorModalPosition(null);
    setLogicModalPosition(null);
  }, []);

  const closeFieldModal = useCallback(() => {
    setOpenFieldDropdown(null);
    setFieldModalPosition(null);
  }, []);

  const closeOperatorModal = useCallback(() => {
    setOpenDropdown(null);
    setOperatorModalPosition(null);
  }, []);

  const closeLogicModal = useCallback(() => {
    setOpenLogicDropdown(null);
    setLogicModalPosition(null);
  }, []);

  // Handle escape key to close modals
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAllModals();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [closeAllModals]);


  const getAvailableFieldsForRule = useCallback((currentRuleId: string) => {
    return columns.filter(col => {
      // Include current field or fields not used by other rules
      const rule = filterRules.find(r => r.columnId === col.id);
      return !rule || rule.id === currentRuleId;
    });
  }, [columns, filterRules]);

  const needsValueInput = useCallback((operator: FilterOperator) => {
    return !['is_empty', 'is_not_empty'].includes(operator);
  }, []);

  // Modal components
  const FieldDropdownModal = ({ 
    isOpen, 
    position, 
    ruleId, 
    _onClose 
  }: { 
    isOpen: boolean; 
    position: {top: number, left: number, width: number} | null; 
    ruleId: string; 
    _onClose: () => void;
  }) => {
    if (!isOpen || !position) return null;

    return createPortal(
      <div 
        className="fixed inset-0 z-50"
        onClick={(e) => {
          e.stopPropagation();
          closeFieldModal();
        }}
      >
        <div 
          className="absolute bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {getAvailableFieldsForRule(ruleId).map((field) => (
            <button
              key={field.id}
              onClick={() => {
                handleFieldChange(ruleId, field);
                closeFieldModal();
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                field.id === filterRules.find(r => r.id === ruleId)?.columnId ? 'bg-gray-200 text-gray-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <span className="truncate">{field.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>,
      document.body
    );
  };

  const OperatorDropdownModal = ({ 
    isOpen, 
    position, 
    ruleId, 
    _onClose 
  }: { 
    isOpen: boolean; 
    position: {top: number, left: number, width: number} | null; 
    ruleId: string; 
    _onClose: () => void;
  }) => {
    if (!isOpen || !position) return null;

    const rule = filterRules.find(r => r.id === ruleId);
    if (!rule) return null;

    return createPortal(
      <div 
        className="fixed inset-0 z-50"
        onClick={(e) => {
          e.stopPropagation();
          closeOperatorModal();
        }}
      >
        <div 
          className="absolute bg-white border border-gray-200 rounded-md shadow-lg"
          style={{
            top: position.top,
            left: position.left,
            width: 192, // w-48 equivalent
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {getOperatorOptions(rule.columnType).map((option) => (
            <button
              key={option.value}
              onClick={() => {
                handleOperatorSelect(ruleId, option.value);
                closeOperatorModal();
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                rule.operator === option.value ? 'bg-green-50 text-green-700' : 'text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>,
      document.body
    );
  };

  const LogicDropdownModal = ({ 
    isOpen, 
    position, 
    ruleId, 
    _onClose 
  }: { 
    isOpen: boolean; 
    position: {top: number, left: number, width: number} | null; 
    ruleId: string; 
    _onClose: () => void;
  }) => {
    if (!isOpen || !position) return null;

    const rule = filterRules.find(r => r.id === ruleId);
    if (!rule) return null;

    return createPortal(
      <div 
        className="fixed inset-0 z-50"
        onClick={(e) => {
          e.stopPropagation();
          closeLogicModal();
        }}
      >
        <div 
          className="absolute bg-white border border-gray-200 rounded-md shadow-lg"
          style={{
            top: position.top,
            left: position.left,
            width: 64, // w-16 equivalent
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleLogicOperatorChange(ruleId, 'and');
              closeLogicModal();
            }}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-md ${
              (rule.logicOperator ?? 'and') === 'and' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
            }`}
          >
            and
          </button>
          <button
            onClick={() => {
              handleLogicOperatorChange(ruleId, 'or');
              closeLogicModal();
            }}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 last:rounded-b-md ${
              rule.logicOperator === 'or' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
            }`}
          >
            or
          </button>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex px-4 pt-3">
        {/* Empty state */}
        {filterRules.length === 0 ? (
          <div className="flex text-[13px] font-[400] text-[#616670]">
            No filter conditions are applied
            <span className="ml-2 flex items-center cursor-pointer">
              <Question size={16} className="mr-2 text-[#6b7280] hover:text-[#1d1f25]" />
            </span>
          </div>
          
        ) : (<div className="text-[13px] font-[400] text-[#616670]">In this view, show records</div>)}
      </div>

      {/* Existing filter rules */}
      <div className="max-h-[25rem] overflow-auto w-full px-4 pt-3">
        <div className="mb-2">
          <div className="relative text-[#1d1f25] font-family-system font-[400] text-[13px] w-[calc(390px + 10.5rem)]">
        {filterRules.map((filterRule, ruleIndex) => (
          <div key={filterRule.id} className="h-[2.5rem] transition-transform">
            <div className="h-[2.5rem] transition-transform ">
              <div className="flex h-full">
              {/* Logic indicator */}
              <div className="flex items-center px-2 w-[4.5rem] pb-[0.5rem]">
                {ruleIndex === 0 ? (
                  <div className="flex items-center flex-auto px-2 w-full h-full">Where</div>
                ) : (
                  <div className="relative">
                    <button
                      ref={(el) => { logicButtonRefs.current[filterRule.id] = el; }}
                      onClick={() => openLogicModal(filterRule.id)}
                      className="hover:bg-gray-200 px-2 py-1 rounded transition-colors duration-150"
                    >
                      {filterRule.logicOperator ?? 'and'}
                    </button>
                  </div>
                )}
              </div>
              

              <div className="flex-auto flex items-center pr-[0.5rem] h-[2rem] transition-[height] duration-[200ms]">
                <div className="flex items-center stretch box-content border border-border-default bg-white rounded-[3px]">
                  {/* div for name, operator, value */}
                  <div className="flex-auto flex items-stretch w-[390px] max-w-[390px] h-[30px]">
                    <div className="flex-none flex items-stretch col-span-12 w-[250px]">
                      {/* Field dropdown */}
                      <div className="self-stretch flex items-stretch border-r border-border-default col-span-6 max-w-[125px] w-[125px] overflow-hidden">
                        <div className="flex flex-auto relative w-full">
                            <button
                              ref={(el) => { fieldButtonRefs.current[filterRule.id] = el; }}
                              onClick={() => openFieldModal(filterRule.id)}
                              className="w-full flex items-center px-2 rounded-[3px] cursor-pointer hover:bg-gray-100 min-w-0"
                            >
                              <div className="truncate flex-auto text-left min-w-0 overflow-hidden">{filterRule.columnName}</div>
                              <div className="flex-none flex items-center ml-1">
                                <ChevronDown size={16} color="#6b7280" />
                              </div>
                            </button>
                        </div>
                    </div>

                {/* Operator dropdown */}
                <div className="self-stretch flex items-stretch border-r border-border-default col-span-6 max-w-[125px] w-[125px] overflow-hidden">
                  <div className="flex flex-auto relative">
                    <button
                      ref={(el) => { operatorButtonRefs.current[filterRule.id] = el; }}
                      onClick={() => openOperatorModal(filterRule.id)}
                      className="flex items-center px-2 rounded-[3px] w-full cursor-pointer hover:bg-gray-100 min-w-0"
                    >
                      <span className="mr-1 truncate flex-auto text-left min-w-0 overflow-hidden">{getOperatorLabel(filterRule.operator, filterRule.columnType)}</span>
                      <ChevronDown size={12} color="#6b7280" />
                    </button>
                  </div>
                </div>
                 </div>

                <div className="flex-auto self-stretch flex items-stretch overflow-hidden border-r border-border-default">
                  {/* Value input (if needed) */}
                  {needsValueInput(filterRule.operator) && (

                      <div className="flex flex-col w-full h-full">
                        <div className="flex-auto relative">
                          <input
                            type={filterRule.columnType === 'NUMBER' ? 'number' : 'text'}
                            value={inputValues[filterRule.id] ?? filterRule.value ?? ''}
                            onChange={(e) => handleValueChange(filterRule.id, e.target.value)}
                            onFocus={() => setFocusedInput(filterRule.id)}
                            onBlur={() => setFocusedInput(null)}
                            placeholder="Enter a value"
                            className={`py-1 px-2 h-full border-0 outline-0 ring-0 w-full ${
                              inputErrors[filterRule.id] 
                                ? 'ring-2 ring-red-500 ring-inset' 
                                : focusedInput === filterRule.id 
                                  ? 'ring-2 ring-blue-500 ring-inset' 
                                  : ''
                            }`}
                          />
                        </div>
                      </div>
                )}
              </div>
             </div>

              {/* Remove button + order button */}
              <div className="flex flex-none self-stretch">
                <button
                  onClick={() => onRemoveFilterRule(filterRule.id)}
                  className="flex-none self-stretch hover:bg-gray-100 justify-center flex items-center focus-visible:outline cursor-pointer border-r border-border-default w-8 h-auto"
                >
                  <Trash size={16} color="#1d1f25" />
                </button>
                <button
                  onClick={() => onRemoveFilterRule(filterRule.id)}
                  className="flex-none self-stretch hover:bg-gray-100 justify-center flex items-center focus-visible:outline cursor-pointer border-r border-border-default w-8 h-auto"
                >
                  <DotsSixVertical size={16} color="#1d1f25" />
                </button>
              </div>
              </div>
              </div>
            </div>
            </div>
          </div>
        ))}
        </div>
        </div>
      </div>

      {/* Add condition button */}
      {filterRules.length < columns.length && (
        <div className=" flex items-center justify-between px-4 pb-4">
          <div className="flex items-center mr-4">
              <button 
                onClick={() => {
                  // Find the first unused column
                  const usedColumnIds = new Set(filterRules.map(rule => rule.columnId));
                  const availableColumn = columns.find(col => !usedColumnIds.has(col.id));
                  if (availableColumn) {
                    handleFieldSelect(availableColumn);
                  }
                }}
                className="mr-4 group cursor-pointer flex items-center text-[13px] text-[#616670] font-[500] font-family-system hover:text-[#1d1f25] transition-colors duration-150"
              >
                <Plus size={12} className="mr-2 text-[#6b7280] group-hover:text-[#1d1f25]" />
                Add condition
              </button>
              <div className="flex items-center">
                  <button 
                  className="group cursor-pointer flex items-center text-[13px] text-[#616670] font-[500] font-family-system hover:text-[#1d1f25] transition-colors duration-150"
                >
                  <Plus size={12} className="mr-2 text-[#6b7280] group-hover:text-[#1d1f25]" />
                  Add condition group
                </button>
                <span className="ml-2 flex items-center cursor-pointer">
                  <Question size={16} className="mr-2 text-[#6b7280] hover:text-[#1d1f25]" />
                </span>
              </div>
            </div>
            <button className="ml-16 cursor-pointer items-center text-[13px] text-[#616670] font-[500] font-family-system hover:text-[#1d1f25] transition-colors duration-150 ">
                Copy from another view
            </button>
        </div>
      )}
      
      {/* Modal components */}
      <FieldDropdownModal
        isOpen={!!openFieldDropdown}
        position={fieldModalPosition}
        ruleId={openFieldDropdown ?? ''}
        _onClose={closeFieldModal}
      />
      
      <OperatorDropdownModal
        isOpen={!!openDropdown}
        position={operatorModalPosition}
        ruleId={openDropdown ?? ''}
        _onClose={closeOperatorModal}
      />
      
      <LogicDropdownModal
        isOpen={!!openLogicDropdown}
        position={logicModalPosition}
        ruleId={openLogicDropdown ?? ''}
        _onClose={closeLogicModal}
      />
    </div>
  );
}