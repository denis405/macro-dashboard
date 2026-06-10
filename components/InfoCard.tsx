import { INFO_PANEL_ITEMS } from "@/lib/charts";

export default function InfoCard() {
  return (
    <aside
      className="flex h-full flex-col rounded-xl border border-surface-border bg-surface-elevated p-5 shadow-sm"
      aria-label="Справка по индикаторам"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Macro Cycle
      </p>
      <h2 className="mt-1 text-lg font-semibold text-ink">
        Как читать дэшборд
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Пять независимых графиков TradingView на одном экране. Каждый виджет
        имеет собственный таймфрейм, масштаб и настройки — данные обновляются
        через TradingView.
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-3">
        {INFO_PANEL_ITEMS.map((item) => (
          <li
            key={item.label}
            className="rounded-lg border border-surface-border bg-surface px-3 py-2.5"
          >
            <span className="text-xs font-semibold text-accent">
              {item.label}
            </span>
            <p className="mt-0.5 text-sm text-ink-muted">{item.text}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-ink-muted">
        Спред 10Y–2Y и Cu/Au построены по формулам TradingView; Pine Script
        версии — в папке{" "}
        <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
          pine/
        </code>
        .
      </p>
    </aside>
  );
}
