"use client";

import React from "react";
import {
  Upload,
  ChevronDown,
  Plus,
  ChevronRight,
  Package,
  ShoppingCart,
} from "lucide-react";
import House from "../icons/House";
import Star from "../icons/Star";
import UsersThree from "../icons/UsersThree";

interface SidebarProps {
  sidebarExpanded: boolean;
  sidebarExpandedButton: boolean;
  starredExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  setStarredExpanded: (expanded: boolean) => void;
  onCreateClick: () => void;
}

export function Sidebar({
  sidebarExpanded,
  sidebarExpandedButton,
  starredExpanded,
  setSidebarExpanded,
  setStarredExpanded,
  onCreateClick,
}: SidebarProps) {
  const isExpanded = sidebarExpanded || sidebarExpandedButton;

  return (
    <aside 
      className={`bg-white border-r border-gray-200 transition-all duration-100 ease-in-out ${
        sidebarExpanded ? 'w-80' : 'w-12'
      } ${
        sidebarExpandedButton ? 'w-80' : 'w-12'
      } absolute left-0 top-0 bottom-0 z-10`}
      onMouseEnter={() => setSidebarExpanded(true)}
      onMouseLeave={() => setSidebarExpanded(false)}
    >
      <nav className="p-2 space-y-1"> 
        {/* Main Navigation Items */}
        <button className="w-full flex items-center gap-3 px-1 py-2 rounded-md hover:bg-gray-200 text-gray-900 transition-colors">
          <House size={20}/>
          {isExpanded && <span className="text-sm font-medium">Home</span>}
        </button>

        <div className="w-full">
          <button 
            className="w-full flex items-center gap-3 px-1 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors"
            onClick={() => isExpanded && setStarredExpanded(!starredExpanded)}
          >
            <Star size={20} />
            {isExpanded && (
              <>
                <span className="text-sm font-medium flex-1 text-left">Starred</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${starredExpanded ? '' : '-rotate-90'}`} />
              </>
            )}
          </button>
          {isExpanded && starredExpanded && (
            <div className="ml-8 mt-1 space-y-1 pr-2">
              <div className="px-1 py-1 flex items-center gap-2">
                <Star size={20} className="border-1 border-gray-200 rounded-sm" />
                <p className="text-xs text-gray-500 flex-1 text-left">Your starred bases, interfaces, and workspaces will appear here</p>
              </div>
            </div>
          )}
        </div>

        <button className="w-full flex items-center gap-3 px-1 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
          <svg width="20" height="20" viewBox="0 0 16 16" className="flex-none text-gray-700">
            <use fill="currentColor" href="/icons/icon_definitions.svg#Share" />
          </svg>
          {isExpanded && <span className="text-sm font-medium">Shared</span>}
        </button>

        <div className="w-full">
          <button className="w-full flex items-center gap-3 px-1 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
            <UsersThree size={20} />
            {isExpanded && (
              <>
                <span className="text-sm font-medium flex-1 text-left">Workspaces</span>
                <div className="flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4" />
                </div>
              </>
            )}
          </button>
        </div>
        <div className="my-2.5 w-full border-t-2 border-gray-200 h-0"></div>
      </nav>

      {/* Bottom Section */}
      {isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1 border-t border-gray-200">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
            <Package className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">Templates and apps</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
            <ShoppingCart className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">Marketplace</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
            <Upload className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">Import</span>
          </button>
          
          <button 
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            onClick={onCreateClick}
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Create</span>
          </button>
        </div>
      )}
    </aside>
  );
}