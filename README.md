# 個人地圖管理工具｜G01-R23

本版本使用 Leaflet + OpenStreetMap，並加入 Google Identity Services Token Model、Google Drive API 與 Google Sheets API 的正式初始化層。流程會以 `appProperties` 尋找或建立可見的專案資料夾、設定 JSON、primary database 與 `Locations` header；不使用 GAS 或 `appDataFolder`。

G01-R23 延續 G01-R22 的地點資料讀取、寫入、編輯、實際列刪除、地址定位、地圖標記拖曳同步、搜尋、Fit All、重新連線，以及缺少資料庫時的明確 Recovery 操作；另外保留 OAuth callback 與 Google API 網路逾時、逐步狀態與網路錯誤訊息，以及 HTML、ES Module import 與 CSS 的版本查詢字串。既有版本資料夾與 Git 歷史保留不覆寫。

## 本機預覽

以任意靜態伺服器開啟此資料夾，例如 `npx serve .`。直接以 `file://` 開啟會受 ES Module 與地圖資源限制。

## 平台設定

正式版需在 Google Cloud 啟用 Drive API／Sheets API，建立 Web application OAuth Client ID，並將 `https://lenovomi0403.github.io` 加入 Authorized JavaScript origins；本程式只在記憶體中使用目前 Token，不寫入 Token、Refresh Token 或 Secret。

## 測試

`npm test` 執行 `src/app.js` 與 `src/config.js` 語法檢查；部署前另執行 `src/google-api.js` 與 `src/recovery-ui.js` 語法檢查，以及 `git diff --check`。Google Drive／Sheets 初始化與 OAuth 仍需在正式網址以已登入帳戶進行真人流程驗證。

## 此版本的調整說明

G01-R23 修正 `prompt:"none"` 在目前 Chrome／GIS Token Model 狀態下沒有回傳 callback、導致一直等待的問題；改為使用者按下初始化後採用 GIS 的空白 prompt（已授權時直接回傳 Token，未授權時由 Google 顯示必要同意流程），並保留 60 秒 AUTH_TIMEOUT。G01-R20／R21／R22 的 CRUD、Recovery、標記同步與快取修正均保留。

## 歷史調整說明

G01-R03 修正 Google Sheets 建立流程：改由 Sheets API 建立試算表，再透過 Drive API 移入「個人地圖管理工具」資料夾並寫入 appProperties，避免以 Drive multipart 直接建立 Google Sheets 造成 `GOOGLE_API_400`。
## 此版本的調整說明

G01-R04 修正 Drive metadata-only 建立流程：資料夾與其他純 metadata 檔案改用 Drive API JSON POST；只有設定 JSON 使用 multipart upload，避免純 metadata multipart 請求造成 `GOOGLE_API_400`。
## 此版本的調整說明

G01-R06 將 Google API 錯誤處理改為顯示 HTTP 狀態、Google 回應訊息與可辨識的失敗內容，避免只顯示籠統的 `GOOGLE_API_400`。
## 此版本的調整說明

G01-R07 修正 Google Drive `q` 查詢的 `appProperties has` 語法；R06 已取得實際回應 `GOOGLE_API_400: Parse Error`，本版依 Drive API 查詢格式移除條件運算子的多餘空白。
