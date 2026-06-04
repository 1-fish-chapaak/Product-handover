import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface KpiCardProps {
  value: string;
  groupingBy?: string;
  label?: string;
  trendValue?: string;
  trendLabel?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  color?: string;
  fontFamily?: string;
}

export function KpiCard({ 
  value, 
  groupingBy,
  label, 
  trendValue = "12%", 
  trendLabel = "vs last month", 
  trendDirection = 'up',
  color = "#26064A",
  fontFamily,
}: KpiCardProps) {
  const fontStyle = fontFamily ? { fontFamily: `'${fontFamily}', sans-serif` } : undefined;
  const displayLabel = groupingBy || label || "Metric";
  
  return (
    <div className="flex flex-col h-full w-full bg-white rounded-2xl p-6 relative overflow-hidden">
      {/* Label - Fixed at top */}
      <div className="shrink-0 mb-4">
        <div className="font-normal text-[0.875rem] text-[#26064a]" style={fontStyle}>{displayLabel}</div>
      </div>
      
      {/* Value - Large display */}
      <div className="flex-1 flex items-start min-h-0">
        <span className="leading-none font-bold tracking-tight text-[2rem]" style={{ color, ...fontStyle }}>
          {value}
        </span>
      </div>
    </div>
  );
}