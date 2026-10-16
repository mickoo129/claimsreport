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
  function renderHero() {
    const s = D.summary[LATEST], s0 = D.summary[YEARS[0]];
    const hospShareAmt = pct(s.hospital.amt, catSum(LATEST, "amt"));
    const hospShareCases = pct(s.hospital.cases, s.cases);
    const ci = D.critical[LATEST];
    const ci4160 = pct(ci.male[2] + ci.female[2], ci.n);
    $("heroStats").innerHTML = [
      ["2025 年總賠償", `${s.total}億+`, `2019 年係 ${s0.total} 億，七年升 ${Math.round(pct(s.total - s0.total, s0.total))}%`],
      ["成功索償個案", fmt.num(s.cases) + "+", `比 2024 年多 8.39%`],
      ["住院佔賠款", fmt.p(hospShareAmt, 0), `${s.hospital.amt} 億，四類之中最多`],
      ["危疾平均索賠年齡", `${ci.avgAge} 歲`, `41–60 歲佔 ${fmt.p(ci4160, 0)}`]
    ].map((x) => `<div class="hstat"><div class="k">${x[0]}</div><div class="v">${x[1]}</div><div class="s">${x[2]}</div></div>`).join("");

    $("takeaways").innerHTML = [
      ["每 5 宗理賠，4 宗係住院", `2025 年 ${fmt.num(s.hospital.cases)} 宗住院賠償，佔全部成功個案約 ${fmt.p(hospShareCases, 0)}。醫療保障係最常用到嘅一張單。`, "#mix"],
      ["危疾：女性多、四五十歲多", `七年嚟危疾賠償有六成幾係女性；高峰喺 41–60 歲，平均 ${ci.avgAge} 歲。`, "#gender"],
      ["醫療費一路升", "私家外科醫生收費 7 年升 20–50%；半私家房平均手術費 3 年升 22%。", "#inflation"]
    ].map((x) => `<div class="tk"><b>${x[0]}</b><span>${x[1]}</span><br><a href="${x[2]}">睇詳情</a></div>`).join("");
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
        data: YEARS.map((y) => +(pct(D.summary[y][c.key].amt, D.summary[base][c.key].amt)).toFixed(0)),
        borderColor: c.color, backgroundColor: c.color, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.25
      }));
      yTitle = "2019 年 = 100";
    }
    const opts = baseOpts();
    opts.scales.y.title = { display: true, text: yTitle, color: C.muted };
    if (mode === "amount") { opts.scales.x.stacked = true; opts.scales.y.stacked = true; opts.scales.y.beginAtZero = true; }
    opts.plugins.tooltip.callbacks = {
      label: (ctx) => mode === "amount" ? ` ${ctx.dataset.label}：${fmt.yi(ctx.parsed.y)} 億` : ` ${ctx.dataset.label}：${ctx.parsed.y}`,
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
          { label: "身故賠償 女性佔比", data: YEARS.map((y) => femaleShare(D.death[y])), borderColor: C.male, backgroundColor: C.male, borderWidth: 2, pointRadius: 4, tension: 0.2, borderDash: [5, 4] }
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
      `<p class="chart-note">身故入面「肺部疾病」包括肺炎等，多數係長者；自殺同意外合共約 5%，年輕人身故主要原因之一。</p>`;
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
      ["投保時有冇如實申報健康狀況？", "危疾成功索償率約 85–89%，係四類之中最低。如實申報、清楚定義，可以減低日後爭議。"],
      ["上一次檢視保障係幾時？", "手術費、病房費年年升，保額買咗幾年可能已經追唔上。建議每 1–2 年檢視一次。"]
    ];
    $("questions").innerHTML = q.map((x) => `<li><b>${x[0]}</b><span>${x[1]}</span></li>`).join("");
    $("sourceList").innerHTML = D.sources.map((s) => `<li>${s}</li>`).join("");
    $("footMeta").textContent = `最後更新：${D.meta.updated} · 數據年份 ${YEARS[0]}–${LATEST} · © ${new Date().getFullYear()} ${D.meta.brandFull}`;
    const ct = D.meta.contact || {};
    let html = `<strong>想詳細睇吓自己嘅保障？</strong><p>同 ${ct.name || "你嘅顧問"} 約個時間，一齊對照呢份數據檢視保單。</p>`;
    if (ct.whatsapp) html += `<div class="contact"><a href="https://wa.me/${ct.whatsapp}?text=${encodeURIComponent("你好，我睇咗理賠數據報告，想檢視吓自己嘅保障。")}" target="_blank" rel="noopener">WhatsApp 預約</a></div>`;
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
            if (a) { a.classList.add("active"); a.scrollIntoView({ block: "nearest", inline: "center" }); }
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
    $("printBtn").addEventListener("click", () => window.print());
    window.addEventListener("beforeprint", () => Object.values(charts).forEach((c) => c.resize()));
  }

  function init() {
    if (window.Chart) {
      Chart.defaults.font.family = "'Noto Sans TC', 'PingFang HK', sans-serif";
      Chart.defaults.font.size = 13;
      Chart.defaults.color = C.ink2;
    }
    renderHero();
    renderYearPicks();
    if (window.Chart) {
      renderTrend(); renderRates(); renderGenderShare(); renderCauseTrend();
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
