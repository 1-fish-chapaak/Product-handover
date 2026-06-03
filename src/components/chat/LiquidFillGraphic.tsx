import { motion } from 'motion/react';
import { Target, Database, Cpu, Sparkles } from 'lucide-react';

interface Props {
  fillPercent: number;
  currentStage: string;
  className?: string;
}

const BANDS = [
  { label: 'Intent', icon: Target, range: [0, 25], color: '#c084fc' },
  { label: 'Data', icon: Database, range: [25, 50], color: '#9b59d6' },
  { label: 'Logic', icon: Cpu, range: [50, 75], color: '#7c3aed' },
  { label: 'Ready', icon: Sparkles, range: [75, 100], color: '#6a12cd' },
];

export default function LiquidFillGraphic({ fillPercent, currentStage, className = '' }: Props) {
  const width = 180;
  const height = 260;
  const beakerX = 40;
  const beakerW = 100;
  const beakerH = 200;
  const beakerY = 30;
  const beakerBottom = beakerY + beakerH;
  const fillH = (beakerH * Math.min(fillPercent, 100)) / 100;
  const fillTop = beakerBottom - fillH;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center ${className}`}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="liquidGradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#6a12cd" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#9b59d6" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.5" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="beakerClip">
            <rect x={beakerX} y={beakerY} width={beakerW} height={beakerH} rx="8" />
          </clipPath>
        </defs>

        {/* Beaker outline */}
        <rect
          x={beakerX}
          y={beakerY}
          width={beakerW}
          height={beakerH}
          rx="8"
          fill="none"
          stroke="rgba(106,18,205,0.15)"
          strokeWidth="2"
        />

        {/* Band lines */}
        {BANDS.map((band) => {
          const y = beakerBottom - (beakerH * band.range[1]) / 100;
          return (
            <line
              key={band.label}
              x1={beakerX}
              y1={y}
              x2={beakerX + beakerW}
              y2={y}
              stroke="rgba(106,18,205,0.08)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          );
        })}

        {/* Liquid fill */}
        <g clipPath="url(#beakerClip)">
          <motion.rect
            x={beakerX}
            width={beakerW}
            fill="url(#liquidGradient)"
            initial={{ y: beakerBottom, height: 0 }}
            animate={{ y: fillTop, height: fillH }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          />

          {/* Wave on top of liquid */}
          {fillPercent > 0 && (
            <motion.ellipse
              cx={beakerX + beakerW / 2}
              rx={beakerW / 2}
              ry={4}
              fill="rgba(192, 132, 252, 0.4)"
              initial={{ cy: beakerBottom }}
              animate={{ cy: fillTop }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            />
          )}

          {/* Bubbles */}
          {fillPercent > 0 && [0, 1, 2, 3, 4].map(idx => (
            <motion.circle
              key={idx}
              cx={beakerX + 20 + idx * 18}
              r={2}
              fill="rgba(255,255,255,0.5)"
              initial={{ cy: beakerBottom - 5, opacity: 0 }}
              animate={{
                cy: [beakerBottom - 5, fillTop + 10],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: idx * 0.4,
                ease: 'easeOut',
              }}
            />
          ))}
        </g>

        {/* Band labels on the right */}
        {BANDS.map((band) => {
          const centerY = beakerBottom - (beakerH * (band.range[0] + band.range[1]) / 2) / 100;
          const isActive = fillPercent >= band.range[0] && fillPercent < band.range[1];
          const isFilled = fillPercent >= band.range[1];

          return (
            <g key={band.label}>
              {/* Active band glow ring */}
              {isActive && (
                <motion.circle
                  cx={beakerX + beakerW + 22}
                  cy={centerY}
                  r={10}
                  fill="none"
                  stroke={band.color}
                  strokeWidth="2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  filter="url(#glow)"
                />
              )}
              {/* Icon circle */}
              <circle
                cx={beakerX + beakerW + 22}
                cy={centerY}
                r={8}
                fill={isFilled ? band.color : isActive ? `${band.color}40` : 'rgba(158,150,184,0.1)'}
              />
              {/* Label text */}
              <text
                x={beakerX + beakerW + 36}
                y={centerY + 4}
                className="text-[0.75rem]"
                fill={isActive || isFilled ? '#0e0b1e' : '#9e96b8'}
                fontWeight={isActive ? '700' : '500'}
                fontFamily="var(--font-sans)"
              >
                {band.label}
              </text>
            </g>
          );
        })}

        {/* Percentage text at bottom */}
        <text
          x={beakerX + beakerW / 2}
          y={beakerBottom + 22}
          textAnchor="middle"
          className="text-[0.8125rem]"
          fill="#6a12cd"
          fontWeight="700"
          fontFamily="var(--font-sans)"
        >
          {fillPercent}%
        </text>
      </svg>

      {/* Stage label */}
      <motion.div
        key={currentStage}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[0.75rem] font-semibold text-primary mt-1"
      >
        {currentStage === 'Ready' ? 'Analysis ready!' : `Understanding ${currentStage.toLowerCase()}...`}
      </motion.div>
    </motion.div>
  );
}
