const status=document.getElementById("status");
const recoveryCodes=["DATABASE_MISSING_REPAIR_REQUIRED","DATABASE_REFERENCE_CONFLICT","DATABASE_CONFLICT","CONFIG_CONFLICT"];

function requestRecovery(options){
  window.dispatchEvent(new CustomEvent("personal-map:recovery",{detail:options}));
}

function showRecovery(text){
  if(!status||document.getElementById("recoveryPanel"))return;
  const missing=text.includes("DATABASE_MISSING_REPAIR_REQUIRED");
  const referenceConflict=text.includes("DATABASE_REFERENCE_CONFLICT");
  const databaseConflict=text.includes("DATABASE_CONFLICT");
  const panel=document.createElement("div");
  panel.id="recoveryPanel";
  panel.className="recovery-panel";
  const title=document.createElement("strong");
  const message=document.createElement("p");
  const retry=document.createElement("button");
  retry.type="button";
  retry.className="button button-quiet";
  retry.textContent="重新搜尋";
  retry.onclick=()=>requestRecovery({});
  panel.append(title,message,retry);
  if(missing){
    title.textContent="找不到原本的個人地圖資料庫";
    message.textContent="設定檔仍指向不存在的試算表；可重新搜尋，或建立新的資料庫並更新設定。";
    const repair=document.createElement("button");
    repair.type="button";
    repair.className="button button-primary";
    repair.textContent="建立新的資料庫並更新設定";
    repair.onclick=()=>requestRecovery({repairMissingDatabase:true});
    panel.append(repair);
  }else if(referenceConflict){
    title.textContent="資料庫參照與現存資料不一致";
    message.textContent="找到其他正式資料庫，為避免誤用資料，請先在 Google Drive 保留正確資源。";
  }else if(databaseConflict){
    title.textContent="找到多個地圖資料庫";
    message.textContent="請在 Google Drive 保留唯一正式資料庫後重新搜尋。";
  }else{
    title.textContent="找到多個專案設定檔";
    message.textContent="請在 Google Drive 保留唯一正式設定檔後重新搜尋。";
  }
  status.insertAdjacentElement("beforebegin",panel);
}

const observer=new MutationObserver(()=>{
  const text=status?.textContent||"";
  if(recoveryCodes.some(code=>text.includes(code)))showRecovery(text);
});
if(status)observer.observe(status,{childList:true,characterData:true,subtree:true});
