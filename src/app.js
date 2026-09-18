import {authorize,initializeProject,loadLocations,saveLocation,deleteLocation,hasToken} from "./google-api.js?v=G01-R25";

const locations=[];
const markers=new Map();
let map;
let editingId=null;
let deleteButton;

const $=id=>document.getElementById(id);
const setStatus=(message,type="")=>{$("status").textContent=message;$('status').className=`status ${type}`};
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const popupContent=location=>`<strong>${esc(location.name)}</strong><br><small>${esc(location.address||`${location.latitude}, ${location.longitude}`)}</small>`;

function render(){
  const query=$("searchInput").value.trim().toLowerCase();
  const rows=locations.filter(location=>[location.name,location.address,location.description,location.category].join(" ").toLowerCase().includes(query));
  $("listMeta").textContent=`${rows.length} 個地點`;
  $("locationList").replaceChildren(...rows.map(location=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="location-card";
    button.innerHTML=`<strong>${esc(location.name)}</strong><small>${esc(location.address||`${location.latitude}, ${location.longitude}`)}</small>`;
    button.onclick=()=>{map.setView([location.latitude,location.longitude],15);openForm(location)};
    return button;
  }));
}

function draw(location){
  if(markers.has(location.id))markers.get(location.id).remove();
  const marker=L.marker([location.latitude,location.longitude],{draggable:true}).addTo(map).bindPopup(popupContent(location));
  marker.on("click",()=>openForm(location));
  marker.on("dragend",()=>moveMarker(location,marker));
  markers.set(location.id,marker);
}

async function moveMarker(location,marker){
  const previous={latitude:location.latitude,longitude:location.longitude};
  const point=marker.getLatLng();
  const updated={...location,latitude:Number(point.lat.toFixed(6)),longitude:Number(point.lng.toFixed(6)),updatedAt:new Date().toISOString()};
  try{
    await saveLocation(updated);
    Object.assign(location,updated);
    marker.setLatLng([updated.latitude,updated.longitude]).setPopupContent(popupContent(location));
    render();
    setStatus("標記位置已同步至 Google Sheets","success");
  }catch(error){
    marker.setLatLng([previous.latitude,previous.longitude]);
    setStatus(`標記移動失敗：${error.message}`,"error");
  }
}

function openForm(location){
  editingId=location?.id||null;
  $("dialogTitle").textContent=editingId?"編輯地點":"新增地點";
  $("locationId").value=editingId||"";
  for(const [id,key] of [["name","name"],["address","address"],["description","description"],["category","category"],["latitude","latitude"],["longitude","longitude"]])$(id).value=location?.[key]??"";
  $("formError").textContent="";
  if(deleteButton)deleteButton.hidden=!editingId;
  $("locationDialog").showModal();
}

