"use client";

import { useState, useEffect } from "react";
import { saveMoodEntry, getMoodEntries, getTodayMood, MoodEntry } from "@/lib/storage";
import { useI18n, tf } from "@/lib/i18n";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const moodEmojis = ["😞", "😟", "😔", "😐", "🙂", "😊", "😄", "😁", "🤩", "🥳"];
const moodColors = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"
];

export function MoodTracker() {
  const { t, lang } = useI18n();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<MoodEntry | undefined>();

  useEffect(() => {
    const today = getTodayMood();
    setTodayEntry(today);
    if (today) {
      setSelectedMood(today.mood);
      setNote(today.note || "");
      setSaved(true);
    }
    setEntries(getMoodEntries().slice(-14)); // Last 14 days
  }, []);

  const handleSave = () => {
    if (selectedMood === null) return;
    const today = new Date().toISOString().split("T")[0];
    saveMoodEntry({ date: today, mood: selectedMood, note: note.trim() || undefined });
    setSaved(true);
    setTodayEntry({ date: today, mood: selectedMood, note: note.trim() || undefined });
    setEntries(getMoodEntries().slice(-14));
  };

  const dateLocale = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : "en-US";

  const chartData = entries.map((e) => ({
    date: new Date(e.date).toLocaleDateString(dateLocale, { month: "short", day: "numeric" }),
    mood: e.mood,
    emoji: moodEmojis[e.mood - 1],
  }));

  return (
    <div className="space-y-6">
      {/* Today's mood input */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
          {t.mood.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          {new Date().toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric" })}
        </p>

        {/* Mood selector */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => { setSelectedMood(n); setSaved(false); }}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border-2 ${
                selectedMood === n
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-110 shadow-md"
                  : "border-transparent bg-slate-50 dark:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:scale-105"
              }`}
            >
              <span className="text-xl sm:text-2xl">{moodEmojis[n - 1]}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{n}</span>
            </button>
          ))}
        </div>

        {selectedMood !== null && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{moodEmojis[selectedMood - 1]}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t.mood.moodLabel}: {selectedMood}/10
              </span>
            </div>
            <textarea
              value={note}
              onChange={(e) => { setNote(e.target.value); setSaved(false); }}
              placeholder={t.mood.addNote}
              rows={2}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSave}
              disabled={saved}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                saved
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
              }`}
            >
              {saved ? t.mood.savedBtn : t.mood.saveBtn}
            </button>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
            {t.mood.chartTitle}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            {tf(t.mood.chartSub, { n: chartData.length })}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[1, 10]}
                ticks={[1, 3, 5, 7, 10]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${moodEmojis[value - 1]} ${value}/10`, t.mood.moodLabel]}
              />
              <Line
                type="monotone"
                dataKey="mood"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
