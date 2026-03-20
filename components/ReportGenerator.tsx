"use client";

import { useState } from "react";
import { getDailyLogsRange, MoodEntry, DailyLog } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { FileText, Download, Calendar, Sparkles, Brain, BarChart2 } from "lucide-react";

type Period   = "1w" | "1m" | "1y";
type Step     = "idle" | "data" | "ai" | "pdf" | "done";

const MISTRAL_API_KEY = "2LitVaCxXcwT2RYBz63xKEoPxGHcgAKJ";
const MISTRAL_URL     = "https://api.mistral.ai/v1/chat/completions";

// ── helpers ────────────────────────────────────────────────────────────────────
function isoToday()  { return new Date().toISOString().split("T")[0]; }
function subtractDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
function avg(arr: (number | undefined)[]): number | null {
  const v = arr.filter((x): x is number => x !== undefined);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
}
function minOf(arr: (number | undefined)[]): number | null {
  const v = arr.filter((x): x is number => x !== undefined);
  return v.length ? Math.min(...v) : null;
}
function maxOf(arr: (number | undefined)[]): number | null {
  const v = arr.filter((x): x is number => x !== undefined);
  return v.length ? Math.max(...v) : null;
}
function trend(recent: (number|undefined)[], earlier: (number|undefined)[]): string {
  const a = avg(recent), b = avg(earlier);
  if (a === null || b === null) return "—";
  const d = a - b;
  if (d > 0.5) return "↑ en hausse";
  if (d < -0.5) return "↓ en baisse";
  return "→ stable";
}

