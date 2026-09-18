# 個人地圖管理工具｜G01-R00

本版本使用 Leaflet + OpenStreetMap，並加入 Google Identity Services Token Model、Google Drive API 與 Google Sheets API 的正式初始化層。流程會以 `appProperties` 尋找或建立可見的專案資料夾、設定 JSON、primary database 與 `Locations` header；不使用 GAS 或 `appDataFolder`。

## 本機預覽

以任意靜態伺服器開啟此資料夾，例如 `npx serve .`。直接以 `file://` 開啟會受 ES Module 與地圖資源限制。

## 待平台設定

`index.html` 的 `window.__PERSONAL_MAP_CONFIG__.oauthClientId` 仍為空值。正式版需在 Google Cloud 建立 OAuth Web Client、啟用 Drive API/Sheets API，並設定 GitHub Pages origin；本程式不保存 Token。

## 測試

`npm test` 執行 JavaScript 語法檢查。Google Drive/Sheets 初始化與 OAuth 需在具備 OAuth Client ID、Google 登入及正式部署網址後進行真人流程驗證。
