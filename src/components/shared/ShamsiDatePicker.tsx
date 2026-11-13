import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { getGregorianToday, toPersianDigits, gregorianToJalali, toShamsiShort } from "@/lib/shamsi";
import JalaliCalendar, { DayMeta } from "@/components/shared/JalaliCalendar";

export default function ShamsiDatePicker({
  value,
  onChange,
  accentColorClass,
  label,
}: {
  value: string;
  onChange: (date: string) => void;
  accentColorClass: string;
  label: string;
}) {
  const { bg, fg, fgMuted, cardBorder, inputBg } = useThemeStyles();
  const [showCal, setShowCal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const calRef = useRef<HTMLDivElement>(null);

  const today = getGregorianToday();
  const selJalali = gregorianToJalali(
    ...(value ? (value.split("-").map(Number) as [number, number, number]) : (today.split("-").map(Number) as [number, number, number]))
  );

  const [calJy, setCalJy] = useState(selJalali[0]);
  const [calJm, setCalJm] = useState(selJalali[1]);

  useEffect(() => {
    if (value) {
      const jal = gregorianToJalali(...(value.split("-").map(Number) as [number, number, number]));
      setCalJy(jal[0]);
      setCalJm(jal[1]);
    }
  }, [value]);

  useEffect(() => {
    if (!showCal) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        calRef.current && !calRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowCal(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showCal]);

  const prevMonth = () => {
    if (calJm === 1) {
      setCalJy(calJy - 1);
      setCalJm(12);
    } else {
      setCalJm(calJm - 1);
    }
  };

  const nextMonth = () => {
    if (calJm === 12) {
      setCalJy(calJy + 1);
      setCalJm(1);
    } else {
      setCalJm(calJm + 1);
    }
  };

  const handleDayClick = (_day: number, meta: DayMeta) => {
    onChange(meta.gregDate);
    setShowCal(false);
  };

  return (
    <div className="relative text-right">
      <label className="block text-xs font-medium mb-1.5" style={{ color: fgMuted }}>
        {label}
      </label>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setShowCal(!showCal)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-all outline-none border focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
      >
        <span className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-zinc-400" />
          {value ? toShamsiShort(value) : "انتخاب تاریخ..."}
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      <AnimatePresence>
        {showCal && (
          <motion.div
            ref={calRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-0 right-0 z-50 mt-2 rounded-2xl p-4 shadow-2xl border"
            style={{ backgroundColor: bg, borderColor: cardBorder }}
            dir="rtl"
          >
            <JalaliCalendar
              jy={calJy}
              jm={calJm}
              onPrev={prevMonth}
              onNext={nextMonth}
              canNext={true}
              todayGreg={today}
              selectedGreg={value}
              onDayClick={handleDayClick}
              renderDay={(day, meta) => {
                const bg2 = meta.isSelected
                  ? accentColorClass === "amber" ? "#f59e0b" : "#6366f1"
                  : meta.isToday
                    ? accentColorClass === "amber" ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)"
                    : "transparent";
                const color2 = meta.isSelected
                  ? "#fff"
                  : meta.isToday
                    ? accentColorClass === "amber" ? "#f59e0b" : "#818cf8"
                    : `${fgMuted}cc`;
                const outline =
                  meta.isToday && !meta.isSelected
                    ? accentColorClass === "amber" ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(99,102,241,0.5)"
                    : "none";
                return (
                  <span
                    className="flex h-full w-full items-center justify-center rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: bg2, color: color2, outline }}
                  >
                    {toPersianDigits(day)}
                  </span>
                );
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
