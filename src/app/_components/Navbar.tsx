"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  Search,
} from "lucide-react";

import List from "./icons/List";
import Bell from "./icons/Bell";
import Question from "./icons/Question";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface NavbarProps {
  user: User;
  onMenuClick: () => void;
}

export function Navbar({ user, onMenuClick }: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="flex items-center w-full h-14 bg-white flex-none shadow-xs border-t-0 border border-gray-200 z-20">
      <nav className="flex items-center justify-between w-full pl-2 pr-4">
        <div className="flex items-center">
          <div className="flex flex-auto items-center">
            <button 
              className="pl-1 pr-2 flex cursor-pointer transition-all duration-200"
              onClick={onMenuClick}
            >
              <div className="text-gray-400 hover:text-gray-800 transition-colors duration-200">
                <List size={20} color="currentColor"/>
              </div>
            </button>

            {/* Logo */}
            <div className="p-3 flex items-center">
              <Link href="/">
                <Image
                  src="/airtable_hori.svg"
                  alt="hori_logo"
                  width={102}
                  height={22}
                  className="flex jusitfy-center h-auto object-contain"
                />
              </Link>
            </div>


            <div className="flex-auto"></div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="flex w-[340px] relative"> 
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <Search 
              className="text-black-400 pointer-events-none"
              size={14}
            />
          </div>
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-16 py-1.5 bg-white-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors border border-gray-200"
            />
            <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none inline-flex items-center px-1.5 py-0.5 rounded border bg-none font-mono text-xs border-none text-gray-500">
              <span className="text-xs">ctrl K</span>
            </kbd>
          </div>

        {/* Help, noti, account */}
        <div className="flex items-center">
          <div className="flex-auto flex items-center">
            <div className="flex-auto flex items-center justify-end">

              <button className="p-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all">
                <Question size={16} />
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
        </div>
      </nav>
    </header>
  );
}