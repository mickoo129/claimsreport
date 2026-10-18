/* global Chart */
(function () {
  "use strict";
  const D = window.CLAIMS;
  const YEARS = D.meta.years;
  const LATEST = D.meta.latest;
  const CATS = [
    { key: "hospital", name: "住院", long: "醫療／住院", color: "#2a78d6", soft: "#a9c8f0", anchor: "#medical" },
    { key: "death", name: "身故", long: "人壽／身故", color: "#eb6834", soft: "#f5b799", anchor: "#life" },
    { key: "critical", name: "危疾", long: "危疾", color: "#6250d6", soft: "#b3a9ee", anchor: "#critical" },
    { key: "accident", name: "意外", long: "意外", color: "#1baf7a", soft: "#9fdcc4", anchor: "#accident" }
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));
  const C = { male: "#2a78d6", female: "#e34948", grid: "#ebe7de", ink2: "#4a5468", muted: "#7a8193", old: "#c4c0b6", accent: "#b5502a" };
  const state = { summaryYear: LATEST, critical: LATEST, death: LATEST, trend: "amount", room: 1 };
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
  const growth = (a, b) => Math.round(pct(a - b, b));
  const catSum = (y, field) => sum(CATS.map((c) => D.summary[y][c.key][field]));
  const femaleShare = (obj) => pct(sum(obj.female), sum(obj.female) + sum(obj.male));
  const causePct = (obj, name) => { const h = obj.causes.find((c) => c[0] === name); return h ? pct(h[1], obj.n) : 0; };

  function draw(id, config) {
    if (charts[id]) charts[id].destroy();
    const el = $(id);
    if (!el || !window.Chart) return;
    charts[id] = new Chart(el, config);
  }

  function bars(list, color, opts = {}) {
    const total = opts.total || sum(list.map((x) => x[1]));
    const max = Math.max(...list.map((x) => x[2] || x[1]));
    const hl = opts.highlight || 0;
    return `<div class="bars${opts.wide ? " wide" : ""}">${list.map((x, i) => {
      const col = typeof color === "function" ? color(x, i) : color;
      const range = x[2] && x[2] !== x[1] ? `<i style="width:${(x[2] / max) * 100}%;background:${col};opacity:.35;position:absolute"></i>` : "";
      const val = opts.valueFn ? opts.valueFn(x) : `${fmt.num(x[1])}（${fmt.p(pct(x[1], total))}）`;
      return `<div class="bar-row${i < hl ? " hl" : ""}">
        <span class="bar-name">${x[0]}</span>
        <span class="bar-track" style="position:relative">${range}<i style="width:${(x[1] / max) * 100}%;background:${col};position:absolute"></i></span>
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
  const barDs = (label, data, color, extra = {}) => Object.assign({ label, data, backgroundColor: color, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 34, categoryPercentage: 0.7, barPercentage: 0.9 }, extra);
  const lineDs = (label, data, color, extra = {}) => Object.assign({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.2 }, extra);

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
  const picto = (n, filled, on, off, shape) => `<span class="picto" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<svg viewBox="0 0 24 24" fill="${i < filled ? on : off}">${shape}</svg>`).join("")}</span>`;
  function keyFact(id, big, text, extra = "", color = C.accent) {
    const el = $(id);
    if (el) el.innerHTML = `<div class="kf-big" style="color:${color}">${big}</div><div class="kf-text">${text}</div>${extra ? `<div class="kf-extra">${extra}</div>` : ""}`;
  }
  const cnt = (v, { pre = "", post = "", dec = 0 } = {}) =>
    `<span data-count="${v}" data-dec="${dec}" data-pre="${pre}" data-post="${post}">${pre}${dec ? Number(v).toFixed(dec) : Math.round(v).toLocaleString("en-US")}${post}</span>`;
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
  const card = (title, inner, cls = "") => `<div class="card ${cls}"><h4 class="card-h">${title}</h4>${inner}</div>`;
  const chartBox = (id, label, cls = "") => `<div class="chart-box ${cls}"><canvas id="${id}" aria-label="${label}"></canvas></div>`;
  const subTitle = (no, t) => `<h3 class="sub-title"><span>${no}</span>${t}</h3>`;
  const lead = (t) => `<p class="sub-lead">${t}</p>`;

  /* ---------- year pickers ---------- */
  function renderYearPicks() {
    document.querySelectorAll(".year-pick").forEach((box) => {
      const scope = box.dataset.scope;
      const cur = scope === "summary" ? state.summaryYear : state[scope];
      const label = box.dataset.label || "揀年份";
      box.innerHTML = `<span class="lbl">${label}</span>` + YEARS.map((y) =>
        `<button type="button" data-year="${y}" class="${y === cur ? "on" : ""}">${y}</button>`).join("");
      box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        const y = Number(b.dataset.year);
        if (scope === "summary") { state.summaryYear = y; renderMix(); }
        else { state[scope] = y; renderTypeDetail(scope); }
        renderYearPicks();
      }));
    });
  }

  /* ---------- hero ---------- */
  function renderHero() {
    const s = D.summary[LATEST], s0 = D.summary[YEARS[0]];
    const ci = D.critical[LATEST], de = D.death[LATEST];
    const days = 365;
    $("punch").innerHTML = `
      <div class="punch-big">每 ${cnt((days * 24 * 60) / s.cases, { dec: 1 })} 分鐘</div>
      <div class="punch-text">就有一宗理賠成功賠出。${LATEST} 年全年 <b>${fmt.num(s.cases)}</b> 宗，合共賠出超過 <b>${s.total} 億</b>。</div>`;
    const perDay = [
      [null, "每日賠出", cnt((s.total * 1e8) / days / 1e4, { pre: "$", post: "萬" }), C.accent, "全年 " + s.total + " 億 ÷ 365 日"],
      ["hospital", "醫療／住院", cnt(s.hospital.cases / days, { post: " 宗" }), CAT.hospital.color, "每日 →"],
      ["critical", "危疾", cnt(ci.n / days, { post: " 宗", dec: 1 }), CAT.critical.color, "每日約 " + Math.round(ci.n / days) + " 人 →"],
      ["death", "人壽／身故", cnt(de.n / days, { post: " 宗", dec: 1 }), CAT.death.color, "每日約 " + Math.round(de.n / days) + " 個家庭 →"],
      ["accident", "意外", cnt(s.accident.cases / days, { post: " 宗" }), CAT.accident.color, "每日 →"]
    ];
    $("perDay").innerHTML = `<div class="pd-title">${LATEST} 年，平均一日入面（撳一類睇詳情）：</div><div class="pd-grid">${perDay.map((x) => {
      const tag = x[0] ? "a" : "div";
      const href = x[0] ? ` href="${CAT[x[0]].anchor}"` : "";
      return `<${tag} class="pd"${href} style="--c:${x[3]}"><span class="pd-k"><i style="background:${x[3]}"></i>${x[1]}</span><b>${x[2]}</b><span class="pd-s">${x[4]}</span></${tag}>`;
    }).join("")}</div>`;
    const series = {
      total: YEARS.map((y) => D.summary[y].total),
      hosp: YEARS.map((y) => D.summary[y].hospital.cases),
      female: YEARS.map((y) => femaleShare(D.critical[y])),
      ciMax: YEARS.map((y) => D.critical[y].max)
    };
    $("heroStats").innerHTML = [
      ["四類總賠償", `${s.total}億+`, `${YEARS[0]} 年 ${s0.total} 億 → 升 ${growth(s.total, s0.total)}%`, series.total],
      ["醫療：住院賠償宗數", fmt.num(s.hospital.cases), `${YEARS[0]} 年 ${fmt.num(s0.hospital.cases)} → 升 ${growth(s.hospital.cases, s0.hospital.cases)}%`, series.hosp],
      ["危疾：女性佔比", fmt.p(femaleShare(ci), 0), `七年都企喺 63–68%`, series.female, [0, 100]],
      ["危疾：最高一宗", fmt.wan(ci.max), `${YEARS[0]} 年 ${fmt.wan(D.critical[YEARS[0]].max)}；平均只係 ${fmt.wan(ci.avg)}`, series.ciMax]
    ].map((x) => `<div class="hstat"><div class="k">${x[0]}<span class="yr">${YEARS[0]}–${LATEST}</span></div><div class="v">${x[1]}</div>${spark(x[3], "#f0b28f", x[4])}<div class="s">${x[2]}</div></div>`).join("");
  }

  /* ---------- Part 1: overview ---------- */
  function renderChapterPick() {
    $("chPick").innerHTML = CATS.map((c) => `<a class="chip" href="${c.anchor}" style="--c:${c.color}"><i></i>${c.long}</a>`).join("") + `<a class="chip" href="#check" style="--c:#14213d"><i></i>保障檢查</a>`;
  }

  function renderTrend() {
    const mode = state.trend, base = YEARS[0];
    let datasets;
    if (mode === "amount") {
      datasets = CATS.map((c) => ({ label: c.long, data: YEARS.map((y) => D.summary[y][c.key].amt), backgroundColor: c.color, borderColor: "#ffffff", borderWidth: { top: 2 }, borderSkipped: false, borderRadius: 4, stack: "a", maxBarThickness: 56 }));
    } else {
      datasets = CATS.map((c) => lineDs(c.long, YEARS.map((y) => growth(D.summary[y][c.key].amt, D.summary[base][c.key].amt)), c.color, { type: "line", tension: 0.25 }));
    }
    const opts = baseOpts();
    opts.scales.y.title = { display: true, text: mode === "amount" ? "億港元" : "對比 2019 年", color: C.muted };
    if (mode === "amount") { opts.scales.x.stacked = true; opts.scales.y.stacked = true; opts.scales.y.beginAtZero = true; }
    else opts.scales.y.ticks.callback = (v) => (v > 0 ? "+" : "") + v + "%";
    opts.plugins.tooltip.callbacks = {
      label: (ctx) => mode === "amount" ? ` ${ctx.dataset.label}：${fmt.yi(ctx.parsed.y)} 億` : ` ${ctx.dataset.label}：${ctx.parsed.y > 0 ? "+" : ""}${ctx.parsed.y}%`,
      footer: (items) => mode === "amount" ? `四類合計：${fmt.yi(sum(items.map((i) => i.parsed.y)))} 億` : ""
    };
    draw("trendChart", { type: mode === "amount" ? "bar" : "line", data: { labels: YEARS, datasets }, options: opts });
    const g = (k) => growth(D.summary[LATEST][k].amt, D.summary[base][k].amt);
    $("trendNote").innerHTML = `${base} → ${LATEST}：醫療／住院 <b>+${g("hospital")}%</b>、危疾 <b>+${g("critical")}%</b>、人壽／身故 <b>+${g("death")}%</b>、意外 <b>+${g("accident")}%</b>。`;
    $("trendTable").innerHTML = `<table class="data-table"><thead><tr><th>年份</th><th>公布總額</th>${CATS.map((c) => `<th>${c.long}（億）</th>`).join("")}</tr></thead><tbody>${
      YEARS.map((y) => `<tr><td>${y}</td><td>${D.summary[y].totalWord} ${D.summary[y].total} 億</td>${CATS.map((c) => `<td>${fmt.yi(D.summary[y][c.key].amt)}</td>`).join("")}</tr>`).join("")
    }</tbody></table>`;
  }

  function renderCounts() {
    $("countMultiples").innerHTML = CATS.map((c) => {
      const first = D.summary[YEARS[0]][c.key].cases, last = D.summary[LATEST][c.key].cases;
      return `<a class="mult" href="${c.anchor}" style="--c:${c.color}"><div class="mult-h"><span><i style="background:${c.color}"></i>${c.long}</span><b style="color:${c.color}">+${growth(last, first)}%</b></div>
        <div class="mult-v num">${fmt.num(first)} → <b>${fmt.num(last)}</b> 宗</div>
        <div class="chart-box mini"><canvas id="cnt-${c.key}" aria-label="${c.long}每年成功獲賠宗數"></canvas></div></a>`;
    }).join("");
    CATS.forEach((c) => drawYearBars("cnt-" + c.key, YEARS.map((y) => D.summary[y][c.key].cases), c, (v) => fmt.num(v) + " 宗", true));
  }

  function drawYearBars(id, data, c, tip, compact) {
    const opts = baseOpts();
    opts.plugins.legend.display = false;
    opts.scales.y.beginAtZero = true;
    opts.scales.y.ticks.maxTicksLimit = compact ? 4 : 6;
    opts.scales.y.ticks.callback = (v) => (v >= 1000 ? v / 1000 + "k" : v);
    if (compact) opts.scales.x.ticks.callback = function (v) { return String(this.getLabelForValue(v)).slice(2); };
    opts.plugins.tooltip.callbacks = { title: (it) => it[0].label + " 年", label: (ctx) => ` ${c.long}：${tip(ctx.parsed.y)}` };
    draw(id, { type: "bar", data: { labels: YEARS, datasets: [barDs(c.long, data, c.color, { maxBarThickness: compact ? 26 : 40 })] }, options: opts });
  }

  function renderMix() {
    const y = state.summaryYear, s = D.summary[y];
    const tc = catSum(y, "cases"), ta = catSum(y, "amt");
    const stack = (field, total) => `<div class="stack">${CATS.map((c) => `<i title="${c.long} ${fmt.p(pct(s[c.key][field], total))}" style="width:${pct(s[c.key][field], total)}%;background:${c.color}"></i>`).join("")}</div>`;
    $("shareRows").innerHTML = `
      <div class="share-row"><div class="lab"><span>成功宗數</span><span class="num">${fmt.num(tc)} 宗</span></div>${stack("cases", tc)}</div>
      <div class="share-row"><div class="lab"><span>賠償金額</span><span class="num">${fmt.yi(ta)} 億</span></div>${stack("amt", ta)}</div>
      <table class="share-table"><thead><tr><th>${y} 年</th><th>宗數</th><th>佔宗數</th><th>金額（億）</th><th>佔金額</th></tr></thead><tbody>
      ${CATS.map((c) => `<tr><td><span class="dot" style="background:${c.color}"></span>${c.long}</td><td>${fmt.num(s[c.key].cases)}</td><td>${fmt.p(pct(s[c.key].cases, tc))}</td><td>${fmt.yi(s[c.key].amt)}</td><td>${fmt.p(pct(s[c.key].amt, ta))}</td></tr>`).join("")}
      </tbody></table>
      <p class="chart-note">醫療宗數最多但每宗金額細；人壽同危疾宗數少，但每宗動輒幾十萬。</p>`;
    const per = CATS.map((c) => [c, c.key === "death" ? D.death[y].avg : c.key === "critical" ? D.critical[y].avg : (s[c.key].amt * 1e8) / s[c.key].cases]);
    const max = Math.max(...per.map((p) => p[1]));
    $("perCase").innerHTML = per.map(([c, v]) => `<div class="pc-row"><span>${c.long}</span><span class="pc-track"><i style="width:${(v / max) * 100}%;background:${c.color}"></i></span><span class="pc-val">${fmt.money(v)}</span></div>`).join("")
      + `<p class="chart-note">${y} 年：一宗危疾平均賠 ${fmt.wan(per[2][1])}，大約等於 ${Math.round(per[2][1] / per[0][1])} 宗住院。</p>`;
  }

  function rateYears() { return YEARS.filter((y) => D.summary[y].hospital.rate != null); }
  function renderRateBars() {
    const ys = rateYears(), ly = ys[ys.length - 1];
    $("rateBars").innerHTML = CATS.map((c) => {
      const v = D.summary[ly][c.key].rate, all = ys.map((y) => D.summary[y][c.key].rate);
      return `<div class="rate-row"><span class="rate-n"><i style="background:${c.color}"></i>${c.long}</span>
        <span class="rate-track"><i style="width:${v}%;background:${c.color}"></i></span>
        <span class="rate-v"><b>${Math.round(v)}</b> / 100</span>
        <span class="rate-r">七年 ${Math.min(...all).toFixed(1)}–${Math.max(...all).toFixed(1)}%</span></div>`;
    }).join("");
  }
  function renderRates() {
    const ys = rateYears();
    const opts = baseOpts();
    opts.scales.y.min = 80; opts.scales.y.max = 100;
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${ctx.parsed.y}%` };
    draw("rateChart", { type: "line", data: { labels: ys, datasets: CATS.map((c) => lineDs(c.long, ys.map((y) => D.summary[y][c.key].rate), c.color)) }, options: opts });
  }

  function renderOverviewFacts() {
    const s = D.summary[LATEST], s0 = D.summary[YEARS[0]];
    keyFact("kf-trend", `+${growth(s.total, s0.total)}%`,
      `<b>四類加埋，七年總賠款由 ${s0.total} 億升到 ${s.total} 億。</b>升得最快係危疾（+${growth(s.critical.amt, s0.critical.amt)}%）同醫療（+${growth(s.hospital.amt, s0.hospital.amt)}%），即係「病」嘅開支升得最急。`);
    const hospAvg = (s.hospital.amt * 1e8) / s.hospital.cases;
    keyFact("kf-mix", "醫療",
      `<b>醫療／住院係 claim 得最多嘅保障：每 5 宗理賠有 4 宗係住院（${LATEST} 年 ${fmt.num(s.hospital.cases)} 宗），七年宗數升 ${growth(s.hospital.cases, s0.hospital.cases)}%。</b>不過每宗平均只係 ${fmt.wan(hospAvg)}；一宗危疾平均 ${fmt.wan(D.critical[LATEST].avg)}。`, "", CAT.hospital.color);
  }

  /* ---------- chapter banner stats ---------- */
  function renderChStats() {
    CATS.forEach((c) => {
      const s = D.summary[LATEST][c.key], s0 = D.summary[YEARS[0]][c.key];
      const avg = c.key === "death" ? D.death[LATEST].avg : c.key === "critical" ? D.critical[LATEST].avg : (s.amt * 1e8) / s.cases;
      const totalAmt = catSum(LATEST, "amt");
      $("chStats-" + c.key).innerHTML = [
        [`${LATEST} 年賠款`, `${fmt.yi(s.amt)} 億`, `佔四類 ${fmt.p(pct(s.amt, totalAmt), 0)} · 七年 +${growth(s.amt, s0.amt)}%`],
        [`${LATEST} 年成功宗數`, `${fmt.num(s.cases)}+`, `七年 +${growth(s.cases, s0.cases)}%`],
        ["平均每宗", fmt.wan(avg), c.key === "hospital" || c.key === "accident" ? "總額 ÷ 宗數推算" : "報告公布平均賠償額"]
      ].map((x) => `<div class="cs"><span>${x[0]}</span><b>${x[1]}</b><em>${x[2]}</em></div>`).join("");
    });
  }

  /* ---------- Part 2: medical ---------- */
  function renderMedical() {
    const c = CAT.hospital, I = D.inflation, s = D.summary[LATEST], s0 = D.summary[YEARS[0]];
    const avgSeries = YEARS.map((y) => (D.summary[y].hospital.amt * 1e8) / D.summary[y].hospital.cases);
    $("body-hospital").innerHTML = `
      <div class="kf" id="kf-hospital"></div>
      ${subTitle("2.1", "醫療 claim 咗幾多？")}
      ${lead(`醫療賠款同宗數七年都差唔多升咗七至九成；平均每宗就企喺 $2 萬左右。`)}
      <div class="grid-2">
        ${card("每年醫療／住院賠款（億港元）", chartBox("hospAmt", "每年住院賠款"))}
        ${card("每年醫療／住院成功宗數", chartBox("hospCases", "每年住院宗數"))}
      </div>
      ${subTitle("2.2", "醫療費升幾多？")}
      <div class="kf" id="kf-inflation"></div>
      <div class="grid-2">
        ${card("住院手術費平均數（個人保單）", chartBox("surgeonChart", "住院手術費平均數走勢") + `<p class="chart-note">香港保險業聯會醫療索償數據調查。2019→2022 年，半私家房平均手術費升 22%，標準房升 25%。</p>`)}
        ${card("私家外科醫生收費：2018 → 2025", `<div id="doctorFees"></div><p class="chart-note">香港醫學會私家醫生收費調查：7 年間升 20%–50%。</p>`)}
      </div>
      ${card("常見手術收費中位數：2018 → 2022", `<div class="seg small" id="roomSeg">
          <button data-room="0" type="button">私家房</button><button class="on" data-room="1" type="button">半私家房</button><button data-room="2" type="button">標準房</button>
        </div><div class="table-scroll" id="surgeryTable"></div><p class="chart-note">個別手術（例如甲狀腺切除嘅私家房收費）會有升有跌，但大部分手術都向上。</p>`, "mt")}
      ${card("私家醫院每日病房收費：2019 → 2026", `<div class="table-scroll" id="roomTable"></div><p class="chart-note">各醫院網站公布價（2019 年 4 月及 2026 年 6 月）。升幅按收費範圍中間值計算，只計房租。</p>`, "mt")}
      ${subTitle("2.3", "一場大病，醫療費要幾多？")}
      <div class="grid-2">
        ${card("大型手術一次要幾多錢？", `<div id="complexList"></div><p class="chart-note">中大醫院定價收費（4 人房，2025 年 12 月）。Level 1 = 冇其他重大病；Level 3 = 有嚴重併發症。</p>`)}
        ${card("癌症標靶藥：一年藥費", `<div id="drugList"></div><p class="chart-note">每月平均支出 × 12 估算。部分屬門診藥物，要睇醫療保障有冇包。</p>`)}
      </div>
      ${subTitle("2.4", "香港人幾時最多入院？")}
      <div class="grid-2">
        ${card("香港住院人數（按年齡，2025 年調查）", chartBox("hospAge", "香港住院人數按年齡") + `<p class="chart-note">政府統計處主題性住戶統計調查（2024 年 10 月至 2025 年 1 月期間）。25–44 歲開始明顯上升，65 歲或以上最多。</p>`)}
        <div class="callout"><strong>約 ${D.hk.uncovered.pct}% 香港人（約 ${Math.round(D.hk.uncovered.people / 1e4)} 萬人）</strong>冇僱主醫療福利，亦冇自己買醫療保險。
          <span>政府統計處 2026 年 3 月報告。即係大約每 2 個人就有 1 個，入私家醫院要全數自己俾。</span></div>
      </div>`;

    keyFact("kf-hospital", `${fmt.p(pct(s.hospital.cases, s.cases), 0)}`,
      `<b>${LATEST} 年每 5 宗理賠有 4 宗係醫療／住院。</b>${fmt.num(s.hospital.cases)} 宗、賠出 ${s.hospital.amt} 億，係四類之中用得最密、賠得最多嘅保障。七年宗數升 ${growth(s.hospital.cases, s0.hospital.cases)}%。`, "", c.color);
    keyFact("kf-inflation", fmt.wan(I.drugs[0][2]),
      `<b>一年肝癌標靶藥嘅藥費。</b>私家外科醫生收費 7 年升 20–50%，私家醫院病房費亦普遍升一至五成；一次複雜大手術可以去到 ${fmt.wan(I.complex[0][2])}。`, "", c.color);

    drawYearBars("hospAmt", YEARS.map((y) => D.summary[y].hospital.amt), c, (v) => fmt.yi(v) + " 億");
    drawYearBars("hospCases", YEARS.map((y) => D.summary[y].hospital.cases), c, (v) => fmt.num(v) + " 宗");
    void avgSeries;

    const rooms = ["私家房", "半私家房", "標準房"], rc = ["#2a78d6", "#eb6834", "#1baf7a"];
    let opts = baseOpts();
    opts.scales.y.ticks.callback = (v) => "$" + v / 1000 + "k";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${fmt.money(ctx.parsed.y)}` };
    draw("surgeonChart", { type: "line", data: { labels: I.surgeonMean.years.map(String), datasets: rooms.map((r, i) => lineDs(r, I.surgeonMean[r], rc[i], { pointRadius: 5, tension: 0.15 })) }, options: opts });

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
    $("complexList").innerHTML = bars(I.complex, C.accent, { wide: true, valueFn: (x) => fmt.wan(x[1]) + "–" + fmt.wan(x[2]) }) + `<div class="legend" style="margin-top:10px"><span><i style="background:${C.accent}"></i>Level 1</span><span><i style="background:${C.accent};opacity:.35"></i>最高到 Level 3</span></div>`;
    $("drugList").innerHTML = bars(I.drugs, c.color, { wide: true, valueFn: (x) => x[1] === x[2] ? fmt.wan(x[1]) : fmt.wan(x[1]) + "–" + fmt.wan(x[2]) });

    opts = baseOpts();
    opts.plugins.legend.display = false;
    opts.scales.y.ticks.callback = (v) => v / 1e4 + "萬";
    opts.scales.x.title = { display: true, text: "年齡", color: C.muted };
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` 住院人數：${fmt.num(ctx.parsed.y)}` };
    draw("hospAge", { type: "bar", data: { labels: D.hk.hospByAge2025.map((x) => x[0]), datasets: [barDs("住院人數", D.hk.hospByAge2025.map((x) => x[1]), c.color)] }, options: opts });

    document.querySelectorAll("[data-room]").forEach((b) => b.addEventListener("click", () => {
      state.room = Number(b.dataset.room);
      document.querySelectorAll("[data-room]").forEach((x) => x.classList.toggle("on", x === b));
      renderSurgery();
    }));
  }
  function renderSurgery() {
    const r = state.room;
    const rows = D.inflation.surgeries.map((s) => ({ ...s, chg: pct(s.y2022[r] - s.y2018[r], s.y2018[r]) })).sort((a, b) => b.chg - a.chg);
    $("surgeryTable").innerHTML = `<table class="data-table"><thead><tr><th>手術</th><th>2018 中位數</th><th>2022 中位數</th><th>升幅</th></tr></thead><tbody>${
      rows.map((s) => `<tr><td>${s.name}</td><td>${fmt.money(s.y2018[r])}</td><td>${fmt.money(s.y2022[r])}</td><td>${fmt.chg(s.y2022[r], s.y2018[r])}</td></tr>`).join("")
    }</tbody></table>`;
  }

  /* ---------- Parts 3 & 4: critical illness / life ---------- */
  const TYPE = {
    critical: { no: "3", c: CAT.critical, src: () => D.critical, word: "危疾", causeWord: "病因" },
    death: { no: "4", c: CAT.death, src: () => D.death, word: "身故", causeWord: "死因" }
  };

  function buildType(key) {
    const T = TYPE[key], c = T.c, n = T.no, isCI = key === "critical";
    const L = D[key][LATEST], L0 = D[key][YEARS[0]], s = D.summary[LATEST][key], s0 = D.summary[YEARS[0]][key];
    $("body-" + key).innerHTML = `
      <div class="kf" id="kf-${key}"></div>
      ${subTitle(n + ".1", `${c.long} claim 咗幾多？`)}
      ${lead(`七年賠款由 ${fmt.yi(s0.amt)} 億升到 ${fmt.yi(s.amt)} 億（+${growth(s.amt, s0.amt)}%），宗數由 ${fmt.num(s0.cases)} 升到 ${fmt.num(s.cases)}（+${growth(s.cases, s0.cases)}%）。`)}
      <div class="grid-2">
        ${card(`每年${c.long}賠款（億港元）`, chartBox(key + "-amt", `每年${c.long}賠款`))}
        ${card(`每年${c.long}成功宗數`, chartBox(key + "-cases", `每年${c.long}宗數`) + `<p class="chart-note">2019–2021 年以「保單」計，2022 年起以「個案」計。</p>`)}
      </div>
      <div class="year-pick sticky-pick" data-scope="${key}" data-label="以下${c.long}數據年份"></div>
      ${subTitle(n + ".2", "男定女多？")}
      <div class="kf" id="kf-${key}-gender"></div>
      <div class="grid-2">
        ${card(`${c.long}：女性佔幾多？（七年）`, chartBox(key + "-gshare", `${c.long}女性佔比`))}
        ${card(`${c.long}：年齡 × 性別`, chartBox(key + "-gage", `${c.long}按年齡及性別`) + `<p class="chart-note" id="${key}-gnote"></p>`)}
      </div>
      ${subTitle(n + ".3", "幾多歲最多？")}
      ${isCI ? `<div class="grid-2">
        ${card("危疾：各年齡組佔比", chartBox(key + "-age", "危疾按年齡分佈") + `<div class="mini-stats" id="${key}-ageStats"></div>`)}
        ${card("三大危疾嘅年齡分佈", chartBox("ci-ageDis", "癌症、心臟病、中風按年齡分佈") + `<p class="chart-note" id="ci-ageDisNote"></p>`)}
      </div>` : card("身故：各年齡組佔比", chartBox(key + "-age", "身故按年齡分佈") + `<div class="mini-stats" id="${key}-ageStats"></div>`)}
      ${subTitle(n + ".4", isCI ? "咩病最多人 claim？" : "咩原因最多？")}
      <div class="grid-2">
        ${card(`${c.long}：${T.causeWord}`, `<div id="${key}-causes"></div>`)}
        ${isCI ? card("癌症個案入面最多係邊種？", `<div id="${key}-cancers"></div>`) + `` : card("香港整體：2024 年主要死因", `<div id="hkDeath"></div><p class="chart-note">香港統計年刊 2025 年版。男女出生時平均預期壽命：男 ${D.hk.lifeExp.male} 歲、女 ${D.hk.lifeExp.female} 歲。</p>`)}
      </div>
      ${card(`癌症佔${c.long}幾多？（七年）`, chartBox(key + "-ctrend", `癌症佔${c.long}比例走勢`), "mt")}
      ${subTitle(n + ".5", "一宗賠幾多？")}
      <div class="kf" id="kf-${key}-amount"></div>
      <div class="grid-2">
        ${card(`${c.long}：每宗賠償額分佈`, `<div id="${key}-bands"></div>`)}
        ${card(`${c.long}：平均 vs 最高一宗（七年）`, chartBox(key + "-max", `${c.long}平均及最高賠償額`) + `<div class="mini-stats" id="${key}-amountStats"></div>`)}
      </div>
      ${isCI ? `${subTitle(n + ".6", "癌症知多啲")}
      <div class="grid-2">
        ${card("五年相對存活率（按期數）", `<div class="table-scroll" id="survivalTable"></div><p class="chart-note">香港癌症資料統計中心《2022 年香港癌症統計概覽》（2024 年 10 月）。</p>`)}
        ${card("危疾復發率參考", `<div id="recurrence"></div><p class="chart-note">出處見 2025 年賠償報告第 14 頁。復發率視乎研究、期數同治療，只供參考。如果保障只賠一次，復發時就可能冇得再 claim。</p>`)}
      </div>
      ${card("香港整體：男女最常見癌症（2023 年新症）", `<div class="split" id="hkCancerGender"></div><p class="chart-note">香港癌症資料統計中心：75 歲前，大約每 4 名男性、每 5 名女性就有 1 位患癌。確診年齡中位數男 69 歲、女 64 歲。</p>`, "mt")}` : ""}`;

    // static (all-years) charts
    drawYearBars(key + "-amt", YEARS.map((y) => D.summary[y][key].amt), c, (v) => fmt.yi(v) + " 億");
    drawYearBars(key + "-cases", YEARS.map((y) => D.summary[y][key].cases), c, (v) => fmt.num(v) + " 宗");

    let opts = baseOpts();
    opts.scales.y.min = 30; opts.scales.y.max = 75;
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${ctx.parsed.y.toFixed(1)}%` };
    draw(key + "-gshare", { type: "line", data: { labels: YEARS, datasets: [
      lineDs("女性佔比", YEARS.map((y) => femaleShare(D[key][y])), C.female),
      lineDs("一半（50%）", YEARS.map(() => 50), "#b9b4a9", { borderWidth: 1, pointRadius: 0, borderDash: [2, 3] })
    ] }, options: opts });

    opts = baseOpts();
    opts.scales.y.min = 0; opts.scales.y.max = 100;
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${ctx.parsed.y.toFixed(1)}%` };
    const ds = [lineDs("癌症", YEARS.map((y) => causePct(D[key][y], "癌症")), c.color)];
    if (isCI) ds.unshift(lineDs("三大危疾合計（癌症＋心臟病＋中風）", YEARS.map((y) => causePct(D[key][y], "癌症") + causePct(D[key][y], "心臟疾病") + causePct(D[key][y], "腦血管疾病")), c.soft, { borderDash: [5, 4] }));
    else ds.push(lineDs("肺部疾病", YEARS.map((y) => causePct(D[key][y], "肺部疾病")), c.soft, { borderDash: [5, 4] }));
    draw(key + "-ctrend", { type: "line", data: { labels: YEARS, datasets: ds }, options: opts });

    opts = baseOpts();
    opts.scales.y.beginAtZero = true;
    opts.scales.y.ticks.callback = (v) => v / 1e4 + "萬";
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${fmt.money(ctx.parsed.y)}` };
    draw(key + "-max", { type: "bar", data: { labels: YEARS, datasets: [
      barDs("最高一宗", YEARS.map((y) => D[key][y].max), c.soft, { order: 2, maxBarThickness: 40 }),
      lineDs("平均每宗", YEARS.map((y) => D[key][y].avg), c.color, { type: "line", order: 1 })
    ] }, options: opts });

    // key facts
    if (isCI) {
      const a4160 = pct(L.male[2] + L.female[2], L.n);
      keyFact("kf-critical", `${L.avgAge} 歲`,
        `<b>危疾平均索賠年齡 ${L.avgAge} 歲，${fmt.p(a4160, 0)} 喺 41–60 歲出事</b>，正正係供樓、養家、供書最重嘅時候。${LATEST} 年 ${fmt.num(L.n)} 宗，${fmt.p(causePct(L, "癌症"), 0)} 係癌症。`, "", c.color);
      keyFact("kf-critical-gender", "3 宗有 2 宗",
        `<b>危疾賠償 ${fmt.p(femaleShare(L), 0)} 係女性</b>，七年都一樣，主因係乳癌。21–40 歲女性個案係男性嘅 ${(L.female[1] / L.male[1]).toFixed(1)} 倍。`,
        picto(3, 2, C.female, C.male, PERSON) + `<span class="picto-cap"><i style="background:${C.female}"></i>女 <i style="background:${C.male}"></i>男</span>`, C.female);
      keyFact("kf-critical-amount", `${Math.round(L.max / L.avg)} 倍`,
        `<b>最高一宗危疾 ${fmt.wan(L.max)}，係平均 ${fmt.wan(L.avg)} 嘅 ${Math.round(L.max / L.avg)} 倍。</b>分別唔係病重唔重，而係<b>當初買咗幾多保額</b>：危疾一筆過賠，買幾多就賠幾多。`, "", c.color);
      const cls = (v) => v >= 80 ? "ok" : v >= 50 ? "mid" : "bad";
      $("survivalTable").innerHTML = `<table class="data-table" style="min-width:420px"><thead><tr><th>癌症</th><th>第一期</th><th>第二期</th><th>第三期</th><th>第四期</th></tr></thead><tbody>${
        D.hk.survival.map((r) => `<tr><td>${r[0]}</td>${r[1].map((v) => `<td><span class="pill ${cls(v)}">${v.toFixed(1)}%</span></td>`).join("")}</tr>`).join("")
      }</tbody></table><div class="legend" style="margin-top:10px"><span><i style="background:#dcefe3"></i>80% 或以上</span><span><i style="background:#f8ebc9"></i>50–80%</span><span><i style="background:#f6d9d4"></i>低於 50%</span></div>`;
      $("recurrence").innerHTML = D.hk.recurrence.map((r) => `<div class="rec"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");
      const g = D.hk.cancerByGender2023;
      $("hkCancerGender").innerHTML = `
        <div><p class="sub-h">男性 首 5 位</p>${bars(g.male, C.male, { valueFn: (x) => fmt.num(x[1]) + " 宗" })}</div>
        <div><p class="sub-h">女性 首 5 位</p>${bars(g.female, C.female, { valueFn: (x) => fmt.num(x[1]) + " 宗" })}</div>`;
    } else {
      keyFact("kf-death", fmt.wan(L.avg),
        `<b>${LATEST} 年身故平均每宗只賠 ${fmt.wan(L.avg)}</b>，對大部分家庭嚟講，未夠還按揭同支持幾年家用。平均索賠年齡 ${L.avgAge} 歲；${fmt.p(pct(L.male[3] + L.female[3], L.n), 0)} 喺 61–80 歲。`, "", c.color);
      keyFact("kf-death-gender", fmt.p(100 - femaleShare(L), 0),
        `<b>身故賠償男性佔多數。</b>61–80 歲男性明顯多過女性；80 歲以上就倒轉，女性較多，反映女性較長壽（香港女性平均預期壽命 ${D.hk.lifeExp.female} 歲，男性 ${D.hk.lifeExp.male} 歲）。`,
        picto(2, 1, C.male, C.female, PERSON) + `<span class="picto-cap"><i style="background:${C.male}"></i>男 <i style="background:${C.female}"></i>女</span>`, C.male);
      keyFact("kf-death-amount", fmt.p(pct(L.bands[0], L.n), 0),
        `<b>${fmt.p(pct(L.bands[0], L.n), 0)} 身故個案賠 $25 萬或以下。</b>最高一宗 ${fmt.wan(L.max)}，分別在於當初買咗幾多保額：人壽保額要按家庭開支、按揭同供養年期去計。`, "", c.color);
      $("hkDeath").innerHTML = bars(D.hk.death2024, "#7a8193", { valueFn: (x) => fmt.num(x[1]) + " 人" });
    }
    renderTypeDetail(key);
  }

  function renderTypeDetail(key) {
    const c = TYPE[key].c, isCI = key === "critical", y = state[key], o = D[key][y];
    let labels = D.ageGroups.slice(), male = o.male.slice(), female = o.female.slice();
    if (isCI && male[4] + female[4] < 5) { labels.pop(); male.pop(); female.pop(); }
    let opts = baseOpts();
    opts.scales.y.title = { display: true, text: `宗數（${o.unit}）`, color: C.muted };
    opts.scales.x.title = { display: true, text: `年齡（${y} 年）`, color: C.muted };
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}：${fmt.num(ctx.parsed.y)}` };
    draw(key + "-gage", { type: "bar", data: { labels, datasets: [barDs("男", male, C.male), barDs("女", female, C.female)] }, options: opts });
    const f = sum(o.female), m = sum(o.male);
    $(key + "-gnote").textContent = isCI
      ? `${y} 年危疾：女性 ${fmt.num(f)}、男性 ${fmt.num(m)}（女性佔 ${fmt.p(pct(f, f + m), 0)}）。21–40 歲女性係男性嘅 ${(o.female[1] / Math.max(1, o.male[1])).toFixed(1)} 倍。`
      : `${y} 年身故：男性 ${fmt.num(m)}、女性 ${fmt.num(f)}（男性佔 ${fmt.p(pct(m, f + m), 0)}）。`;

    const dist = D.ageGroups.map((_, i) => pct(o.male[i] + o.female[i], o.n));
    opts = baseOpts();
    opts.plugins.legend.display = false;
    opts.scales.y.ticks.callback = (v) => v + "%";
    opts.scales.x.title = { display: true, text: `年齡（${y} 年）`, color: C.muted };
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${c.long}：${ctx.parsed.y.toFixed(1)}%` };
    draw(key + "-age", { type: "bar", data: { labels: D.ageGroups, datasets: [barDs(c.long, dist, D.ageGroups.map((_, i) => (dist[i] === Math.max(...dist) ? c.color : c.soft)))] }, options: opts });
    $(key + "-ageStats").innerHTML = [
      ["索賠年齡", o.avgAge ? `平均 ${o.avgAge} 歲` : `最多 ${o.peakAge}`],
      ["最多嘅年齡組", D.ageGroups[dist.indexOf(Math.max(...dist))] + " 歲"],
      ["佔比", fmt.p(Math.max(...dist), 0)]
    ].map((x) => `<div class="ms"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");

    if (isCI) {
      const ay = o.ageByDisease ? y : LATEST, abd = D.critical[ay].ageByDisease, names = Object.keys(abd);
      const ramp = ["#e4e0f8", "#b3a9ee", "#8274e0", "#6250d6", "#3a2c94"];
      const o2 = baseOpts({ indexAxis: "y" });
      o2.scales.x.stacked = true; o2.scales.y.stacked = true;
      o2.scales.x.max = 100; o2.scales.x.grid = { color: C.grid }; o2.scales.x.ticks = { callback: (v) => v + "%", color: C.muted };
      o2.scales.y.grid = { display: false };
      o2.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label} 歲：${ctx.parsed.x}%` };
      o2.plugins.tooltip.filter = (item) => item.parsed.x > 0;
      draw("ci-ageDis", { type: "bar", data: { labels: names, datasets: D.ageGroups.map((g, i) => ({ label: g, data: names.map((nm) => abd[nm][i]), backgroundColor: ramp[i], borderColor: "#fff", borderWidth: { right: 2 }, borderSkipped: false, maxBarThickness: 40 })).filter((d) => sum(d.data) > 0) }, options: o2 });
      $("ci-ageDisNote").textContent = (ay !== y ? `報告由 2024 年先有呢項分析，以下顯示 ${ay} 年。` : `${ay} 年：`) + "癌症、心臟病、中風都係 41–60 歲最多，大約佔六成。";
      $(key + "-cancers").innerHTML = o.cancers
        ? bars(o.cancers, (x, i) => (i === 0 ? C.female : c.color), { total: o.causes[0][1] }) + `<p class="chart-note">${y} 年危疾癌症個案首 5 位，百分比係佔癌症個案。乳癌係女性危疾多嘅主因。</p>`
        : `<p class="chart-note">報告由 2023 年起先公布危疾癌症首 5 位。${LATEST} 年：乳癌 29%、肺癌 11%、甲狀腺癌 9%。</p>`;
    }
    $(key + "-causes").innerHTML = bars(o.causes, (x, i) => (i < 3 ? c.color : c.soft), { total: o.n, highlight: 3 }) + `<p class="chart-note">${y} 年，共 ${fmt.num(o.n)} ${o.unit}。</p>`;
    $(key + "-bands").innerHTML = bars(D.bandLabels.map((l, i) => [l, o.bands[i]]), (x, i) => (i >= 3 ? c.color : c.soft), { total: o.n }) + `<p class="chart-note">${y} 年。深色 = $75 萬以上嘅大額個案。</p>`;
    const over = (from) => pct(sum(o.bands.slice(from)), o.n);
    $(key + "-amountStats").innerHTML = [
      [`${y} 平均`, fmt.wan(o.avg)],
      [`${y} >$75萬`, fmt.p(over(3), 0)],
      [`${y} 最高一宗`, fmt.wan(o.max)]
    ].map((x) => `<div class="ms"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
  }

  /* ---------- Part 5: accident ---------- */
  function renderAccident() {
    const c = CAT.accident, s = D.summary[LATEST], s0 = D.summary[YEARS[0]];
    const avg = YEARS.map((y) => (D.summary[y].accident.amt * 1e8) / D.summary[y].accident.cases);
    const de = D.death[LATEST], accDeath = de.causes.find((x) => x[0] === "意外");
    $("body-accident").innerHTML = `
      <div class="kf" id="kf-accident"></div>
      ${subTitle("5.1", "意外 claim 咗幾多？")}
      <div class="grid-2">
        ${card("每年意外賠款（億港元）", chartBox("acc-amt", "每年意外賠款"))}
        ${card("每年意外成功宗數", chartBox("acc-cases", "每年意外宗數"))}
      </div>
      ${card("意外：平均每宗賠幾多？", chartBox("acc-avg", "意外平均每宗賠償") + `<p class="chart-note">總額 ÷ 成功宗數推算。報告冇公布意外嘅類型（交通、工作、家居等）同年齡分佈。${accDeath ? `另外，${LATEST} 年身故賠償之中有 ${accDeath[1]} 宗（${fmt.p(pct(accDeath[1], de.n))}）係意外身故。` : ""}</p>`, "mt")}`;
    keyFact("kf-accident", `${fmt.num(s.accident.cases)} 宗`,
      `<b>意外宗數僅次於醫療，但每宗平均只係 ${fmt.money(avg[avg.length - 1])}。</b>屬於「宗數多、每宗細」；七年宗數升 ${growth(s.accident.cases, s0.accident.cases)}%。真正大額嘅意外（例如嚴重受傷、身故）要靠醫療同人壽保障。`, "", c.color);
    drawYearBars("acc-amt", YEARS.map((y) => D.summary[y].accident.amt), c, (v) => fmt.yi(v) + " 億");
    drawYearBars("acc-cases", YEARS.map((y) => D.summary[y].accident.cases), c, (v) => fmt.num(v) + " 宗");
    const opts = baseOpts();
    opts.plugins.legend.display = false;
    opts.scales.y.beginAtZero = true;
    opts.scales.y.ticks.callback = (v) => "$" + fmt.num(v);
    opts.plugins.tooltip.callbacks = { label: (ctx) => ` 平均每宗：${fmt.money(ctx.parsed.y)}` };
    draw("acc-avg", { type: "line", data: { labels: YEARS, datasets: [lineDs("平均每宗", avg, c.color)] }, options: opts });
  }

  /* ---------- Part 6: check ---------- */
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
    const lifeNeed = exp * 12 * yrs + debt, lifeHave = life + sav, lMax = Math.max(lifeNeed, lifeHave, ld.avg, 1);
    const ciLow = inc * 3, ciHigh = inc * 5, drug = D.inflation.drugs[0][2], cMax = Math.max(ciHigh, ci, drug, 1);
    const complexTop = D.inflation.complex[0][2];
    const medHave = medType === "full" ? drug : medType === "limit" ? med : 0, mMax = Math.max(drug, medHave, 1);
    let medVerdict;
    if (medType === "none") medVerdict = `<p class="verdict bad">冇個人醫保：住院、手術要自己俾或者靠公立醫院輪候</p>`;
    else if (medType === "full") medVerdict = `<p class="verdict ok">全數賠償類型，大額住院較有保障</p><p class="hint">記得睇清楚門診癌症治療、標靶藥有冇包，同埋有冇終身或每年上限。</p>`;
    else if (med >= drug) medVerdict = `<p class="verdict ok">年限額足夠應付一年標靶藥</p>`;
    else if (med >= complexTop) medVerdict = `<p class="verdict warn">夠一次大型手術，但未必夠一年標靶藥</p>`;
    else medVerdict = `<p class="verdict bad">年限額低過一次複雜大手術（${fmt.wan(complexTop)}）</p>`;
    $("checkResults").innerHTML = `
      <div class="ck" style="--c:${CAT.death.color}">
        <h4>人壽</h4><p class="sub">家庭開支 × ${yrs} 年 ＋ 債務</p>
        ${ckRow("你現有（保額＋儲蓄）", lifeHave, lMax, C.male)}
        ${ckRow("估計需要", lifeNeed, lMax, C.accent)}
        ${ckRow(`${LATEST} 平均身故賠償`, ld.avg, lMax, C.old)}
        ${verdict(lifeHave, lifeNeed, "現有保障足夠應付估算需要")}
        <p class="hint">${LATEST} 年身故平均只賠 ${fmt.wan(ld.avg)}，但有 ${fmt.p(pct(ld.bands[4], ld.n), 0)} 個案超過 $100 萬。</p>
      </div>
      <div class="ck" style="--c:${CAT.critical.color}">
        <h4>危疾</h4><p class="sub">年收入 3–5 倍（停工＋治療）</p>
        ${ckRow("你現有危疾保額", ci, cMax, C.male)}
        ${ckRow("建議下限（3 倍）", ciLow, cMax, C.accent)}
        ${ckRow("建議上限（5 倍）", ciHigh, cMax, C.accent)}
        ${ckRow(`${LATEST} 平均危疾賠償`, cd.avg, cMax, C.old)}
        ${ckRow("肝癌標靶藥一年", drug, cMax, CAT.critical.color)}
        ${verdict(ci, ciLow, "達到建議下限")}
        <p class="hint">癌症有機會復發（乳癌約 30%），檢查下保單有冇多次賠償。</p>
      </div>
      <div class="ck" style="--c:${CAT.hospital.color}">
        <h4>醫療</h4><p class="sub">對照大型手術同標靶藥開支</p>
        ${medType === "limit" ? ckRow("你嘅每年限額", med, mMax, C.male) : medType === "none" ? ckRow("你嘅醫療保障", 0, mMax, C.male) : ""}
        ${ckRow("肝葉切除（Level 3）", complexTop, mMax, C.accent)}
        ${ckRow("肝癌標靶藥一年", drug, mMax, CAT.critical.color)}
        ${medVerdict}
      </div>`;
  }

  function renderNext() {
    const q = [
      ["危疾", "我嘅危疾保單賠幾多次？", "癌症、心臟病、中風都有機會復發。如果只賠一次，第二次出事就要靠自己。"],
      ["醫療", "醫療保險有冇全數賠償，或者夠高嘅每年限額？", "一次複雜手術可以去到 $86 萬，一年標靶藥可以超過 $180 萬。睇清楚門診癌症治療包唔包。"],
      ["人壽", "人壽保額夠唔夠還按揭同養家？", `身故平均賠償只係 ${fmt.wan(D.death[LATEST].avg)}，對大部分家庭嚟講遠遠唔夠。`],
      ["危疾", "投保時有冇如實申報健康狀況？", "危疾每 100 宗申請約有 85–89 宗獲賠，係四類之中最低。如實申報、清楚定義，可以減低日後爭議。"],
      ["全部", "上一次檢視保障係幾時？", "手術費、病房費年年升，保額買咗幾年可能已經追唔上。建議每 1–2 年檢視一次。"]
    ];
    const col = { 危疾: CAT.critical.color, 醫療: CAT.hospital.color, 人壽: CAT.death.color, 全部: "#14213d" };
    $("questions").innerHTML = q.map((x) => `<li><span class="q-tag" style="background:${col[x[0]]}">${x[0]}</span><b>${x[1]}</b><span>${x[2]}</span></li>`).join("");
    $("sourceList").innerHTML = D.sources.map((s) => `<li>${s}</li>`).join("");
    $("footMeta").textContent = `最後更新：${D.meta.updated} · 數據年份 ${YEARS[0]}–${LATEST}`;
    $("copyright").textContent = `© ${new Date().getFullYear()} Michael Koo Protection Alliance (MKPA). 版權所有。`;
    const ct = D.meta.contact || {};
    let html = `<strong>想詳細睇吓自己嘅保障？</strong><p>同 ${ct.name || "你嘅顧問"} 約個時間，一齊對照呢份數據檢視保單。</p>`;
    if (ct.phone) html += `<p>${ct.name}　電話／WhatsApp：<b style="color:#fff">${ct.phone}</b></p>`;
    if (ct.whatsapp) html += `<div class="contact"><a href="https://wa.me/${ct.whatsapp}?text=${encodeURIComponent("你好，我睇咗理賠數據報告，想檢視吓自己嘅保障。")}" target="_blank" rel="noopener">WhatsApp 預約</a></div>`;
    html += `<p style="margin-top:10px"><a href="print.html" style="color:#fff">下載／列印 A4 版報告 →</a></p>`;
    $("contactBox").innerHTML = html;
  }

  /* ---------- nav: where am I ---------- */
  function bindNav() {
    const links = [...document.querySelectorAll(".nav-links a")];
    const nowBar = $("nowBar"), nowText = $("nowText");
    const NAMES = { overview: ["總覽", "四類保險一齊比較", "#14213d"], medical: ["醫療／住院保險", "以下數字全部係講醫療／住院", CAT.hospital.color], critical: ["危疾保險", "以下數字全部係講危疾", CAT.critical.color], life: ["人壽保險（身故賠償）", "以下數字全部係講人壽／身故", CAT.death.color], accident: ["意外保險", "以下數字全部係講意外", CAT.accident.color], check: ["保障檢查", "對照自己嘅保障", "#14213d"] };
    const setActive = (id) => {
      links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + id));
      const a = links.find((l) => l.getAttribute("href") === "#" + id);
      if (a) { const nav = a.parentElement; if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2; }
      const n = NAMES[id];
      if (n) { nowBar.style.setProperty("--c", n[2]); nowText.innerHTML = `<b>你而家睇緊：${n[0]}</b><span>${n[1]}</span>`; nowBar.classList.add("show"); }
      else nowBar.classList.remove("show");
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      }, { rootMargin: "-30% 0px -65% 0px" });
      document.querySelectorAll(".chapter").forEach((el) => io.observe(el));
      const heroIo = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { links.forEach((l) => l.classList.remove("active")); nowBar.classList.remove("show"); } }); }, { rootMargin: "0px 0px -60% 0px" });
      heroIo.observe($("top"));
    }
  }

  function bindControls() {
    document.querySelectorAll("[data-trend]").forEach((b) => b.addEventListener("click", () => {
      state.trend = b.dataset.trend;
      document.querySelectorAll("[data-trend]").forEach((x) => x.classList.toggle("on", x === b));
      renderTrend();
    }));
    const det = $("rateChart").closest("details");
    det.addEventListener("toggle", () => { if (det.open) renderRates(); });
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
    renderChapterPick();
    renderOverviewFacts();
    renderChStats();
    renderTrend();
    renderCounts();
    renderMix();
    renderRateBars();
    renderMedical();
    buildType("critical");
    buildType("death");
    renderAccident();
    renderYearPicks();
    renderCheck();
    renderNext();
    bindControls();
    bindNav();
    countUp();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
