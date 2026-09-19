# 個人地圖管理工具｜G01-R27

本版本使用 Leaflet + OpenStreetMap，並加入 Google Identity Services Token Model、Google Drive API 與 Google Sheets API 的正式初始化層。流程會以 `appProperties` 尋找或建立可見的專案資料夾、設定 JSON、primary database 與 `Locations` header；不使用 GAS 或 `appDataFolder`。

G01-R27 延續 G01-R26 的 Drive／Sheets 初始化、完整 CRUD、地址定位、標記拖曳同步、搜尋、Fit All、Recovery 與小尺寸地圖高度修正；新增真正可執行的「搜尋地點」按鈕、輸入即時候選結果、候選地點的地圖資訊面板、面板新增／編輯／刪除操作、地址或 `緯度,經度` 任一方式新增，以及手機版地點清單與快速新增入口。OAuth access token 僅以目前瀏覽器分頁的 `sessionStorage` 保存短期工作階段，重新整理後會自動恢復並重新載入資料；不保存 Refresh Token 或 Client Secret。同步把 HTML、ES Module import 與 CSS 的版本查詢字串升級至 G01-R27，避免新版修正被舊版快取遮蔽。候選地點使用 OpenStreetMap Nominatim 公開搜尋服務，不宣稱為 Google Places。既有版本資料夾與 Git 歷史保留不覆寫。

## 本機預覽

以任意靜態伺服器開啟此資料夾，例如 `npx serve .`。直接以 `file://` 開啟會受 ES Module 與地圖資源限制。

## 平台設定

正式版需在 Google Cloud 啟用 Drive API／Sheets API，建立 Web application OAuth Client ID，並將 `https://lenovomi0403.github.io` 加入 Authorized JavaScript origins；本程式只在目前分頁的 `sessionStorage` 保存短期 access token，不寫入 Refresh Token、Client Secret 或其他長期憑證。

## 測試

`npm test` 執行 `src/app.js`、`src/config.js`、`src/google-api.js` 與 `src/recovery-ui.js` 語法檢查；部署前另執行 `git diff --check`。Google Drive／Sheets 初始化與 OAuth 仍需在正式網址以已登入帳戶進行真人流程驗證；搜尋候選結果則需保留對 Nominatim 公開服務的正常網路連線。

## 此版本的調整說明

G01-R27 新增搜尋按鈕與 Nominatim 即時候選、右側地點資訊面板、候選結果新增與已儲存地點刪除、地址-only geocoding、無空格 `緯度,經度` 顯示、手機版 sidebar／快速新增入口與可滾動表單；同時採用語意化 cool-neutral／warm-neutral token、清楚的主要／次要／危險操作、focus 狀態與 reduced-motion 支援。保存 G01-R26 的資料與舊版檔案不覆寫。

## 歷史調整說明

G01-R03 修正 Google Sheets 建立流程：改由 Sheets API 建立試算表，再透過 Drive API 移入「個人地圖管理工具」資料夾並寫入 appProperties，避免以 Drive multipart 直接建立 Google Sheets 造成 `GOOGLE_API_400`。
## 此版本的調整說明

G01-R04 修正 Drive metadata-only 建立流程：資料夾與其他純 metadata 檔案改用 Drive API JSON POST；只有設定 JSON 使用 multipart upload，避免純 metadata multipart 請求造成 `GOOGLE_API_400`。
## 此版本的調整說明

G01-R06 將 Google API 錯誤處理改為顯示 HTTP 狀態、Google 回應訊息與可辨識的失敗內容，避免只顯示籠統的 `GOOGLE_API_400`。
## 此版本的調整說明

G01-R07 修正 Google Drive `q` 查詢的 `appProperties has` 語法；R06 已取得實際回應 `GOOGLE_API_400: Parse Error`，本版依 Drive API 查詢格式移除條件運算子的多餘空白。
