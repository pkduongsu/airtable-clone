"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import ChevronDown from "../icons/ChevronDown";
import List from "../icons/List";
import GridFour from "../icons/GridFour";

interface Base {
  id: string;
  name: string;
  updatedAt: Date | string;
}

interface BasesSectionProps {
  bases?: Base[];
  onDeleteBase: (baseId: string, baseName: string) => void;
  getRelativeTime: (date: Date | string) => string;
}

export function BasesSection({ bases, onDeleteBase, getRelativeTime }: BasesSectionProps) {
  const [viewMode, setViewMode] = useState('grid');
  const isTemp = (id: string) => id.startsWith("temp-");

  const CardInner = ({ base }: { base: Base }) => (
    <div className="relative rounded-[6px] bg-white cursor-pointer shadow-at-main-nav h-[92px] w-[300px]">
      <div className="flex">
        <div className="flex items-center justify-center rounded-l-lg relative w-[92px] h-[92px] min-w-[92px]">
          <div className="flex justify-center items-center w-[56px] h-[56px] rounded-[12px] relative bg-[#63498d] text-white">
            <span className="font-family-system font-[400] text-[22px] leading-[18px] ">
              {base.name?.slice(0, 2) || "Un"}
            </span>
          </div>
        </div>
        <div className="flex flex-col flex-auto justify-center">
          <h3 className="font-medium text-sm mb-0.5">
            {isTemp(base.id) ? `${base.name ?? "Untitled Base"} (Creating…)` : base.name}
          </h3>
          <p className="text-xs text-gray-500">
            {isTemp(base.id) ? "Creating…" : getRelativeTime(base.updatedAt)}
          </p>
        </div>
      </div>

      {isTemp(base.id) && (
        <div className="absolute inset-0 rounded-[6px] bg-white/60 flex items-center justify-center">
          <div className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="relative shrink-0 pb-[10px] mb-[-10px] z-[5]">
        <div className="flex items-center relative pb-5 justify-between">
          <div className="flex items-center mr-2">
            <div className="flex items-center mr-3">
              <button className="flex items-center cursor-pointer justify-between text-gray-500 hover:text-[#1d1f25]">
                <div className="mr-1">
                  <h2 className="text-[15px] leading-[22.5px] font-[400] font-family-system">Opened today</h2>
                </div>
                <ChevronDown size={16} className="flex-none" color="currentColor"/>
              </button>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex rounded-full">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 cursor-pointer rounded-full transition-colors ${viewMode === 'list' ? 'bg-[rgba(0,0,0,0.05)]' : 'hover:bg-[rgba(0,0,0,0.05)]'}`}
            >
              <List size={20} color="#1d1f25" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 cursor-pointer rounded-full transition-colors ${viewMode === 'grid' ? 'bg-[rgba(0,0,0,0.05)]' : 'hover:bg-[rgba(0,0,0,0.05)]'}`}
            >
              <GridFour size={20} color="#1d1f25"/>
            </button>
          </div>
        </div>
      </div>

      {/* Bases Grid/List */}
      <div className="flex-auto overflow-y-auto w-full p-1 items-start">
        {viewMode === "grid" ? (
          <div className="flex flex-wrap gap-[16px] mb-6">
            {bases?.map((base) => (
              <div key={base.id} className="relative group h-[92px] w-[300px] flex-shrink-0">
                {isTemp(base.id) ? (
                  <div className="block">
                    <CardInner base={base} />
                  </div>
                ) : (
                  <Link href={`/${base.id}`} className="block">
                    <CardInner base={base} />
                  </Link>
                )}

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isTemp(base.id)) onDeleteBase(base.id, base.name);
                  }}
                  disabled={isTemp(base.id)}
                  className={`absolute top-2 right-2 p-1.5 rounded-[6px] bg-white shadow-at-main-nav border border-gray-200 text-gray-500
                    ${isTemp(base.id) ? "opacity-50 cursor-not-allowed" : "hover:text-red-600 hover:border-red-200 opacity-0 group-hover:opacity-100"}
                    transition-all duration-200 z-10`}
                  title={isTemp(base.id) ? "Creating…" : "Delete base"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col w-full items-start gap-4 mb-6">
            {bases?.map((base) => (
              <div key={base.id} className="relative group w-full max-w-[572px]">
                {isTemp(base.id) ? (
                  <div className="block">
                    <div className="relative rounded-[6px] bg-white shadow-at-main-nav h-[92px] w-full">
                      {/* reuse CardInner for list width */}
                      <div className="p-0"><CardInner base={base as any} /></div>
                    </div>
                  </div>
                ) : (
                  <Link href={`/${base.id}`} className="block">
                    <div className="relative rounded-[6px] bg-white cursor-pointer shadow-at-main-nav h-[92px] w-full">
                      <div className="p-0"><CardInner base={base as any} /></div>
                    </div>
                  </Link>
                )}

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isTemp(base.id)) onDeleteBase(base.id, base.name);
                  }}
                  disabled={isTemp(base.id)}
                  className={`absolute top-2 right-2 p-1.5 rounded-[6px] bg-white shadow-at-main-nav border border-gray-200 text-gray-500
                    ${isTemp(base.id) ? "opacity-50 cursor-not-allowed" : "hover:text-red-600 hover:border-red-200 opacity-0 group-hover:opacity-100"}
                    transition-all duration-200 z-10`}
                  title={isTemp(base.id) ? "Creating…" : "Delete base"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}