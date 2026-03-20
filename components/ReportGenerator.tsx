"use client";

import { useState } from "react";
import { getDailyLogsRange, MoodEntry, DailyLog } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { FileText, Download, Calendar } from "lucide-react";

type Period = "1w" | "1m" | "1y";

function isoToday(): string {
  return new Date().toISOString().split("T")[0];
}

function subtractDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function avg(arr: (number | undefined)[]): number | null {
  const vals = arr.filter((v): v is number => v !== undefined);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}

function minOf(arr: (number | undefined)[]): number | null {
  const vals = arr.filter((v): v is number => v !== undefined);
  return vals.length ? Math.min(...vals) : null;
}

function maxOf(arr: (number | undefined)[]): number | null {
  const vals = arr.filter((v): v is number => v !== undefined);
  return vals.length ? Math.max(...vals) : null;
}

export function ReportGenerator() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>("1w");
  const [loading, setLoading] = useState(false);

  const locale = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : "en-US";

  const periodDays: Record<Period, number> = { "1w": 7, "1m": 30, "1y": 365 };
  const periodLabels: Record<Period, string> = {
    "1w": t.mood.reportPeriod1w,
    "1m": t.mood.reportPeriod1m,
    "1y": t.mood.reportPeriod1y,
  };

  const generatePDF = async () => {
    setLoading(true);
    try {
      const endDate   = isoToday();
      const startDate = subtractDays(endDate, periodDays[period] - 1);
      const dailyLogs = getDailyLogsRange(startDate, endDate);
      // Flatten all entries for stats
      const entries: MoodEntry[] = dailyLogs.flatMap((d: DailyLog) => d.entries);

      // Dynamically import jsPDF (client-side only)
      const { jsPDF } = await import("jspdf");
      const autoTable  = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = margin;

      // ── Cover header ──────────────────────────────────────────────────
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageW, 38, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text("MindScope", margin, 16);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(t.mood.reportTitle, margin, 26);

      const endLabel   = new Date(endDate   + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
      const startLabel = new Date(startDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
      doc.setFontSize(9);
      doc.text(`${t.mood.reportFrom} ${startLabel} ${t.mood.reportTo} ${endLabel}`, margin, 34);

      y = 48;

      // ── No data ───────────────────────────────────────────────────────
      if (dailyLogs.length === 0) {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(12);
        doc.text(t.mood.reportNoData, margin, y);
        doc.save(`mindscope-report-${period}.pdf`);
        setLoading(false);
        return;
      }

      // ── Summary stats ─────────────────────────────────────────────────
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(t.mood.reportSummary, margin, y);
      y += 7;

      // Tracked days count
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`${dailyLogs.length} ${t.mood.reportDaysTracked} / ${periodDays[period]} (${entries.length} entrées)`, margin, y);
      y += 8;

      const stats: Array<{ label: string; avg: number | null; min: number | null; max: number | null; unit?: string }> = [
        { label: t.mood.reportMood,     avg: avg(entries.map(e => e.mood)),     min: minOf(entries.map(e => e.mood)),     max: maxOf(entries.map(e => e.mood)),     unit: "/10" },
        { label: t.mood.reportSleep,    avg: avg(entries.map(e => e.sleep)),    min: minOf(entries.map(e => e.sleep)),    max: maxOf(entries.map(e => e.sleep)),    unit: t.mood.hoursUnit },
        { label: t.mood.appetiteLabel,  avg: avg(entries.map(e => e.appetite)), min: minOf(entries.map(e => e.appetite)), max: maxOf(entries.map(e => e.appetite)), unit: "/5" },
        { label: t.mood.energyLabel,    avg: avg(entries.map(e => e.energy)),   min: minOf(entries.map(e => e.energy)),   max: maxOf(entries.map(e => e.energy)),   unit: "/5" },
        { label: t.mood.reportAlcohol,  avg: avg(entries.map(e => e.alcohol)),  min: minOf(entries.map(e => e.alcohol)),  max: maxOf(entries.map(e => e.alcohol)),  unit: ` ${t.mood.alcoholDrinks}` },
      ].filter(s => s.avg !== null);

      autoTable(doc, {
        startY: y,
        head:   [[t.mood.reportSummary, t.mood.reportAvg, t.mood.reportMin, t.mood.reportMax]],
        body:   stats.map(s => [
          s.label,
          s.avg !== null ? `${s.avg}${s.unit}` : "-",
          s.min !== null ? `${s.min}${s.unit}` : "-",
          s.max !== null ? `${s.max}${s.unit}` : "-",
        ]),
        styles:     { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });

      y = (doc as any).lastAutoTable.finalY + 12;

      // ── Behaviour summary ─────────────────────────────────────────────
      const withAlcohol  = entries.filter(e => e.alcohol  != null && e.alcohol  > 0).length;
      const withSubst    = entries.filter(e => e.substances != null && e.substances > 0).length;
      const withRisk     = entries.filter(e => e.riskBehavior === true).length;

      if (withAlcohol + withSubst + withRisk > 0) {
        if (y > 240) { doc.addPage(); y = margin; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(t.mood.reportBehaviours, margin, y);
        y += 7;

        autoTable(doc, {
          startY: y,
          head:   [[t.mood.reportBehaviours, `${t.mood.reportDaysTracked} (${entries.length})`]],
          body:   [
            [t.mood.reportAlcohol,   `${withAlcohol} ${t.mood.reportDaysTracked}`],
            [t.mood.reportSubstances,`${withSubst} ${t.mood.reportDaysTracked}`],
            [t.mood.reportRisk,      `${withRisk} ${t.mood.reportDaysTracked}`],
          ],
          styles:     { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // ── Daily log table ───────────────────────────────────────────────
      if (y > 220) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text(t.mood.reportDailyLog, margin, y);
      y += 7;

      const moodEmojisMap = ["😞","😟","😔","😐","🙂","😊","😄","😁","🤩","🥳"];
      const subOpts = t.mood.substanceOpts;

      // Build rows: one row per entry with date + time
      const tableRows: string[][] = [];
      for (const day of dailyLogs) {
        const d = new Date(day.date + "T12:00:00");
        const dateStr = d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
        for (const e of day.entries) {
          const timeStr = e.datetime.split("T")[1]?.slice(0, 5) ?? "";
          tableRows.push([
            `${dateStr}\n${timeStr}`,
            `${e.mood}/10`,
            e.sleep  != null ? `${e.sleep}${t.mood.hoursUnit}` : "-",
            e.appetite != null ? `${e.appetite}/5` : "-",
            e.energy   != null ? `${e.energy}/5`   : "-",
            e.alcohol  != null && e.alcohol > 0 ? `${e.alcohol}` : "0",
            e.substances != null ? subOpts[e.substances] : "-",
            e.riskBehavior === true  ? t.mood.riskYes
              : e.riskBehavior === false ? t.mood.riskNo : "-",
            e.note ? (e.note.length > 60 ? e.note.slice(0, 57) + "…" : e.note) : "",
          ]);
        }
      }

      autoTable(doc, {
        startY: y,
        head: [[
          t.mood.reportDate,
          t.mood.reportMood,
          t.mood.reportSleep,
          t.mood.appetiteLabel,
          t.mood.energyLabel,
          t.mood.reportAlcohol,
          t.mood.reportSubstances,
          t.mood.reportRisk,
          t.mood.reportJournal,
        ]],
        body: tableRows,
        styles:     { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 8: { cellWidth: 40 } },
        margin: { left: margin, right: margin },
      });

      // ── Journal section ───────────────────────────────────────────────
      const journalEntries = entries.filter(e => e.note);
      if (journalEntries.length > 0) {
        doc.addPage();
        y = margin;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(t.mood.journalLabel, margin, y);
        y += 8;

        for (const e of journalEntries) {
          if (y > 270) { doc.addPage(); y = margin; }
          const d = new Date(e.date + "T12:00:00");
          const dateStr = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

          doc.setFillColor(239, 246, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(37, 99, 235);
          doc.text(dateStr, margin, y);
          y += 5;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          const lines = doc.splitTextToSize(e.note ?? "", pageW - margin * 2);
          doc.text(lines, margin, y);
          y += lines.length * 4.5 + 6;
        }
      }

      // ── Footer on all pages ───────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(t.mood.reportGenBy, margin, 290);
        doc.text(`${i} / ${totalPages}`, pageW - margin, 290, { align: "right" });
      }

      // ── Save ──────────────────────────────────────────────────────────
      const filename = `mindscope-${period}-${endDate}.pdf`;
      doc.save(filename);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t.mood.reportTitle}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">PDF · {t.mood.reportGenBy}</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {(["1w", "1m", "1y"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
              period === p
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-300"}`}>
            <Calendar className="h-4 w-4" />
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Date range preview */}
      <div className="mb-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
        {(() => {
          const end   = isoToday();
          const start = subtractDays(end, periodDays[period] - 1);
          const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
          return `${t.mood.reportFrom} ${new Date(start + "T12:00:00").toLocaleDateString(locale, opts)} ${t.mood.reportTo} ${new Date(end + "T12:00:00").toLocaleDateString(locale, opts)}`;
        })()}
      </div>

      {/* Generate button */}
      <button onClick={generatePDF} disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
          loading ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg"}`}>
        {loading ? (
          <>
            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t.mood.reportDownloading}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            {t.mood.reportGenerate} — {periodLabels[period]}
          </>
        )}
      </button>
    </div>
  );
}
