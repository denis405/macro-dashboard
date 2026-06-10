import MacroChart from "@/components/MacroChart";
import InfoCard from "@/components/InfoCard";
import type { MacroIndicator, ThemeMode } from "@/lib/charts";

interface MacroGridProps {
  indicators: MacroIndicator[];
  theme: ThemeMode;
}

export default function MacroGrid({ indicators, theme }: MacroGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3 lg:grid-rows-2">
      {indicators.map((indicator) => (
        <MacroChart
          key={indicator.id}
          title={indicator.title}
          description={indicator.description}
          sourceUrl={indicator.sourceUrl}
          sourceLabel={indicator.sourceLabel}
          symbol={indicator.symbol}
          interval={indicator.interval}
          studies={indicator.studies}
          theme={theme}
        />
      ))}
      <InfoCard />
    </div>
  );
}
