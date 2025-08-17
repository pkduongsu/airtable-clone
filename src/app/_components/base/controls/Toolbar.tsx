import { useEffect, useState, useRef } from "react";
import List from "../../icons/List";
import GridFeature from "../../icons/GridFeature";
import ChevronDown from "../../icons/ChevronDown";
import EyeSlash from "../../icons/EyeSlash";
import FunnelSimple from "../../icons/FunnelSimple";
import Group from "../../icons/Group";
import ArrowsDownUp from "../../icons/ArrowsDownUp";
import PaintBucket from "../../icons/PaintBucket";
import RowHeightSmall from "../../icons/RowHeightSmall";
import ArrowSquareOut from "../../icons/ArrowSquareOut";
import MagnifyingGlass from "../../icons/MagnifyingGlass";
import { CleanTooltip, CleanTooltipContent, CleanTooltipTrigger } from "~/components/ui/clean-tooltip";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToolbarModal } from "../modals/ToolbarModal";
import { HideFieldsModal } from "../modals/HideFieldsModal";
import { SortModal, type SortRule } from "../modals/SortModal";
import { FilterModal, type FilterRule } from "../modals/FilterModal";

interface Column {
  id: string;
  name: string;
  type: string;
  order: number;
  width: number;
  tableId: string;
}

interface ToolbarProps {
  selectedTable?: string | null;
  tables?: Array<{ id: string; name: string; }>;
  onSidebarHover?: () => void;
  onSidebarLeave?: () => void;
  onSidebarClick?: () => void;
  columns?: Column[];
  hiddenColumns?: Set<string>;
  onToggleColumn?: (columnId: string) => void;
  onHideAllColumns?: () => void;
  onShowAllColumns?: () => void;
  sortRules?: SortRule[];
  onUpdateSortRule?: (ruleId: string, direction: 'asc' | 'desc') => void;
  onRemoveSortRule?: (ruleId: string) => void;
  onAddSortRule?: (columnId: string, columnName: string, columnType: string) => void;
  onUpdateSortRuleField?: (ruleId: string, columnId: string, columnName: string, columnType: string) => void;
  filterRules?: FilterRule[];
  onUpdateFilterRule?: (ruleId: string, operator: FilterRule['operator'], value?: string | number) => void;
  onRemoveFilterRule?: (ruleId: string) => void;
  onAddFilterRule?: (columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => void;
  onUpdateFilterRuleField?: (ruleId: string, columnId: string, columnName: string, columnType: 'TEXT' | 'NUMBER') => void;
}

export default function Toolbar({ 
  selectedTable, 
  tables: _tables, 
  onSidebarHover, 
  onSidebarLeave, 
  onSidebarClick,
  columns = [],
  hiddenColumns = new Set(),
  onToggleColumn,
  onHideAllColumns,
  onShowAllColumns,
  sortRules = [],
  onUpdateSortRule,
  onRemoveSortRule,
  onAddSortRule,
  onUpdateSortRuleField,
  filterRules = [],
  onUpdateFilterRule,
  onRemoveFilterRule,
  onAddFilterRule,
  onUpdateFilterRuleField
}: ToolbarProps) {
  const [tabDimensions, setTabDimensions] = useState<{left: number, width: number} | null>(null);
  const [isHideFieldsModalOpen, setIsHideFieldsModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const hideFieldsButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (selectedTable) {
      // Find the selected tab element and measure it
      const selectedTabElement = document.querySelector(`[data-tab-id="${selectedTable}"]`);
      if (selectedTabElement) {
        const rect = selectedTabElement.getBoundingClientRect();
        const containerRect = document.querySelector('.w-\\[calc\\(100vw-56px\\)\\]')?.getBoundingClientRect();
        if (containerRect) {
          setTabDimensions({
            left: rect.left - containerRect.left,
            width: rect.width
          });
        }
      }
    }
  }, [selectedTable]);

  const getFilterText = (filterRules: FilterRule[]) => {
    if (filterRules.length === 0) return "Filter";
    if (filterRules.length <= 4) {
      const names = filterRules.map(rule => rule.columnName);
      return `Filtered by ${names.join(', ')}`;
    }
    const firstName = filterRules[0]?.columnName ?? '';
    const otherCount = filterRules.length - 1;
    return `Filtered by ${firstName} and ${otherCount} other field${otherCount === 1 ? '' : 's'}`;
  };

