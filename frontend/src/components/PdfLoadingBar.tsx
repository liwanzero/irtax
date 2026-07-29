import { useEffect, useRef, useState } from "react";

interface PdfLoadingBarProps {
  active: boolean;
  label?: string;
  className?: string;
}

export default function PdfLoadingBar({ active, label = "Subiendo…", className = "" }: PdfLoadingBarProps) {
  const [progress, setProgress] = useState(6);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setProgress(6);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const step = Math.max(0.6, (92 - p) * 0.06);
        return Math.min(92, p + step);
      });
    }, 200);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative h-20 w-14 overflow-hidden rounded-md border-2 border-slate-300 bg-slate-50 shadow-sm">
        <div className="absolute right-0 top-0 h-0 w-0 border-b-[10px] border-l-[10px] border-b-slate-300 border-l-transparent" />
        <div className="absolute inset-x-2 top-3 h-1 rounded bg-slate-200" />
        <div className="absolute inset-x-2 top-6 h-1 w-2/3 rounded bg-slate-200" />

        <div
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-teal-500 via-emerald-400 to-emerald-300 transition-all duration-200 ease-out"
          style={{ height: `${progress}%` }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 text-xl leading-none transition-all duration-200 ease-out"
          style={{ bottom: `calc(${progress}% - 11px)`, transform: "translateX(-50%) rotate(-45deg)" }}
        >
          🚀
        </div>
      </div>
      <span className="text-xs font-medium text-slate-500">
        {label} {Math.round(progress)}%
      </span>
    </div>
  );
}
