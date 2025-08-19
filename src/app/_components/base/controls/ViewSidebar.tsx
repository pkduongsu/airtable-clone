"use client";

import { useState } from "react";
import { CustomResizablePanel } from "../components/CustomResizablePanel";
import { ToolbarModal } from "../modals/ToolbarModal";
import { CreateViewModal, type ViewConfig } from "../modals/CreateViewModal";
import { ViewContextMenuModal } from "../modals/ViewContextMenuModal";
import Plus from "../../icons/Plus";
import MagnifyingGlass from "../../icons/MagnifyingGlass";
import Cog from "../../icons/Cog";
import GridFeature from "../../icons/GridFeature";
import { api } from "~/trpc/react";

interface ViewSidebarProps {
  isExpanded: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onWidthChange: (width: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  selectedTable?: string | null;
  currentView?: string | null;
  onViewChange?: (viewId: string | null, config: ViewConfig) => void;
  currentSortRules?: Array<{
    id: string;
    columnId: string;
    columnName: string;
    columnType: string;
    direction: 'asc' | 'desc';
  }>;
  currentFilterRules?: Array<{
    id: string;
    columnId: string;
    columnName: string;
    columnType: 'TEXT' | 'NUMBER';
    operator: 'is_empty' | 'is_not_empty' | 'contains' | 'not_contains' | 'equals' | 'greater_than' | 'less_than';
    value?: string | number;
  }>;
  currentHiddenColumns?: string[];
  views?: Array<{
    id: string;
    name: string;
    config: unknown;
    isDefault: boolean;
    createdAt: Date;
  }>;
  onRefetchViews?: () => void;
}

export function ViewSidebar({
  isExpanded,
  isHovered,
  onHover,
  onLeave,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  selectedTable,
  currentView,
  onViewChange,
  currentSortRules: _currentSortRules = [],
  currentFilterRules: _currentFilterRules = [],
  currentHiddenColumns: _currentHiddenColumns = [],
  views,
  onRefetchViews,
}: ViewSidebarProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createButtonRef, setCreateButtonRef] = useState<HTMLButtonElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    view: { id: string; name: string; isDefault: boolean } | null;
  }>({
    isOpen: false,
    position: null,
    view: null,
  });


  // Get default view name for creating new views
  const { data: defaultViewName } = api.view.getDefaultViewName.useQuery(
    { tableId: selectedTable! },
    { enabled: !!selectedTable && isCreateModalOpen }
  );

  // Create view mutation
  const createViewMutation = api.view.create.useMutation({
    onSuccess: (newView) => {
      if (onRefetchViews) {
        onRefetchViews();
      }
      setIsCreateModalOpen(false);
      // Switch to the newly created view
      if (onViewChange) {
        onViewChange(newView.id, newView.config as unknown as ViewConfig);
      }
    }
  });

  // Rename view mutation
  const renameViewMutation = api.view.update.useMutation({
    onSuccess: () => {
      if (onRefetchViews) {
        onRefetchViews();
      }
    }
  });

  // Delete view mutation
  const deleteViewMutation = api.view.delete.useMutation({
    onSuccess: () => {
      if (onRefetchViews) {
        onRefetchViews();
      }
      // Switch to default view if current view was deleted
      if (contextMenu.view && currentView === contextMenu.view.id) {
        const remainingViews = views?.filter(v => v.id !== contextMenu.view!.id);
        if (remainingViews && remainingViews.length > 0) {
          const firstView = remainingViews[0];
          if (onViewChange && firstView) {
            onViewChange(firstView.id, firstView.config as ViewConfig);
          }
        } else {
          if (onViewChange) {
            onViewChange(null, { sortRules: [], filterRules: [], hiddenColumns: [] });
          }
        }
      }
    }
  });



  const handleCreateView = (name: string) => {
    if (!selectedTable) return;

    // Create new view with clean state (no sorting, filtering, or hidden columns)
    const config: ViewConfig = {
      sortRules: [],
      filterRules: [],
      hiddenColumns: [],
    };

    createViewMutation.mutate({
      tableId: selectedTable,
      name,
      config
    });
  };

  const handleViewClick = (view: { id: string; name: string; config: unknown }) => {
    if (onViewChange) {
      onViewChange(view.id, view.config as ViewConfig);
    }
  };

  const handleCreateNewClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleViewRightClick = (event: React.MouseEvent, view: { id: string; name: string; isDefault: boolean }) => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      view,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu({
      isOpen: false,
      position: null,
      view: null,
    });
  };

  const handleViewRename = (viewId: string, newName: string) => {
    renameViewMutation.mutate({ id: viewId, name: newName });
  };

  const handleViewDelete = (viewId: string) => {
    deleteViewMutation.mutate({ id: viewId });
  };
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
              <button 
                ref={setCreateButtonRef}
                onClick={handleCreateNewClick}
                className="h-[32px] cursor-pointer items-center justify-start box-border focus-visible:-outline rounded-[6px] bg-white hover:bg-[#0000000d] flex w-full px-3 pl-[16px]"
              >
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
                      {/* Display all views */}
                      {views?.map((view) => (
                        <button 
                          key={view.id}
                          onClick={() => handleViewClick(view)}
                          onContextMenu={(e) => handleViewRightClick(e, view)}
                          className={`rounded-[3px] cursor-pointer flex relative justify-center flex-col pt-2 pb-2 px-3 hover:bg-[#0000000d] w-full ${
                            currentView === view.id ? 'bg-[#166ee1]/10' : ''
                          }`}
                        >
                          <div className="flex items-center">
                            <div className="flex flex-auto items-center">
                              <span className="flex-inline flex-none items-center mr-2">
                                <GridFeature 
                                  size={16} 
                                  color={currentView === view.id ? "#166ee1" : "#166ee1"} 
                                  className="flex-none" 
                                />
                              </span>
                              <span className={`font-family-system font-[500] text-[13px] leading-[16.25px] truncate ${
                                currentView === view.id ? 'text-[#166ee1]' : 'text-[#1d1f25]'
                              }`}>
                                {view.name}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                      
                      {/* Default view fallback if no views exist */}
                      {(!views || views.length === 0) && (
                        <button 
                          onClick={() => onViewChange?.(null, { sortRules: [], filterRules: [], hiddenColumns: [] })}
                          className="rounded-[3px] cursor-pointer flex relative justify-center flex-col pt-2 pb-2 px-3 hover:bg-[#0000000d] w-full"
                        >
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
                      )}
                    </div>
                  </div>
              </div>
          </div>
        </nav>
      </CustomResizablePanel>
      
      {/* Create View Modal */}
      <ToolbarModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        triggerRef={{ current: createButtonRef }}
        width={320}
        maxHeight={300}
      >
        <CreateViewModal
          defaultName={defaultViewName ?? "Grid view"}
          onSave={handleCreateView}
          onCancel={() => setIsCreateModalOpen(false)}
          isCreating={createViewMutation.isPending}
        />
      </ToolbarModal>

      {/* Context Menu Modal */}
      <ViewContextMenuModal
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        view={contextMenu.view}
        onClose={handleContextMenuClose}
        onRename={handleViewRename}
        onDelete={handleViewDelete}
      />
    </div>
  );
}