async function geocode(address){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  let response;
  try{response=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=zh-TW&q=${encodeURIComponent(address)}`,{headers:{Accept:"application/json"},signal:controller.signal})}
  catch(error){if(error.name==="AbortError")throw new Error("地址定位逾時");throw new Error(`地址定位失敗：${error.message}`)}
  finally{clearTimeout(timer)}
  if(!response.ok)throw new Error("無法定位此地址");
  const rows=await response.json();
  if(!rows.length)throw new Error("無法定位此地址，請確認地址或直接輸入座標");
  return {latitude:Number(rows[0].lat),longitude:Number(rows[0].lon)};
}

async function save(event){
  event.preventDefault();
  $("formError").textContent="";
  const name=$("name").value.trim();
  const address=$("address").value.trim();
  const latitudeText=$("latitude").value.trim();
  const longitudeText=$("longitude").value.trim();
  if(!name){$("formError").textContent="名稱必填。";return}
  const hasLatitude=latitudeText!=="";
  const hasLongitude=longitudeText!=="";
  if(!address&&!hasLatitude&&!hasLongitude){$("formError").textContent="請提供地址或有效座標。";return}
  if(hasLatitude!==hasLongitude){$("formError").textContent="緯度與經度必須同時填寫。";return}
  let latitude=Number(latitudeText);
  let longitude=Number(longitudeText);
  const saveButton=$("saveButton");
  saveButton.disabled=true;
  try{
    if(!hasLatitude&&!hasLongitude){
      setStatus("正在定位地址…");
      ({latitude,longitude}=await geocode(address));
      $("latitude").value=latitude;
      $("longitude").value=longitude;
    }
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)throw new Error("座標格式無效");
    const old=locations.find(location=>location.id===editingId);
    const location={id:editingId||crypto.randomUUID(),name,address,latitude,longitude,description:$("description").value.trim(),category:$("category").value.trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    await saveLocation(location);
    const index=locations.findIndex(item=>item.id===location.id);
    if(index<0)locations.push(location);else locations[index]=location;
    draw(location);
    render();
    $("locationDialog").close();
    setStatus("地點已同步至 Google Sheets","success");
  }catch(error){
    $("formError").textContent=error.message;
    setStatus(`儲存失敗：${error.message}`,"error");
  }finally{saveButton.disabled=false}
}

async function removeCurrent(){
  if(!editingId||!confirm("確定要刪除這個地點嗎？"))return;
  try{
    await deleteLocation(editingId);
    const index=locations.findIndex(location=>location.id===editingId);
    if(index>=0)locations.splice(index,1);
    if(markers.has(editingId)){markers.get(editingId).remove();markers.delete(editingId)}
    $("locationDialog").close();
    render();
    setStatus("地點已刪除","success");
  }catch(error){setStatus(`刪除失敗：${error.message}`,"error")}
}

async function connect(options={}){
  const button=$("authButton");
  button.disabled=true;
  button.textContent="連線中…";
  document.getElementById("recoveryPanel")?.remove();
  try{
    if(!hasToken()){setStatus("正在等待 Google OAuth 回傳…");await authorize()}
    await initializeProject({...options,onProgress:label=>setStatus(`${label}…`)});
    const loaded=await loadLocations();
    for(const marker of markers.values())marker.remove();
    markers.clear();
    locations.splice(0,locations.length,...loaded);
    locations.forEach(draw);
    render();
    $("addButton").disabled=false;
    $("fitButton").disabled=false;
    button.textContent="Google 環境：已準備";
    setStatus("Google 環境：授權與能力驗證成功","success");
  }catch(error){
    setStatus(`初始化失敗：${error.message}`,"error");
    button.disabled=false;
    button.textContent="初始化我的地圖";
  }
}

window.__personalMapReconnect=connect;
window.addEventListener("personal-map:recovery",event=>connect(event.detail||{}));

map=L.map("map").setView([23.7,120.9],8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap 貢獻者"}).addTo(map);
map.on("click",event=>{if(!$('addButton').disabled)openForm({latitude:event.latlng.lat.toFixed(6),longitude:event.latlng.lng.toFixed(6)})});

$("authButton").onclick=()=>connect();
$("addButton").onclick=()=>openForm();
$("fitButton").onclick=()=>locations.length&&map.fitBounds(L.latLngBounds(locations.map(location=>[location.latitude,location.longitude])),{padding:[40,40]});
$("locationForm").onsubmit=save;
$("searchInput").oninput=render;
$("closeSidebar").onclick=()=>$('sidebar').classList.remove('is-open');
$("openSidebar").onclick=()=>$('sidebar').classList.add('is-open');
deleteButton=document.createElement("button");
deleteButton.type="button";
deleteButton.className="button button-quiet";
deleteButton.textContent="刪除地點";
deleteButton.hidden=true;
deleteButton.onclick=removeCurrent;
document.querySelector(".dialog-actions")?.prepend(deleteButton);
document.querySelectorAll('#locationDialog button[value="cancel"]').forEach(button=>{
  button.onclick=()=>$("locationDialog").close();
});
render();
