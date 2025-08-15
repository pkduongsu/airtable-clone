"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface CustomResizablePanelProps {
  defaultWidth?: number;
  minWidth: number;
  maxWidth: number;
  children: React.ReactNode;
  className?: string;
  onResize?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

export function CustomResizablePanel({
  defaultWidth = 320,
  minWidth,
  maxWidth,
  children,
  className = "",
  onResize,
  onResizeStart,
  onResizeEnd,
}: CustomResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    onResizeStart?.();
  }, [onResizeStart]);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
        onResize?.(newWidth);
      }
    },
    [isResizing, minWidth, maxWidth, onResize]
  );

  const stopResize = useCallback(() => {
    setIsResizing(false);
    onResizeEnd?.();
  }, [onResizeEnd]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", resize);
      document.addEventListener("mouseup", stopResize);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resize, stopResize]);

  // Call onResize when width changes or component mounts
  useEffect(() => {
    onResize?.(width);
  }, [width, onResize]);

  return (
    <div className="flex h-full">
      <div
        ref={panelRef}
        className={`bg-white border-r border-border-default relative ${className}`}
        style={{ width: `${width}px`, minWidth: `${minWidth}px`, maxWidth: `${maxWidth}px` }}
      >
        {children}
        
        {/* Custom resize handle */}
        <div
          ref={handleRef}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize transition-all duration-200"
          onMouseDown={startResize}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            width: isHovering || isResizing ? "3px" : "1px",
            backgroundColor: isHovering || isResizing ? "#166ee1" : "transparent",
          }}
        />
      </div>
    </div>
  );
}