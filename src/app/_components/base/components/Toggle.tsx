"use client";

interface ToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  label: string;
  className?: string;
}

export function Toggle({ enabled, onToggle, label, className = "" }: ToggleProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <button
        type="button"
        className={`mx-2 relative flex items-center h-3 w-[18px] flex-shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
          enabled ? 'bg-[#048A0E]' : 'bg-gray-300'
        }`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(!enabled)}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-2 w-2 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-1.5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="font-family-system font-400 text-[#1d1f25] text-[13px] leading-[18px]">{label}</span>
    </div>
  );
}