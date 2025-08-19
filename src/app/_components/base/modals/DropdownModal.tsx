"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface DropdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  width?: number;
  maxHeight?: number;
  className?: string;
  align?: 'left' | 'right';
}

export function DropdownModal({
  isOpen,
  onClose,
  triggerRef,
  children,
  width = 200,
  maxHeight = 300,
  className = "",
  align = 'left',
}: DropdownModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle positioning
  const updatePosition = useCallback(() => {
    if (!isOpen || !triggerRef.current || !modalRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const modal = modalRef.current;
    
    // Position below the trigger button with a small gap
    let top = triggerRect.bottom + 4;
    let left = align === 'right' 
      ? triggerRect.right - width  // Right-align: modal's right edge aligns with trigger's right edge
      : triggerRect.left;          // Left-align: modal's left edge aligns with trigger's left edge

    // Ensure the modal stays within the viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if modal would overflow
    if (align === 'right') {
      // For right-aligned modals, ensure left edge doesn't go off-screen
      if (left < 16) {
        left = 16;
      }
    } else {
      // For left-aligned modals, ensure right edge doesn't go off-screen
      if (left + width > viewportWidth - 16) {
        left = viewportWidth - width - 16;
      }
    }
    
    // Adjust vertical position if modal would overflow
    if (top + maxHeight > viewportHeight - 16) {
      top = triggerRect.top - maxHeight - 4;
      // If still doesn't fit, position at bottom of viewport
      if (top < 16) {
        top = viewportHeight - maxHeight - 16;
      }
    }

    modal.style.top = `${top}px`;
    modal.style.left = `${left}px`;
    modal.style.width = `${width}px`;
    modal.style.maxHeight = `${maxHeight}px`;
  }, [isOpen, width, maxHeight, triggerRef, align]);

  // Handle outside clicks
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the trigger button or the modal itself
      if (
        modalRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      
      onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Update position when modal opens or window resizes
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      
      const handleResize = () => updatePosition();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [isOpen, updatePosition]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={modalRef}
      data-dropdown-modal="true"
      className={`fixed z-[60] bg-white border border-gray-200 rounded-[3px] shadow-lg overflow-hidden transition-all duration-150 ease-out ${className}`}
      style={{
        transform: isOpen ? "scale(1)" : "scale(0.95)",
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div className="overflow-y-auto max-h-full">
        {children}
      </div>
    </div>,
    document.body
  );
}