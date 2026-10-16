/* global Chart */
(function () {
  "use strict";
  const D = window.CLAIMS;
  const YEARS = D.meta.years, Y = D.meta.latest;
  const CATS = [
    { key: "hospital", name: "住院", color: "#2a78d6" },
    { key: "death", name: "身故", color: "#eb6834" },
    { key: "critical", name: "危疾", color: "#6250d6" },
    { key: "accident", name: "意外", color: "#1baf7a" }
  ];
  const C = { male: "#2a78d6", female: "#e34948", ci: "#6250d6", ciL: "#b3a9ee", death: "#eb6834", deathL: "#f5b799", grid: "#ebe7de", muted: "#7a8193", ink2: "#4a5468", old: "#c4c0b6", accent: "#b5502a" };
  const TOTAL_PAGES = 7;
  const YEAR_NOW = new Date().getFullYear();

  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const f = {
    yi: (n) => Number(n).toFixed(2).replace(/\.?0+$/, ""),
    num: (n) => Math.round(n).toLocaleString("en-US"),
    money: (n) => "$" + Math.round(n).toLocaleString("en-US"),
    wan: (n) => n >= 1e5 ? "$" + Math.round(n / 1e4).toLocaleString("en-US") + "萬" : n >= 1e4 ? "$" + (n / 1e4).toFixed(1).replace(/\.0$/, "") + "萬" : "$" + Math.round(n).toLocaleString("en-US"),
    p: (n, d = 1) => Number(n).toFixed(d) + "%",
    chg: (a, b) => { const v = pct(a - b, b); const c = Math.abs(v) < 0.5 ? "flat" : v > 0 ? "up" : "down"; return `<span class="${c}">${v > 0 ? "+" : ""}${v.toFixed(0)}%</span>`; }
  };
  const catSum = (y, k) => sum(CATS.map((c) => D.summary[y][c.key][k]));
  const femaleShare = (o) => pct(sum(o.female), sum(o.female) + sum(o.male));
  const causePct = (o, name) => { const h = o.causes.find((c) => c[0] === name); return h ? pct(h[1], o.n) : 0; };

  function bars(list, color, opt = {}) {
    const total = opt.total || sum(list.map((x) => x[1]));
    const max = Math.max(...list.map((x) => x[2] || x[1]));
    return `<div class="bars">${list.map((x, i) => {
      const col = typeof color === "function" ? color(x, i) : color;
      const v = opt.val ? opt.val(x) : `${f.num(x[1])}（${f.p(pct(x[1], total))}）`;
      const range = x[2] && x[2] !== x[1] ? `<i style="width:${(x[2] / max) * 100}%;background:${col};opacity:.35"></i>` : "";
      return `<div class="br${opt.wide ? " w" : ""}"><span>${x[0]}</span><span class="bt">${range}<i style="width:${(x[1] / max) * 100}%;background:${col}"></i></span><span class="bv">${v}</span></div>`;
    }).join("")}</div>`;
  }
  const chart = (id, h) => `<div class="chart" style="height:${h}mm"><canvas id="${id}"></canvas></div>`;
  const page = (n, title, body) => `
    <section class="page">
      ${n > 1 ? `<div class="ph"><span><b>MKPA</b> · 理賠數據解讀 ${YEARS[0]}–${Y}</span><span>${title}</span></div>` : ""}
      <div class="body">${body}</div>
      <div class="pf"><span>© ${YEAR_NOW} Michael Koo Protection Alliance (MKPA). 版權所有。</span><span>${n} / ${TOTAL_PAGES}</span></div>
    </section>`;
  const head = (no, t, sub) => `<div><h2 class="title"><span class="no">${no}</span>${t}</h2>${sub ? `<p class="lead-s" style="margin-top:1.5mm">${sub}</p>` : ""}</div>`;

  /* ---------- build pages ---------- */
  const s = D.summary[Y], s0 = D.summary[YEARS[0]];
  const ci = D.critical[Y], de = D.death[Y];
  const ciAge = D.ageGroups.map((_, i) => pct(ci.male[i] + ci.female[i], ci.n));
  const deAge = D.ageGroups.map((_, i) => pct(de.male[i] + de.female[i], de.n));
  const growth = (k) => Math.round(pct(s[k].amt - s0[k].amt, s0[k].amt));
  const ct = D.meta.contact || {};

  const p1 = `
    <div class="cover">
      <p class="eb">個人保險賠償報告 · ${YEARS[0]}–${Y} · 香港及澳門保單</p>
      <h1>七年理賠數據，<br>睇清楚錢賠咗去邊</h1>
      <p>將七份年度理賠報告逐個數字整理：邊類保險最多人用、男女有咩分別、幾多歲最易出事，同埋醫療費每年升幾多。</p>
      <div class="pnch"><b>每 ${((365 * 24 * 60) / s.cases).toFixed(1)} 分鐘</b><span>就有一宗理賠成功賠出 · 平均每日賠出 $${f.num((s.total * 1e8) / 365 / 1e4)}萬 · 每日約 ${Math.round(s.hospital.cases / 365)} 宗住院、${Math.round(ci.n / 365)} 宗危疾、${Math.round(de.n / 365)} 宗身故</span></div>
      <div class="kstats">
        <div><span>${Y} 年總賠償</span><b>${s.total}億+</b><i>${YEARS[0]} 年 ${s0.total} 億，升 ${Math.round(pct(s.total - s0.total, s0.total))}%</i></div>
        <div><span>成功索償個案</span><b>${f.num(s.cases)}+</b><i>比上年多 8.39%</i></div>
        <div><span>住院佔賠款</span><b>${f.p(pct(s.hospital.amt, catSum(Y, "amt")), 0)}</b><i>${s.hospital.amt} 億，四類最多</i></div>
        <div><span>危疾平均索賠年齡</span><b>${ci.avgAge} 歲</b><i>41–60 歲佔 ${f.p(ciAge[2], 0)}</i></div>
      </div>
    </div>
    <div class="tks">
      <div><b>每 5 宗理賠，4 宗係住院</b>${Y} 年 ${f.num(s.hospital.cases)} 宗住院賠償，佔全部成功個案約 ${f.p(pct(s.hospital.cases, s.cases), 0)}。</div>
      <div><b>危疾：女性多、四五十歲多</b>七年嚟危疾賠償有六成幾係女性；高峰喺 41–60 歲。</div>
      <div><b>醫療費一路升</b>私家外科醫生收費 7 年升 20–50%；半私家房平均手術費 3 年升 22%。</div>
    </div>
    ${head("01", "七年走勢：賠款差唔多翻倍", `${YEARS[0]} → ${Y}：住院 +${growth("hospital")}%、危疾 +${growth("critical")}%、身故 +${growth("death")}%、意外 +${growth("accident")}%。`)}
    <div class="box">${chart("cTrend", 46)}</div>
    <table>
      <thead><tr><th>億港元</th>${YEARS.map((y) => `<th>${y}</th>`).join("")}</tr></thead>
      <tbody>
        ${CATS.map((c) => `<tr><td><span class="dot" style="background:${c.color}"></span>${c.name}</td>${YEARS.map((y) => `<td>${f.yi(D.summary[y][c.key].amt)}</td>`).join("")}</tr>`).join("")}
        <tr><td><b>公布總額</b></td>${YEARS.map((y) => `<td><b>${D.summary[y].total}</b></td>`).join("")}</tr>
      </tbody>
    </table>
    <p class="note">報告總額以「超過」表述（2020 年為「接近」），四類加埋會略高於公布總額。</p>`;

  const per = CATS.map((c) => c.key === "death" ? de.avg : c.key === "critical" ? ci.avg : (s[c.key].amt * 1e8) / s[c.key].cases);
  const tc = catSum(Y, "cases"), ta = catSum(Y, "amt");
  const p2 = `
    ${head("02", "咩 claim 得多？咩 claim 得少？", "「最多人 claim」同「賠最多錢」唔係同一樣嘢。")}
    <div class="box">
      <h3>${Y} 年四大類比較</h3>
      <table>
        <thead><tr><th></th><th>成功宗數</th><th>佔宗數</th><th>金額（億）</th><th>佔金額</th><th>平均每宗</th></tr></thead>
        <tbody>${CATS.map((c, i) => `<tr><td><span class="dot" style="background:${c.color}"></span>${c.name}</td><td>${f.num(s[c.key].cases)}</td><td>${f.p(pct(s[c.key].cases, tc))}</td><td>${f.yi(s[c.key].amt)}</td><td>${f.p(pct(s[c.key].amt, ta))}</td><td><b>${f.money(per[i])}</b></td></tr>`).join("")}</tbody>
      </table>
      <p class="note">住院、意外平均每宗 = 總額 ÷ 成功宗數；身故、危疾用報告公布嘅平均賠償額。一宗危疾平均賠償約等於 ${Math.round(per[2] / per[0])} 宗住院。</p>
    </div>
    <div class="box">
      <h3>成功索償率（${YEARS[0]}–2024）</h3>
      ${chart("cRate", 52)}
      <p class="note">危疾一直係四類之中最低（約 85–89%）。投保時如實申報、清楚保障定義，對危疾特別重要。</p>
    </div>
    ${head("03", "男女分別：危疾三分二係女性")}
    <div class="g2">
      <div class="box"><h3>女性佔比</h3>${chart("cFemale", 56)}<p class="note">危疾女性七年都企喺 63–68%，主因乳癌。</p></div>
      <div class="box"><h3>${Y} 年危疾：年齡 × 性別</h3>${chart("cCiGender", 56)}<p class="note">21–40 歲女性危疾個案係男性嘅 ${(ci.female[1] / ci.male[1]).toFixed(1)} 倍。</p></div>
    </div>
`;

  const bandList = (o) => D.bandLabels.map((l, i) => [l, o.bands[i]]);
  const p3 = `
    ${head("04", "幾多歲最多人 claim？", `危疾平均 ${ci.avgAge} 歲、41–60 歲佔 ${f.p(ciAge[2], 0)}；身故平均 ${de.avgAge} 歲。`)}
    <div class="g2">
      <div class="box"><h3>${Y} 年各年齡組佔比</h3>${chart("cAge", 66)}</div>
      <div class="box"><h3>三大危疾嘅年齡分佈（${Y}）</h3>${chart("cAgeDis", 66)}</div>
    </div>
    ${head("05", "咩病最多人 claim？", "癌症年年都係第一位：危疾約四分三、身故約四成。")}
    <div class="g2">
      <div class="box">
        <h3>${Y} 年危疾原因（首 6 位）</h3>
        ${bars(ci.causes.slice(0, 6), (x, i) => i < 3 ? C.ci : C.ciL, { total: ci.n })}
        <h3 style="margin-top:3mm">癌症個案首 5 位</h3>
        ${bars(ci.cancers, (x, i) => i === 0 ? C.female : C.ci, { total: ci.causes[0][1] })}
      </div>
      <div class="box">
        <h3>${Y} 年身故原因（首 6 位）</h3>
        ${bars(de.causes.slice(0, 6), (x, i) => i < 3 ? C.death : C.deathL, { total: de.n })}
        <h3 style="margin-top:3mm">癌症佔比 七年變化</h3>
        <table><thead><tr><th></th>${YEARS.map((y) => `<th>${String(y).slice(2)}</th>`).join("")}</tr></thead><tbody>
          <tr><td>佔危疾</td>${YEARS.map((y) => `<td>${causePct(D.critical[y], "癌症").toFixed(0)}%</td>`).join("")}</tr>
          <tr><td>佔身故</td>${YEARS.map((y) => `<td>${causePct(D.death[y], "癌症").toFixed(0)}%</td>`).join("")}</tr>
        </tbody></table>
      </div>
    </div>
`;

  const I = D.inflation;
  const surg = I.surgeries.map((x) => ({ ...x, c: pct(x.y2022[1] - x.y2018[1], x.y2018[1]) })).sort((a, b) => b.c - a.c);
  const p4 = `
    ${head("06", "一宗賠幾多？平均數會呃人")}
    <div class="g2">
      <div class="box">
        <h3>${Y} 年每宗賠償額分佈</h3>
        <p class="note" style="margin:0 0 1mm">危疾</p>
        ${bars(bandList(ci), (x, i) => i >= 3 ? C.ci : C.ciL, { total: ci.n })}
        <p class="note" style="margin:2mm 0 1mm">身故</p>
        ${bars(bandList(de), (x, i) => i >= 3 ? C.death : C.deathL, { total: de.n })}
      </div>
      <div class="box">
        <h3>危疾：平均 vs 最高一宗</h3>
        ${chart("cMax", 62)}
        <p class="note">平均約 38–40 萬七年冇乜變，但最高一宗由 ${f.wan(D.critical[YEARS[0]].max)} 升到 ${f.wan(ci.max)}。</p>
      </div>
    </div>
    ${head("07", "醫療通脹：手術費、病房費年年升", "住院賠款七年升咗九成幾，背後係醫療費本身越來越貴。")}
    <div class="g2">
      <div class="box"><h3>住院手術費平均數（個人保單）</h3>${chart("cSurgeon", 60)}<p class="note">香港保險業聯會醫療索償數據調查。2019→2022：半私家房 +22%、標準房 +25%。</p></div>
      <div class="box"><h3>私家外科醫生收費：2018 → 2025</h3>
        <table><thead><tr><th></th><th>2018</th><th>2025</th><th>升幅</th></tr></thead><tbody>
        ${I.doctorFees.map((d) => `<tr><td>${d[0]}</td><td>${f.money(d[1])}</td><td><b>${f.money(d[2])}</b></td><td>${f.chg(d[2], d[1])}</td></tr>`).join("")}
        </tbody></table><p class="note">香港醫學會私家醫生收費調查：7 年間升 20%–50%。</p></div>
    </div>
`;

  const p5b = `
    ${head("07", "醫療通脹（續）：同一個手術、同一間醫院，今日貴幾多？")}
    <div class="box">
      <h3>常見手術收費中位數：2018 → 2022</h3>
      <table><thead><tr><th>手術</th><th>私家房 2018</th><th>私家房 2022</th><th>半私家 2018</th><th>半私家 2022</th><th>半私家升幅</th><th>標準房 2018</th><th>標準房 2022</th></tr></thead><tbody>
      ${surg.map((x) => `<tr><td>${x.name}</td><td>${f.money(x.y2018[0])}</td><td>${f.money(x.y2022[0])}</td><td>${f.money(x.y2018[1])}</td><td><b>${f.money(x.y2022[1])}</b></td><td>${f.chg(x.y2022[1], x.y2018[1])}</td><td>${f.money(x.y2018[2])}</td><td>${f.money(x.y2022[2])}</td></tr>`).join("")}
      </tbody></table>
    </div>
    <div class="box">
      <h3>私家醫院每日病房收費：2019 → 2026</h3>
      <table><thead><tr><th>醫院</th><th>半私家 2019</th><th>半私家 2026</th><th>升幅</th><th>普通房 2019</th><th>普通房 2026</th><th>升幅</th></tr></thead><tbody>
      ${I.rooms.map((r) => `<tr><td>${r.name}</td><td>$${r.semi[0]}</td><td>$${r.semi[1]}</td><td>${f.chg(r.semiMid[1], r.semiMid[0])}</td><td>$${r.ward[0]}</td><td>$${r.ward[1]}</td><td>${f.chg(r.wardMid[1], r.wardMid[0])}</td></tr>`).join("")}
      </tbody></table>
      <p class="note">各醫院網站公布價（2019 年 4 月及 2026 年 6 月）。升幅按收費範圍中間值計，只計房租。</p>
    </div>
    <div class="callout"><b>約 ${D.hk.uncovered.pct}% 香港人（約 ${Math.round(D.hk.uncovered.people / 1e4)} 萬人）</b>冇僱主醫療福利，亦冇自己買醫療保險。<span style="color:${C.ink2}">（政府統計處，2026 年 3 月）</span></div>`;
  const cls = (v) => v >= 80 ? "ok" : v >= 50 ? "mid" : "bad";
  const p5 = `
    <div class="g2">
      <div class="box"><h3>大型手術一次要幾多錢？（中大醫院定價）</h3>
        ${bars(I.complex, C.accent, { wide: true, val: (x) => f.wan(x[1]) + "–" + f.wan(x[2]) })}
        <div class="legend"><span><i style="background:${C.accent}"></i>Level 1</span><span><i style="background:${C.accent};opacity:.35"></i>最高到 Level 3</span></div>
        <p class="note">4 人房，2025 年 12 月。Level 3 = 有嚴重併發症。</p></div>
      <div class="box"><h3>癌症標靶藥：一年藥費</h3>
        ${bars(I.drugs, C.ci, { val: (x) => x[1] === x[2] ? f.wan(x[1]) : f.wan(x[1]) + "–" + f.wan(x[2]) })}
        <p class="note">每月平均支出 × 12 估算。部分屬門診藥物，要睇醫療保障有冇包。</p></div>
    </div>

    ${head("08", "癌症：早發現存活率高，但會復發")}
    <div class="g2">
      <div class="box"><h3>五年相對存活率（按期數）</h3>
        <table><thead><tr><th>癌症</th><th>第一期</th><th>第二期</th><th>第三期</th><th>第四期</th></tr></thead><tbody>
        ${D.hk.survival.map((r) => `<tr><td>${r[0]}</td>${r[1].map((v) => `<td><span class="pill ${cls(v)}">${v.toFixed(1)}%</span></td>`).join("")}</tr>`).join("")}
        </tbody></table><p class="note">香港癌症資料統計中心（2024 年 10 月）。</p></div>
      <div class="box"><h3>危疾復發率參考</h3>
        <table><tbody>${D.hk.recurrence.map((r) => `<tr><td>${r[0]}</td><td><b style="color:${C.accent}">${r[1]}</b></td></tr>`).join("")}</tbody></table>
        <p class="note">復發率視乎研究、期數同治療，只供參考。如果保障只賠一次，復發時就可能冇得再 claim。</p>
        <p class="note">75 歲前：${D.hk.cancerRisk.men}、${D.hk.cancerRisk.women}可能患癌。</p></div>
    </div>
    <div class="g2">
      <div class="box"><h3>香港男性最常見癌症（2023）</h3>${bars(D.hk.cancerByGender2023.male, C.male, { val: (x) => f.num(x[1]) + " 宗" })}</div>
      <div class="box"><h3>香港女性最常見癌症（2023）</h3>${bars(D.hk.cancerByGender2023.female, C.female, { val: (x) => f.num(x[1]) + " 宗" })}</div>
    </div>`;

  const qs = [
    ["我嘅危疾保單賠幾多次？", "癌症、心臟病、中風都有機會復發。如果只賠一次，第二次出事就要靠自己。"],
    ["醫療保險有冇全數賠償，或者夠高嘅每年限額？", "一次複雜手術可以去到 $86 萬，一年標靶藥可以超過 $180 萬。睇清楚門診癌症治療包唔包。"],
    ["人壽保額夠唔夠還按揭同養家？", `身故平均賠償只係 ${f.wan(de.avg)}，對大部分家庭嚟講遠遠唔夠。`],
    ["投保時有冇如實申報健康狀況？", "危疾成功索償率約 85–89%，係四類之中最低。如實申報、清楚定義，可以減低日後爭議。"],
    ["上一次檢視保障係幾時？", "手術費、病房費年年升，保額買咗幾年可能已經追唔上。建議每 1–2 年檢視一次。"]
  ];
  const p6 = `
    ${head("09", "同顧問傾之前，問自己 5 條問題")}
    <ol class="qs">${qs.map((q) => `<li><b>${q[0]}</b>${q[1]}</li>`).join("")}</ol>
    ${head("10", "我嘅保障一覽", "同顧問一齊填。")}
    <table class="fill">
      <thead><tr><th>保障</th><th>現有保額／計劃</th><th>建議參考</th><th>缺口／跟進</th></tr></thead>
      <tbody>
        <tr><td>人壽</td><td></td><td>家庭開支 × 年數 ＋ 債務 − 儲蓄</td><td></td></tr>
        <tr><td>危疾</td><td></td><td>年收入 3–5 倍；有冇多次賠償</td><td></td></tr>
        <tr><td>醫療</td><td></td><td>全數賠償或足夠年限額；門診癌症治療</td><td></td></tr>
        <tr><td>意外</td><td></td><td></td><td></td></tr>
        <tr><td>其他</td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="contact">
      <div><b>想詳細睇吓自己嘅保障？</b><br><span>約 ${ct.name || "顧問"} 一齊對照數據檢視保單。</span></div>
      <div style="text-align:right"><span>電話／WhatsApp</span><br><b>${ct.phone || ""}</b></div>
    </div>
    <div>
      <h3>資料來源</h3>
      <ol class="src">${D.sources.map((x) => `<li>${x}</li>`).join("")}</ol>
    </div>
    <p class="disc">本資料由 MKPA 整理，用作講解理賠數據，唔構成任何產品要約、建議或游說；所有數字只供參考。建議保額參考為簡化估算，實際需要請同顧問詳細分析。最後更新：${D.meta.updated}。</p>`;

  document.getElementById("pages").innerHTML = [
    page(1, "", p1), page(2, "claim 咩最多 · 男女分別", p2), page(3, "年齡 · 病因 · 賠償額", p3),
    page(4, "賠償額 · 醫療通脹", p4), page(5, "手術費 · 病房費", p5b), page(6, "醫療開支 · 癌症", p5), page(7, "檢視保障", p6)
  ].join("");

  /* ---------- charts ---------- */
  if (window.Chart) {
    Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.color = C.ink2;
    Chart.defaults.animation = false;
    Chart.defaults.devicePixelRatio = 3;
  }
  const opts = (extra = {}) => Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top", align: "start", labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 8, boxHeight: 8, padding: 10 } }, tooltip: { enabled: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: C.grid }, border: { display: false }, ticks: { color: C.muted } } }
  }, extra);
  const mk = (id, cfg) => { const el = document.getElementById(id); if (el && window.Chart) new Chart(el, cfg); };
  const barDs = (label, data, color) => ({ label, data, backgroundColor: color, borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: "bottom", maxBarThickness: 26, categoryPercentage: 0.7, barPercentage: 0.9 });
  const lineDs = (label, data, color, dash) => ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 3, tension: 0.2, borderDash: dash || [] });

  let o = opts(); o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.y.beginAtZero = true; o.scales.y.title = { display: true, text: "億港元", color: C.muted };
  mk("cTrend", { type: "bar", data: { labels: YEARS, datasets: CATS.map((c) => ({ label: c.name, data: YEARS.map((y) => D.summary[y][c.key].amt), backgroundColor: c.color, borderColor: "#fff", borderWidth: { top: 1.5 }, borderSkipped: false, borderRadius: 3, maxBarThickness: 46 })) }, options: o });

  const ry = YEARS.filter((y) => D.summary[y].hospital.rate != null);
  o = opts(); o.scales.y.min = 80; o.scales.y.max = 100; o.scales.y.ticks.callback = (v) => v + "%";
  mk("cRate", { type: "line", data: { labels: ry, datasets: CATS.map((c) => lineDs(c.name, ry.map((y) => D.summary[y][c.key].rate), c.color)) }, options: o });

  o = opts(); o.scales.y.min = 30; o.scales.y.max = 75; o.scales.y.ticks.callback = (v) => v + "%";
  mk("cFemale", { type: "line", data: { labels: YEARS, datasets: [lineDs("危疾 女性佔比", YEARS.map((y) => femaleShare(D.critical[y])), C.female), lineDs("身故 女性佔比", YEARS.map((y) => femaleShare(D.death[y])), C.male, [4, 3])] }, options: o });

  o = opts(); o.scales.y.title = { display: true, text: "宗數", color: C.muted };
  mk("cCiGender", { type: "bar", data: { labels: D.ageGroups.slice(0, 4), datasets: [barDs("男", ci.male.slice(0, 4), C.male), barDs("女", ci.female.slice(0, 4), C.female)] }, options: o });

  o = opts(); o.scales.y.ticks.callback = (v) => v + "%";
  mk("cAge", { type: "bar", data: { labels: D.ageGroups, datasets: [barDs("危疾", ciAge, C.ci), barDs("身故", deAge, C.death)] }, options: o });

  const abd = ci.ageByDisease, names = Object.keys(abd), ramp = ["#e4e0f8", "#b3a9ee", "#8274e0", "#6250d6", "#3a2c94"];
  o = opts({ indexAxis: "y" }); o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.max = 100; o.scales.x.grid = { color: C.grid }; o.scales.x.ticks = { callback: (v) => v + "%", color: C.muted }; o.scales.y.grid = { display: false };
  mk("cAgeDis", { type: "bar", data: { labels: names, datasets: D.ageGroups.map((g, i) => ({ label: g, data: names.map((n) => abd[n][i]), backgroundColor: ramp[i], borderColor: "#fff", borderWidth: { right: 1.5 }, borderSkipped: false, maxBarThickness: 26 })).filter((d) => sum(d.data) > 0) }, options: o });

  o = opts(); o.scales.y.beginAtZero = true; o.scales.y.ticks.callback = (v) => v / 1e4 + "萬";
  mk("cMax", { type: "bar", data: { labels: YEARS, datasets: [
    { type: "bar", label: "最高一宗", data: YEARS.map((y) => D.critical[y].max), backgroundColor: C.ciL, borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: "bottom", maxBarThickness: 28, order: 2 },
    { type: "line", label: "平均每宗", data: YEARS.map((y) => D.critical[y].avg), borderColor: C.ci, backgroundColor: C.ci, borderWidth: 2, pointRadius: 3, order: 1 }] }, options: o });

  const rooms = ["私家房", "半私家房", "標準房"], rc = ["#2a78d6", "#eb6834", "#1baf7a"];
  o = opts(); o.scales.y.ticks.callback = (v) => "$" + v / 1000 + "k";
  mk("cSurgeon", { type: "line", data: { labels: I.surgeonMean.years.map(String), datasets: rooms.map((r, i) => lineDs(r, I.surgeonMean[r], rc[i])) }, options: o });

  /* ---------- screen fit & print ---------- */
  const pages = [...document.querySelectorAll(".page")];
  function fit() {
    const w = document.documentElement.clientWidth;
    const z = w < 820 ? (w - 12) / 794 : 1;
    pages.forEach((p) => { p.style.zoom = z === 1 ? "" : z; });
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("beforeprint", () => pages.forEach((p) => { p.style.zoom = ""; }));
  window.addEventListener("afterprint", fit);
  document.getElementById("doPrint").addEventListener("click", () => window.print());
})();
