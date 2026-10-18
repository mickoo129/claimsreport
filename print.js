/* global Chart */
(function () {
  "use strict";
  const D = window.CLAIMS;
  const YEARS = D.meta.years, Y = D.meta.latest, Y0 = YEARS[0];
  const CATS = [
    { key: "hospital", name: "住院", long: "醫療／住院", color: "#2a78d6", soft: "#a9c8f0", bg: "#eaf2fc" },
    { key: "death", name: "身故", long: "人壽／身故", color: "#eb6834", soft: "#f5b799", bg: "#fdf0ea" },
    { key: "critical", name: "危疾", long: "危疾", color: "#6250d6", soft: "#b3a9ee", bg: "#efedfb" },
    { key: "accident", name: "意外", long: "意外", color: "#1baf7a", soft: "#9fdcc4", bg: "#e8f7f1" }
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));
  const NAVY = { key: "all", long: "總覽", color: "#14213d", soft: "#c9cfdc", bg: "#eef0f5" };
  const CHECK = { key: "check", long: "檢視保障", color: "#b5502a", soft: "#e9c4b2", bg: "#f6e9e1" };
  const C = { male: "#2a78d6", female: "#e34948", grid: "#ebe7de", muted: "#7a8193", ink2: "#4a5468", old: "#c4c0b6", accent: "#b5502a" };
  const YEAR_NOW = new Date().getFullYear();

  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const growth = (a, b) => Math.round(pct(a - b, b));
  const f = {
    yi: (n) => Number(n).toFixed(2).replace(/\.?0+$/, ""),
    num: (n) => Math.round(n).toLocaleString("en-US"),
    money: (n) => "$" + Math.round(n).toLocaleString("en-US"),
    wan: (n) => n >= 1e8 ? "$" + f.yi(n / 1e8) + "億" : n >= 1e5 ? "$" + Math.round(n / 1e4).toLocaleString("en-US") + "萬" : n >= 1e4 ? "$" + (n / 1e4).toFixed(1).replace(/\.0$/, "") + "萬" : "$" + Math.round(n).toLocaleString("en-US"),
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
  const box = (t, inner) => `<div class="box"><h3>${t}</h3>${inner}</div>`;
  const sub = (no, t) => `<h2 class="title"><span class="no">${no}</span>${t}</h2>`;
  const kf = (big, text) => `<div class="kfp"><b>${big}</b><span>${text}</span></div>`;

  const pages = [];
  function page(cat, title, body) { pages.push({ cat, title, body }); }
  function chBanner(cat, part, h, desc, statsHtml) {
    return `<div class="chb"><span class="chn">${part}</span><h2>${h}</h2><p>${desc}</p>${statsHtml || ""}</div>`;
  }
  function catStats(c) {
    const s = D.summary[Y][c.key], s0 = D.summary[Y0][c.key];
    const avg = c.key === "death" ? D.death[Y].avg : c.key === "critical" ? D.critical[Y].avg : (s.amt * 1e8) / s.cases;
    return `<div class="chs">${[
      [`${Y} 年賠款`, `${f.yi(s.amt)} 億`, `七年 +${growth(s.amt, s0.amt)}%`],
      [`${Y} 年成功宗數`, `${f.num(s.cases)}+`, `七年 +${growth(s.cases, s0.cases)}%`],
      ["平均每宗", f.wan(avg), c.key === "hospital" || c.key === "accident" ? "總額 ÷ 宗數推算" : "報告公布平均"]
    ].map((x) => `<div><span>${x[0]}</span><b>${x[1]}</b><em>${x[2]}</em></div>`).join("")}</div>`;
  }

  const s = D.summary[Y], s0 = D.summary[Y0];
  const ci = D.critical[Y], de = D.death[Y];
  const ct = D.meta.contact || {};
  const I = D.inflation;

  /* ---- 1 cover + trend ---- */
  page(NAVY, "", `
    <div class="cover">
      <p class="eb">個人保險賠償報告 · ${Y0}–${Y} · 香港及澳門保單</p>
      <h1>七年理賠數據，<br>睇清楚錢賠咗去邊</h1>
      <p>按醫療、危疾、人壽、意外四類分開講：邊類最多人用、男女有咩分別、幾多歲最易出事，同埋醫療費每年升幾多。</p>
      <div class="pnch"><b>每 ${((365 * 24 * 60) / s.cases).toFixed(1)} 分鐘</b><span>就有一宗理賠成功賠出 · 平均每日賠出 $${f.num((s.total * 1e8) / 365 / 1e4)}萬</span></div>
      <div class="kstats">${[
        [null, "四類總賠償", `${s.total}億+`, `${Y0} 年 ${s0.total} 億 · +${growth(s.total, s0.total)}%`],
        ["hospital", "醫療／住院", `${Math.round(s.hospital.cases / 365)} 宗／日`, `${f.num(s.hospital.cases)} 宗／年`],
        ["critical", "危疾", `${(ci.n / 365).toFixed(1)} 宗／日`, `${f.num(ci.n)} 宗／年`],
        ["death", "人壽／身故", `${(de.n / 365).toFixed(1)} 宗／日`, `${f.num(de.n)} 宗／年`],
        ["accident", "意外", `${Math.round(s.accident.cases / 365)} 宗／日`, `${f.num(s.accident.cases)} 宗／年`]
      ].map((x) => `<div style="border-top:1.2mm solid ${x[0] ? CAT[x[0]].color : "#f0b28f"}"><span>${x[1]}</span><b>${x[2]}</b><i>${x[3]}</i></div>`).join("")}</div>
    </div>
    <div class="toc">${[[NAVY, "1", "總覽：四類比較", 2], [CAT.hospital, "2", "醫療／住院", 3], [CAT.critical, "3", "危疾", 6], [CAT.death, "4", "人壽／身故", 9], [CAT.accident, "5", "意外", 10], [CHECK, "6", "檢視保障", 11]]
      .map((x) => `<div style="border-left:1.4mm solid ${x[0].color}"><b>第 ${x[1]} 部分</b><span>${x[2]}</span><em>P.${x[3]}</em></div>`).join("")}</div>
    ${sub("1.1", "七年走勢：賠款差唔多翻倍")}
    <p class="lead-s">${Y0} → ${Y}：醫療 +${growth(s.hospital.amt, s0.hospital.amt)}%、危疾 +${growth(s.critical.amt, s0.critical.amt)}%、人壽 +${growth(s.death.amt, s0.death.amt)}%、意外 +${growth(s.accident.amt, s0.accident.amt)}%。</p>
    <div class="box">${chart("cTrend", 52)}</div>
    <table>
      <thead><tr><th>億港元</th>${YEARS.map((y) => `<th>${y}</th>`).join("")}</tr></thead>
      <tbody>${CATS.map((c) => `<tr><td><span class="dot" style="background:${c.color}"></span>${c.long}</td>${YEARS.map((y) => `<td>${f.yi(D.summary[y][c.key].amt)}</td>`).join("")}</tr>`).join("")}
        <tr><td><b>公布總額</b></td>${YEARS.map((y) => `<td><b>${D.summary[y].total}</b></td>`).join("")}</tr></tbody>
    </table>`);

  /* ---- 2 overview: claim most ---- */
  const per = CATS.map((c) => c.key === "death" ? de.avg : c.key === "critical" ? ci.avg : (s[c.key].amt * 1e8) / s[c.key].cases);
  const tc = catSum(Y, "cases"), ta = catSum(Y, "amt");
  page(NAVY, "第 1 部分 · 總覽", `
    ${sub("1.2", "咩 claim 得最多？")}
    ${kf("醫療", `每 5 宗理賠有 4 宗係醫療／住院（${Y} 年 ${f.num(s.hospital.cases)} 宗），七年宗數升 ${growth(s.hospital.cases, s0.hospital.cases)}%。`)}
    ${box(`每類每年成功獲賠宗數（${Y0}–${Y}）`, `<div class="g4">${CATS.map((c) => { const a = D.summary[Y0][c.key].cases, b = s[c.key].cases; return `<div><div class="mh"><span><i style="background:${c.color}"></i>${c.long}</span><b style="color:${c.color}">+${growth(b, a)}%</b></div><div class="mv">${f.num(a)} → <b>${f.num(b)}</b></div>${chart("cCnt-" + c.key, 44)}</div>`; }).join("")}</div><p class="note">各圖刻度唔同；2019–2021 年身故及危疾以「保單」計。</p>`)}
    ${box(`${Y} 年四類比較`, `<table>
        <thead><tr><th></th><th>成功宗數</th><th>佔宗數</th><th>金額（億）</th><th>佔金額</th><th>平均每宗</th></tr></thead>
        <tbody>${CATS.map((c, i) => `<tr><td><span class="dot" style="background:${c.color}"></span>${c.long}</td><td>${f.num(s[c.key].cases)}</td><td>${f.p(pct(s[c.key].cases, tc))}</td><td>${f.yi(s[c.key].amt)}</td><td>${f.p(pct(s[c.key].amt, ta))}</td><td><b>${f.money(per[i])}</b></td></tr>`).join("")}</tbody>
      </table><p class="note">一宗危疾平均賠償約等於 ${Math.round(per[2] / per[0])} 宗住院。住院、意外平均 = 總額 ÷ 成功宗數。</p>`)}
    ${box("每 100 宗申請，有幾多宗獲賠？（2024 年）", CATS.map((c) => { const v = D.summary[2024][c.key].rate; return `<div class="br w"><span>${c.long}</span><span class="bt"><i style="width:${v}%;background:${c.color}"></i></span><span class="bv"><b>${Math.round(v)}</b> / 100</span></div>`; }).join("") + `<p class="note">危疾要符合指定疾病定義，所以相對低；投保時要如實申報。</p>`)}`);

  /* ---- 3–5 medical ---- */
  const H = CAT.hospital;
  page(H, "第 2 部分 · 醫療／住院保險", `
    ${chBanner(H, "第 2 部分 · 醫療／住院保險", "醫療：claim 得最多、用得最密", "住院、手術、醫生費嘅賠償。本部分所有數字都係講醫療／住院。", catStats(H))}
    ${kf(f.p(pct(s.hospital.cases, s.cases), 0), `${Y} 年每 5 宗理賠有 4 宗係醫療／住院，賠出 ${s.hospital.amt} 億，係四類之中用得最密、賠得最多。`)}
    ${sub("2.1", "醫療 claim 咗幾多？")}
    <div class="g2">${box("每年賠款（億港元）", chart("hAmt", 48))}${box("每年成功宗數", chart("hCases", 48))}</div>
    ${sub("2.2", "醫療費升幾多？")}
    <div class="g2">
      ${box("住院手術費平均數（個人保單）", chart("cSurgeon", 52) + `<p class="note">香港保險業聯會。2019→2022：半私家房 +22%、標準房 +25%。</p>`)}
      ${box("私家外科醫生收費：2018 → 2025", `<table><thead><tr><th></th><th>2018</th><th>2025</th><th>升幅</th></tr></thead><tbody>${I.doctorFees.map((d) => `<tr><td>${d[0]}</td><td>${f.money(d[1])}</td><td><b>${f.money(d[2])}</b></td><td>${f.chg(d[2], d[1])}</td></tr>`).join("")}</tbody></table><p class="note">香港醫學會私家醫生收費調查。</p>`)}
    </div>`);

  const surg = I.surgeries.map((x) => ({ ...x, c: pct(x.y2022[1] - x.y2018[1], x.y2018[1]) })).sort((a, b) => b.c - a.c);
  page(H, "第 2 部分 · 醫療／住院保險（續）", `
    ${sub("2.2", "醫療費升幾多？（續）")}
    ${box("常見手術收費中位數：2018 → 2022", `<table><thead><tr><th>手術</th><th>私家房 2018</th><th>私家房 2022</th><th>半私家 2018</th><th>半私家 2022</th><th>半私家升幅</th><th>標準房 2018</th><th>標準房 2022</th></tr></thead><tbody>
      ${surg.map((x) => `<tr><td>${x.name}</td><td>${f.money(x.y2018[0])}</td><td>${f.money(x.y2022[0])}</td><td>${f.money(x.y2018[1])}</td><td><b>${f.money(x.y2022[1])}</b></td><td>${f.chg(x.y2022[1], x.y2018[1])}</td><td>${f.money(x.y2018[2])}</td><td>${f.money(x.y2022[2])}</td></tr>`).join("")}
      </tbody></table>`)}
    ${box("私家醫院每日病房收費：2019 → 2026", `<table><thead><tr><th>醫院</th><th>半私家 2019</th><th>半私家 2026</th><th>升幅</th><th>普通房 2019</th><th>普通房 2026</th><th>升幅</th></tr></thead><tbody>
      ${I.rooms.map((r) => `<tr><td>${r.name}</td><td>$${r.semi[0]}</td><td>$${r.semi[1]}</td><td>${f.chg(r.semiMid[1], r.semiMid[0])}</td><td>$${r.ward[0]}</td><td>$${r.ward[1]}</td><td>${f.chg(r.wardMid[1], r.wardMid[0])}</td></tr>`).join("")}
      </tbody></table><p class="note">各醫院網站公布價（2019 年 4 月及 2026 年 6 月）。升幅按收費範圍中間值計，只計房租。</p>`)}
    <div class="callout"><b>約 ${D.hk.uncovered.pct}% 香港人（約 ${Math.round(D.hk.uncovered.people / 1e4)} 萬人）</b>冇僱主醫療福利，亦冇自己買醫療保險。（政府統計處，2026 年 3 月）</div>`);

  page(H, "第 2 部分 · 醫療／住院保險（續）", `
    ${sub("2.3", "一場大病，醫療費要幾多？")}
    <div class="g2">
      ${box("大型手術一次要幾多錢？（中大醫院定價）", bars(I.complex, C.accent, { wide: true, val: (x) => f.wan(x[1]) + "–" + f.wan(x[2]) }) + `<div class="legend"><span><i style="background:${C.accent}"></i>Level 1</span><span><i style="background:${C.accent};opacity:.35"></i>最高到 Level 3</span></div><p class="note">4 人房，2025 年 12 月。Level 3 = 有嚴重併發症。</p>`)}
      ${box("癌症標靶藥：一年藥費", bars(I.drugs, H.color, { val: (x) => x[1] === x[2] ? f.wan(x[1]) : f.wan(x[1]) + "–" + f.wan(x[2]) }) + `<p class="note">每月平均支出 × 12 估算。部分屬門診藥物，要睇醫療保障有冇包。</p>`)}
    </div>
    ${sub("2.4", "香港人幾時最多入院？")}
    ${box("香港住院人數（按年齡，2025 年調查）", chart("hAge", 60) + `<p class="note">政府統計處主題性住戶統計調查。25–44 歲開始明顯上升，65 歲或以上最多。</p>`)}`);

  /* ---- 6–8 critical ---- */
  const K = CAT.critical;
  const ciAge = D.ageGroups.map((_, i) => pct(ci.male[i] + ci.female[i], ci.n));
  page(K, "第 3 部分 · 危疾保險", `
    ${chBanner(K, "第 3 部分 · 危疾保險", "危疾：一確診就一筆過賠", "癌症、心臟病、中風等指定疾病嘅賠償。本部分所有數字都係講危疾。", catStats(K))}
    ${kf(`${ci.avgAge} 歲`, `危疾平均索賠年齡 ${ci.avgAge} 歲，${f.p(ciAge[2], 0)} 喺 41–60 歲出事，正正係供樓、養家最重嘅時候。`)}
    ${sub("3.1", "危疾 claim 咗幾多？")}
    <div class="g2">${box("每年賠款（億港元）", chart("kAmt", 42))}${box("每年成功宗數", chart("kCases", 42))}</div>
    ${sub("3.2", "男定女多？")}
    <div class="g2">
      ${box("女性佔幾多？（七年）", chart("kFemale", 48) + `<p class="note">七年都企喺 63–68%，主因乳癌。</p>`)}
      ${box(`${Y} 年：年齡 × 性別`, chart("kGender", 48) + `<p class="note">21–40 歲女性個案係男性嘅 ${(ci.female[1] / ci.male[1]).toFixed(1)} 倍。</p>`)}
    </div>`);
  page(K, "第 3 部分 · 危疾保險（續）", `
    ${sub("3.3", "幾多歲最多？")}
    <div class="g2">${box(`${Y} 年各年齡組佔比`, chart("kAge", 46))}${box(`三大危疾嘅年齡分佈（${Y}）`, chart("kAgeDis", 46))}</div>
    ${sub("3.4", "咩病最多人 claim？")}
    <div class="g2">
      ${box(`${Y} 年危疾原因（首 6 位）`, bars(ci.causes.slice(0, 6), (x, i) => i < 3 ? K.color : K.soft, { total: ci.n }))}
      ${box("癌症個案首 5 位", bars(ci.cancers, (x, i) => i === 0 ? C.female : K.color, { total: ci.causes[0][1] }) + `<p class="note">百分比係佔癌症個案。</p>`)}
    </div>
    ${sub("3.5", "一宗賠幾多？")}
    ${kf(`${Math.round(ci.max / ci.avg)} 倍`, `最高一宗 ${f.wan(ci.max)}，係平均 ${f.wan(ci.avg)} 嘅 ${Math.round(ci.max / ci.avg)} 倍。分別在於當初買咗幾多保額。`)}
    <div class="g2">
      ${box(`${Y} 年每宗賠償額分佈`, bars(D.bandLabels.map((l, i) => [l, ci.bands[i]]), (x, i) => i >= 3 ? K.color : K.soft, { total: ci.n }))}
      ${box("平均 vs 最高一宗（七年）", chart("kMax", 40))}
    </div>`);
  const cls = (v) => v >= 80 ? "ok" : v >= 50 ? "mid" : "bad";
  page(K, "第 3 部分 · 危疾保險（續）", `
    ${sub("3.6", "癌症知多啲")}
    <div class="g2">
      ${box("五年相對存活率（按期數）", `<table><thead><tr><th>癌症</th><th>第一期</th><th>第二期</th><th>第三期</th><th>第四期</th></tr></thead><tbody>
        ${D.hk.survival.map((r) => `<tr><td>${r[0]}</td>${r[1].map((v) => `<td><span class="pill ${cls(v)}">${v.toFixed(1)}%</span></td>`).join("")}</tr>`).join("")}
        </tbody></table><p class="note">香港癌症資料統計中心（2024 年 10 月）。</p>`)}
      ${box("危疾復發率參考", `<table><tbody>${D.hk.recurrence.map((r) => `<tr><td>${r[0]}</td><td><b style="color:${C.accent}">${r[1]}</b></td></tr>`).join("")}</tbody></table><p class="note">復發率視乎研究、期數同治療，只供參考。如果保障只賠一次，復發時就可能冇得再 claim。</p>`)}
    </div>
    <div class="g2">
      ${box("香港男性最常見癌症（2023）", bars(D.hk.cancerByGender2023.male, C.male, { val: (x) => f.num(x[1]) + " 宗" }))}
      ${box("香港女性最常見癌症（2023）", bars(D.hk.cancerByGender2023.female, C.female, { val: (x) => f.num(x[1]) + " 宗" }))}
    </div>
    <p class="note">香港癌症資料統計中心：75 歲前，${D.hk.cancerRisk.men}、${D.hk.cancerRisk.women}可能患癌。</p>
    <table class="trendt"><thead><tr><th>癌症佔危疾</th>${YEARS.map((y) => `<th>${y}</th>`).join("")}</tr></thead><tbody>
      <tr><td>癌症</td>${YEARS.map((y) => `<td>${causePct(D.critical[y], "癌症").toFixed(0)}%</td>`).join("")}</tr>
      <tr><td>三大危疾合計</td>${YEARS.map((y) => `<td>${(causePct(D.critical[y], "癌症") + causePct(D.critical[y], "心臟疾病") + causePct(D.critical[y], "腦血管疾病")).toFixed(0)}%</td>`).join("")}</tr>
    </tbody></table>`);

  /* ---- 9 life ---- */
  const L = CAT.death;
  const deAge = D.ageGroups.map((_, i) => pct(de.male[i] + de.female[i], de.n));
  page(L, "第 4 部分 · 人壽保險（身故賠償）", `
    ${chBanner(L, "第 4 部分 · 人壽保險（身故賠償）", "人壽：留俾屋企人嘅一筆錢", "受保人身故後賠俾家人嘅錢。本部分所有數字都係講人壽／身故。", catStats(L))}
    ${kf(f.wan(de.avg), `${Y} 年身故平均每宗只賠 ${f.wan(de.avg)}；${f.p(pct(de.bands[0], de.n), 0)} 個案賠 $25 萬或以下。人壽保額要按家庭開支、按揭同供養年期去計。`)}
    <div class="g2">${box("每年賠款（億港元）", chart("lAmt", 28))}${box("每年成功宗數", chart("lCases", 28))}</div>
    <div class="g2">
      ${box(`${Y} 年：年齡 × 性別`, chart("lGender", 44) + `<p class="note">男性佔 ${f.p(100 - femaleShare(de), 0)}；61–80 歲男性明顯較多，80 歲以上女性較多。</p>`)}
      ${box(`${Y} 年死因（首 6 位）`, bars(de.causes.slice(0, 6), (x, i) => i < 3 ? L.color : L.soft, { total: de.n }) + `<p class="note">平均索賠年齡 ${de.avgAge} 歲；${f.p(deAge[3], 0)} 喺 61–80 歲。</p>`)}
    </div>
    <div class="g2">
      ${box(`${Y} 年每宗賠償額分佈`, bars(D.bandLabels.map((l, i) => [l, de.bands[i]]), (x, i) => i >= 3 ? L.color : L.soft, { total: de.n }))}
      ${box("平均 vs 最高一宗（七年）", chart("lMax", 34))}
    </div>`);

  /* ---- 10 accident ---- */
  const A = CAT.accident;
  const accDeath = de.causes.find((x) => x[0] === "意外");
  const accAvg = YEARS.map((y) => (D.summary[y].accident.amt * 1e8) / D.summary[y].accident.cases);
  page(A, "第 5 部分 · 意外保險", `
    ${chBanner(A, "第 5 部分 · 意外保險", "意外：宗數多、每宗細", "意外受傷嘅醫療同賠償。本部分所有數字都係講意外。", catStats(A))}
    ${kf(`${f.num(s.accident.cases)} 宗`, `意外宗數僅次於醫療，但每宗平均只係 ${f.money(accAvg[accAvg.length - 1])}，屬於「宗數多、每宗細」。真正大額嘅意外要靠醫療同人壽保障。`)}
    <div class="g2">${box("每年賠款（億港元）", chart("aAmt", 50))}${box("每年成功宗數", chart("aCases", 50))}</div>
    ${box("平均每宗賠幾多？", chart("aAvg", 46) + `<p class="note">總額 ÷ 成功宗數推算。報告冇公布意外類型同年齡分佈。${accDeath ? `${Y} 年身故賠償之中有 ${accDeath[1]} 宗係意外身故。` : ""}</p>`)}`);

  /* ---- 11 check ---- */
  const qs = [
    ["危疾", "我嘅危疾保單賠幾多次？", "癌症、心臟病、中風都有機會復發。如果只賠一次，第二次出事就要靠自己。"],
    ["醫療", "醫療保險有冇全數賠償，或者夠高嘅每年限額？", "一次複雜手術可以去到 $86 萬，一年標靶藥可以超過 $180 萬。"],
    ["人壽", "人壽保額夠唔夠還按揭同養家？", `身故平均賠償只係 ${f.wan(de.avg)}，對大部分家庭嚟講遠遠唔夠。`],
    ["危疾", "投保時有冇如實申報健康狀況？", "危疾每 100 宗申請約有 85–89 宗獲賠，係四類之中最低。"],
    ["全部", "上一次檢視保障係幾時？", "手術費、病房費年年升，建議每 1–2 年檢視一次。"]
  ];
  const qc = { 危疾: K.color, 醫療: H.color, 人壽: L.color, 全部: NAVY.color };
  page(CHECK, "第 6 部分 · 檢視保障", `
    ${sub("6.1", "同顧問傾之前，問自己 5 條問題")}
    <ol class="qs">${qs.map((q) => `<li><b><span class="qt" style="background:${qc[q[0]]}">${q[0]}</span>${q[1]}</b>${q[2]}</li>`).join("")}</ol>
    ${sub("6.2", "我嘅保障一覽")}
    <table class="fill">
      <thead><tr><th>保障</th><th>現有保額／計劃</th><th>建議參考</th><th>缺口／跟進</th></tr></thead>
      <tbody>
        <tr><td style="border-left:1.2mm solid ${H.color}">醫療</td><td></td><td>全數賠償或足夠年限額；門診癌症治療</td><td></td></tr>
        <tr><td style="border-left:1.2mm solid ${K.color}">危疾</td><td></td><td>年收入 3–5 倍；有冇多次賠償</td><td></td></tr>
        <tr><td style="border-left:1.2mm solid ${L.color}">人壽</td><td></td><td>家庭開支 × 年數 ＋ 債務 − 儲蓄</td><td></td></tr>
        <tr><td style="border-left:1.2mm solid ${A.color}">意外</td><td></td><td></td><td></td></tr>
        <tr><td>其他</td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="contact">
      <div><b>想詳細睇吓自己嘅保障？</b><br><span>約 ${ct.name || "顧問"} 一齊對照數據檢視保單。</span></div>
      <div style="text-align:right"><span>電話／WhatsApp</span><br><b>${ct.phone || ""}</b></div>
    </div>
    <div><h3>資料來源</h3><ol class="src">${D.sources.map((x) => `<li>${x}</li>`).join("")}</ol></div>
    <p class="disc">本資料由 MKPA 整理，用作講解理賠數據，唔構成任何產品要約、建議或游說；所有數字只供參考。建議保額參考為簡化估算，實際需要請同顧問詳細分析。最後更新：${D.meta.updated}。</p>`);

  /* ---- render pages ---- */
  const total = pages.length;
  document.getElementById("pages").innerHTML = pages.map((p, i) => `
    <section class="page" style="--c:${p.cat.color};--soft:${p.cat.soft};--bg:${p.cat.bg}">
      ${i > 0 ? `<div class="ph"><span><b>MKPA</b> · 理賠數據解讀 ${Y0}–${Y}</span><span class="tag">${p.title}</span></div>` : ""}
      <div class="body">${p.body}</div>
      <div class="pf"><span>© ${YEAR_NOW} Michael Koo Protection Alliance (MKPA). 版權所有。</span><span>${i + 1} / ${total}</span></div>
    </section>`).join("");
  const hint = document.querySelector(".toolbar .hint");
  if (hint) hint.textContent = `A4 直度 · 共 ${total} 頁 · 建議勾選「背景圖形」`;

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
  const barDs = (label, data, color, ex = {}) => Object.assign({ label, data, backgroundColor: color, borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: "bottom", maxBarThickness: 26, categoryPercentage: 0.7, barPercentage: 0.9 }, ex);
  const lineDs = (label, data, color, ex = {}) => Object.assign({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 3, tension: 0.2 }, ex);
  const yearBars = (id, data, color, compact) => {
    const o = opts(); o.plugins.legend.display = false; o.scales.y.beginAtZero = true; o.scales.y.ticks.maxTicksLimit = 4;
    o.scales.y.ticks.callback = (v) => (v >= 1000 ? v / 1000 + "k" : v);
    if (compact) o.scales.x.ticks = { callback: function (v) { return String(this.getLabelForValue(v)).slice(2); }, font: { size: 8 } };
    mk(id, { type: "bar", data: { labels: YEARS, datasets: [barDs("", data, color)] }, options: o });
  };

  let o = opts(); o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.y.beginAtZero = true; o.scales.y.title = { display: true, text: "億港元", color: C.muted };
  mk("cTrend", { type: "bar", data: { labels: YEARS, datasets: CATS.map((c) => ({ label: c.long, data: YEARS.map((y) => D.summary[y][c.key].amt), backgroundColor: c.color, borderColor: "#fff", borderWidth: { top: 1.5 }, borderSkipped: false, borderRadius: 3, maxBarThickness: 46 })) }, options: o });
  CATS.forEach((c) => yearBars("cCnt-" + c.key, YEARS.map((y) => D.summary[y][c.key].cases), c.color, true));

  yearBars("hAmt", YEARS.map((y) => D.summary[y].hospital.amt), H.color);
  yearBars("hCases", YEARS.map((y) => D.summary[y].hospital.cases), H.color);
  o = opts(); o.scales.y.ticks.callback = (v) => "$" + v / 1000 + "k";
  mk("cSurgeon", { type: "line", data: { labels: I.surgeonMean.years.map(String), datasets: ["私家房", "半私家房", "標準房"].map((r, i) => lineDs(r, I.surgeonMean[r], ["#2a78d6", "#eb6834", "#1baf7a"][i])) }, options: o });
  o = opts(); o.plugins.legend.display = false; o.scales.y.ticks.callback = (v) => v / 1e4 + "萬";
  mk("hAge", { type: "bar", data: { labels: D.hk.hospByAge2025.map((x) => x[0] + " 歲"), datasets: [barDs("住院人數", D.hk.hospByAge2025.map((x) => x[1]), H.color, { maxBarThickness: 40 })] }, options: o });

  yearBars("kAmt", YEARS.map((y) => D.summary[y].critical.amt), K.color);
  yearBars("kCases", YEARS.map((y) => D.summary[y].critical.cases), K.color);
  o = opts(); o.scales.y.min = 30; o.scales.y.max = 75; o.scales.y.ticks.callback = (v) => v + "%";
  mk("kFemale", { type: "line", data: { labels: YEARS, datasets: [lineDs("女性佔比", YEARS.map((y) => femaleShare(D.critical[y])), C.female), lineDs("一半（50%）", YEARS.map(() => 50), "#b9b4a9", { borderWidth: 1, pointRadius: 0, borderDash: [2, 3] })] }, options: o });
  o = opts(); o.scales.y.title = { display: true, text: "宗數", color: C.muted };
  mk("kGender", { type: "bar", data: { labels: D.ageGroups.slice(0, 4), datasets: [barDs("男", ci.male.slice(0, 4), C.male), barDs("女", ci.female.slice(0, 4), C.female)] }, options: o });
  o = opts(); o.plugins.legend.display = false; o.scales.y.ticks.callback = (v) => v + "%";
  mk("kAge", { type: "bar", data: { labels: D.ageGroups, datasets: [barDs("危疾", ciAge, D.ageGroups.map((_, i) => ciAge[i] === Math.max(...ciAge) ? K.color : K.soft))] }, options: o });
  const abd = ci.ageByDisease, names = Object.keys(abd), ramp = ["#e4e0f8", "#b3a9ee", "#8274e0", "#6250d6", "#3a2c94"];
  o = opts({ indexAxis: "y" }); o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.x.max = 100; o.scales.x.grid = { color: C.grid }; o.scales.x.ticks = { callback: (v) => v + "%", color: C.muted }; o.scales.y.grid = { display: false };
  mk("kAgeDis", { type: "bar", data: { labels: names, datasets: D.ageGroups.map((g, i) => ({ label: g, data: names.map((n) => abd[n][i]), backgroundColor: ramp[i], borderColor: "#fff", borderWidth: { right: 1.5 }, borderSkipped: false, maxBarThickness: 26 })).filter((d) => sum(d.data) > 0) }, options: o });
  const maxChart = (id, key, c) => {
    const oo = opts(); oo.scales.y.beginAtZero = true; oo.scales.y.ticks.callback = (v) => v / 1e4 + "萬";
    mk(id, { type: "bar", data: { labels: YEARS, datasets: [barDs("最高一宗", YEARS.map((y) => D[key][y].max), c.soft, { order: 2 }), lineDs("平均每宗", YEARS.map((y) => D[key][y].avg), c.color, { type: "line", order: 1 })] }, options: oo });
  };
  maxChart("kMax", "critical", K);

  yearBars("lAmt", YEARS.map((y) => D.summary[y].death.amt), L.color);
  yearBars("lCases", YEARS.map((y) => D.summary[y].death.cases), L.color);
  o = opts(); o.scales.y.title = { display: true, text: "宗數", color: C.muted };
  mk("lGender", { type: "bar", data: { labels: D.ageGroups, datasets: [barDs("男", de.male, C.male), barDs("女", de.female, C.female)] }, options: o });
  maxChart("lMax", "death", L);

  yearBars("aAmt", YEARS.map((y) => D.summary[y].accident.amt), A.color);
  yearBars("aCases", YEARS.map((y) => D.summary[y].accident.cases), A.color);
  o = opts(); o.plugins.legend.display = false; o.scales.y.beginAtZero = true; o.scales.y.ticks.callback = (v) => "$" + f.num(v);
  mk("aAvg", { type: "line", data: { labels: YEARS, datasets: [lineDs("平均每宗", accAvg, A.color)] }, options: o });

  /* ---------- screen fit & print ---------- */
  const pageEls = [...document.querySelectorAll(".page")];
  function fit() {
    const w = document.documentElement.clientWidth;
    const z = w < 820 ? (w - 12) / 794 : 1;
    pageEls.forEach((p) => { p.style.zoom = z === 1 ? "" : z; });
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("beforeprint", () => pageEls.forEach((p) => { p.style.zoom = ""; }));
  window.addEventListener("afterprint", fit);
  document.getElementById("doPrint").addEventListener("click", () => window.print());
})();
