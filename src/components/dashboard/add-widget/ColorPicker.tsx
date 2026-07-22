import { Check } from "lucide-react";

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#6a12cd", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", 
  "#ec4899", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"
];

export function ColorPicker({ selectedColor, onColorChange, colors = DEFAULT_COLORS }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={`size-[28px] rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
            selectedColor === color
              ? "ring-2 ring-[#6a12cd] ring-offset-2"
              : "hover:ring-2 hover:ring-[#6a12cd]/40 hover:ring-offset-2"
          }`}
          style={{ backgroundColor: color }}
        >
          {selectedColor === color && (
            <Check className="size-[14px] text-white" strokeWidth={2.5} />
          )}
        </button>
      ))}
      
      {/* Color code display - inline with color circles */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#e5e7eb] rounded-sm w-fit">
        <div className="size-[12px] rounded-xs" style={{ backgroundColor: selectedColor }} />
        <span className="text-[0.6875rem] font-medium text-[#26064a] uppercase">{selectedColor}</span>
      </div>
    </div>
  );
}