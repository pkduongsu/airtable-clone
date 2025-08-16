"use client";

import Plus from "../../icons/Plus";
import Database from "../../icons/Database";

interface SummaryBarProps {
  recordCount: number;
  onAddRow: () => void;
  onBulkAddRows: () => void;
  isBulkLoading: boolean;
}

export function SummaryBar({ recordCount, onAddRow, onBulkAddRows, isBulkLoading }: SummaryBarProps) {
  return (
    <div className="bg-white border-t border-border-default px-4 py-3 flex items-center h-[34px]">
      <div className="text-sm text-[#1d1f25] font-[400] text-[11px] font-family-system leading-[18px] pb-0.5 px-2 pt-[3px]">
        {recordCount} {recordCount === 1 ? 'record' : 'records'}
      </div>
      <div className="flex flex-auto focus-visible:outline ml-2 bg-white bottom-[25px] absolute rounded-[9999px] h-[36px] z-1">
        <button 
          className="cursor-pointer relative flex items-center justify-center z-1 border border-default rounded-tl-[9999px] rounded-bl-[9999px] bg-white hover:bg-[#e5e9f0] py-2 pl-4 pr-3 h-full"
          onClick={onAddRow}
        >
          <span className="flex items-center">
            <Plus size={16} />
          </span>
        </button>
        <button 
          className={`relative flex items-center justify-center z-1 border border-default rounded-tr-[9999px] rounded-br-[9999px] border-l-0 bg-white hover:bg-[#e5e9f0] py-2 pl-4 pr-3 h-full ${isBulkLoading ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
          onClick={onBulkAddRows}
          disabled={isBulkLoading}
        >
          {isBulkLoading ? (
            <div className="w-4 h-4 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Database size={16} />
          )}
          <span className="pl-2 font-family-system text-[#1d1f25] font-[400] leading-[18px] text-[13px]">
            {isBulkLoading ? 'Adding rows...' : 'Add 100k Rows'}
          </span>
        </button>
      </div>
    </div>
  );
}