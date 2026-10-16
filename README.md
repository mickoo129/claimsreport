# 七年理賠數據解讀 2019–2025（MKPA）

用《個人保險賠償報告》2019–2025 年版整理嘅客戶講解網站：七年走勢、咩 claim 得多／少、男女分別、年齡、病因、賠償額分佈、醫療通脹、癌症存活／復發，同埋保障自我檢查。

## 檔案
| 檔案 | 用途 |
|---|---|
| `index.html` | 版面同文字 |
| `styles.css` | 樣式（包括手機版同列印版） |
| `data.js` | **全部數字**，每個數都註明出自邊份報告 |
| `app.js` | 圖表、年份切換、保障檢查計算 |
| `print.html` / `print.css` / `print.js` | A4 列印版（7 頁，用同一份 `data.js`） |

## 每年更新（例如 2026 年報告出咗）
1. 喺 `data.js` 嘅 `meta.years` 加 `2026`，`meta.latest` 改做 `2026`。
2. 喺 `summary`、`death`、`critical` 各加一個 `2026: {...}`，格式照抄 2025。
3. 年齡分組用 `0-20 / 21-40 / 41-60 / 61-80 / 80+`；金額分佈由細到大五組。
4. 改 `meta.updated`。其他圖表會自動更新。

## 聯絡掣
聯絡資料喺 `data.js` 嘅 `meta.contact`（`whatsapp` 要連 852，例如 `85267256685`）。頁尾同 A4 版最後一頁都會用。

頁尾版權年份會自動跟當年年份。

## 部署
純靜態網站，唔使 build：
- **GitHub Pages**：Settings → Pages → Deploy from branch → `main` / root。
- **Netlify**：直接拖成個資料夾上去，或者連呢個 repo。

## 免責
本網站由 MKPA 整理，唔構成任何產品要約或建議。

© Michael Koo Protection Alliance (MKPA). 版權所有。
