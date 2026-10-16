/* global Chart */
(function () {
  "use strict";
  const D = window.CLAIMS;
  const YEARS = D.meta.years;
  const LATEST = D.meta.latest;
  const CATS = [
    { key: "hospital", name: "住院", color: "#2a78d6" },
    { key: "death", name: "身故", color: "#eb6834" },
    { key: "critical", name: "危疾", color: "#6250d6" },
    { key: "accident", name: "意外", color: "#1baf7a" }
  ];
  const C = { male: "#2a78d6", female: "#e34948", ci: "#6250d6", death: "#eb6834", grid: "#ebe7de", ink2: "#4a5468", muted: "#7a8193", old: "#c4c0b6", accent: "#b5502a" };
  const state = { summaryYear: LATEST, detailYear: LATEST, gType: "critical", trend: "amount", room: 1 };
  const charts = {};

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const pct = (part, whole) => (whole ? (part / whole) * 100 : 0);
  const fmt = {
    yi: (n) => Number(n).toFixed(2).replace(/\.?0+$/, ""),
    num: (n) => Math.round(n).toLocaleString("en-US"),
    money: (n) => "$" + Math.round(n).toLocaleString("en-US"),
    wan: (n) => {
      if (n >= 1e8) return "$" + fmt.yi(n / 1e8) + "億";
      if (n >= 1e5) return "$" + Math.round(n / 1e4).toLocaleString("en-US") + "萬";
      if (n >= 1e4) return "$" + (n / 1e4).toFixed(1).replace(/\.0$/, "") + "萬";
      return fmt.money(n);
    },
    p: (n, d = 1) => Number(n).toFixed(d) + "%",
    chg: (a, b) => {
      const v = pct(a - b, b);
      const cls = Math.abs(v) < 0.5 ? "flat" : v > 0 ? "up" : "down";
      return `<span class="chg ${cls}">${v > 0 ? "+" : ""}${v.toFixed(0)}%</span>`;
    }
  };
  const catSum = (y, field) => sum(CATS.map((c) => D.summary[y][c.key][field]));
  const femaleShare = (obj) => pct(sum(obj.female), sum(obj.female) + sum(obj.male));
  const causePct = (obj, name) => {
    const hit = obj.causes.find((c) => c[0] === name);
    return hit ? pct(hit[1], obj.n) : 0;
  };

  function draw(id, config) {
    if (charts[id]) charts[id].destroy();
    const el = $(id);
    if (!el) return;
    charts[id] = new Chart(el, config);
  }

  function bars(list, color, opts = {}) {
    const total = opts.total || sum(list.map((x) => x[1]));
    const max = Math.max(...list.map((x) => x[1]));
    const hl = opts.highlight || 0;
    return `<div class="bars">${list.map((x, i) => {
      const w = max ? (x[1] / max) * 100 : 0;
      const val = opts.valueFn ? opts.valueFn(x) : `${fmt.num(x[1])}（${fmt.p(pct(x[1], total))}）`;
      return `<div class="bar-row${i < hl ? " hl" : ""}">
        <span class="bar-name">${x[0]}</span>
        <span class="bar-track"><i style="width:${w}%;background:${typeof color === "function" ? color(x, i) : color}"></i></span>
        <span class="bar-val">${val}</span>
      </div>`;
    }).join("")}</div>`;
  }

  function baseOpts(extra = {}) {
    return Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "start", labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, padding: 14 } },
        tooltip: { backgroundColor: "#14213d", padding: 10, cornerRadius: 8, titleFont: { weight: "700" }, boxPadding: 4 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: C.ink2 } },
        y: { grid: { color: C.grid }, border: { display: false }, ticks: { color: C.muted } }
      }
    }, extra);
  }

  /* ---------- year pickers ---------- */
  function renderYearPicks() {
    document.querySelectorAll(".year-pick").forEach((box) => {
      const scope = box.dataset.scope;
      const cur = scope === "summary" ? state.summaryYear : state.detailYear;
      box.innerHTML = `<span class="lbl">揀年份</span>` + YEARS.map((y) =>
        `<button type="button" data-year="${y}" class="${y === cur ? "on" : ""}">${y}</button>`).join("");
      box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        const y = Number(b.dataset.year);
        if (scope === "summary") { state.summaryYear = y; renderMix(); }
        else { state.detailYear = y; renderDetail(); }
        renderYearPicks();
      }));
    });
  }

  /* ---------- hero ---------- */
  /* ---------- small visuals ---------- */
  function spark(values, color, range) {
    const w = 120, h = 32, pad = 3;
    const min = range ? range[0] : Math.min(...values), max = range ? range[1] : Math.max(...values), span = max - min || 1;
    const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)]);
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="${color}"/></svg>`;
  }
  const PERSON = '<path d="M12 2.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 19c0-4.6 3.1-8 7-8s7 3.4 7 8c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1Z"/>';
  const BLOCK = '<rect x="3" y="3" width="18" height="18" rx="4"/>';
  function picto(n, filled, on, off, shape) {
    return `<span class="picto" aria-hidden="true">${Array.from({ length: n }, (_, i) =>
      `<svg viewBox="0 0 24 24" fill="${i < filled ? on : off}">${shape}</svg>`).join("")}</span>`;
  }
  function keyFact(id, big, text, extra = "", color = C.accent) {
    const el = $(id);
    if (el) el.innerHTML = `<div class="kf-big" style="color:${color}">${big}</div><div class="kf-text">${text}</div>${extra ? `<div class="kf-extra">${extra}</div>` : ""}`;
  }

  function countUp() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count), dec = Number(el.dataset.dec || 0);
      const pre = el.dataset.pre || "", post = el.dataset.post || "";
      const t0 = performance.now(), dur = 700;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        const v = target * e;
        el.textContent = pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US")) + post;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  const cnt = (v, { pre = "", post = "", dec = 0 } = {}) =>
    `<span data-count="${v}" data-dec="${dec}" data-pre="${pre}" data-post="${post}">${pre}${dec ? Number(v).toFixed(dec) : Math.round(v).toLocaleString("en-US")}${post}</span>`;

  /* ---------- hero ---------- */
  function renderHero() {
    const s = D.summary[LATEST], s0 = D.summary[YEARS[0]];
    const ci = D.critical[LATEST], de = D.death[LATEST];
    const days = 365;
    const minutes = (days * 24 * 60) / s.cases;
    const ci4160 = pct(ci.male[2] + ci.female[2], ci.n);
    const hospShareCases = pct(s.hospital.cases, s.cases);

    $("punch").innerHTML = `
      <div class="punch-big">每 ${cnt(minutes, { dec: 1 })} 分鐘</div>
      <div class="punch-text">就有一宗理賠成功賠出。${LATEST} 年全年 <b>${fmt.num(s.cases)}</b> 宗，合共賠出超過 <b>${s.total} 億</b>。</div>`;

    const perDay = [
      ["每日賠出", cnt((s.total * 1e8) / days / 1e4, { pre: "$", post: "萬" }), C.accent, "全年 " + s.total + " 億 ÷ 365 日"],
      ["住院", cnt(s.hospital.cases / days, { post: " 宗" }), CATS[0].color, "每日"],
      ["意外", cnt(s.accident.cases / days, { post: " 宗" }), CATS[3].color, "每日"],
      ["身故", cnt(de.n / days, { post: " 宗", dec: 1 }), CATS[1].color, "每日 · 約 " + Math.round(de.n / days) + " 個家庭"],
      ["危疾", cnt(ci.n / days, { post: " 宗", dec: 1 }), CATS[2].color, "每日 · 約 " + Math.round(ci.n / days) + " 個人確診獲賠"]
    ];
    $("perDay").innerHTML = `<div class="pd-title">${LATEST} 年，平均一日入面：</div><div class="pd-grid">${perDay.map((x) =>
      `<div class="pd"><span class="pd-k"><i style="background:${x[2]}"></i>${x[0]}</span><b>${x[1]}</b><span class="pd-s">${x[3]}</span></div>`).join("")}</div>`;

    const series = {
      total: YEARS.map((y) => D.summary[y].total),
      hosp: YEARS.map((y) => D.summary[y].hospital.cases),
      female: YEARS.map((y) => femaleShare(D.critical[y])),
      ciMax: YEARS.map((y) => D.critical[y].max)
    };
    $("heroStats").innerHTML = [
      ["總賠償", `${s.total}億+`, `${YEARS[0]} 年 ${s0.total} 億 → 升 ${Math.round(pct(s.total - s0.total, s0.total))}%`, series.total],
      ["住院賠償宗數", fmt.num(s.hospital.cases), `${YEARS[0]} 年 ${fmt.num(s0.hospital.cases)} → 升 ${Math.round(pct(s.hospital.cases - s0.hospital.cases, s0.hospital.cases))}%`, series.hosp],
      ["危疾女性佔比", fmt.p(femaleShare(ci), 0), `七年都企喺 63–68%`, series.female, [0, 100]],
      ["最高一宗危疾", fmt.wan(ci.max), `${YEARS[0]} 年 ${fmt.wan(D.critical[YEARS[0]].max)}；平均只係 ${fmt.wan(ci.avg)}`, series.ciMax]
    ].map((x) => `<div class="hstat"><div class="k">${x[0]}<span class="yr">${YEARS[0]}–${LATEST}</span></div><div class="v">${x[1]}</div>${spark(x[3], "#f0b28f", x[4])}<div class="s">${x[2]}</div></div>`).join("");

    $("takeaways").innerHTML = [
      ["每 5 宗理賠，4 宗係住院", `住院佔全部成功個案約 ${fmt.p(hospShareCases, 0)}。醫療保障係最常用到嘅一張單。`, "#mix"],
      ["危疾：女性多、四五十歲多", `每 3 宗危疾有 2 宗係女性；${fmt.p(ci4160, 0)} 喺 41–60 歲，平均 ${ci.avgAge} 歲。`, "#gender"],
      ["醫療費一路升", "私家外科醫生收費 7 年升 20–50%；一年標靶藥可以超過 $180 萬。", "#inflation"]
    ].map((x) => `<a class="tk" href="${x[2]}"><b>${x[0]}</b><span>${x[1]}</span><em>睇詳情 →</em></a>`).join("");
  }

  /* ---------- key facts per section ---------- */
  function renderKeyFacts() {
    const s = D.summary[LATEST], s0 = D.summary[YEARS[0]];
    const ci = D.critical[LATEST], de = D.death[LATEST];
    const g = (k) => Math.round(pct(s[k].amt - s0[k].amt, s0[k].amt));
    keyFact("kf-trend", `+${Math.round(pct(s.total - s0.total, s0.total))}%`,
      `<b>七年總賠款由 ${s0.total} 億升到 ${s.total} 億。</b>升得最快係危疾（+${g("critical")}%）同住院（+${g("hospital")}%），即係「病」嘅開支升得最急。`);
    const hospAvg = (s.hospital.amt * 1e8) / s.hospital.cases;
    const hg = Math.round(pct(s.hospital.cases - s0.hospital.cases, s0.hospital.cases));
    keyFact("kf-mix", fmt.num(s.hospital.cases) + " 宗",
      `<b>住院係 claim 得最多嘅保障：每 5 宗理賠有 4 宗係住院，七年宗數升 ${hg}%。</b>不過每宗平均只係 ${fmt.wan(hospAvg)}；一宗危疾平均 ${fmt.wan(ci.avg)}，等於 ${Math.round(ci.avg / hospAvg)} 宗住院。`, "", CATS[0].color);
    const fs = femaleShare(ci);
    keyFact("kf-gender", "3 宗有 2 宗",
      `<b>危疾賠償 ${fmt.p(fs, 0)} 係女性。</b>七年都一樣，主因係乳癌。身故就倒轉，男性多過女性。`,
      picto(3, 2, C.female, C.male, PERSON) + `<span class="picto-cap"><i style="background:${C.female}"></i>女 <i style="background:${C.male}"></i>男</span>`, C.female);
    const ci4160 = pct(ci.male[2] + ci.female[2], ci.n);
    keyFact("kf-age", "41–60 歲",
      `<b>${fmt.p(ci4160, 0)} 危疾喺呢個年齡出事，平均 ${ci.avgAge} 歲。</b>正正係供樓、養家、供書最重嘅時候。21–40 歲都已經佔 ${fmt.p(pct(ci.male[1] + ci.female[1], ci.n), 0)}。`, "", CATS[2].color);
    const cancerShare = causePct(ci, "癌症");
    keyFact("kf-causes", "4 宗有 3 宗",
      `<b>危疾 ${fmt.p(cancerShare, 0)} 係癌症</b>，身故都有 ${fmt.p(causePct(de, "癌症"), 0)}。癌症入面最多係乳癌，其次係肺癌同甲狀腺癌。`,
      picto(4, 3, C.ci, "#d9d4f5", BLOCK) + `<span class="picto-cap"><i style="background:${C.ci}"></i>癌症</span>`, C.ci);
    keyFact("kf-amount", `${Math.round(ci.max / ci.avg)} 倍`,
      `<b>最高一宗危疾 ${fmt.wan(ci.max)}，係平均 ${fmt.wan(ci.avg)} 嘅 ${Math.round(ci.max / ci.avg)} 倍。</b>分別唔係病重唔重，而係<b>當初買咗幾多保額</b>：危疾一筆過賠，買幾多就賠幾多。`, "", CATS[2].color);
    const drug = D.inflation.drugs[0][2];
    keyFact("kf-inflation", fmt.wan(drug),
      `<b>一年肝癌標靶藥嘅藥費</b>，等於 ${(drug / ci.avg).toFixed(1)} 個平均危疾賠償。私家外科醫生收費 7 年升 20–50%，私家醫院病房費亦普遍升一至五成。`);
    const br = D.hk.survival.find((r) => r[0] === "女性乳腺")[1];
    keyFact("kf-cancer", `${Math.round(br[0])}% → ${Math.round(br[3])}%`,
      `<b>女性乳癌：第一期五年存活率 ${br[0]}%，第四期得 ${br[3]}%。</b>早發現、早治療，結果差好遠；治療期亦長，要預足醫療同收入保障。`, "", C.female);
  }

  /* ---------- 01 trend ---------- */
  function renderTrend() {
    const mode = state.trend;
    const base = YEARS[0];
    let datasets, yTitle;
    if (mode === "amount") {
      datasets = CATS.map((c) => ({
        label: c.name, data: YEARS.map((y) => D.summary[y][c.key].amt),
        backgroundColor: c.color, borderColor: "#ffffff", borderWidth: { top: 2 }, borderSkipped: false,
        borderRadius: 4, stack: "a", maxBarThickness: 56
      }));
      yTitle = "億港元";
    } else {
      datasets = CATS.map((c) => ({
        label: c.name, type: "line",
        data: YEARS.map((y) => +(pct(D.summary[y][c.key].amt - D.summary[base][c.key].amt, D.summary[base][c.key].amt)).toFixed(0)),
        borderColor: c.color, backgroundColor: c.color, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.25
      }));
      yTitle = "對比 2019 年";
    }
    const opts = baseOpts();
    opts.scales.y.title = { display: true, text: yTitle, color: C.muted };
    if (mode !== "amount") opts.scales.y.ticks.callback = (v) => (v > 0 ? "+" : "") + v + "%";
    if (mode === "amount") { opts.scales.x.stacked = true; opts.scales.y.stacked = true; opts.scales.y.beginAtZero = true; }
    opts.plugins.tooltip.callbacks = {
      label: (ctx) => mode === "amount" ? ` ${ctx.dataset.label}：${fmt.yi(ctx.parsed.y)} 億` : ` ${ctx.dataset.label}：${ctx.parsed.y > 0 ? "+" : ""}${ctx.parsed.y}%`,
      footer: (items) => mode === "amount" ? `四類合計：${fmt.yi(sum(items.map((i) => i.parsed.y)))} 億（公布總額${D.summary[YEARS[items[0].dataIndex]].totalWord} ${D.summary[YEARS[items[0].dataIndex]].total} 億）` : ""
    };
    draw("trendChart", { type: mode === "amount" ? "bar" : "line", data: { labels: YEARS, datasets }, options: opts });

    const g = (k) => Math.round(pct(D.summary[LATEST][k].amt - D.summary[base][k].amt, D.summary[base][k].amt));
    $("trendNote").innerHTML = `2019 → 2025：住院 <b>+${g("hospital")}%</b>、危疾 <b>+${g("critical")}%</b>、身故 <b>+${g("death")}%</b>、意外 <b>+${g("accident")}%</b>。危疾同住院升得最快，即係「病」嘅開支比「意外」同「身故」升得更急。`;

    $("trendTable").innerHTML = `<table class="data-table"><thead><tr><th>年份</th><th>公布總額</th>${CATS.map((c) => `<th>${c.name}（億）</th>`).join("")}<th>四類成功宗數</th></tr></thead><tbody>${
      YEARS.map((y) => `<tr><td>${y}</td><td>${D.summary[y].totalWord} ${D.summary[y].total} 億</td>${CATS.map((c) => `<td>${fmt.yi(D.summary[y][c.key].amt)}</td>`).join("")}<td>${fmt.num(catSum(y, "cases"))}</td></tr>`).join("")
    }</tbody></table><p class="chart-note">宗數為報告「超過／接近」數字加總；2019–2021 年身故／危疾以保單計。</p>`;
  }

  /* ---------- 02 mix ---------- */
  function renderMix() {
    const y = state.summaryYear, s = D.summary[y];
    const tc = catSum(y, "cases"), ta = catSum(y, "amt");
    const stack = (field, total) => `<div class="stack">${CATS.map((c) => {
      const v = pct(s[c.key][field], total);
      return `<i title="${c.name} ${fmt.p(v)}" style="width:${v}%;background:${c.color}"></i>`;
    }).join("")}</div>`;
    $("shareRows").innerHTML = `
      <div class="share-row"><div class="lab"><span>成功宗數</span><span class="num">${fmt.num(tc)} 宗</span></div>${stack("cases", tc)}</div>
      <div class="share-row"><div class="lab"><span>賠償金額</span><span class="num">${fmt.yi(ta)} 億</span></div>${stack("amt", ta)}</div>
      <div class="legend">${CATS.map((c) => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join("")}</div>
      <table class="share-table"><thead><tr><th>${y} 年</th><th>宗數</th><th>佔宗數</th><th>金額（億）</th><th>佔金額</th></tr></thead><tbody>
      ${CATS.map((c) => `<tr><td><span class="dot" style="background:${c.color}"></span>${c.name}</td><td>${fmt.num(s[c.key].cases)}</td><td>${fmt.p(pct(s[c.key].cases, tc))}</td><td>${fmt.yi(s[c.key].amt)}</td><td>${fmt.p(pct(s[c.key].amt, ta))}</td></tr>`).join("")}
      </tbody></table>`;

    const per = CATS.map((c) => {
      let v;
      if (c.key === "death") v = D.death[y].avg;
      else if (c.key === "critical") v = D.critical[y].avg;
      else v = (s[c.key].amt * 1e8) / s[c.key].cases;
      return [c, v];
    });
    const max = Math.max(...per.map((p) => p[1]));
    $("perCase").innerHTML = per.map(([c, v]) => `<div class="pc-row"><span>${c.name}</span><span class="pc-track"><i style="width:${(v / max) * 100}%;background:${c.color}"></i></span><span class="pc-val">${fmt.money(v)}</span></div>`).join("")
      + `<p class="chart-note">${y} 年：一宗危疾平均賠 ${fmt.wan(per[2][1])}，大約等於 ${Math.round(per[2][1] / per[0][1])} 宗住院。</p>`;
  }

  function renderRates() {
    const ys = YEARS.filter((y) => D.summary[y].hospital.rate != null);
    const opts = baseOpts();
    opts.scales.y.min = 80; opts.scales.y.max = 100;
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${ctx.parsed.y}%` };
    draw("rateChart", {
      type: "line",
      data: { labels: ys, datasets: CATS.map((c) => ({ label: c.name, data: ys.map((y) => D.summary[y][c.key].rate), borderColor: c.color, backgroundColor: c.color, borderWidth: 2, pointRadius: 4, tension: 0.2 })) },
      options: opts
    });
  }


  function renderCounts() {
    const box = $("countMultiples");
    box.innerHTML = CATS.map((c) => {
      const first = D.summary[YEARS[0]][c.key].cases, last = D.summary[LATEST][c.key].cases;
      return `<div class="mult"><div class="mult-h"><span><i style="background:${c.color}"></i>${c.name}</span><b class="chg up" style="color:${c.color}">+${Math.round(pct(last - first, first))}%</b></div>
        <div class="mult-v num">${fmt.num(first)} → <b>${fmt.num(last)}</b> 宗</div>
        <div class="chart-box mini"><canvas id="cnt-${c.key}" aria-label="${c.name}每年成功獲賠宗數"></canvas></div></div>`;
    }).join("");
    CATS.forEach((c) => {
      const opts = baseOpts();
      opts.plugins.legend.display = false;
      opts.scales.y.beginAtZero = true;
      opts.scales.y.ticks.maxTicksLimit = 4;
      opts.scales.y.ticks.callback = (v) => v >= 1000 ? v / 1000 + "k" : v;
      opts.scales.x.ticks.callback = function (v) { return String(this.getLabelForValue(v)).slice(2); };
      opts.plugins.tooltip.callbacks = { title: (it) => it[0].label + " 年", label: (ctx) => ` ${c.name}：${fmt.num(ctx.parsed.y)} 宗` };
      draw("cnt-" + c.key, { type: "bar", data: { labels: YEARS, datasets: [{ label: c.name, data: YEARS.map((y) => D.summary[y][c.key].cases), backgroundColor: c.color, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 26 }] }, options: opts });
    });
  }

  function renderRateBars() {
    const ys = YEARS.filter((y) => D.summary[y].hospital.rate != null);
    const ly = ys[ys.length - 1];
    $("rateBars").innerHTML = CATS.map((c) => {
      const v = D.summary[ly][c.key].rate;
      const all = ys.map((y) => D.summary[y][c.key].rate);
      return `<div class="rate-row"><span class="rate-n"><i style="background:${c.color}"></i>${c.name}</span>
        <span class="rate-track"><i style="width:${v}%;background:${c.color}"></i></span>
        <span class="rate-v"><b>${Math.round(v)}</b> / 100</span>
        <span class="rate-r">七年 ${Math.min(...all).toFixed(1)}–${Math.max(...all).toFixed(1)}%</span></div>`;
    }).join("");
  }

  function bindRateToggle() {
    const det = $("rateChart").closest("details");
    det.addEventListener("toggle", () => { if (det.open) renderRates(); });
  }

  /* ---------- 03 gender ---------- */
  function renderGenderShare() {
    const opts = baseOpts();
    opts.scales.y.min = 30; opts.scales.y.max = 75;
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${ctx.parsed.y.toFixed(1)}%` };
    draw("genderShareChart", {
      type: "line",
      data: {
        labels: YEARS,
        datasets: [
          { label: "危疾賠償 女性佔比", data: YEARS.map((y) => femaleShare(D.critical[y])), borderColor: C.female, backgroundColor: C.female, borderWidth: 2, pointRadius: 4, tension: 0.2 },
          { label: "身故賠償 女性佔比", data: YEARS.map((y) => femaleShare(D.death[y])), borderColor: C.male, backgroundColor: C.male, borderWidth: 2, pointRadius: 4, tension: 0.2, borderDash: [5, 4] },
          { label: "一半（50%）", data: YEARS.map(() => 50), borderColor: "#b9b4a9", backgroundColor: "#b9b4a9", borderWidth: 1, pointRadius: 0, borderDash: [2, 3] }
        ]
      },
      options: opts
    });
  }

  function renderGenderAge() {
    const y = state.detailYear, t = state.gType;
    const obj = t === "critical" ? D.critical[y] : D.death[y];
    let labels = D.ageGroups.slice(), male = obj.male.slice(), female = obj.female.slice();
    if (t === "critical" && male[4] + female[4] < 5) { labels.pop(); male.pop(); female.pop(); }
    const opts = baseOpts();
    opts.scales.y.title = { display: true, text: `宗數（${obj.unit}）`, color: C.muted };
    opts.scales.x.title = { display: true, text: "年齡", color: C.muted };
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${fmt.num(ctx.parsed.y)}` };
    const ds = (label, data, color) => ({ label, data, backgroundColor: color, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 34, categoryPercentage: 0.7, barPercentage: 0.9 });
    draw("genderAgeChart", { type: "bar", data: { labels, datasets: [ds("男", male, C.male), ds("女", female, C.female)] }, options: opts });

    const f = sum(obj.female), m = sum(obj.male);
    let note;
    if (t === "critical") {
      const r = obj.female[1] / Math.max(1, obj.male[1]);
      note = `${y} 年危疾：女性 ${fmt.num(f)}、男性 ${fmt.num(m)}（女性佔 ${fmt.p(pct(f, f + m), 0)}）。21–40 歲女性係男性嘅 ${r.toFixed(1)} 倍，後生女性都唔可以忽略危疾保障。`;
    } else {
      note = `${y} 年身故：男性 ${fmt.num(m)}、女性 ${fmt.num(f)}（男性佔 ${fmt.p(pct(m, f + m), 0)}）。61–80 歲男性明顯較多；80 歲以上就女性較多，反映女性較長壽。`;
    }
    $("genderNote").textContent = note;
  }

  function renderHkCancer() {
    const g = D.hk.cancerByGender2023;
    $("hkCancerGender").innerHTML = `
      <div><p class="sub-h">男性 首 5 位</p>${bars(g.male, C.male, { valueFn: (x) => fmt.num(x[1]) + " 宗" })}</div>
      <div><p class="sub-h">女性 首 5 位</p>${bars(g.female, C.female, { valueFn: (x) => fmt.num(x[1]) + " 宗" })}</div>`;
  }

  /* ---------- 04 age ---------- */
  function renderAge() {
    const y = state.detailYear, ci = D.critical[y], de = D.death[y];
    const dist = (o) => D.ageGroups.map((_, i) => pct(o.male[i] + o.female[i], o.n));
    const opts = baseOpts();
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.scales.x.title = { display: true, text: "年齡", color: C.muted };
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${ctx.parsed.y.toFixed(1)}%` };
    const ds = (label, data, color) => ({ label, data, backgroundColor: color, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 34, categoryPercentage: 0.7, barPercentage: 0.9 });
    draw("ageChart", { type: "bar", data: { labels: D.ageGroups, datasets: [ds("危疾", dist(ci), C.ci), ds("身故", dist(de), C.death)] }, options: opts });

    const ageTxt = (o) => o.avgAge ? `平均 ${o.avgAge} 歲` : `最多 ${o.peakAge}`;
    $("ageStats").innerHTML = [
      ["危疾索賠年齡", ageTxt(ci)],
      ["危疾 41–60 歲", fmt.p(dist(ci)[2], 0)],
      ["身故索賠年齡", ageTxt(de)]
    ].map((x) => `<div class="ms"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");

    const ay = D.critical[y].ageByDisease ? y : LATEST;
    const abd = D.critical[ay].ageByDisease;
    const names = Object.keys(abd);
    const ramp = ["#e4e0f8", "#b3a9ee", "#8274e0", "#6250d6", "#3a2c94"];
    const opts2 = baseOpts({ indexAxis: "y" });
    opts2.scales.x.stacked = true; opts2.scales.y.stacked = true;
    opts2.scales.x.max = 100; opts2.scales.x.grid = { color: C.grid }; opts2.scales.x.ticks = { callback: (v) => v + "%", color: C.muted };
    opts2.scales.y.grid = { display: false };
    opts2.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label} 歲：${ctx.parsed.x}%` };
    opts2.plugins.tooltip.filter = (item) => item.parsed.x > 0;
    draw("ageDiseaseChart", {
      type: "bar",
      data: { labels: names, datasets: D.ageGroups.map((g, i) => ({ label: g, data: names.map((n) => abd[n][i]), backgroundColor: ramp[i], borderColor: "#fff", borderWidth: { right: 2 }, borderSkipped: false, maxBarThickness: 40 })).filter((d) => sum(d.data) > 0) },
      options: opts2
    });
    $("ageDiseaseNote").textContent = (ay !== y ? `報告由 2024 年先有呢項分析，以下顯示 ${ay} 年。` : `${ay} 年：`) +
      `癌症、心臟病、腦血管病都係 41–60 歲最多，大約佔六成；心臟病同中風喺 61–80 歲亦佔三成左右。`;
  }

  /* ---------- 05 causes ---------- */
  function renderCauses() {
    const y = state.detailYear, ci = D.critical[y], de = D.death[y];
    $("ciCauses").innerHTML = bars(ci.causes, (x, i) => i < 3 ? C.ci : "#b3a9ee", { total: ci.n, highlight: 3 });
    $("ciCancers").innerHTML = ci.cancers
      ? `<p class="sub-h">癌症個案入面首 5 位（${y} 年）</p>` + bars(ci.cancers, (x, i) => i === 0 ? C.female : C.ci, { total: ci.causes[0][1] })
      : `<p class="chart-note">報告由 2023 年起先公布危疾癌症首 5 位（2025 年：乳癌 29%、肺癌 11%、甲狀腺癌 9%）。</p>`;
    $("deathCauses").innerHTML = bars(de.causes, (x, i) => i < 3 ? C.death : "#f5b799", { total: de.n, highlight: 3 }) +
      `<p class="chart-note">癌症、肺部疾病、心臟疾病年年都係身故首三位，合共約七成。</p>`;
  }

  function renderCauseTrend() {
    const big3 = (o) => causePct(o, "癌症") + causePct(o, "心臟疾病") + causePct(o, "腦血管疾病");
    const opts = baseOpts();
    opts.scales.y.min = 30; opts.scales.y.max = 100;
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${ctx.parsed.y.toFixed(1)}%` };
    draw("causeTrendChart", {
      type: "line",
      data: {
        labels: YEARS,
        datasets: [
          { label: "三大危疾佔危疾", data: YEARS.map((y) => big3(D.critical[y])), borderColor: "#9b8fe6", backgroundColor: "#9b8fe6", borderDash: [5, 4], borderWidth: 2, pointRadius: 4 },
          { label: "癌症佔危疾", data: YEARS.map((y) => causePct(D.critical[y], "癌症")), borderColor: C.ci, backgroundColor: C.ci, borderWidth: 2, pointRadius: 4 },
          { label: "癌症佔身故", data: YEARS.map((y) => causePct(D.death[y], "癌症")), borderColor: C.death, backgroundColor: C.death, borderWidth: 2, pointRadius: 4 }
        ]
      },
      options: opts
    });
  }

  /* ---------- 06 amount ---------- */
  function renderAmount() {
    const y = state.detailYear, ci = D.critical[y], de = D.death[y];
    const bandList = (o) => D.bandLabels.map((l, i) => [l, o.bands[i]]);
    const col = (base, hi) => (x, i) => i >= 3 ? hi : base;
    $("ciBands").innerHTML = bars(bandList(ci), col("#b3a9ee", C.ci), { total: ci.n });
    $("deathBands").innerHTML = bars(bandList(de), col("#f5b799", C.death), { total: de.n });

    const opts = baseOpts();
    opts.scales.y.beginAtZero = true;
    opts.scales.y.ticks.callback = (v) => v / 1e4 + "萬";
    opts.scales.y.title = { display: true, text: "港元", color: C.muted };
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${fmt.money(ctx.parsed.y)}` };
    draw("ciMaxChart", {
      type: "bar",
      data: {
        labels: YEARS,
        datasets: [
          { type: "bar", label: "最高一宗", data: YEARS.map((yy) => D.critical[yy].max), backgroundColor: "#b3a9ee", borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 40, order: 2 },
          { type: "line", label: "平均每宗", data: YEARS.map((yy) => D.critical[yy].avg), borderColor: C.ci, backgroundColor: C.ci, borderWidth: 2, pointRadius: 4, order: 1 }
        ]
      },
      options: opts
    });
    const over = (o, from) => pct(sum(o.bands.slice(from)), o.n);
    $("amountStats").innerHTML = [
      [`${y} 危疾 >$75萬`, fmt.p(over(ci, 3), 0)],
      [`${y} 身故 >$100萬`, fmt.p(over(de, 4), 0)],
      [`${y} 最高身故`, fmt.wan(de.max)]
    ].map((x) => `<div class="ms"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
  }

  function renderDetail() { renderGenderAge(); renderAge(); renderCauses(); renderAmount(); }

  /* ---------- 07 inflation ---------- */
  function renderInflation() {
    const I = D.inflation;
    const rooms = ["私家房", "半私家房", "標準房"];
    const cols = ["#2a78d6", "#eb6834", "#1baf7a"];
    const opts = baseOpts();
    opts.scales.y.ticks.callback = (v) => "$" + v / 1000 + "k";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${fmt.money(ctx.parsed.y)}` };
    draw("surgeonChart", {
      type: "line",
      data: { labels: I.surgeonMean.years.map(String), datasets: rooms.map((r, i) => ({ label: r, data: I.surgeonMean[r], borderColor: cols[i], backgroundColor: cols[i], borderWidth: 2, pointRadius: 5, tension: 0.15 })) },
      options: opts
    });

    const maxFee = Math.max(...I.doctorFees.map((d) => d[2]));
    $("doctorFees").innerHTML = I.doctorFees.map((d) => `
      <div class="pc-row" style="grid-template-columns:7.5rem 1fr 5rem">
        <span>${d[0]}</span>
        <span>
          <span class="pc-track" style="display:block;height:8px;margin-bottom:4px"><i style="width:${(d[1] / maxFee) * 100}%;background:${C.old}"></i></span>
          <span class="pc-track" style="display:block;height:8px"><i style="width:${(d[2] / maxFee) * 100}%;background:${C.accent}"></i></span>
        </span>
        <span class="pc-val">${fmt.chg(d[2], d[1])}</span>
      </div>
      <div style="font-size:12px;color:${C.muted};margin:-8px 0 6px 0" class="num">${fmt.money(d[1])} → <b style="color:#14213d">${fmt.money(d[2])}</b></div>`).join("")
      + `<div class="legend"><span><i style="background:${C.old}"></i>2018</span><span><i style="background:${C.accent}"></i>2025</span></div>`;

    renderSurgery();

    $("roomTable").innerHTML = `<table class="data-table"><thead><tr><th>醫院</th><th>半私家 2019</th><th>半私家 2026</th><th>升幅</th><th>普通房 2019</th><th>普通房 2026</th><th>升幅</th></tr></thead><tbody>${
      I.rooms.map((r) => `<tr><td>${r.name}</td><td>$${r.semi[0]}</td><td>$${r.semi[1]}</td><td>${fmt.chg(r.semiMid[1], r.semiMid[0])}</td><td>$${r.ward[0]}</td><td>$${r.ward[1]}</td><td>${fmt.chg(r.wardMid[1], r.wardMid[0])}</td></tr>`).join("")
    }</tbody></table>`;

    const rangeBars = (list, color, fmtFn) => {
      const max = Math.max(...list.map((x) => x[2]));
      return `<div class="bars wide">${list.map((x) => `<div class="bar-row">
        <span class="bar-name">${x[0]}</span>
        <span class="bar-track" style="position:relative"><i style="width:${(x[2] / max) * 100}%;background:${color};opacity:.35;position:absolute"></i><i style="width:${(x[1] / max) * 100}%;background:${color};position:absolute"></i></span>
        <span class="bar-val">${x[1] === x[2] ? fmtFn(x[1]) : fmtFn(x[1]) + "–" + fmtFn(x[2])}</span></div>`).join("")}</div>`;
    };
    $("complexList").innerHTML = rangeBars(I.complex, C.accent, fmt.wan) + `<div class="legend" style="margin-top:10px"><span><i style="background:${C.accent}"></i>Level 1</span><span><i style="background:${C.accent};opacity:.35"></i>最高到 Level 3</span></div>`;
    $("drugList").innerHTML = rangeBars(I.drugs, C.ci, fmt.wan);
  }

  function renderSurgery() {
    const r = state.room;
    const rows = D.inflation.surgeries.map((s) => ({ ...s, chg: pct(s.y2022[r] - s.y2018[r], s.y2018[r]) })).sort((a, b) => b.chg - a.chg);
    $("surgeryTable").innerHTML = `<table class="data-table"><thead><tr><th>手術</th><th>2018 中位數</th><th>2022 中位數</th><th>升幅</th></tr></thead><tbody>${
      rows.map((s) => `<tr><td>${s.name}</td><td>${fmt.money(s.y2018[r])}</td><td>${fmt.money(s.y2022[r])}</td><td>${fmt.chg(s.y2022[r], s.y2018[r])}</td></tr>`).join("")
    }</tbody></table>`;
  }

  /* ---------- 08 cancer ---------- */
  function renderCancer() {
    const cls = (v) => v >= 80 ? "ok" : v >= 50 ? "mid" : "bad";
    $("survivalTable").innerHTML = `<table class="data-table" style="min-width:420px"><thead><tr><th>癌症</th><th>第一期</th><th>第二期</th><th>第三期</th><th>第四期</th></tr></thead><tbody>${
      D.hk.survival.map((r) => `<tr><td>${r[0]}</td>${r[1].map((v) => `<td><span class="pill ${cls(v)}">${v.toFixed(1)}%</span></td>`).join("")}</tr>`).join("")
    }</tbody></table><div class="legend" style="margin-top:10px"><span><i style="background:#dcefe3"></i>80% 或以上</span><span><i style="background:#f8ebc9"></i>50–80%</span><span><i style="background:#f6d9d4"></i>低於 50%</span></div>`;
    $("recurrence").innerHTML = D.hk.recurrence.map((r) => `<div class="rec"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");
  }

  /* ---------- 09 check ---------- */
  function val(id) { const n = Number($(id).value); return Number.isFinite(n) && n > 0 ? n : 0; }
  function ckRow(label, v, max, color) {
    return `<div class="ck-row"><span>${label}</span><span class="n">${fmt.wan(v)}</span><span class="t"><i style="width:${Math.min(100, max ? (v / max) * 100 : 0)}%;background:${color}"></i></span></div>`;
  }
  function verdict(have, need, okTxt) {
    if (!need) return `<p class="verdict warn">請輸入資料</p>`;
    const r = have / need;
    if (r >= 1) return `<p class="verdict ok">${okTxt}</p>`;
    if (r >= 0.7) return `<p class="verdict warn">接近，仲差約 ${fmt.wan(need - have)}</p>`;
    return `<p class="verdict bad">缺口約 ${fmt.wan(need - have)}</p>`;
  }
  function renderCheck() {
    const exp = val("inExpense"), yrs = val("inYears"), debt = val("inDebt"), sav = val("inSaving"), life = val("inLife");
    const inc = val("inIncome"), ci = val("inCi"), medType = $("inMedType").value, med = val("inMed");
    $("medLimitField").style.display = medType === "limit" ? "" : "none";
    const ld = D.death[LATEST], cd = D.critical[LATEST];
    const lifeNeed = exp * 12 * yrs + debt;
    const lifeHave = life + sav;
    const lMax = Math.max(lifeNeed, lifeHave, ld.avg, 1);
    const ciLow = inc * 3, ciHigh = inc * 5;
    const drug = D.inflation.drugs[0][2];
    const cMax = Math.max(ciHigh, ci, drug, 1);
    const complexTop = D.inflation.complex[0][2];
    const medHave = medType === "full" ? drug : medType === "limit" ? med : 0;
    const mMax = Math.max(drug, medHave, 1);
    let medVerdict;
    if (medType === "none") medVerdict = `<p class="verdict bad">冇個人醫保：住院、手術要自己俾或者靠公立醫院輪候</p>`;
    else if (medType === "full") medVerdict = `<p class="verdict ok">全數賠償類型，大額住院較有保障</p><p class="hint">記得睇清楚門診癌症治療、標靶藥有冇包，同埋有冇終身或每年上限。</p>`;
    else if (med >= drug) medVerdict = `<p class="verdict ok">年限額足夠應付一年標靶藥</p>`;
    else if (med >= complexTop) medVerdict = `<p class="verdict warn">夠一次大型手術，但未必夠一年標靶藥</p>`;
    else medVerdict = `<p class="verdict bad">年限額低過一次複雜大手術（${fmt.wan(complexTop)}）</p>`;

    $("checkResults").innerHTML = `
      <div class="ck">
        <h4>人壽／身故</h4>
        <p class="sub">家庭開支 × ${yrs} 年 ＋ 債務</p>
        ${ckRow("你現有（保額＋儲蓄）", lifeHave, lMax, C.male)}
        ${ckRow("估計需要", lifeNeed, lMax, C.accent)}
        ${ckRow(`${LATEST} 平均身故賠償`, ld.avg, lMax, C.old)}
        ${verdict(lifeHave, lifeNeed, "現有保障足夠應付估算需要")}
        <p class="hint">${LATEST} 年身故平均只賠 ${fmt.wan(ld.avg)}，但有 ${fmt.p(pct(ld.bands[4], ld.n), 0)} 個案超過 $100 萬。</p>
      </div>
      <div class="ck">
        <h4>危疾</h4>
        <p class="sub">年收入 3–5 倍（停工＋治療）</p>
        ${ckRow("你現有危疾保額", ci, cMax, C.male)}
        ${ckRow("建議下限（3 倍）", ciLow, cMax, C.accent)}
        ${ckRow("建議上限（5 倍）", ciHigh, cMax, C.accent)}
        ${ckRow(`${LATEST} 平均危疾賠償`, cd.avg, cMax, C.old)}
        ${ckRow("肝癌標靶藥一年", drug, cMax, C.ci)}
        ${verdict(ci, ciLow, "達到建議下限")}
        <p class="hint">癌症有機會復發（乳癌約 30%），檢查下保單有冇多次賠償。</p>
      </div>
      <div class="ck">
        <h4>住院／醫療</h4>
        <p class="sub">對照大型手術同標靶藥開支</p>
        ${medType === "limit" ? ckRow("你嘅每年限額", med, mMax, C.male) : medType === "none" ? ckRow("你嘅醫療保障", 0, mMax, C.male) : ""}
        ${ckRow("肝葉切除（Level 3）", complexTop, mMax, C.accent)}
        ${ckRow("肝癌標靶藥一年", drug, mMax, C.ci)}
        ${medVerdict}
      </div>`;
  }

  /* ---------- 10 next / footer ---------- */
  function renderNext() {
    const q = [
      ["我嘅危疾保單賠幾多次？", "癌症、心臟病、中風都有機會復發。如果只賠一次，第二次出事就要靠自己。"],
      ["醫療保險有冇全數賠償，或者夠高嘅每年限額？", "一次複雜手術可以去到 $86 萬，一年標靶藥可以超過 $180 萬。睇清楚門診癌症治療包唔包。"],
      ["人壽保額夠唔夠還按揭同養家？", "身故平均賠償只係 30 幾萬，對大部分家庭嚟講遠遠唔夠。"],
      ["投保時有冇如實申報健康狀況？", "危疾每 100 宗申請約有 85–89 宗獲賠，係四類之中最低。如實申報、清楚定義，可以減低日後爭議。"],
      ["上一次檢視保障係幾時？", "手術費、病房費年年升，保額買咗幾年可能已經追唔上。建議每 1–2 年檢視一次。"]
    ];
    $("questions").innerHTML = q.map((x) => `<li><b>${x[0]}</b><span>${x[1]}</span></li>`).join("");
    $("sourceList").innerHTML = D.sources.map((s) => `<li>${s}</li>`).join("");
    $("footMeta").textContent = `最後更新：${D.meta.updated} · 數據年份 ${YEARS[0]}–${LATEST}`;
    $("copyright").textContent = `© ${new Date().getFullYear()} Michael Koo Protection Alliance (MKPA). 版權所有。`;
    const ct = D.meta.contact || {};
    let html = `<strong>想詳細睇吓自己嘅保障？</strong><p>同 ${ct.name || "你嘅顧問"} 約個時間，一齊對照呢份數據檢視保單。</p>`;
    if (ct.phone) html += `<p>${ct.name}　電話／WhatsApp：<b style="color:#fff">${ct.phone}</b></p>`;
    if (ct.whatsapp) html += `<div class="contact"><a href="https://wa.me/${ct.whatsapp}?text=${encodeURIComponent("你好，我睇咗理賠數據報告，想檢視吓自己嘅保障。")}" target="_blank" rel="noopener">WhatsApp 預約</a></div>`;
    html += `<p style="margin-top:10px"><a href="print.html" style="color:#fff">下載／列印 A4 版報告 →</a></p>`;
    if (ct.email) html += `<p><a href="mailto:${ct.email}">${ct.email}</a></p>`;
    $("contactBox").innerHTML = html;
  }

  /* ---------- nav ---------- */
  function bindNav() {
    const links = [...document.querySelectorAll(".nav-links a")];
    const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            const a = map.get(e.target.id);
            if (a) {
              a.classList.add("active");
              const nav = a.parentElement;
              if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
            }
          }
        });
      }, { rootMargin: "-40% 0px -55% 0px" });
      map.forEach((_, id) => { const el = $(id); if (el) io.observe(el); });
    }
  }

  function bindControls() {
    document.querySelectorAll("[data-trend]").forEach((b) => b.addEventListener("click", () => {
      state.trend = b.dataset.trend;
      document.querySelectorAll("[data-trend]").forEach((x) => x.classList.toggle("on", x === b));
      renderTrend();
    }));
    document.querySelectorAll("[data-gtype]").forEach((b) => b.addEventListener("click", () => {
      state.gType = b.dataset.gtype;
      document.querySelectorAll("[data-gtype]").forEach((x) => x.classList.toggle("on", x === b));
      renderGenderAge();
    }));
    document.querySelectorAll("[data-room]").forEach((b) => b.addEventListener("click", () => {
      state.room = Number(b.dataset.room);
      document.querySelectorAll("[data-room]").forEach((x) => x.classList.toggle("on", x === b));
      renderSurgery();
    }));
    ["inExpense", "inYears", "inDebt", "inSaving", "inLife", "inIncome", "inCi", "inMed", "inMedType"].forEach((id) => {
      $(id).addEventListener("input", renderCheck);
      $(id).addEventListener("change", renderCheck);
    });
    window.addEventListener("beforeprint", () => Object.values(charts).forEach((c) => c.resize()));
  }

  function init() {
    if (window.Chart) {
      Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "sans-serif";
      Chart.defaults.font.size = 13;
      Chart.defaults.animation.duration = 500;
      Chart.defaults.color = C.ink2;
    }
    renderHero();
    renderKeyFacts();
    countUp();
    renderYearPicks();
    if (window.Chart) {
      renderTrend(); renderCounts(); renderRateBars(); bindRateToggle(); renderGenderShare(); renderCauseTrend();
    }
    renderMix();
    renderHkCancer();
    if (window.Chart) renderDetail(); else { renderCauses(); }
    if (window.Chart) renderInflation();
    renderCancer();
    renderCheck();
    renderNext();
    bindControls();
    bindNav();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
