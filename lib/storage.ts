export interface TestResult {
  id: string;
  testId: string;
  testName: string;
  score: number;
  maxScore: number;
  severityLabel: string;
  severity: string;
  completedAt: string;
  answers: Record<string, number>;
}

export interface MoodEntry {
  date: string; // ISO date string YYYY-MM-DD
  mood: number; // 1-10
  note?: string;
}

const RESULTS_KEY = "mindscope_results";
const MOOD_KEY = "mindscope_mood";

export function saveResult(result: Omit<TestResult, "id">): TestResult {
  const results = getResults();
  const newResult: TestResult = {
    ...result,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  results.unshift(newResult);
  // Keep only last 50 results
  const trimmed = results.slice(0, 50);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(trimmed));
  return newResult;
}

export function getResults(): TestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getResultById(id: string): TestResult | undefined {
  return getResults().find((r) => r.id === id);
}

export function deleteResult(id: string): void {
  const results = getResults().filter((r) => r.id !== id);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

export function clearAllResults(): void {
  localStorage.removeItem(RESULTS_KEY);
}

export function saveMoodEntry(entry: MoodEntry): void {
  const entries = getMoodEntries();
  const existing = entries.findIndex((e) => e.date === entry.date);
  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }
  // Keep last 90 days
  const sorted = entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
  localStorage.setItem(MOOD_KEY, JSON.stringify(sorted));
}

export function getMoodEntries(): MoodEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MOOD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getTodayMood(): MoodEntry | undefined {
  const today = new Date().toISOString().split("T")[0];
  return getMoodEntries().find((e) => e.date === today);
}
