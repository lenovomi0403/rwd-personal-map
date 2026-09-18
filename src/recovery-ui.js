const status=document.getElementById("status");
const observer=new MutationObserver(()=>{
  const text=status?.textContent||"";
  if(!status||document.getElementById("recoveryPanel")||!/(DATABASE_MISSING_REPAIR_REQUIRED|DATABASE_CONFLICT|CONFIG_CONFLICT)/.test(text))return;
  const title=text.includes("DATABASE_CONFLICT")?"找到多個地圖資料庫":text.includes("CONFIG_CONFLICT")?"找到多個專案設定檔":"找不到原本的個人地圖資料庫";
  const panel=document.createElement("div");panel.id="recoveryPanel";panel.className="recovery-panel";panel.innerHTML="<strong>找不到原本的個人地圖資料庫</strong><p>請確認原本的 Google Sheets 是否已刪除或無法存取。</p><button type=button id=recoveryRetry>重新搜尋</button>";status.insertAdjacentElement("beforebegin",panel);document.getElementById("recoveryRetry").onclick=()=>location.reload();
  panel.querySelector("strong").textContent=title;panel.querySelector("p").textContent=text.includes("DATABASE_CONFLICT")||text.includes("CONFIG_CONFLICT")?"請在 Google Drive 保留唯一正式資源後重新搜尋。":"請確認原本的 Google Sheets 是否已刪除或無法存取。";
});
if(status)observer.observe(status,{childList:true,characterData:true,subtree:true});
