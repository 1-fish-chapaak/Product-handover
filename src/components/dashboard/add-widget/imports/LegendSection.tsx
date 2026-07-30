import { useState } from "react";
import { ChevronDown, Type, Bold, Italic } from "lucide-react";
import { WhiteDropdown } from "../WhiteDropdown";

interface LegendSectionProps {
  showLegend?: boolean;
  onShowLegendChange?: (v: boolean) => void;
  legendPosition?: string;
  onLegendPositionChange?: (v: string) => void;
  legendBold?: boolean;
  onLegendBoldChange?: (v: boolean) => void;
  legendItalic?: boolean;
  onLegendItalicChange?: (v: boolean) => void;
  legendTextColor?: string;
  onLegendTextColorChange?: (v: string) => void;
}

export default function LegendSection({ showLegend, onShowLegendChange, legendPosition: posProp, onLegendPositionChange, legendBold: boldProp, onLegendBoldChange, legendItalic: italicProp, onLegendItalicChange, legendTextColor: colorProp, onLegendTextColorChange }: LegendSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const enabled = showLegend ?? true;
  const [localPos, setLocalPos] = useState("top");
  const [localBold, setLocalBold] = useState(false);
  const [localItalic, setLocalItalic] = useState(false);
  const [localColor, setLocalColor] = useState("");

  const pos = posProp ?? localPos;
  const isBold = boldProp ?? localBold;
  const isItalic = italicProp ?? localItalic;
  const textColor = colorProp ?? localColor;

  return (
    <div className="bg-white rounded-md border border-[#e5e7eb] overflow-hidden shadow-sm mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
      >
        <div className="flex items-center gap-2">
          <div className="size-[18px] rounded-xs flex items-center justify-center">
            <Type className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
          </div>
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Legend</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onShowLegendChange?.(!enabled); }}
            className={`relative w-[36px] h-[20px] rounded-full transition-all ${enabled ? "bg-[#6a12cd]" : "bg-[rgba(0,0,0,0.12)]"}`}
          >
            <div className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-all ${enabled ? "left-[18px]" : "left-[2px]"}`} />
          </button>
          <ChevronDown
            className="size-[14px] text-[#6a12cd] transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>
      {isOpen && (
        <div className="p-3 bg-[#fafafa] space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.6875rem] font-semibold text-[#26064a]">Position</label>
            <WhiteDropdown
              value={pos}
              onChange={v => { setLocalPos(v); onLegendPositionChange?.(v); }}
              options={[
                { value: "top", label: "Top" },
                { value: "right", label: "Right" },
                { value: "bottom", label: "Bottom" },
                { value: "left", label: "Left" }
              ]}
              size="sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.6875rem] font-semibold text-[#26064a]">Legend Format</label>
            <div className="flex items-center bg-white rounded-sm border border-[#e5e7eb] overflow-hidden">
              <button
                onClick={() => { setLocalBold(!isBold); onLegendBoldChange?.(!isBold); }}
                className={`flex-1 flex items-center justify-center px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${isBold ? "bg-[#6a12cd] text-white" : "bg-white text-[#26064a] hover:bg-[#faf5ff]"}`}
              >
                <Bold className={`size-[14px] transition-colors ${isBold ? "text-white" : "text-[#6a12cd]"}`} />
              </button>
              <button
                onClick={() => { setLocalItalic(!isItalic); onLegendItalicChange?.(!isItalic); }}
                className={`flex-1 flex items-center justify-center px-3 py-2 transition-all duration-200 ${isItalic ? "bg-[#6a12cd] text-white" : "bg-white text-[#26064a] hover:bg-[#faf5ff]"}`}
              >
                <Italic className={`size-[14px] transition-colors ${isItalic ? "text-white" : "text-[#6a12cd]"}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
