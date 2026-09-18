const status=document.getElementById("status");
const observer=new MutationObserver(()=>{
  const text=status?.textContent||"";
  if(!status||!text.includes("DATABASE_MISSING_REPAIR_REQUIRED")||document.getElementById("recoveryPanel"))return;
  const panel=document.createElement("div");panel.id="recoveryPanel";panel.className="recovery-panel";panel.innerHTML="<strong>找不到原本的個人地圖資料庫</strong><p>請確認原本的 Google Sheets 是否已刪除或無法存取。</p><button type=button id=recoveryRetry>重新搜尋</button>";status.insertAdjacentElement("beforebegin",panel);document.getElementById("recoveryRetry").onclick=()=>location.reload();
});
if(status)observer.observe(status,{childList:true,characterData:true,subtree:true});
