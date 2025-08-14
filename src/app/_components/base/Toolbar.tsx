import List from "../icons/List";
import GridFeature from "../icons/GridFeature";
import ChevronDown from "../icons/ChevronDown";
import EyeSlash from "../icons/EyeSlash";
import FunnelSimple from "../icons/FunnelSimple";
import Group from "../icons/Group";
import ArrowsDownUp from "../icons/ArrowsDownUp";
import PaintBucket from "../icons/PaintBucket";

export default function Toolbar() {
  return (
    <div className="w-full relative bg-white">
      <div className="flex flex-none gap-2 items-center border-b border-border-default overflow-hidden print:hidden h-12 min-w-[600px]">
        <div className="flex flex-auto items-center pl-4 pr-2">
          {/* Sidebar open/close */}
          <button className="mr-2 flex items-center justify-center cursor-pointer focus-visible:outline h-8 w-8 toolbar-button rounded-[6px]">
            <List size={16} color="#1d1f25" />
          </button>
          {/* Grid view */}
          <button className="flex items-center cursor-pointer rounded-[3px] focus-visible:outline px-2 h-[26px] max-w-fit toolbar-button">
            <div className="flex items-center min-w-0">
              <span className="flex-inline flex-none items-center">
                <GridFeature size={16} color="rgb(22, 110, 225)" className="flex-none" />
              </span>
              <h2 className="truncate flex-auto ml-2 mr-2 text-[#1d1f25] text-[13px] font-[500] leading-[18px] font-family-system">
                Grid view
              </h2>
              {/* More grid options */}
              <div>
                <ChevronDown size={16} />
              </div>
            </div>
          </button>
        </div>
        <div className="flex flex-auto item-center justify-end h-full pr-2">
          <div className="flex items-center flex-auto h-full overflow-hidden">
            <div className="flex items-center px-2 grow justify-end">
              <div className="flex items-center">
                <div className="flex flex-row mr-2">
                  <div>
                    {/* Show/Hide fields add tooltips to each button here */}
                    <button className="toolbar-button focus-visible:outline mr-2">
                      <div className="cursor-pointer flex items-center px-2 py-1">
                        <EyeSlash size={16} color="#616670" className="flex-none transition-colors duration-200" />
                      </div>
                    </button>
                    {/* Filter button */}
                    <button className="focus-visible:outline toolbar-button">
                      <div className="cursor-pointer flex items-center px-2 py-1">
                        <FunnelSimple size={16} color="#616670" className="flex-none transition-colors duration-200" />
                      </div>
                    </button>
                  </div>
                </div>
                <div className="flex items-center">
                  <button className="toolbar-button focus-visible:outline mr-2">
                    <div className="cursor-pointer flex items-center px-2 py-1">
                      <Group size={16} color="#616670" className="flex-none" />
                    </div>
                  </button>
                  <div>
                    <div>
                      <button className="toolbar-button focus-visible:outline mr-2">
                        <div className="cursor-pointer flex items-center px-2 py-1">
                            <ArrowsDownUp size={16} color="#616670" className="flex-none" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <button className="toolbar-button focus-visible:outline mr-2">
                    <div className="cursor-pointer flex items-center px-2 py-1">
                        <PaintBucket size={16} color="#616670" className="flex-none" />
                    </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};