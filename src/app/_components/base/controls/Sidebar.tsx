"use client";

import React from "react";
import Link from "next/link";
import AirtableBase from "../../icons/AirtableBase";
import LeftArrow from "../../icons/LeftArrow";
import Question from "../../icons/Question";
import Bell from "../../icons/Bell";
import { CleanTooltip, CleanTooltipContent, CleanTooltipTrigger } from "~/components/ui/clean-tooltip";
import { useState } from "react";
import { TooltipProvider } from "@radix-ui/react-tooltip";


interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface SideBarProps {
  user: User;
}


export function Sidebar({user} : SideBarProps) {

  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <TooltipProvider>
    <aside className="h-full print:hidden bg-white">
      <div className="box-border h-full flex flex-col justify-between py-4 px-2 border-r border-border-default w-[56px]">
        {/* Top section */}
        <div className="flex flex-none flex-col items-center gap-2">
          <div className="flex items-center">
            <Link href="/" className="flex flex-none relative group">
              {/* AirtableBase - visible by default, hidden on hover */}
              <div className="group-hover:opacity-0 group-hover:scale-75 transition-all duration-200 ease-in-out">
                <AirtableBase />
              </div>
              
              {/* Left Arrow - hidden by default, visible on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-125 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 ease-in-out">
                <LeftArrow />
              </div>
            </Link>
          </div>

          {/* Omni Icon - TODO */}
          <div className="px-1">
            <div>
              <div className="flex h-full rounded-full">
                <div className="flex h-full items-center justify-center rounded-full focus:outline-white text-purple-600">

                </div>
              </div>
            </div>
          </div>
        </div>
                
        {/* Bottom buttons */}
        <div className="flex flex-auto flex-col justify-end items-center gap-3">
          <CleanTooltip>
            <CleanTooltipTrigger asChild>
              <div 
                role="button" 
                className="w-7 h-7 rounded-full hover:bg-gray-100 focus:outline-none flex items-center justify-center cursor-pointer transition-colors"
              >
                <Question size={16} className="flex-shrink-0 text-gray-700" />
              </div>
            </CleanTooltipTrigger>
            <CleanTooltipContent side="right" sideOffset={8}>
              Help
            </CleanTooltipContent>
          </CleanTooltip>
          
          <CleanTooltip>
            <CleanTooltipTrigger asChild>
              <div
                role="button"
                className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer transition-all relative">
                <Bell size={16} className="text-gray-600" />
              </div>
            </CleanTooltipTrigger>
            <CleanTooltipContent side="right" sideOffset={8}>
              Notifications
            </CleanTooltipContent>
          </CleanTooltip>

          {/* Account */}
          <div className="flex flex-none items-center relative">
                <CleanTooltip>
                  <CleanTooltipTrigger asChild>
                    <button
                      onClick={() => setAccountOpen(!accountOpen)}
                      className="w-[26px] h-[26px] cursor-pointer bg-[#39caff] rounded-full flex items-center justify-center shadow-at-main-nav text-[#1d1f25] font-family-system leading-[26px] font-[400] text-[13px]"
                    >
                      {user.name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? 'U'}
                    </button>
                  </CleanTooltipTrigger>
                  <CleanTooltipContent side="right" sideOffset={8}>
                    Account
                  </CleanTooltipContent>
                </CleanTooltip>

                {accountOpen && (
                  <div className="absolute left-full ml-2 bottom-0 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium">{user.name ?? 'Anonymous User'}</p> 
                      <p className="text-xs text-gray-500">{user.email ?? 'No email'}</p>
                    </div>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Profile</button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Settings</button>
                    <div className="border-t border-gray-200 mt-1 pt-1">
                      <Link href="/api/auth/signout/">
                        <button 
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
                        >
                          Sign out
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
          </div>
        </div>
      </div>
    </aside>
    </TooltipProvider>
  );
}