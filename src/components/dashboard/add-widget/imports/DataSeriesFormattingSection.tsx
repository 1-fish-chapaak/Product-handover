import { useState, useEffect } from "react";
import { ChevronDown, BarChart3 } from "lucide-react";
import { WhiteDropdown } from "../WhiteDropdown";

interface DataSeriesFormattingSectionProps {
  series?: string[];
  seriesColors?: Record<string, string>;
  onSeriesColorsChange?: (colors: Record<string, string>) => void;
  /** Show spacing control only for bar/column charts */
  /** Spacing control — 'bar' for bar gap, 'pie' for distance from center, 'disabled' for greyed out */
  spacingType?: 'bar' | 'pie' | 'disabled' | false;
  /** Per-series spacing map e.g. { "Approved": "20" } */
  spacingMap?: Record<string, string>;
  onSpacingMapChange?: (map: Record<string, string>) => void;
}

const DEFAULT_COLORS = [
  "#6a12cd", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"
];

export default function DataSeriesFormattingSection({
  series = [],
  seriesColors: controlledColors,
  onSeriesColorsChange,
  spacingType = false,
  spacingMap: controlledSpacingMap,
  onSpacingMapChange,
}: DataSeriesFormattingSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState("");

  const [internalColors, setInternalColors] = useState<Record<string, string>>({});
  const colors = controlledColors ?? internalColors;
  const setColors = (next: Record<string, string>) => {
    if (onSeriesColorsChange) onSeriesColorsChange(next);
    else setInternalColors(next);
  };

  const [internalSpacingMap, setInternalSpacingMap] = useState<Record<string, string>>({});
  const spacingMap = controlledSpacingMap ?? internalSpacingMap;
  const setSpacingMap = onSpacingMapChange || setInternalSpacingMap;

  const spacing = selectedSeries ? (spacingMap[selectedSeries] || "0") : "0";
  const setSpacing = (v: string) => {
    if (selectedSeries) setSpacingMap({ ...spacingMap, [selectedSeries]: v });
  };

  useEffect(() => {
    if (series.length > 0 && (!selectedSeries || !series.includes(selectedSeries))) {
      setSelectedSeries(series[0]);
    }
  }, [series, selectedSeries]);

  const selectedColor = selectedSeries
    ? (colors[selectedSeries] || DEFAULT_COLORS[series.indexOf(selectedSeries) % DEFAULT_COLORS.length])
    : DEFAULT_COLORS[0];

  const spacingOptions = [
    { value: "0", label: "0%" },
    { value: "10", label: "10%" },
    { value: "20", label: "20%" },
    { value: "30", label: "30%" },
    { value: "40", label: "40%" },
    { value: "50", label: "50%" }
  ];

  const seriesOptions = series.map(s => ({ value: s, label: s }));

  return (
    <div className="bg-white rounded-md border border-[#e5e7eb] shadow-sm mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
      >
        <div className="flex items-center gap-2">
          <div className="size-[18px] rounded-xs flex items-center justify-center">
            <BarChart3 className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
          </div>
          <span className="text-[0.75rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Customize Data Colors</span>
        </div>
        <ChevronDown
          className="size-[14px] text-[#6a12cd] transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {isOpen && (
        <div className="p-3 bg-[#fafafa] space-y-3">
          {/* Select Series */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.75rem] font-semibold text-[#26064a]">Categories</label>
            <WhiteDropdown
              value={selectedSeries}
              onChange={setSelectedSeries}
              options={seriesOptions}
              placeholder={seriesOptions.length > 0 ? "Select a series..." : "No series available"}
              size="sm"
            />
          </div>

          {/* Color + Spacing (spacing only for bar charts) */}
          <div className="grid gap-3 grid-cols-2">
            {/* Color */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.6875rem] font-semibold text-[#26064a]">Color</label>
              <WhiteDropdown
                value={selectedColor}
                onChange={(hex) => {
                  if (selectedSeries) {
                    setColors({ ...colors, [selectedSeries]: hex });
                  }
                }}
                mode="colorpicker"
                placeholder="Select color..."
                size="sm"
              />
            </div>

            {/* Spacing — bar charts / Distance from center — pie charts / disabled for others */}
            <div className={`flex flex-col gap-1.5 ${spacingType === 'disabled' ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="text-[0.6875rem] font-semibold text-[#26064a]">{spacingType === 'pie' ? 'Distance from center' : 'Spacing'}</label>
              <WhiteDropdown
                value={spacing}
                onChange={setSpacing}
                options={spacingOptions}
                placeholder="Select spacing..."
                size="sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