  return (
    <TooltipProvider>
    <div className="w-full relative bg-white">
      {/* Custom border with gap under selected tab */}
      <div className="absolute top-0 left-0 right-0 h-px bg-border-default">
        {tabDimensions && (
          <div 
            className="absolute top-0 h-px bg-white"
            style={{
              left: `${tabDimensions.left}px`,
              width: `${tabDimensions.width}px`
            }}
          />
        )}
      </div>
      <div className="flex flex-none border-b border-border-default gap-2 items-center overflow-hidden print:hidden h-12 min-w-[600px]">
        <div className="flex flex-auto items-center pl-4 pr-2">
          {/* Sidebar open/close */}
          <button 
            className="mr-2 flex items-center justify-center cursor-pointer focus-visible:outline h-8 w-8 toolbar-button rounded-[6px]"
            onMouseEnter={onSidebarHover}
            onMouseLeave={onSidebarLeave}
            onClick={onSidebarClick}
          >
            <List size={16} color="#1d1f25" />
          </button>
          {/* Grid view */}
          <button className="flex items-center cursor-pointer rounded-[3px] focus-visible:outline px-2 h-[26px] max-w-fit toolbar-button">
            <div className="flex items-center min-w-0">
              <span className="flex-inline flex-none items-center">
                <GridFeature size={16} color="rgb(22, 110, 225)" className="flex-none" />
              </span>
              <h2 className="truncate flex-auto ml-2 mr-2 text-[#1d1f25] text-[13px] font-[500] leading-[18px] font-family-system">
                Grid view
              </h2>
              {/* More grid options */}
              <div>
                <ChevronDown size={16} />
              </div>
            </div>
          </button>
        </div>
        <div className="flex flex-auto item-center justify-end h-full pr-2">
          <div className="flex items-center flex-auto h-full overflow-hidden">
            <div className="flex items-center px-2 grow justify-end">
              <div className="flex items-center">
                <div className="flex flex-row mr-2">
                  <div>
                    {/* Show/Hide fields button */}
                    <button 
                      ref={hideFieldsButtonRef}
                      className={`toolbar-button focus-visible:outline mr-2 ${
                        hiddenColumns.size > 0 ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                      onClick={() => setIsHideFieldsModalOpen(!isHideFieldsModalOpen)}
                    >
                      <div className="cursor-pointer flex items-center px-2 py-1">
                        <EyeSlash 
                          size={16} 
                          color={hiddenColumns.size > 0 ? "#2563eb" : "#616670"} 
                          className="flex-none transition-colors duration-200" 
                        />
                        <div className={`max-w-[384px] truncate ml-1 font-family-system text-[13px] leading-[18px] font-[400] hidden min-[1168px]:block ${
                          hiddenColumns.size > 0 ? 'text-blue-700' : 'text-[#616670]'
                        }`}>
                          {hiddenColumns.size > 0 
                            ? `${hiddenColumns.size} hidden field${hiddenColumns.size === 1 ? '' : 's'}`
                            : 'Hide fields'
                          }
                        </div>                      
                      </div>
                    </button>
                    {/* Filter button */}
                    <button 
                      ref={filterButtonRef}
                      className={`focus-visible:outline toolbar-button mr-2 ${
                        filterRules.length > 0 ? 'bg-green-50 border border-green-200' : ''
                      }`}
                      onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
                    >
                      <div className="cursor-pointer flex items-center px-2 py-1">
                        <FunnelSimple 
                          size={16} 
                          color={filterRules.length > 0 ? "#16a34a" : "#616670"} 
                          className="flex-none transition-colors duration-200" 
                        />
                        <div className={`max-w-[384px] truncate ml-1 font-family-system text-[13px] leading-[18px] font-[400] hidden min-[1168px]:block ${
                          filterRules.length > 0 ? 'text-green-700' : 'text-[#616670]'
                        }`}>
                          {getFilterText(filterRules)}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
                <div className="flex items-center">
                  <button className="toolbar-button focus-visible:outline mr-2">
                    <div className="cursor-pointer flex items-center px-2 py-1">
                      <Group size={16} color="#616670" className="flex-none"/>
                      <div className="max-w-[384px] truncate ml-1 font-family-system text-[13px] leading-[18px] font-[400] text-[#616670] hidden min-[1168px]:block">Group</div>
                    </div>
                  </button>
                  <div>
                    <div>
                      <button 
                        ref={sortButtonRef}
                        className={`toolbar-button focus-visible:outline mr-2 ${
                          sortRules.length > 0 ? 'bg-orange-50 border border-orange-200' : ''
                        }`}
                        onClick={() => setIsSortModalOpen(!isSortModalOpen)}
                      >
                        <div className="cursor-pointer flex items-center px-2 py-1">
                            <ArrowsDownUp 
                              size={16} 
                              color={sortRules.length > 0 ? "#ea580c" : "#616670"} 
                              className="flex-none" 
                            />
                            <div className={`max-w-[384px] truncate ml-1 font-family-system text-[13px] leading-[18px] font-[400] hidden min-[1168px]:block ${
                              sortRules.length > 0 ? 'text-orange-700' : 'text-[#616670]'
                            }`}>
                              {sortRules.length > 0 
                                ? `Sorted by ${sortRules.length} field${sortRules.length === 1 ? '' : 's'}`
                                : 'Sort'
                              }
                            </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <button className="toolbar-button focus-visible:outline mr-2">
                    <div className="cursor-pointer flex items-center px-2 py-1">
                        <PaintBucket size={16} color="#616670" className="flex-none" />
                        <div className="max-w-[384px] truncate ml-1 font-family-system text-[13px] leading-[18px] font-[400] text-[#616670] hidden min-[1168px]:block">Color</div>
                    </div>
                </button>
                <CleanTooltip>
                  <CleanTooltipTrigger asChild>
                    <button className="toolbar-button focus-visible:outline mr-2">
                        <div className="cursor-pointer flex items-center px-2 py-1">
                            <RowHeightSmall size={16} color="#616670" className="flex-none" />
                        </div>
                    </button>
                  </CleanTooltipTrigger>
                  <CleanTooltipContent side="bottom" sideOffset={8}>
                    Row height
                  </CleanTooltipContent>
                </CleanTooltip>
              </div>
              
              <span className="flex items-center mr-2">
                <CleanTooltip>
                  <CleanTooltipTrigger asChild>
                    <button className="toolbar-button">
                        <div className="cursor-pointer pointer flex items-center px-2 py-1">
                            <ArrowSquareOut size={16} color="#616670" className="flex-none" />
                             <div className="max-w-[384px] truncate ml-1 font-family-system text-[13px] leading-[18px] font-[400] text-[#616670] hidden min-[1168px]:block">Share and sync</div>
                        </div>
                    </button>
                  </CleanTooltipTrigger>
                  <CleanTooltipContent side="bottom" sideOffset={8}>
                    Share and sync
                  </CleanTooltipContent>
                </CleanTooltip>
              </span>
            </div>
          </div>
          <div className="flex items-center mr-2">
            <CleanTooltip>
              <CleanTooltipTrigger asChild>
                <button className="flex items-center justify-center focus-visible:outline cursor-pointer rounded-[6px] hover:bg-gray-100 w-8 h-8">
                  <MagnifyingGlass size={16} color="#616670" className="flex-none" />
                </button>
              </CleanTooltipTrigger>
              <CleanTooltipContent side="bottom" sideOffset={8}>
                Search
              </CleanTooltipContent>
            </CleanTooltip>
          </div>
        </div>
      </div>

      {/* Hide Fields Modal */}
      <ToolbarModal
        isOpen={isHideFieldsModalOpen}
        onClose={() => setIsHideFieldsModalOpen(false)}
        triggerRef={hideFieldsButtonRef}
        width={320}
        maxHeight={400}
      >
        <HideFieldsModal
          columns={columns}
          hiddenColumns={hiddenColumns}
          onToggleColumn={onToggleColumn ?? (() => {
            // No-op when onToggleColumn is not provided
          })}
          onHideAll={onHideAllColumns ?? (() => {
            // No-op when onHideAllColumns is not provided
          })}
          onShowAll={onShowAllColumns ?? (() => {
            // No-op when onShowAllColumns is not provided
          })}
        />
      </ToolbarModal>

      {/* Sort Modal */}
      <ToolbarModal
        isOpen={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        triggerRef={sortButtonRef}
        width={360}
        maxHeight={450}
      >
        <SortModal
          columns={columns}
          sortRules={sortRules}
          onUpdateSortRule={onUpdateSortRule ?? (() => {
            // No-op when onUpdateSortRule is not provided
          })}
          onRemoveSortRule={onRemoveSortRule ?? (() => {
            // No-op when onRemoveSortRule is not provided
          })}
          onAddSortRule={onAddSortRule ?? (() => {
            // No-op when onAddSortRule is not provided
          })}
          onUpdateSortRuleField={onUpdateSortRuleField ?? (() => {
            // No-op when onUpdateSortRuleField is not provided
          })}
        />
      </ToolbarModal>

      {/* Filter Modal */}
      <ToolbarModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        triggerRef={filterButtonRef}
        width={400}
        maxHeight={500}
      >
        <FilterModal
          columns={columns}
          filterRules={filterRules}
          onUpdateFilterRule={onUpdateFilterRule ?? (() => {
            // No-op when onUpdateFilterRule is not provided
          })}
          onRemoveFilterRule={onRemoveFilterRule ?? (() => {
            // No-op when onRemoveFilterRule is not provided
          })}
          onAddFilterRule={onAddFilterRule ?? (() => {
            // No-op when onAddFilterRule is not provided
          })}
          onUpdateFilterRuleField={onUpdateFilterRuleField ?? (() => {
            // No-op when onUpdateFilterRuleField is not provided
          })}
        />
      </ToolbarModal>

    </div>
    </TooltipProvider>
  );
};