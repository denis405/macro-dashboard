const indicators = [
  {
    id: "pmi",
    title: "PMI (Purchasing Managers' Index)",
    description:
      "Опрос менеджеров по закупкам. >50 = рост, <50 = спад. Опережающий индикатор ВВП на 1–2 квартала.",
    wide: true,
    embeds: [
      {
        label: "PMI РФ — S&P Global Manufacturing",
        type: "iframe",
        src: "https://ssltvc1.investing.com/?pair_ID=1630&height=320&width=100%25&interval=86400&plotStyle=area&domain_ID=1&lang_ID=11&timezone_ID=25",
        height: 320,
        sourceUrl:
          "https://www.investing.com/economic-calendar/russian-s-p-global-manufacturing-pmi-1630",
        sourceLabel: "Investing.com"
      },
      {
        label: "PMI США — ISM Manufacturing",
        type: "iframe",
        src: "https://ssltvc1.investing.com/?pair_ID=173&height=320&width=100%25&interval=86400&plotStyle=area&domain_ID=1&lang_ID=11&timezone_ID=25",
        height: 320,
        sourceUrl: "https://tradingeconomics.com/united-states/business-confidence",
        sourceLabel: "Trading Economics"
      }
    ],
    guide: {
      what: "Показывает, расширяется или сжимается производственная активность.",
      why: "PMI помогает быстро оценить импульс реального сектора и ожидания бизнеса.",
      danger: "Ниже 48 — явный сигнал ухудшения; зона 48–52 требует осторожного чтения."
    }
  },
  {
    id: "copper",
    title: "Цена меди (Dr. Copper)",
    description:
      "Медь — базовый материал для проводки, техники и стройки. Рост цены часто отражает рост промышленного спроса.",
    embeds: [
      {
        label: "Copper — COMEX",
        type: "iframe",
        src: "https://ssltvc1.investing.com/?pair_ID=8830&height=320&width=100%25&interval=86400&plotStyle=area&domain_ID=1&lang_ID=11&timezone_ID=25",
        height: 320,
        sourceUrl: "https://tradingeconomics.com/commodity/copper",
        sourceLabel: "Trading Economics"
      }
    ],
    guide: {
      what: "Отражает цену меди на мировом сырьевом рынке.",
      why: "Рост меди часто связан с ожиданиями промышленного роста и спросом на инфраструктуру.",
      danger: "Устойчивое падение может указывать на слабый глобальный спрос и риск замедления."
    }
  },
  {
    id: "vix",
    title: "VIX (Volatility Index)",
    description:
      "Индекс ожидаемой волатильности S&P 500 на 30 дней. Барометр страха: низкий (<15) — спокойствие, высокий (>30) — паника.",
    embeds: [
      {
        label: "VIX — CBOE",
        type: "iframe",
        src: "https://ssltvc1.investing.com/?pair_ID=44336&height=320&width=100%25&interval=86400&plotStyle=area&domain_ID=1&lang_ID=11&timezone_ID=25",
        height: 320,
        sourceUrl: "https://tradingeconomics.com/vix:ind",
        sourceLabel: "Trading Economics"
      }
    ],
    guide: {
      what: "Показывает ожидаемую рынком волатильность S&P 500.",
      why: "VIX помогает понять уровень страха, спрос на защиту и риск резких движений.",
      danger: "Выше 25 — стрессовая зона; 15–25 — умеренная осторожность; ниже 15 — спокойный режим."
    }
  },
  {
    id: "yield-curve",
    title: "Кривая доходности UST и ОФЗ",
    description:
      "Форма кривой (нормальная, плоская, инвертированная) даёт карту ожиданий по ставкам и циклу.",
    wide: true,
    embeds: [
      {
        label: "UST 10Y − 2Y spread — FRED",
        type: "iframe",
        src: "https://fred.stlouisfed.org/graph/graph-landing.php?width=100%25&height=320&id=T10Y2Y&nsh=1",
        height: 320,
        sourceUrl: "https://fred.stlouisfed.org/series/T10Y2Y",
        sourceLabel: "FRED / U.S. Treasury"
      },
      {
        label: "Кривая ОФЗ — MOEX",
        type: "moex",
        sourceUrl: "https://www.moex.com/ru/marketdata/indices/state/g-curve/",
        sourceLabel: "MOEX"
      }
    ],
    guide: {
      what: "Показывает соотношение доходностей коротких и длинных облигаций.",
      why: "Форма кривой отражает ожидания по ставкам, инфляции и экономическому циклу.",
      danger: "Плоская кривая сигнализирует неопределённость, инверсия — повышенный стресс и риск замедления."
    }
  }
];

const grid = document.querySelector("#indicator-grid");
const guide = document.querySelector("#reading-guide");
const sourceList = document.querySelector("#source-list");

document.addEventListener("DOMContentLoaded", initDashboard);

function initDashboard() {
  renderIndicators(indicators);
  renderReadingGuide(indicators);
  renderSourceLinks(indicators);
}

