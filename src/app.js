import {authorize,initializeProject,loadLocations,saveLocation,deleteLocation,hasToken,clearToken} from "./google-api.js?v=G01-R27-geo";

const locations=[];
const markers=new Map();
let map;
let editingId=null;
let deleteButton;
let selectedPlace=null;
let searchTimer=null;
let searchController=null;
let searchResults=[];
let latestSearchQuery="";

const $=id=>document.getElementById(id);
const setStatus=(message,type="")=>{$("status").textContent=message;$("status").className=`status ${type}`};
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const cleanNumber=value=>{const number=Number(value);return Number.isFinite(number)?String(Number(number.toFixed(6))):"—"};
const coordinateText=(latitude,longitude)=>`${cleanNumber(latitude)},${cleanNumber(longitude)}`;
const popupContent=location=>`<strong>${esc(location.name)}</strong><br><small>${esc(location.address||coordinateText(location.latitude,location.longitude))}</small>`;
const parseCoordinate=value=>{
  const match=String(value||"").match(/^\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*$/);
  return match?{latitude:Number(match[1]),longitude:Number(match[2])}:null;
};

function render(){
  const query=$("searchInput").value.trim().toLowerCase();
  const rows=locations.filter(location=>[location.name,location.address,location.description,location.category].join(" ").toLowerCase().includes(query));
  $("listMeta").textContent=query?`${rows.length} 個已儲存地點`:`${rows.length} 個地點`;
  $("locationList").replaceChildren(...rows.map(location=>{
    const button=document.createElement("button");
    button.type="button";
    button.className=`location-card${selectedPlace?.kind==="saved"&&selectedPlace.location.id===location.id?" selected":""}`;
    button.setAttribute("aria-pressed",String(selectedPlace?.kind==="saved"&&selectedPlace.location.id===location.id));
    button.innerHTML=`<strong>${esc(location.name)}</strong><small>${esc(location.address||coordinateText(location.latitude,location.longitude))}</small>`;
    button.onclick=()=>selectSavedLocation(location);
    return button;
  }));
}

function renderSearchResults(results=searchResults,message=""){
  const container=$("searchResults");
  container.replaceChildren();
  if(message){
    const text=document.createElement("p");
    text.className="search-state muted";
    text.textContent=message;
    container.append(text);
    return;
  }
  if(!results.length)return;
  const heading=document.createElement("p");
  heading.className="search-results-heading";
  heading.textContent=`搜尋結果（${results.length}）`;
  container.append(heading);
  for(const place of results){
    const button=document.createElement("button");
    const name=place.name||place.display_name?.split(",")[0]||"未命名地點";
    button.type="button";
    button.className=`search-result${selectedPlace?.kind==="search"&&selectedPlace.place.place_id===place.place_id?" selected":""}`;
    button.setAttribute("aria-pressed",String(selectedPlace?.kind==="search"&&selectedPlace.place.place_id===place.place_id));
    button.innerHTML=`<strong>${esc(name)}</strong><small>${esc(place.display_name||"")}</small>`;
    button.onclick=()=>selectSearchPlace(place);
    container.append(button);
  }
}

function showPlacePanel(payload){
  selectedPlace=payload;
  const saved=payload.kind==="saved";
  const ready=!$("addButton").disabled;
  const place=saved?payload.location:payload.place;
  const name=saved?place.name:(place.name||place.display_name?.split(",")[0]||"搜尋結果");
  const address=saved?(place.address||"尚未填寫地址"):(place.display_name||"尚未提供地址");
  const latitude=saved?place.latitude:Number(place.lat);
  const longitude=saved?place.longitude:Number(place.lon);
  $("placePanelTitle").textContent=name;
  $("placePanelAddress").textContent=address;
  $("placePanelCoordinate").textContent=coordinateText(latitude,longitude);
  $("placePanelMeta").textContent=saved?(place.category?`分類：${place.category}`:"已儲存於我的地點"):(place.type?`地圖搜尋結果・${place.type}`:"地圖搜尋結果");
  $("panelAddButton").disabled=saved||!ready;
  $("panelAddButton").textContent=saved?"已加入我的地點":ready?"＋ 新增地點":"先初始化我的地圖";
  $("panelAddButton").title=!saved&&!ready?"請先初始化我的地圖":"";
  $("panelEditButton").hidden=!saved;
  $("panelDeleteButton").disabled=!saved;
  $("panelDeleteButton").title=saved?"刪除這個已儲存的地點":"請先新增地點後才能刪除";
  $("placePanel").hidden=false;
  render();
}

