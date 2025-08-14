"use client";

import { useState } from "react";
import ChevronDown from "../icons/ChevronDown";
import AirtableBase from "../icons/AirtableBase";
import ClockCounterClockwise from "../icons/ClockCounterClockwise";

interface NavBarProps {
  base?: {
    id: string;
    name: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    tables: {
      id: string;
      name: string;
      baseId: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
  } | null;
}

export function NavBar({ base } : NavBarProps) {
  const [selectedTab, setSelectedTab] = useState("Data");
  
  const tabs = ["Data", "Automations", "Interfaces", "Forms"];
  
  return (
    <header className="h-[57px] border-b box-border border-border-default print:hidden bg-white">
        <div className="flex h-full gap-2 min-w-[600px] justify-between">
            {/* Base Icon and Name */}
            <div className="flex pl-4 bg-white overflow-hidden h-full">
                <div className="w-full flex-none flex items-center justify-start gap-2">
                    <div className="w-[32px] h-[32px] bg-[#63498d] border border-border-default rounded-[6px] flex shrink-0 items-center justify-center">
                        <div className="relative top-[2px] h-[24px] w-[24px]">
                            <AirtableBase color="hsla(0, 0%, 100%, 0.95)" />                        
                        </div>
                    </div>
                    <div className="flex items-center min-w-0 max-w-[480px]">
                        {/* TODO: Add Base rename */}
                        <button 
                            className="flex items-center cursor-pointer" 
                        >
                            <div className="leading-6 rounded-full font-family-inter-updated font-[675] text-[17px] text-[#1d1f25] min-w-0 truncate flex-auto">
                                {base?.name ?? "Loading..."}
                            </div>
                            <div className="flex flex-none ml-1">
                                <ChevronDown size={16} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
            {/* Page List */}
            <ul className="flex relative items-stretch justify-center bg-white gap-4 px-2">
                {tabs.map((tab) => (
                    <li key={tab}>
                        <a 
                            className="relative flex h-full items-center cursor-pointer"
                            onClick={() => setSelectedTab(tab)}
                        >
                            <p className={`font-family-system font-[500] text-[13px] leading-5 py-2 hover:text-[#1d1f25] ${
                                selectedTab === tab ? 'text-[#1d1f25]' : 'text-[#616670]'
                            }`}>
                                {tab}
                            </p>
                            {selectedTab === tab && (
                                <div className="absolute right-0 left-0 bottom-[-1px] h-0.5 bg-[#63498d]"></div>
                            )}
                        </a>
                    </li>
                ))}
            </ul>
            {/* History + Share Button */}
            <div className="flex items-center justify-end pr-2 overflow-hidden bg-white">
                <div className="inline-flex items-center gap-1">
                    <div className="flex-none flex items-center">
                        <button className="cursor-pointer flex justify-center items-center rounded-full mx-2 w-7 h-7 hover:bg-[#E5E9F0]">
                            <ClockCounterClockwise size={16} />
                        </button>

                        <button className="flex items-center cursor-pointer rounded-[6px] border-0 leading-[19.5px] ml-2 mr-2 px-3 h-[28px] bg-[#63498d] shadow-at-main-nav">
                            <span className="leading-6 text-white text-[13px] font-[500] ">Share</span>
                        </button>

                    </div>
                </div>

            </div>

        </div>
    </header>
  );
}