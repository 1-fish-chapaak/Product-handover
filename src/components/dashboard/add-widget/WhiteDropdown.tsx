// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Bold, Italic, Underline } from "lucide-react";
import { createPortal } from "react-dom";

interface DropdownOption {
  value: string;
  label: string;
  icon?: any;
}

interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

interface WhiteDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options?: DropdownOption[];
  groups?: DropdownGroup[]; // Grouped options with section headers like "General", "X axis", etc.
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  mode?: "dropdown" | "colorpicker";
  xAxisValues?: string[]; // Values currently assigned to X-axis
  yAxisValues?: string[]; // Values currently assigned to Y-axis
}

const DEFAULT_COLORS = [
  "#6a12cd", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", 
  "#ec4899", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"
];

export function WhiteDropdown({
  value,
  onChange,
  options = [],
  groups = [],
  placeholder = "Select an option...",
  className = "",
  size = "md",
  mode = "dropdown",
  xAxisValues = [],
  yAxisValues = []
}: WhiteDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, openUpward: false });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate dropdown position
  const calculatePosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Show above if more space above, otherwise show below
    const shouldOpenUpward = spaceAbove > spaceBelow;
    
    setDropdownPosition({
      top: shouldOpenUpward ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUpward: shouldOpenUpward
    });
  };

  // Open dropdown and calculate position
  const openDropdown = () => {
    calculatePosition();
    setIsOpen(true);
  };

  // Recalculate position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => calculatePosition();
    const handleResize = () => calculatePosition();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, options.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
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
    // Check in flat options first
    const option = options.find(opt => opt.value === value);
    if (option) return option.label;
    
    // Check in grouped options
    for (const group of groups) {
      const groupOption = group.options.find(opt => opt.value === value);
      if (groupOption) return groupOption.label;
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
    <>
      <div className={`relative ${className}`}>
        {mode === "colorpicker" ? (
          /* Color Picker Button */
          <button
            ref={buttonRef}
            type="button"
            onClick={openDropdown}
            className={`w-full h-[32px] ${sizeClass.button} bg-white border border-[#e5e7eb] rounded-sm focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm flex items-center gap-2`}
          >
            <div className="size-5 rounded-xs border border-[#e5e7eb]" style={{ backgroundColor: value || "#6a12cd" }} />
            <span className="text-[0.6875rem] font-medium text-[#26064a] flex-1 text-left">
              {value && value.startsWith("#") ? value : "#6a12cd"}
            </span>
            <ChevronDown
              className={`${sizeClass.icon} text-[#64748b] transition-transform duration-200 shrink-0`}
              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        ) : (
          /* Dropdown Trigger Button */
          <button
            ref={buttonRef}
            type="button"
            onClick={openDropdown}
            className={`w-full h-[32px] ${sizeClass.button} bg-white border border-[#e5e7eb] rounded-sm text-left ${
              hasValue ? "text-[#26064a]" : "text-[#cbd5e1]"
            } focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm flex items-center justify-between`}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown
              className={`${sizeClass.icon} text-[#64748b] transition-transform duration-200 shrink-0 ml-2`}
              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        )}
      </div>

      {/* Dropdown Menu Portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 99999,
            maxHeight: mode === "colorpicker" ? "auto" : "200px",
            overflowY: mode === "colorpicker" ? "visible" : "auto",
            overflowX: "hidden",
            transform: dropdownPosition.openUpward ? "translateY(-100%)" : "none",
            scrollbarWidth: "thin",
            scrollbarColor: "#d1d5db #f9fafb"
          }}
          className="bg-white rounded-md shadow-2xl border border-[#e5e7eb] custom-scrollbar"
        >
          {mode === "colorpicker" ? (
            <div className="p-3">
              <div className="flex flex-wrap gap-2 mb-3">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleSelect(color)}
                    className={`size-7 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                      value === color
                        ? "ring-2 ring-[#6a12cd] ring-offset-2"
                        : "hover:ring-2 hover:ring-[#6a12cd]/40 hover:ring-offset-2"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {value === color && (
                      <Check className="size-[14px] text-white" strokeWidth={2.5} />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Custom color input */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#e5e7eb]">
                
                <input
                  type="text"
                  value={value || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("#") || val === "") {
                      handleSelect(val);
                    }
                  }}
                  placeholder="#6a12cd"
                  className="flex-1 min-w-0 px-2 py-1.5 text-[0.6875rem] bg-white border border-[#e5e7eb] rounded-xs text-[#26064a] placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all font-mono"
                />
              </div>
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 py-2 text-[0.625rem] font-bold text-[#64748b] bg-[#f8f9fa] border-b border-[#e5e7eb]">
                    {group.label}
                  </div>
                  {group.options.map((option) => {
                    const isSelected = value === option.value;
                    const isInXAxis = xAxisValues.includes(option.value);
                    const isInYAxis = yAxisValues.includes(option.value);
                    
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={`w-full px-3 py-2.5 ${sizeClass.dropdown} text-left flex items-center justify-between gap-3 hover:bg-[#f8f9fa] transition-colors ${
                          isSelected ? "bg-[#faf5ff]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`font-medium truncate ${isSelected ? "text-[#6a12cd]" : "text-[#26064a]"}`}>
                            {option.label}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isInXAxis && (
                              <span className="px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider bg-[#6a12cd]/10 text-[#6a12cd] rounded-xs border border-[#6a12cd]/20">
                                X
                              </span>
                            )}
                            {isInYAxis && (
                              <span className="px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider bg-[#0ea5e9]/10 text-[#0ea5e9] rounded-xs border border-[#0ea5e9]/20">
                                Y
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className={`${sizeClass.checkIcon} text-[#6a12cd] shrink-0`} strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              {options.map((option) => {
                const isSelected = value === option.value;
                const isInXAxis = xAxisValues.includes(option.value);
                const isInYAxis = yAxisValues.includes(option.value);
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full px-3 py-2.5 ${sizeClass.dropdown} text-left flex items-center justify-between gap-3 hover:bg-[#f8f9fa] transition-colors ${
                      isSelected ? "bg-[#faf5ff]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`font-medium truncate ${isSelected ? "text-[#6a12cd]" : "text-[#26064a]"}`}>
                        {option.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isInXAxis && (
                          <span className="px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider bg-[#6a12cd]/10 text-[#6a12cd] rounded-xs border border-[#6a12cd]/20">
                            X
                          </span>
                        )}
                        {isInYAxis && (
                          <span className="px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider bg-[#0ea5e9]/10 text-[#0ea5e9] rounded-xs border border-[#0ea5e9]/20">
                            Y
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className={`${sizeClass.checkIcon} text-[#6a12cd] shrink-0`} strokeWidth={2.5} />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>,
        document.body
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8f9fa;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </>
  );
}