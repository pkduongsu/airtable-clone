"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Rocket,
  FileText,
  Upload,
  Layers,
  Search,
  HelpCircle,
  Bell,
  Home,
  Star,
  ChevronDown,
  Share2,
  Users,
  Plus,
  ChevronRight,
  Package,
  ShoppingCart,
  List,
  Grid3X3,
  Database,
  Clock,
  Table,
} from "lucide-react";
import Image from "next/image";

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
  const [workspacesExpanded, setWorkspacesExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const templateCards = [
    {
      title: 'Start with Omni',
      description: 'Use AI to build a custom app tailored to your workflow',
      icon: Rocket,
      bgColor: 'bg-purple-100',
      hoverBgColor: 'hover:bg-purple-200',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Start with templates',
      description: 'Select a template to get started and customize as you go.',
      icon: FileText,
      bgColor: 'bg-blue-100',
      hoverBgColor: 'hover:bg-blue-200',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Quickly upload',
      description: 'Easily migrate your existing projects in just a few minutes.',
      icon: Upload,
      bgColor: 'bg-green-100',
      hoverBgColor: 'hover:bg-green-200',
      iconColor: 'text-green-600',
    },
    {
      title: 'Build an app on your own',
      description: 'Start with a blank app and build your ideal workflow.',
      icon: Layers,
      bgColor: 'bg-orange-100',
      hoverBgColor: 'hover:bg-orange-200',
      iconColor: 'text-orange-600',
    },
  ];

  const recentBases = [
    { name: 'Product roadmap', icon: Layers, time: '2 hours ago', color: 'from-pink-500 to-red-500' },
    { name: 'Customer database', icon: Database, time: '5 hours ago', color: 'from-blue-500 to-indigo-500' },
    { name: 'Marketing calendar', icon: Clock, time: '1 day ago', color: 'from-green-500 to-teal-500' },
    { name: 'Sales pipeline', icon: Table, time: '3 days ago', color: 'from-purple-500 to-pink-500' },
  ];

  return (
      <div className="h-screen w-screen flex flex-col bg-white">
        {/*Top Nav Bar - to be isolated to a component later */}
        <header className="flex items-center w-full h-13 bg-white flex-none shadow-md border border-gray-200">
          <nav className="flex items-center justify-between w-full pl-1 pr-2">
            <div className="flex items-center">
              <div className="flex flex-auto items-center">
                <button className="pl-2 pr-4 py-2 flex cursor-pointer"
                  onClick={() => setSidebarExpanded(!sidebarExpanded)}>
                    {/* TODO: Add tooltip: Expand Sidebar here */}
                  <Menu 
                    width={20}
                    height={20}
                    className="text-gray-900 transition-all duration-200 hover:stroke-[1.75] stroke-[0.75]"
                    strokeWidth={2}
              
                  />
                </button>

                  {/* Logo */}
                  <Link href="/dashboard" >
                    <Image
                      src="/airtable_hori.svg"
                      alt="hori_logo"
                      width={102}
                      height={22}
                      className="flex jusitfy-center h-auto object-contain"
                    />
                  </Link>
                  <div className="flex-auto"></div>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black-400 pointer-events-none"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-16 py-1.5 bg-white-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors border border-gray-200"
                />
                <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none inline-flex items-center px-1.5 py-0.5 rounded border bg-none font-mono text-xs border-none text-gray-500">
                  <span className="text-xs">ctrl K</span>
                </kbd>
              </div>
            </div>

            {/* Help, noti, account */}
            <div className="flex items-center">
              <div className="flex-auto flex items-center">
                <div className="flex-auto flex items-center justify-end">

                  <button className="p-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all">
                    <HelpCircle className="h-5 w-5" />
                  </button>

                  <button 
                    className="p-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all relative"
                  >
                    <Bell className="h-5 w-5" />
                  </button>

                  <div className="relative ml-2">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center hover:ring-2 hover:ring-cyan-500 hover:ring-offset-2 transition-all text-white text-sm font-medium"
                >
                  {user.name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? 'U'}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
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
                          >Sign out</button>
                    </Link>
                      </div>
                  </div>
                )}
              </div>
                </div>
              </div>
            </div>
          </nav>
        </header>
          
      {/* Main Layout */}
      <div className="flex flex-auto">
        {/* Expandable Sidebar */}
        <aside 
          className={`bg-white border-r border-gray-200 transition-all duration-100 ease-in-out ${
            sidebarExpanded ? 'w-64' : 'w-16'
          } relative`}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <nav className="p-3 space-y-1">
            {/* Main Navigation Items */}
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-gray-200 text-gray-900 transition-colors">
              <Home className="h-5 w-5 flex-shrink-0" />
              {sidebarExpanded && <span className="text-sm font-medium">Home</span>}
            </button>

            <div className="w-full">
              <button 
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors"
                onClick={() => sidebarExpanded && setWorkspacesExpanded(!workspacesExpanded)}
              >
                <Star className="h-5 w-5 flex-shrink-0" />
                {sidebarExpanded && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">Starred</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${workspacesExpanded ? '' : '-rotate-90'}`} />
                  </>
                )}
              </button>
              {sidebarExpanded && workspacesExpanded && (
                <div className="ml-8 mt-1 space-y-1">
                  <div className="px-3 py-1">
                    <p className="text-xs text-gray-500">Your starred bases, interfaces, and workspaces will appear here</p>
                  </div>
                </div>
              )}
            </div>

            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
              <Share2 className="h-5 w-5 flex-shrink-0" />
              {sidebarExpanded && <span className="text-sm font-medium">Shared</span>}
            </button>

            <div className="w-full">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-200 text-gray-700 transition-colors">
                <Users className="h-5 w-5 flex-shrink-0" />
                {sidebarExpanded && (
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
          </nav>

          {/* Bottom Section */}
          {sidebarExpanded && (
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
              
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
                <Plus className="h-5 w-5" />
                <span className="text-sm font-medium">Create</span>
              </button>
              
              <div className="pt-2 mt-2 border-t border-gray-300">
                <a href="#" className="text-xs text-blue-600 hover:underline">https://airtable.com</a>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8 bg-white overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Home</h1>
            
            {/* Template Cards */}
            <section className="grid grid-cols-4 gap-4 mb-8">
              {templateCards.map((template, index) => (
                <article 
                  key={index}
                  className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${template.bgColor} ${template.hoverBgColor}`}>
                      <template.icon className={`w-5 h-5 ${template.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">{template.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {/* Recent Bases Section */}
            <section className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-medium text-gray-600">Recently opened</h2>
                
                {/* View Toggle */}
                <div className="flex bg-white border border-gray-200 rounded-md p-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2 py-1 rounded transition-colors ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    <List size={16} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-2 py-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    <Grid3X3 size={16} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Base Cards */}
              <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-3'}>
                {recentBases.slice(0, viewMode === 'grid' ? 3 : 2).map((base, index) => (
                  <article 
                    key={index}
                    className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${base.color} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                        <base.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-0.5">{base.name}</h3>
                        <p className="text-xs text-gray-500">Opened {base.time}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>

  );
}