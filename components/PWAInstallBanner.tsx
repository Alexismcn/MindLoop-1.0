"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share, Plus, Download, Smartphone } from "lucide-react";

const STORAGE_KEY = "mindloop_pwa";
const MIN_VISITS   = 2;   // show from 2nd visit
const DISMISS_DAYS = 30;  // don't re-show for 30 days after dismiss

interface PWAState {
  visits?: number;
  dismissedAt?: number;
  installed?: boolean;
}

function readState(): PWAState {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}
function writeState(s: PWAState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [mode,    setMode]    = useState<"android" | "ios" | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promptRef = useRef<any>(null);

  useEffect(() => {
    // Already running as installed PWA — never show
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((window.navigator as any).standalone === true) return;

    const state = readState();

    // If already installed or permanently skipped
    if (state.installed) return;

    // If dismissed recently
    if (state.dismissedAt) {
      const days = (Date.now() - state.dismissedAt) / 86_400_000;
      if (days < DISMISS_DAYS) return;
    }

    // Increment visit counter
    const visits = (state.visits ?? 0) + 1;
    writeState({ ...state, visits });

    // Only show from MIN_VISITS onward
    if (visits < MIN_VISITS) return;

    // iOS detection (no beforeinstallprompt on Safari)
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !("MSStream" in window);

    if (isIOS) {
      // Small delay so it doesn't jump on page load
      const timer = setTimeout(() => {
        setMode("ios");
        setVisible(true);
      }, 4000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome / Edge — wait for the native prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e;
      setMode("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Track actual installation
  useEffect(() => {
    const handler = () => {
      const state = readState();
      writeState({ ...state, installed: true });
      setVisible(false);
    };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  const handleInstall = async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === "accepted") {
      const state = readState();
      writeState({ ...state, installed: true });
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    const state = readState();
    writeState({ ...state, dismissedAt: Date.now() });
    setVisible(false);
  };

  if (!visible || !mode) return null;

  return (
    /* Slide up from bottom, sits above the mobile tab bar */
    <div className="fixed bottom-[5.5rem] sm:bottom-6 inset-x-3 z-[9990] pointer-events-none">
      <div
        className="pointer-events-auto rounded-2xl bg-white dark:bg-slate-800
          border border-slate-200 dark:border-slate-700
          shadow-[0_8px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]
          overflow-hidden animate-sheet-up"
      >
        {/* Coloured accent strip */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="flex items-start gap-4 p-4">
          {/* App icon */}
          <div className="flex-shrink-0 h-14 w-14 rounded-2xl overflow-hidden shadow-md border border-slate-100 dark:border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`}
              alt="MindLoop"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight">
              Installer MindLoop
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              {mode === "ios"
                ? "Accès rapide depuis votre écran d'accueil, sans pub, même hors ligne."
                : "Installez l'app sur votre téléphone — rapide, privé, sans App Store."}
            </p>

            {mode === "ios" ? (
              /* iOS instruction */
              <div className="mt-2.5 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <Share className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Appuyez sur{" "}
                  <Share className="h-3 w-3 inline -mt-0.5 mx-0.5" />
                  {" "}puis{" "}
                  <span className="font-semibold">«&nbsp;Sur l&rsquo;écran d&rsquo;accueil&nbsp;»</span>
                </span>
              </div>
            ) : (
              /* Android install button */
              <button
                onClick={handleInstall}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                  bg-blue-600 hover:bg-blue-700 active:scale-95
                  text-white text-xs font-semibold shadow
                  transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                Installer l&rsquo;application
              </button>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            aria-label="Fermer"
            className="flex-shrink-0 -mt-1 -mr-1 h-8 w-8 flex items-center justify-center
              rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
              hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* iOS: not-now link */}
        {mode === "ios" && (
          <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Smartphone className="h-3 w-3" />
              Fonctionne sur iPhone &amp; iPad
            </span>
            <button
              onClick={handleDismiss}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Plus tard
            </button>
          </div>
        )}
        {mode === "android" && (
          <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Plus className="h-3 w-3" />
              Fonctionne sans connexion
            </span>
            <button
              onClick={handleDismiss}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Plus tard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
