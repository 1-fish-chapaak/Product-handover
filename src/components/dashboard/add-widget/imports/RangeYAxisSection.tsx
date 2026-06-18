import { useState } from "react";
import { ChevronDown, MoveVertical } from "lucide-react";

export default function RangeYAxisSection({ label = "Range (Y Axis)", yMin, yMax, invertRange, onYMinChange, onYMaxChange, onInvertChange }: {
  label?: string;
  yMin?: string;
  yMax?: string;
  invertRange?: boolean;
  onYMinChange?: (v: string) => void;
  onYMaxChange?: (v: string) => void;
  onInvertChange?: (v: boolean) => void;
} = {}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [localInvert, setLocalInvert] = useState(false);
  const [localMin, setLocalMin] = useState("");
  const [localMax, setLocalMax] = useState("");

  const minimum = yMin ?? localMin;
  const maximum = yMax ?? localMax;
  const invert = invertRange ?? localInvert;

  return (
    <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm mt-3">
      <button
        onClick={() => setRangeOpen(!rangeOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
      >
        <div className="flex items-center gap-2">
          <div className="size-[18px] rounded-[4px] flex items-center justify-center">
            <MoveVertical className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
          </div>
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">{label}</span>
        </div>
        <ChevronDown
          className="size-[14px] text-[#6a12cd] transition-transform duration-200"
          style={{ transform: rangeOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {rangeOpen && (
        <div className="p-2.5 bg-[#fafafa] space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[0.75rem] font-medium text-[#26064a]">Minimum</label>
              <input
                type="text"
                value={minimum}
                onChange={(e) => { setLocalMin(e.target.value); onYMinChange?.(e.target.value); }}
                placeholder="Auto"
                className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[0.75rem] font-medium text-[#26064a]">Maximum</label>
              <input
                type="text"
                value={maximum}
                onChange={(e) => { setLocalMax(e.target.value); onYMaxChange?.(e.target.value); }}
                placeholder="Auto"
                className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[0.75rem] font-medium text-[#26064a]">Invert Range</p>
            <button
              onClick={() => { setLocalInvert(!invert); onInvertChange?.(!invert); }}
              className={`relative w-[36px] h-[20px] rounded-[12px] transition-all ${
                invert ? "bg-[#6a12cd]" : "bg-[#e5e7eb]"
              }`}
            >
              <div
                className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-all ${
                  invert ? "left-[18px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
