import { useEffect, useId, useRef } from "react";
import type { ThemeMode } from "@/lib/charts";

const WIDGET_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

interface MacroChartProps {
  title: string;
  description: string;
  sourceUrl: string;
  sourceLabel: string;
  symbol: string;
  interval: string;
  studies?: string[];
  theme: ThemeMode;
}

function widgetBackground(theme: ThemeMode): string {
  return theme === "dark" ? "rgba(18, 24, 32, 1)" : "rgba(255, 255, 255, 1)";
}

function widgetGridColor(theme: ThemeMode): string {
  return theme === "dark" ? "rgba(30, 41, 59, 0.6)" : "rgba(226, 232, 240, 0.8)";
}

export default function MacroChart({
  title,
  description,
  sourceUrl,
  sourceLabel,
  symbol,
  interval,
  studies,
  theme,
}: MacroChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetHostRef = useRef<HTMLDivElement>(null);
  const instanceId = useId().replace(/:/g, "");

  useEffect(() => {
    const host = widgetHostRef.current;
    if (!host) return;

    host.innerHTML = "";

    const widgetRoot = document.createElement("div");
    widgetRoot.className = "tradingview-widget-container__widget";
    widgetRoot.style.height = "100%";
    widgetRoot.style.width = "100%";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = WIDGET_SCRIPT;
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "America/New_York",
      theme,
      style: "1",
      locale: "en",
      backgroundColor: widgetBackground(theme),
      gridColor: widgetGridColor(theme),
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      hide_volume: true,
      support_host: "https://www.tradingview.com",
      ...(studies?.length ? { studies } : {}),
    });

    host.appendChild(widgetRoot);
    host.appendChild(script);

    return () => {
      host.innerHTML = "";
    };
  }, [symbol, interval, studies, theme]);

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-elevated shadow-sm"
      aria-labelledby={`chart-title-${instanceId}`}
    >
      <div
        ref={containerRef}
        className="relative min-h-[280px] flex-1 sm:min-h-[320px] lg:min-h-[360px]"
      >
        <div
          ref={widgetHostRef}
          className="tradingview-widget-container absolute inset-0 h-full w-full"
        />
      </div>

      <footer className="border-t border-surface-border px-4 py-3">
        <h2
          id={`chart-title-${instanceId}`}
          className="text-sm font-semibold text-ink"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-medium"
          >
            Источник: {sourceLabel}
          </a>
        ) : (
          <p className="mt-2 text-xs font-medium text-ink-muted">
            Источник: {sourceLabel}
          </p>
        )}
      </footer>
    </article>
  );
}