function hidePlacePanel(){
  selectedPlace=null;
  $("placePanel").hidden=true;
  render();
}

function closeOverlaySidebar(){
  if(!matchMedia("(max-width: 1023px)").matches)return;
  $("sidebar").classList.remove("is-open");
  requestAnimationFrame(()=>map.invalidateSize());
}

function selectSavedLocation(location){
  map.setView([location.latitude,location.longitude],15);
  showPlacePanel({kind:"saved",location});
  closeOverlaySidebar();
  setStatus("已選取我的地點");
}

function selectSearchPlace(place){
  const latitude=Number(place.lat);
  const longitude=Number(place.lon);
  map.setView([latitude,longitude],15);
  showPlacePanel({kind:"search",place});
  renderSearchResults();
  closeOverlaySidebar();
  setStatus("已選取搜尋結果，可從右側資訊面板新增");
}

function draw(location){
  if(markers.has(location.id))markers.get(location.id).remove();
  const marker=L.marker([location.latitude,location.longitude],{draggable:true}).addTo(map).bindPopup(popupContent(location));
  marker.on("click",()=>selectSavedLocation(location));
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
    if(selectedPlace?.kind==="saved"&&selectedPlace.location.id===location.id)showPlacePanel({kind:"saved",location});
    render();
    setStatus("標記位置已同步至 Google Sheets","success");
  }catch(error){
    marker.setLatLng([previous.latitude,previous.longitude]);
    setStatus(`標記移動失敗：${error.message}`,"error");
  }
}

function syncCoordinateFields(){
  const latitude=Number($("latitude").value);
  const longitude=Number($("longitude").value);
  if(Number.isFinite(latitude)&&Number.isFinite(longitude))$("coordinate").value=coordinateText(latitude,longitude);
}

function openForm(location){
  editingId=location?.id||null;
  $("dialogTitle").textContent=editingId?"編輯地點":"新增地點";
  $("locationId").value=editingId||"";
  for(const [id,key] of [["name","name"],["address","address"],["description","description"],["category","category"],["latitude","latitude"],["longitude","longitude"]])$(id).value=location?.[key]??"";
  $("coordinate").value=location&&Number.isFinite(Number(location.latitude))&&Number.isFinite(Number(location.longitude))?coordinateText(location.latitude,location.longitude):"";
  $("formError").textContent="";
  if(deleteButton)deleteButton.hidden=!editingId;
  $("locationDialog").showModal();
  setTimeout(()=>$("name").focus(),0);
}