// ── AI prompt builder ──────────────────────────────────────────────────────────
function buildPrompt(
  entries: MoodEntry[],
  dailyLogs: DailyLog[],
  startDate: string,
  endDate: string,
  lang: string,
  period: string,
  t: Record<string, string>,
): string {
  const locale = lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : lang === "zh" ? "zh-CN" : "en-US";

  const totalDays   = dailyLogs.length;
  const avgMood     = avg(entries.map(e => e.mood));
  const minMood     = minOf(entries.map(e => e.mood));
  const maxMood     = maxOf(entries.map(e => e.mood));
  const avgSleep    = avg(entries.map(e => e.sleep));
  const minSleep    = minOf(entries.map(e => e.sleep));
  const maxSleep    = maxOf(entries.map(e => e.sleep));
  const avgApp      = avg(entries.map(e => e.appetite));
  const avgEnergy   = avg(entries.map(e => e.energy));
  const daysAlcohol = entries.filter(e => e.alcohol != null && e.alcohol > 0).length;
  const avgAlcohol  = avg(entries.filter(e => e.alcohol != null && e.alcohol! > 0).map(e => e.alcohol));
  const daysSubst   = entries.filter(e => e.substances != null && e.substances > 0).length;
  const daysRisk    = entries.filter(e => e.riskBehavior === true).length;

  // Trend: last 1/3 vs first 1/3
  const slice = Math.max(3, Math.floor(entries.length / 3));
  const early = entries.slice(0, slice);
  const late  = entries.slice(-slice);
  const moodTrend   = trend(late.map(e => e.mood),     early.map(e => e.mood));
  const sleepTrend  = trend(late.map(e => e.sleep),    early.map(e => e.sleep));
  const energyTrend = trend(late.map(e => e.energy),   early.map(e => e.energy));

  // Journal excerpts (max 5 most meaningful)
  const notes = entries
    .filter(e => e.note && e.note.trim().length > 15)
    .slice(-5)
    .map(e => {
      const d = new Date(e.date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" });
      const t2 = e.datetime.split("T")[1]?.slice(0,5) ?? "";
      return `  - ${d} ${t2}: "${e.note!.slice(0, 120)}${e.note!.length > 120 ? "…" : ""}"`;
    }).join("\n");

  const startLabel = new Date(startDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const endLabel   = new Date(endDate   + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  const langInstruction = lang === "fr" ? "Réponds en français."
    : lang === "es" ? "Responde en español."
    : lang === "zh" ? "请用中文回复。"
    : "Reply in English.";

  return `${langInstruction}

You are MindScope's wellness AI analyst. Below is a personal self-tracking summary. Write a comprehensive, structured, compassionate wellness analysis report of 4 to 6 paragraphs.

IMPORTANT RULES:
- You are NOT a doctor. Never diagnose. Never prescribe.
- Always end with a reminder to consult a mental health professional if needed.
- Be warm, encouraging, and nuanced. Highlight both positives and areas to watch.
- Structure your response with clear paragraphs: Overview, Mood & Energy, Sleep, Behaviours (if relevant), Journal Themes (if notes provided), Recommendations.
- Use plain text only (no markdown, no bullet points, no titles — this will be embedded in a PDF).

=== TRACKING DATA ===
Period: ${startLabel} → ${endLabel} (${totalDays} days tracked out of ${period} days)

AVERAGES:
- Mood: ${avgMood ?? "—"}/10  (min ${minMood ?? "—"}, max ${maxMood ?? "—"})
- Sleep: ${avgSleep ?? "—"} hours  (min ${minSleep ?? "—"}, max ${maxSleep ?? "—"})
- Appetite: ${avgApp ?? "—"}/5
- Energy: ${avgEnergy ?? "—"}/5
- Alcohol: ${daysAlcohol > 0 ? `consumed on ${daysAlcohol} days (avg ${avgAlcohol} drinks/day)` : "none recorded"}
- Substances: ${daysSubst > 0 ? `${daysSubst} days` : "none"}
- Risk behaviours: ${daysRisk > 0 ? `${daysRisk} days` : "none"}

TRENDS (recent vs earlier):
- Mood: ${moodTrend}
- Sleep: ${sleepTrend}
- Energy: ${energyTrend}

JOURNAL EXCERPTS:
${notes || "  No notes recorded."}
`;
}

// ── AI call ────────────────────────────────────────────────────────────────────
async function callMistral(prompt: string): Promise<string> {
  const res = await fetch(MISTRAL_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: "You are a professional wellness analyst embedded in the MindScope self-tracking app. You write empathetic, evidence-informed wellness analysis reports based on user self-tracking data. You never diagnose. You always recommend professional consultation when appropriate." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens:  1200,
    }),
  });
  if (!res.ok) throw new Error(`Mistral API error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── PDF section: AI analysis ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addAISection(
  doc: any,
  analysis: string,
  pageW: number,
  margin: number,
  title: string,
  disclaimer: string,
) {
  doc.addPage();
  let y = margin;

  // Section header bar
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("✦  " + title, margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Mistral AI · MindScope", margin, 22);
  y = 38;

  // Disclaimer box
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(253, 230, 138); // amber-300
  doc.roundedRect(margin, y, pageW - margin * 2, 10, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text(disclaimer, margin + 3, y + 7);
  y += 16;

  // Analysis text
  const paragraphs = analysis.split(/\n{2,}/).filter(p => p.trim().length > 0);

  for (const para of paragraphs) {
    const cleanPara = para.trim().replace(/\n/g, " ");
    const lines = doc.splitTextToSize(cleanPara, pageW - margin * 2);

    if (y + lines.length * 5 > 278) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 5; // paragraph spacing
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export function ReportGenerator() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>("1w");
  const [step,   setStep]   = useState<Step>("idle");

  const locale = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : "en-US";
  const periodDays: Record<Period, number>   = { "1w": 7,  "1m": 30,  "1y": 365 };
  const periodLabels: Record<Period, string> = {
    "1w": t.mood.reportPeriod1w,
    "1m": t.mood.reportPeriod1m,
    "1y": t.mood.reportPeriod1y,
  };

  const steps: Record<Exclude<Step, "idle">, string> = {
    data: lang === "fr" ? "Collecte des données…"       : lang === "es" ? "Recopilando datos…"          : "Collecting data…",
    ai:   lang === "fr" ? "Analyse IA en cours…"        : lang === "es" ? "Análisis de IA en curso…"    : "AI analyzing your data…",
    pdf:  lang === "fr" ? "Génération du PDF…"           : lang === "es" ? "Generando PDF…"              : "Generating PDF…",
    done: lang === "fr" ? "Téléchargement…"              : lang === "es" ? "Descargando…"                : "Downloading…",
  };

  const aiSectionTitle = lang === "fr" ? "Analyse IA — Rapport de bien-être"
    : lang === "es" ? "Análisis IA — Informe de bienestar"
    : lang === "zh" ? "AI 分析 — 健康报告"
    : "AI Analysis — Wellness Report";

  const aiDisclaimer = lang === "fr"
    ? "⚠  Analyse automatisée à titre informatif uniquement. Ce rapport ne constitue pas un avis médical. Consultez un professionnel de santé."
    : lang === "es"
    ? "⚠  Análisis automatizado solo informativo. No constituye consejo médico. Consulte a un profesional de salud."
    : lang === "zh"
    ? "⚠  仅供参考的自动分析。不构成医疗建议。请咨询专业医疗人员。"
    : "⚠  Automated analysis for informational purposes only. Not medical advice. Please consult a healthcare professional.";

  const generatePDF = async () => {
    setStep("data");
    try {
      const endDate   = isoToday();
      const startDate = subtractDays(endDate, periodDays[period] - 1);
      const dailyLogs = getDailyLogsRange(startDate, endDate);
      const entries: MoodEntry[] = dailyLogs.flatMap((d: DailyLog) => d.entries);

      // ── AI analysis ─────────────────────────────────────────────────────
      setStep("ai");
      let aiAnalysis = "";
      if (entries.length > 0) {
        const tRecord: Record<string, string> = {
          moodLabel: t.mood.moodLabel,
          sleepLabel: t.mood.sleepLabel,
        };
        try {
          const prompt = buildPrompt(entries, dailyLogs, startDate, endDate, lang, `${periodDays[period]} days`, tRecord);
          aiAnalysis = await callMistral(prompt);
        } catch {
          aiAnalysis = lang === "fr"
            ? "L'analyse IA n'a pas pu être générée. Veuillez vérifier votre connexion internet."
            : "AI analysis could not be generated. Please check your internet connection.";
        }
      }

      // ── Build PDF ────────────────────────────────────────────────────────
      setStep("pdf");
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = margin;

      // ── Cover header ─────────────────────────────────────────────────────
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageW, 42, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("MindScope", margin, 16);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(t.mood.reportTitle, margin, 27);
      const endLabel   = new Date(endDate   + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
      const startLabel = new Date(startDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
      doc.setFontSize(9);
      doc.text(`${t.mood.reportFrom} ${startLabel} ${t.mood.reportTo} ${endLabel}`, margin, 36);
      // AI badge
      doc.setFillColor(99, 102, 241);
      doc.roundedRect(pageW - margin - 26, 8, 26, 8, 2, 2, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("✦ IA Mistral", pageW - margin - 23, 13.5);
      y = 52;

      // ── No data ───────────────────────────────────────────────────────────
      if (dailyLogs.length === 0) {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(12);
        doc.text(t.mood.reportNoData, margin, y);
        doc.save(`mindscope-report-${period}.pdf`);
        setStep("idle");
        return;
      }

      // ── Summary stats ─────────────────────────────────────────────────────
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(t.mood.reportSummary, margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`${dailyLogs.length} ${t.mood.reportDaysTracked} / ${periodDays[period]}  ·  ${entries.length} entrée${entries.length > 1 ? "s" : ""}`, margin, y);
      y += 8;

      const stats = [
        { label: t.mood.reportMood,     avgV: avg(entries.map(e => e.mood)),     minV: minOf(entries.map(e => e.mood)),     maxV: maxOf(entries.map(e => e.mood)),     unit: "/10" },
        { label: t.mood.reportSleep,    avgV: avg(entries.map(e => e.sleep)),    minV: minOf(entries.map(e => e.sleep)),    maxV: maxOf(entries.map(e => e.sleep)),    unit: t.mood.hoursUnit },
        { label: t.mood.appetiteLabel,  avgV: avg(entries.map(e => e.appetite)), minV: minOf(entries.map(e => e.appetite)), maxV: maxOf(entries.map(e => e.appetite)), unit: "/5" },
        { label: t.mood.energyLabel,    avgV: avg(entries.map(e => e.energy)),   minV: minOf(entries.map(e => e.energy)),   maxV: maxOf(entries.map(e => e.energy)),   unit: "/5" },
        { label: t.mood.reportAlcohol,  avgV: avg(entries.map(e => e.alcohol)),  minV: minOf(entries.map(e => e.alcohol)),  maxV: maxOf(entries.map(e => e.alcohol)),  unit: ` ${t.mood.alcoholDrinks}` },
      ].filter(s => s.avgV !== null);

      autoTable(doc, {
        startY: y,
        head:   [[t.mood.reportSummary, t.mood.reportAvg, t.mood.reportMin, t.mood.reportMax]],
        body:   stats.map(s => [s.label, `${s.avgV}${s.unit}`, `${s.minV}${s.unit}`, `${s.maxV}${s.unit}`]),
        styles:     { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // ── Behaviour summary ─────────────────────────────────────────────────
      const withAlcohol = entries.filter(e => e.alcohol  != null && e.alcohol  > 0).length;
      const withSubst   = entries.filter(e => e.substances != null && e.substances > 0).length;
      const withRisk    = entries.filter(e => e.riskBehavior === true).length;
      if (withAlcohol + withSubst + withRisk > 0) {
        if (y > 240) { doc.addPage(); y = margin; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(30, 41, 59);
        doc.text(t.mood.reportBehaviours, margin, y); y += 7;
        autoTable(doc, {
          startY: y,
          head: [[t.mood.reportBehaviours, `${t.mood.reportDaysTracked} / ${dailyLogs.length}`]],
          body: [
            [t.mood.reportAlcohol,    `${withAlcohol}`],
            [t.mood.reportSubstances, `${withSubst}`],
            [t.mood.reportRisk,       `${withRisk}`],
          ],
          styles:     { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // ── AI Analysis page ──────────────────────────────────────────────────
      if (aiAnalysis) {
        addAISection(doc, aiAnalysis, pageW, margin, aiSectionTitle, aiDisclaimer);
      }

      // ── Daily log table ───────────────────────────────────────────────────
      doc.addPage();
      y = margin;
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(30, 41, 59);
      doc.text(t.mood.reportDailyLog, margin, y); y += 7;
      const subOpts = t.mood.substanceOpts;
      const tableRows: string[][] = [];
      for (const day of dailyLogs) {
        const d = new Date(day.date + "T12:00:00");
        const dateStr = d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
        for (const e of day.entries) {
          tableRows.push([
            `${dateStr}\n${e.datetime.split("T")[1]?.slice(0,5) ?? ""}`,
            `${e.mood}/10`,
            e.sleep     != null ? `${e.sleep}${t.mood.hoursUnit}` : "-",
            e.appetite  != null ? `${e.appetite}/5` : "-",
            e.energy    != null ? `${e.energy}/5`   : "-",
            e.alcohol   != null && e.alcohol > 0 ? `${e.alcohol}` : "0",
            e.substances != null ? subOpts[e.substances] : "-",
            e.riskBehavior === true ? t.mood.riskYes : e.riskBehavior === false ? t.mood.riskNo : "-",
            e.note ? (e.note.length > 55 ? e.note.slice(0, 52) + "…" : e.note) : "",
          ]);
        }
      }
      autoTable(doc, {
        startY: y,
        head: [[t.mood.reportDate, t.mood.reportMood, t.mood.reportSleep, t.mood.appetiteLabel, t.mood.energyLabel, t.mood.reportAlcohol, t.mood.reportSubstances, t.mood.reportRisk, t.mood.reportJournal]],
        body: tableRows,
        styles:     { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 8: { cellWidth: 38 } },
        margin: { left: margin, right: margin },
      });

      // ── Journal section ───────────────────────────────────────────────────
      const journalEntries = entries.filter(e => e.note);
      if (journalEntries.length > 0) {
        doc.addPage(); y = margin;
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(30, 41, 59);
        doc.text(t.mood.journalLabel, margin, y); y += 8;
        for (const e of journalEntries) {
          if (y > 270) { doc.addPage(); y = margin; }
          const d = new Date(e.date + "T12:00:00");
          const ds = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          const ts = e.datetime.split("T")[1]?.slice(0,5) ?? "";
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(37, 99, 235);
          doc.text(`${ds}  ${ts}`, margin, y); y += 5;
          doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
          const lines = doc.splitTextToSize(e.note ?? "", pageW - margin * 2);
          doc.text(lines, margin, y); y += lines.length * 4.5 + 7;
        }
      }

      // ── Footer ────────────────────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text(t.mood.reportGenBy + (aiAnalysis ? "  ·  ✦ Analyse IA Mistral" : ""), margin, 290);
        doc.text(`${i} / ${totalPages}`, pageW - margin, 290, { align: "right" });
      }

      setStep("done");
      doc.save(`mindscope-${period}-${endDate}.pdf`);
      setTimeout(() => setStep("idle"), 2000);
    } catch {
      setStep("idle");
    }
  };

  const loading = step !== "idle";

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t.mood.reportTitle}</h3>
            <p className="text-xs text-indigo-200">
              {lang === "fr" ? "Rapport PDF avec analyse IA Mistral" : "PDF Report with Mistral AI analysis"}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* What's included */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { icon: <BarChart2 className="h-4 w-4" />, label: lang === "fr" ? "Statistiques" : "Statistics" },
            { icon: <Brain className="h-4 w-4" />,    label: lang === "fr" ? "Analyse IA" : "AI Analysis" },
            { icon: <FileText className="h-4 w-4" />, label: lang === "fr" ? "Journal" : "Journal" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Period selector */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["1w", "1m", "1y"] as Period[]).map((p) => (
            <button key={p} onClick={() => !loading && setPeriod(p)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                period === p
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-300"}`}>
              <Calendar className="h-4 w-4" />
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="mb-5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
          {(() => {
            const end   = isoToday();
            const start = subtractDays(end, periodDays[period] - 1);
            const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
            return `${t.mood.reportFrom} ${new Date(start + "T12:00:00").toLocaleDateString(locale, opts)} ${t.mood.reportTo} ${new Date(end + "T12:00:00").toLocaleDateString(locale, opts)}`;
          })()}
        </div>

        {/* Loading steps indicator */}
        {loading && (
          <div className="mb-4 space-y-2">
            {(["data", "ai", "pdf"] as const).map((s) => {
              const done    = ["pdf", "done"].includes(step) && s !== "pdf" || step === "done";
              const current = step === s;
              const pending = !done && !current;
              return (
                <div key={s} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                  current ? "bg-indigo-50 dark:bg-indigo-900/20" : done ? "bg-green-50 dark:bg-green-900/10" : "opacity-40"}`}>
                  {current ? (
                    <span className="h-4 w-4 flex-shrink-0 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  ) : done ? (
                    <span className="h-4 w-4 flex-shrink-0 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">✓</span>
                  ) : (
                    <span className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  )}
                  <span className={`text-sm font-medium ${current ? "text-indigo-600 dark:text-indigo-400" : done ? "text-green-600 dark:text-green-400" : "text-slate-400"}`}>
                    {steps[s]}
                  </span>
                  {s === "ai" && current && (
                    <span className="text-xs text-indigo-400 ml-auto">Mistral AI</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Generate button */}
        <button onClick={generatePDF} disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
            loading ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl"}`}>
          {loading ? (
            <>
              <span className="h-4 w-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
              {(steps as Record<string, string>)[step] ?? steps["data"]}
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              {t.mood.reportGenerate} — {periodLabels[period]}
              <Sparkles className="h-4 w-4 opacity-70" />
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">
          {lang === "fr" ? "✦ L'IA analysera vos données et rédigera un rapport personnalisé dans votre langue."
           : lang === "es" ? "✦ La IA analizará sus datos y redactará un informe personalizado."
           : "✦ AI will analyze your data and write a personalized report in your language."}
        </p>
      </div>
    </div>
  );
}
