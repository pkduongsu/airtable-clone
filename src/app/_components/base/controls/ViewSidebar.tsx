"use client";

import { CustomResizablePanel } from "../CustomResizablePanel";
import Plus from "../../icons/Plus";
import MagnifyingGlass from "../../icons/MagnifyingGlass";
import Cog from "../../icons/Cog";
import GridFeature from "../../icons/GridFeature";

interface ViewSidebarProps {
  isExpanded: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onWidthChange: (width: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
}

export function ViewSidebar({
  isExpanded,
  isHovered,
  onHover,
  onLeave,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: ViewSidebarProps) {
  return (
    <div
      className="absolute top-0 left-0 h-full z-10 transition-transform duration-300 ease-in-out"
      style={{
        transform: isExpanded || isHovered ? 'translateX(0)' : 'translateX(-100%)',
        pointerEvents: isExpanded || isHovered ? 'auto' : 'none'
      }}
    >
      <CustomResizablePanel
        defaultWidth={280}
        minWidth={280}
        maxWidth={720}
        className="print:hidden h-full"
        onResize={onWidthChange}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      >
        <nav 
          className="h-full bg-white w-full"
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
        >
          <div className="h-full flex flex-col box-border py-2.5 px-2">
            <div className="flex flex-none flex-col justify-start pb-2">
              <button className="h-[32px] cursor-pointer items-center justify-start box-border focus-visible:-outline rounded-[6px] bg-white hover:bg-[#0000000d] flex w-full px-3 pl-[16px]">
                <Plus size={16} className="flex-none mr-2" color="#1d1f25"/>
                <span className="truncate font-family-system font-[400] text-[13px] leading-[22px]">Create new...</span>
              </button>
              <div className="px-2 mt-1">
                <div className="relative h-[32px]">
                  <div className="w-full h-[32px]">
                    <div className="flex items-center relative h-[32px]">
                      <input type="text" className="w-full h-[32px] px-[30px] py-[6px] font-family-system text-[13px] font-[400] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#166ee1]" placeholder="Find a view" />
                      <MagnifyingGlass size={14} color="#616670" className="flex-none absolute left-2" />
                    </div>
                  </div>
                  <div className="absolute right-1 bottom-0 flex items-center top-1/2 -translate-y-1/2">
                    <button className="w-7 h-7 rounded-[6px] flex items-center justify-center focus-visible:outline cursor-pointer toolbar-button">
                      <Cog size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-auto overflow-y-auto overflow-x-hidden">
                <div className="h-full" />
                  <div className="flex flex-col flex-auto w-full min-h-[144px]">
                    <div className="relative flex-auto">
                      {/* If there are many views, should list all views here -> TODO */}
                      {/* For now just 1 view card*/}
                      <button className="rounded-[3px] cursor-pointer flex relative justify-center flex-col pt-2 pb-2 px-3 hover:bg-[#0000000d] w-full">
                        <div className="flex items-center">
                          <div className="flex flex-auto items-center">
                            <span className="flex-inline flex-none items-center mr-2">
                              <GridFeature size={16} color="#166ee1" className="flex-none" />
                            </span>
                            <span className="font-family-system font-[500] text-[13px] leading-[16.25px] truncate text-[#1d1f25]">
                              Grid view
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
              </div>
          </div>
        </nav>
      </CustomResizablePanel>
    </div>
  );
}