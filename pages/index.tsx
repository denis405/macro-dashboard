import Head from "next/head";
import { useEffect, useState } from "react";
import MacroGrid from "@/components/MacroGrid";
import { MACRO_INDICATORS, type ThemeMode } from "@/lib/charts";

function ThemeToggle({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-surface-border bg-surface-elevated p-1"
      role="group"
      aria-label="Тема оформления"
    >
      {(["light", "dark"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={theme === mode}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            theme === mode
              ? "bg-accent text-white shadow-sm"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {mode === "light" ? "Светлая" : "Тёмная"}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem("macro-dashboard-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("macro-dashboard-theme", theme);
  }, [theme, mounted]);

  return (
    <>
      <Head>
        <title>Macro Dashboard — TradingView</title>
        <meta
          name="description"
          content="Макроэкономический дэшборд: PMI, Copper, VIX, Yield Curve и Copper/Gold Ratio на одной странице."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen">
        <header className="border-b border-surface-border bg-surface-elevated/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <a
                href="../"
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink"
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
                Macro Dashboard
              </a>
              <nav
                className="flex flex-wrap gap-2"
                aria-label="Версии дашборда"
              >
                <a
                  href="../"
                  className="rounded-full border border-surface-border px-3 py-1 text-xs font-medium text-ink-muted transition hover:text-ink"
                >
                  v1 — свои графики
                </a>
                <a
                  href="./"
                  aria-current="page"
                  className="rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                >
                  v2 — TradingView
                </a>
              </nav>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Macro Terminal
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Макроэкономический дэшборд
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                Пять независимых графиков TradingView для мониторинга цикла:
                PMI, медь, VIX, спред 10Y–2Y и отношение Copper/Gold.
              </p>
            </div>
            {mounted && <ThemeToggle theme={theme} onChange={setTheme} />}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {mounted ? (
            <MacroGrid indicators={MACRO_INDICATORS} theme={theme} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="min-h-[360px] animate-pulse rounded-xl border border-surface-border bg-surface-elevated"
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
