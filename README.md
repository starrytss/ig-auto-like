# IG Auto Like｜IG 自動刷新按讚

山姆蛋實驗室 SamEgg Lab 製作的 Chrome／Microsoft Edge 桌面擴充功能

定時刷新 Instagram 首頁 並依設定替符合條件的貼文按讚

目前版本 **v0.7.0** · 原始版本日期 **2026/10/22**

## 下載與安裝

- [下載 Chrome v0.7 ZIP](https://github.com/starrytss/ig-auto-like/raw/refs/heads/main/downloads/IG_AutoLike_Refresh_v0.7.zip)
- [下載 Edge v0.7 ZIP](https://github.com/starrytss/ig-auto-like/raw/refs/heads/main/downloads/IG_AutoLike_Refresh_Edge_v0.7.zip)
- [工具介紹與操作說明](https://samtss.com/tools/ig-auto-like/)

1. 下載對應 ZIP 並解壓縮
2. 開啟 `chrome://extensions` 或 `edge://extensions`
3. 開啟「開發人員模式」並選「載入未封裝項目」
4. 選擇直接包含 `manifest.json` 的資料夾
5. 回到已登入的 Instagram 首頁 重新整理分頁後開啟擴充功能設定並按「開始」

也可以使用 GitHub 的 **Code → Download ZIP** 下載完整原始碼
解壓縮後載入 `extensions/chrome` 或 `extensions/edge`

需求為桌面版 Chrome／Edge 120 以上
Safari 尚未提供可用版本 本專案不包含 Safari 程式

## 功能

- 自訂刷新秒數 按讚間隔 每輪最多篇數
- 首頁右上角固定尺寸浮動面板與每秒倒數
- 開始／暫停與本次統計
- 隱藏面板並記住顯示設定
- 可選擇是否包含未追蹤帳號與開始前已存在的貼文
- 略過已按讚 廣告 自己的貼文與無法辨識的貼文

關閉瀏覽器或電腦後不會繼續執行
按面板 × 只會隱藏面板 停止操作請按「暫停」

## 開發

```sh
git clone https://github.com/starrytss/ig-auto-like.git
cd ig-auto-like
```

本專案為原生 JavaScript／HTML／CSS 的 Manifest V3 擴充功能
無需 npm install 或建置即可載入

| 路徑 | 用途 |
| --- | --- |
| `extensions/chrome/` | Chrome 可直接載入的完整原始碼 |
| `extensions/edge/` | Edge 可直接載入的完整原始碼 |
| `downloads/` | 與原網站相同的 v0.7 安裝包 |
| `background.js` | 背景工作與執行狀態協調 |
| `content.js` | 首頁執行流程與浮動面板 |
| `core.js` | 帳號／貼文辨識與候選條件 |
| `dom.js` | Instagram 頁面辨識與 DOM 操作 |
| `popup.*` | 擴充功能設定介面 |
| `verification.json` | 原始 v0.7 隨附的歷史驗證紀錄 |

修改後到擴充功能管理頁按重新載入 再重新整理 IG 分頁
兩個瀏覽器版本目前分別保存 修改共用邏輯時請同步檢查兩份
`downloads/` 是固定的 v0.7 封存包 不會自動隨原始碼修改而更新

## 驗證狀態

本次獨立開源保留網站原有程式與安裝包 不調整執行行為
已檢查 JavaScript 語法與 manifest 引用檔案

隨附 `verification.json` 記載原作者 v0.7 的 210 項模擬檢查通過
這是歷史紀錄 本專案未包含該模擬測試執行器
未在本次工作中重新執行該 210 項測試
尚未完成登入 IG 的 Chrome／Edge 實站驗證

## 隱私與限制

設定與處理紀錄使用瀏覽器本機儲存 不提供跨裝置同步
程式未使用 Cookie 權限 沒有要求輸入 IG 密碼
目前原始碼未包含對外分析服務或將紀錄送至外部伺服器的程式
擴充功能會讀取 IG 首頁可見內容以辨識貼文並執行操作

本工具非 Meta／Instagram 官方產品
自動操作可能導致帳號限制 IG 介面變動也可能使功能失效
不保證任何操作頻率能避免限制

## 參與開發

歡迎透過 Issues 回報問題 或提交 Pull Request
詳見 [CONTRIBUTING.md](CONTRIBUTING.md)

## 授權

本專案採用 [MIT License](LICENSE)
Instagram／Meta 與其他第三方商標屬於各自權利人
開源授權不代表官方合作或商標使用授權