async function searchNominatim(query,limit=5,signal){
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&accept-language=zh-TW&countrycodes=tw&q=${encodeURIComponent(query)}`;
  const response=await fetch(url,{headers:{Accept:"application/json"},signal});
  if(!response.ok)throw new Error(`搜尋服務回應 ${response.status}`);
  return response.json();
}

async function searchArcGIS(query,limit=5,signal){
  const url=`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(query)}&f=json&maxLocations=${limit}&outFields=*`;
  const response=await fetch(url,{headers:{Accept:"application/json"},signal});
  if(!response.ok)throw new Error(`備援定位服務回應 ${response.status}`);
  const payload=await response.json();
  return (payload.candidates||[]).filter(candidate=>candidate.location).map((candidate,index)=>({
    place_id:`arcgis-${candidate.attributes?.MatchID||index}-${candidate.location.y}-${candidate.location.x}`,
    name:candidate.attributes?.ShortLabel||candidate.address||"未命名地點",
    display_name:candidate.address||candidate.attributes?.LongLabel||"",
    lat:String(candidate.location.y),
    lon:String(candidate.location.x),
    type:candidate.attributes?.Addr_type||"address",
    source:"ArcGIS"
  }));
}

async function geocode(address){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  let nominatimError=null;
  try{
    const rows=await searchNominatim(address,1,controller.signal);
    if(rows.length)return {latitude:Number(rows[0].lat),longitude:Number(rows[0].lon)};
  }catch(error){
    if(error.name!=="AbortError")nominatimError=error;
  }finally{clearTimeout(timer)}
  const fallbackController=new AbortController();
  const fallbackTimer=setTimeout(()=>fallbackController.abort(),10000);
  try{
    const rows=await searchArcGIS(address,1,fallbackController.signal);
    if(rows.length)return {latitude:Number(rows[0].lat),longitude:Number(rows[0].lon)};
  }catch(error){
    if(error.name==="AbortError")throw new Error("地址定位逾時");
    throw new Error(`地址定位失敗：${error.message}`);
  }finally{clearTimeout(fallbackTimer)}
  if(nominatimError)throw new Error(`地址定位失敗：${nominatimError.message}`);
  throw new Error("無法定位此地址，請確認地址或直接輸入座標");
}

async function searchPlaces(query){
  const trimmed=query.trim();
  if(trimmed.length<2){searchResults=[];latestSearchQuery="";renderSearchResults([],trimmed?"請至少輸入 2 個字元":"");return}
  searchController?.abort();
  searchController=new AbortController();
  renderSearchResults([],"搜尋中…");
  try{
    let rows=await searchNominatim(trimmed,5,searchController.signal);
    if(!rows.length)rows=await searchArcGIS(trimmed,5,searchController.signal);
    searchResults=rows;
    latestSearchQuery=trimmed;
    renderSearchResults(rows,rows.length?"":"找不到候選地點");
    if(!rows.length)setStatus("找不到候選地點");
  }catch(error){
    if(error.name==="AbortError")return;
    searchResults=[];
    renderSearchResults([],`搜尋失敗：${error.message}`);
    setStatus(`搜尋失敗：${error.message}`,"error");
  }
}

async function save(event){
  event.preventDefault();
  $("formError").textContent="";
  const name=$("name").value.trim();
  const address=$("address").value.trim();
  const coordinate=$("coordinate").value.trim();
  let latitudeText=$("latitude").value.trim();
  let longitudeText=$("longitude").value.trim();
  if(!name){$("formError").textContent="名稱必填。";return}
  if(coordinate){
    const parsed=parseCoordinate(coordinate);
    if(!parsed){$("formError").textContent="座標格式請使用 緯度,經度，例如 25.033964,121.564468。";return}
    latitudeText=String(parsed.latitude);
    longitudeText=String(parsed.longitude);
  }
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
      $("coordinate").value=coordinateText(latitude,longitude);
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
    showPlacePanel({kind:"saved",location});
    setStatus("地點已同步至 Google Sheets","success");
  }catch(error){
    if(error.message==="AUTH_EXPIRED")clearToken();
    $("formError").textContent=error.message;
    setStatus(`儲存失敗：${error.message}`,"error");
  }finally{saveButton.disabled=false}
}

async function removeCurrent(){
  if(!editingId||!confirm("確定要刪除這個地點嗎？"))return;
  const id=editingId;
  try{
    await deleteLocation(id);
    const index=locations.findIndex(location=>location.id===id);
    if(index>=0)locations.splice(index,1);
    if(markers.has(id)){markers.get(id).remove();markers.delete(id)}
    editingId=null;
    $("locationDialog").close();
    hidePlacePanel();
    render();
    setStatus("地點已刪除","success");
  }catch(error){
    if(error.message==="AUTH_EXPIRED")clearToken();
    setStatus(`刪除失敗：${error.message}`,"error");
  }
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
    hidePlacePanel();
    render();
    $("addButton").disabled=false;
    $("searchButton").disabled=false;
    $("fitButton").disabled=false;
    $("quickAddButton").disabled=false;
    button.textContent="Google 環境：已準備";
    setStatus("Google 環境：授權與能力驗證成功","success");
  }catch(error){
    if(error.message==="AUTH_EXPIRED")clearToken();
    setStatus(`初始化失敗：${error.message}`,"error");
    button.disabled=false;
    button.textContent=error.message==="AUTH_EXPIRED"?"重新連線":"初始化我的地圖";
  }
}

window.__personalMapReconnect=connect;
window.addEventListener("personal-map:recovery",event=>connect(event.detail||{}));

map=L.map("map").setView([23.7,120.9],8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap 貢獻者"}).addTo(map);
map.on("click",event=>{if(!$("addButton").disabled)openForm({latitude:event.latlng.lat.toFixed(6),longitude:event.latlng.lng.toFixed(6)})});

$("authButton").onclick=()=>connect();
$("addButton").onclick=()=>openForm();
$("quickAddButton").onclick=()=>openForm();
$("searchButton").onclick=()=>{
  const query=$("searchInput").value.trim();
  if(!query){$("searchInput").focus();setStatus("請先輸入要搜尋的地點");return}
  if(query===latestSearchQuery&&searchResults.length){renderSearchResults();return}
  searchPlaces(query);
};
$("fitButton").onclick=()=>locations.length&&map.fitBounds(L.latLngBounds(locations.map(location=>[location.latitude,location.longitude])),{padding:[40,40]});
$("locationForm").onsubmit=save;
$("searchInput").oninput=()=>{
  render();
  clearTimeout(searchTimer);
  const query=$("searchInput").value;
  if(query.trim().length<2){searchController?.abort();searchResults=[];latestSearchQuery="";renderSearchResults();return}
  searchTimer=setTimeout(()=>searchPlaces(query),450);
};
$("latitude").oninput=syncCoordinateFields;
$("longitude").oninput=syncCoordinateFields;
$("coordinate").oninput=()=>{
  const parsed=parseCoordinate($("coordinate").value);
  if(parsed){$("latitude").value=parsed.latitude;$("longitude").value=parsed.longitude}
};
$("closeSidebar").onclick=()=>$("sidebar").classList.remove("is-open");
$("openSidebar").onclick=()=>{
  $("sidebar").classList.add("is-open");
  requestAnimationFrame(()=>map.invalidateSize());
};
$("closePlacePanel").onclick=hidePlacePanel;
$("panelAddButton").onclick=()=>{
  if(selectedPlace?.kind!=="search")return;
  if($("addButton").disabled){setStatus("請先初始化我的地圖");return}
  const place=selectedPlace.place;
  openForm({name:place.name||place.display_name?.split(",")[0]||"未命名地點",address:place.display_name||"",latitude:Number(place.lat),longitude:Number(place.lon),category:place.type||""});
};
$("panelEditButton").onclick=()=>{if(selectedPlace?.kind==="saved")openForm(selectedPlace.location)};
$("panelDeleteButton").onclick=async()=>{if(selectedPlace?.kind!=="saved")return;editingId=selectedPlace.location.id;await removeCurrent()};
deleteButton=document.createElement("button");
deleteButton.type="button";
deleteButton.className="button button-destructive";
deleteButton.textContent="刪除地點";
deleteButton.hidden=true;
deleteButton.onclick=removeCurrent;
document.querySelector(".dialog-actions")?.prepend(deleteButton);
document.querySelectorAll('#locationDialog button[value="cancel"]').forEach(button=>{button.onclick=()=>$("locationDialog").close()});
render();
if(hasToken())connect({automatic:true});
