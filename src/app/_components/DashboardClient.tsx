"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Upload,
  ChevronDown,
  Plus,
  ChevronRight,
  Package,
  ShoppingCart,
  Database,
} from "lucide-react";
import { api } from "~/trpc/react";
import { CreateBaseModal } from "./CreateBaseModal";
import { Navbar } from "./Navbar";
import Omni from "./icons/Omni";
import House from "./icons/House";
import Star from "./icons/Star";
import UsersThree from "./icons/UsersThree";
import GridFour from "./icons/GridFour";
import ArrowUp from "./icons/ArrowUp";
import Table from "./icons/Table";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardClientProps {
  user: User;
}

export function DashboardClient({ user }: DashboardClientProps) {
  const [viewMode, setViewMode] = useState('grid');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarExpandedButton, setSidebarExpandedButton] = useState(false);
  const [starredExpanded, setStarredExpanded] = useState(false);
  const [createBaseModalOpen, setCreateBaseModalOpen] = useState(false);

  const { data: bases, refetch: refetchBases } = api.base.list.useQuery();

  const templateCards = [
    {
      title: 'Start with Omni',
      description: 'Use AI to build a custom app tailored to your workflow',
      icon: Omni,
      iconColor: 'rgb(221, 4, 168)',
    },
    {
      title: 'Start with templates',
      description: 'Select a template to get started and customize as you go.',
      icon: GridFour,
      iconColor: 'rgb(99, 73, 141)',
    },
    {
      title: 'Quickly upload',
      description: 'Easily migrate your existing projects in just a few minutes.',
      icon: ArrowUp,
      iconColor: 'rgb(13, 127, 120)',
    },
    {
      title: 'Build an app on your own',
      description: 'Start with a blank app and build your ideal workflow.',
      icon: Table,
      iconColor: 'rgb(59, 102, 163)',
    },
  ];

  return (
      <div className="h-screen w-screen flex flex-col bg-white">
        <Navbar 
          user={user} 
          onMenuClick={() => setSidebarExpandedButton(!sidebarExpandedButton)} 
        />
          
      {/* Main Layout */}
      <div className="flex flex-auto relative">
        {/* Expandable Sidebar */}
        <aside 
          className={`bg-white border-r border-gray-200 transition-all duration-100 ease-in-out ${
            sidebarExpanded ? 'w-80' : 'w-12'
          } ${
            sidebarExpandedButton ? 'w-80' : 'w-12'
          } absolute left-0 top-0 bottom-0 z-10 `}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <nav className="p-2 space-y-1"> 
            {/* Main Navigation Items */}
            <button className="w-full flex items-center gap-3 px-1 py-2 rounded-md hover:bg-gray-200 text-gray-900 transition-colors">
              <House size={20}/>
              {(sidebarExpanded || sidebarExpandedButton)  && <span className="text-sm font-medium">Home</span>}
            </button>

            <div className="w-full">
              <button 
                className="w-full flex items-center gap-3 px-1 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors"
                onClick={() => (sidebarExpanded || sidebarExpandedButton)  && setStarredExpanded(!starredExpanded)}
              >
                <Star size={20} />
                {(sidebarExpanded || sidebarExpandedButton) && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">Starred</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${starredExpanded ? '' : '-rotate-90'}`} />
                  </>
                )}
              </button>
              {(sidebarExpanded || sidebarExpandedButton) && starredExpanded && (
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
              {(sidebarExpanded || sidebarExpandedButton) && <span className="text-sm font-medium">Shared</span>}
            </button>

            <div className="w-full">
              <button className="w-full flex items-center gap-3 px-1 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
                <UsersThree size={20} />
                {(sidebarExpanded || sidebarExpandedButton)&& (
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
          {(sidebarExpanded || sidebarExpandedButton) && (
            <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1 border-t border-gray-200 bg-gray-50">
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
              
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                      onClick={() => setCreateBaseModalOpen(true)}>
                <Plus className="h-5 w-5" />
                <span className="text-sm font-medium">Create</span>
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 ml-12 pl-12 pr-12 pt-8 overflow-y-auto bg-grey-25">
            <h1 className="text-[27px] heading-primary leading-[34px]  mb-6">Home</h1>
            
            {/* Template Cards */}
            <div className="flex flex-col">
              <div className="mb-2.5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-0.5">
                  {templateCards.map((template, index) => (
                <article 
                  key={index}
                  className="bg-white rounded-[6px] shadow-at-main-nav p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col gap-0">
                    {/* Icon and Title Row */}
                    <div className="flex items-center gap-1">
                        {
                          <template.icon size={20} color={`${template.iconColor}`} className="flex-none" />
                        }
                      <h2 className="leading-[19px] text-[#1d1f25] font-[600] text-[15px] ml-2">{template.title}</h2>
                    </div>
                    <p className="text-[13px] text-gray-500 leading-[1.5] mt-1">
                      {template.description}
                    </p>
                  </div>
                </article>
              ))}
                </div>
              </div>
            </div>

            {/* Recent Bases Section */}
            <section className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-medium text-gray-600">Opened anytime</h2>
                <div className="flex items-center gap-4">
                  {/* View Toggle */}
                  <div className="flex rounded-md p-0.5">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-2 py-1 rounded-full transition-colors ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                    >
                      <Menu size={16} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-2 py-1 rounded-full transition-colors ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                    >
                      <GridFour size={20}/>
                    </button>
                  </div>
                </div>
              </div>

              {/* Base Cards */}
              <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-3'}>
                {bases?.map((base) => (
                  <Link href={`/${base.id}`} key={base.id}>
                    <article 
                      className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          <Database className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-sm mb-0.5">{base.name}</h3>
                          <p className="text-xs text-gray-500">
                            {base.tables.length} table{base.tables.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          </div>
      </div>

      <CreateBaseModal
        open={createBaseModalOpen}
        onOpenChange={setCreateBaseModalOpen}
        onSuccess={refetchBases}
      />
    </div>
  );
}