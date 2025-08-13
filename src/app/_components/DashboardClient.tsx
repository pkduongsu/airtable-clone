"use client";

import React, { useState } from "react";
import {
  Trash2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Navbar } from "./home/Navbar";
import { Sidebar } from "./home/Sidebar";
import { QuickStartCards } from "./home/QuickStartCards";
import { BasesSection } from "./home/BasesSection";

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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarExpandedButton, setSidebarExpandedButton] = useState(false);
  const [starredExpanded, setStarredExpanded] = useState(false);

  const getRelativeTime = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return "Opened just now";
    } else if (diffInMinutes < 60) {
      return `Opened ${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    } else if (diffInHours < 24) {
      return `Opened ${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else if (diffInDays === 1) {
      return "Opened yesterday";
    } else if (diffInDays < 7) {
      return `Opened ${diffInDays} days ago`;
    } else {
      return `Opened on ${past.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })}`;
    }
  };

  const { data: bases, refetch: refetchBases } = api.base.list.useQuery();
  const deleteBaseMutation = api.base.delete.useMutation();
  const createBaseMutation = api.base.create.useMutation({
    onSuccess: () => {
      refetchBases();
    },
  });

  const handleDeleteBase = async (baseId: string, baseName: string) => {
    if (window.confirm(`Are you sure you want to delete "${baseName}"? This action cannot be undone.`)) {
      try {
        await deleteBaseMutation.mutateAsync({ id: baseId });
        await refetchBases();
      } catch (error) {
        console.error("Failed to delete base:", error);
        alert("Failed to delete base. Please try again.");
      }
    }
  };

  const handleCreateBase = () => {
    createBaseMutation.mutate({
      name: "Untitled Base",
      createSampleTable: true,
    });
  };


  return (
    <>
      <div className="h-screen w-screen flex flex-col bg-white">
        <Navbar 
          user={user} 
          onMenuClick={() => setSidebarExpandedButton(!sidebarExpandedButton)} 
        />
          
        {/* Main Layout */}
        <div className="flex flex-auto relative">
          <Sidebar
            sidebarExpanded={sidebarExpanded}
            sidebarExpandedButton={sidebarExpandedButton}
            starredExpanded={starredExpanded}
            setSidebarExpanded={setSidebarExpanded}
            setStarredExpanded={setStarredExpanded}
            onCreateClick={handleCreateBase}
          />

          {/* Main Content Area */}
          <div className="flex-1 ml-12 pt-8 px-12 overflow-y-auto bg-grey-25">
            <h1 className="text-[27px] heading-primary leading-[34px] mb-6">Home</h1>
            
            <QuickStartCards />

            <BasesSection 
              bases={bases}
              onDeleteBase={handleDeleteBase}
              getRelativeTime={getRelativeTime}
            />
          </div>
        </div>
      </div>

    </>
  );
}