function renderIndicators(items) {
  grid.innerHTML = items.map(createIndicatorCard).join("");

  items.forEach((indicator) => {
    indicator.embeds.forEach((embed, index) => {
      mountEmbed(indicator.id, index, embed);
    });
  });
}

function createIndicatorCard(indicator) {
  const embedBlocks = indicator.embeds
    .map((embed, index) => createEmbedBlock(indicator.id, index, embed))
    .join("");

  const embedLayout =
    indicator.embeds.length > 1
      ? `<div class="dual-embed">${embedBlocks}</div>`
      : embedBlocks;

  const primarySource = indicator.embeds[0];

  return `
    <article class="indicator-card${indicator.wide ? " indicator-card--wide" : ""}">
      <div class="card-top">
        <div>
          <h2 class="indicator-title">${indicator.title}</h2>
          <p class="indicator-description">${indicator.description}</p>
        </div>
      </div>

      <p class="embed-attribution">
        Графики обновляются на стороне
        ${indicator.embeds.map(formatSourceLink).join(" · ")}
      </p>

      ${embedLayout}

      <a class="source-button" href="${primarySource.sourceUrl}" target="_blank" rel="noopener noreferrer">
        Открыть источник
      </a>
    </article>
  `;
}

function createEmbedBlock(indicatorId, index, embed) {
  const wrapId = `embed-${indicatorId}-${index}`;
  const tallClass = embed.height >= 320 ? " embed-wrap--tall" : "";

  return `
    <div>
      <p class="embed-label">${embed.label}</p>
      <div class="embed-wrap${tallClass}" id="${wrapId}">
        <div class="embed-mount" data-embed-id="${wrapId}"></div>
        <div class="embed-fallback" id="${wrapId}-fallback" hidden>
          <p>Виджет не загрузился. Откройте график на сайте источника.</p>
          <a class="source-button" href="${embed.sourceUrl}" target="_blank" rel="noopener noreferrer">
            ${embed.sourceLabel}
          </a>
        </div>
      </div>
    </div>
  `;
}

function mountEmbed(indicatorId, index, embed) {
  const mount = document.querySelector(`#embed-${indicatorId}-${index} .embed-mount`);
  const fallback = document.querySelector(`#embed-${indicatorId}-${index}-fallback`);

  if (!mount) {
    return;
  }

  if (embed.type === "iframe") {
    mount.appendChild(createIframe(embed, fallback));
    return;
  }

  if (embed.type === "moex") {
    mount.appendChild(createMoexPanel(embed));
  }
}

function createIframe(embed, fallback) {
  const iframe = document.createElement("iframe");
  iframe.className = "embed-frame";
  iframe.src = embed.src;
  iframe.title = embed.label;
  iframe.loading = "lazy";
  iframe.setAttribute("allowtransparency", "true");
  iframe.referrerPolicy = "no-referrer-when-downgrade";

  iframe.addEventListener("error", () => showFallback(fallback));

  return iframe;
}

function createMoexPanel(embed) {
  const panel = document.createElement("div");
  panel.className = "embed-fallback is-visible";
  panel.style.position = "static";
  panel.style.minHeight = "280px";
  panel.innerHTML = `
    <p>
      MOEX не разрешает встраивать кривую доходности на сторонние сайты.
      График доступен только на странице биржи.
    </p>
    <a class="source-button" href="${embed.sourceUrl}" target="_blank" rel="noopener noreferrer">
      Открыть кривую ОФЗ на MOEX
    </a>
  `;

  return panel;
}

function showFallback(fallback) {
  if (!fallback) {
    return;
  }

  fallback.hidden = false;
  fallback.classList.add("is-visible");
}

function formatSourceLink(embed) {
  return `<a href="${embed.sourceUrl}" target="_blank" rel="noopener noreferrer">${embed.sourceLabel}</a>`;
}

function renderReadingGuide(items) {
  guide.innerHTML = items
    .map(
      (indicator) => `
    <article class="guide-card">
      <h3>${indicator.title}</h3>
      <dl class="guide-list">
        <div>
          <dt>Что показывает</dt>
          <dd>${indicator.guide.what}</dd>
        </div>
        <div>
          <dt>Почему важен</dt>
          <dd>${indicator.guide.why}</dd>
        </div>
        <div>
          <dt>Опасные значения</dt>
          <dd>${indicator.guide.danger}</dd>
        </div>
      </dl>
    </article>
  `
    )
    .join("");
}

function renderSourceLinks(items) {
  const links = items.flatMap((indicator) =>
    indicator.embeds.map((embed) => ({
      title: `${indicator.title} — ${embed.sourceLabel}`,
      url: embed.sourceUrl
    }))
  );

  sourceList.innerHTML = links
    .map(
      (link) => `
    <a class="source-link" href="${link.url}" target="_blank" rel="noopener noreferrer">
      <strong>${link.title}</strong>
      <span>${new URL(link.url).hostname}</span>
    </a>
  `
    )
    .join("");
}
