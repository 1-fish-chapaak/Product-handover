// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface DropdownOption {
  value: string;
  label: string;
  icon?: any;
}

interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options?: DropdownOption[];
  groups?: DropdownGroup[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}

export function CustomDropdown({
  value,
  onChange,
  options = [],
  groups = [],
  placeholder = "Select an option...",
  className = "",
  size = "md"
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Get selected option label
  const getSelectedLabel = () => {
    if (groups.length > 0) {
      for (const group of groups) {
        const option = group.options.find(opt => opt.value === value);
        if (option) return option.label;
      }
    } else {
      const option = options.find(opt => opt.value === value);
      if (option) return option.label;
    }
    return placeholder;
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const hasValue = value !== "";
  const selectedLabel = getSelectedLabel();

  // Size variants
  const sizeClasses = {
    sm: {
      button: "px-2.5 py-2 text-[0.6875rem]",
      icon: "size-[11px]",
      dropdown: "text-[0.6875rem]",
      checkIcon: "size-[13px]"
    },
    md: {
      button: "px-3 py-2 text-[0.75rem]",
      icon: "size-[13px]",
      dropdown: "text-[0.75rem]",
      checkIcon: "size-[14px]"
    }
  };

  const sizeClass = sizeClasses[size];

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${sizeClass.button} bg-white border border-[#e5e7eb] rounded-[6px] text-left ${
          hasValue ? "text-[#26064a]" : "text-[#cbd5e1]"
        } focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm flex items-center justify-between`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`${sizeClass.icon} text-[#64748b] transition-transform duration-200 shrink-0 ml-2`}
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50">
          <div className="bg-gradient-to-br from-[#3d3d46]/95 via-[#4a4a55]/95 to-[#353540]/95 backdrop-blur-xl rounded-[12px] shadow-2xl border border-white/10 overflow-hidden max-h-[280px] overflow-y-auto custom-scrollbar">
            {/* Render grouped options */}
            {groups.length > 0 ? (
              groups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {group.label && (
                    <div className="px-3 py-2 text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider border-b border-white/5">
                      {group.label}
                    </div>
                  )}
                  {group.options.map((option) => {
                    const isSelected = value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={`w-full px-4 py-3 ${sizeClass.dropdown} text-left flex items-center justify-between gap-3 hover:bg-white/10 transition-colors ${
                          isSelected ? "bg-white/5" : ""
                        }`}
                      >
                        <span className="text-white font-medium">{option.label}</span>
                        {isSelected && (
                          <Check className={`${sizeClass.checkIcon} text-white shrink-0`} strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              /* Render flat options */
              options.map((option) => {
                const isSelected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full px-4 py-3 ${sizeClass.dropdown} text-left flex items-center justify-between gap-3 hover:bg-white/10 transition-colors ${
                      isSelected ? "bg-white/5" : ""
                    }`}
                  >
                    <span className="text-white font-medium">{option.label}</span>
                    {isSelected && (
                      <Check className={`${sizeClass.checkIcon} text-white shrink-0`} strokeWidth={2.5} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
