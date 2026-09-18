import {APP_CONFIG} from "./config.js?v=G01-R22";

const DRIVE="https://www.googleapis.com/drive/v3";
const SHEETS="https://sheets.googleapis.com/v4";
const FOLDER_PROPS={application:"personal-map",projectName:"個人地圖管理工具",resourceRole:"project-root",schemaVersion:"1"};
const CONFIG_PROPS={application:"personal-map",projectName:"個人地圖管理工具",resourceRole:"binding-config",schemaVersion:"1"};
const DB_PROPS={application:"personal-map",projectName:"個人地圖管理工具",resourceRole:"primary-database",schemaVersion:"1"};
const LOCATION_HEADERS=["id","name","address","latitude","longitude","description","category","createdAt","updatedAt"];
const REQUEST_TIMEOUT_MS=20000;
const AUTH_TIMEOUT_MS=60000;
let accessToken="";
let databaseId="";
let locationsSheetId=null;

const headers=()=>({Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"});
async function fetchWithTimeout(url,options={},timeoutMs=REQUEST_TIMEOUT_MS){
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal})}
  catch(error){
    if(error.name==="AbortError")throw new Error(`GOOGLE_API_TIMEOUT: ${timeoutMs}ms`);
    throw new Error(`GOOGLE_NETWORK_ERROR: ${error.message}`);
  }finally{clearTimeout(timeoutId)}
}
async function api(url,options={}){
  const response=await fetchWithTimeout(url,{...options,headers:{...headers(),...(options.headers||{})}});
  if(response.status===401)throw new Error("AUTH_EXPIRED");
  if(!response.ok){
    const body=await response.text();
    let detail=body;
    try{const parsed=JSON.parse(body);detail=parsed.error?.message||body}catch{}
    throw new Error(`GOOGLE_API_${response.status}: ${detail.slice(0,240)}`);
  }
  if(response.status===204)return null;
  const text=await response.text();
  if(!text.trim())return null;
  try{return JSON.parse(text)}catch(error){throw new Error(`GOOGLE_RESPONSE_PARSE_ERROR: ${error.message}`)}
}
function q(value){return `'${String(value).replaceAll("'","\\'")}'`}
function query(name,mime){return `name=${q(name)} and mimeType=${q(mime)} and trashed=false`}
function tagged(fileList,role){return fileList.filter(file=>file.appProperties?.application==="personal-map"&&file.appProperties?.resourceRole===role)}
export function hasToken(){return Boolean(accessToken)}

function parseLocation(row){
  return {
    id:row[0]||"",
    name:row[1]||"",
    address:row[2]||"",
    latitude:Number(row[3]),
    longitude:Number(row[4]),
    description:row[5]||"",
    category:row[6]||"",
    createdAt:row[7]||"",
    updatedAt:row[8]||""
  };
}
export async function loadLocations(){
  const result=await api(`${SHEETS}/spreadsheets/${databaseId}/values/${encodeURIComponent("Locations!A2:I")}`);
  return (result.values||[]).map(parseLocation).filter(x=>x.id);
}
export async function saveLocation(location){
  const rows=await loadLocations();
  const index=rows.findIndex(x=>x.id===location.id);
  const row=[location.id,location.name,location.address,String(location.latitude),String(location.longitude),location.description,location.category,location.createdAt,location.updatedAt];
  const target=index<0?rows.length+2:index+2;
  await api(`${SHEETS}/spreadsheets/${databaseId}/values/${encodeURIComponent(`Locations!A${target}:I${target}`)}?valueInputOption=RAW`,{method:"PUT",body:JSON.stringify({range:`Locations!A${target}:I${target}`,majorDimension:"ROWS",values:[row]})});
  return location;
}
export async function deleteLocation(id){
  const rows=await loadLocations();
  const index=rows.findIndex(x=>x.id===id);
  if(index<0)return;
  if(!Number.isInteger(locationsSheetId))throw new Error("LOCATIONS_SHEET_NOT_READY");
  const rowNumber=index+2;
  await api(`${SHEETS}/spreadsheets/${databaseId}:batchUpdate`,{method:"POST",body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId:locationsSheetId,dimension:"ROWS",startIndex:rowNumber-1,endIndex:rowNumber}}}]})});
}

async function step(label,fn,onProgress){onProgress?.(label);try{return await fn()}catch(error){throw new Error(`${label}：${error.message}`)}}
export async function authorize(){
  if(!window.google?.accounts?.oauth2)throw new Error("GIS_NOT_LOADED");
  if(!APP_CONFIG.oauthClientId)throw new Error("OAUTH_CLIENT_ID_MISSING");
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>fail(new Error("AUTH_TIMEOUT: OAuth callback 未在 60 秒內返回")),AUTH_TIMEOUT_MS);
    const finish=callback=>value=>{if(settled)return;settled=true;clearTimeout(timer);callback(value)};
    const succeed=finish(resolve);
    const fail=finish(reject);
    try{
      const client=google.accounts.oauth2.initTokenClient({
        client_id:APP_CONFIG.oauthClientId,
        scope:APP_CONFIG.scopes,
        callback:response=>{
          if(settled)return;
          if(!response.error){accessToken=response.access_token;succeed(response);return;}
          const detail=response.error_description?` (${response.error_description})`:"";
          fail(new Error(`AUTH_DENIED: ${response.error}${detail}`));
        }
      });
      client.requestAccessToken({prompt:""});
    }catch(error){fail(new Error(`AUTH_REQUEST_FAILED: ${error.message}`))}
  });
}

async function files(search,fields="files(id,name,mimeType,parents,appProperties,createdTime,modifiedTime)"){
  return api(`${DRIVE}/files?q=${encodeURIComponent(search)}&spaces=drive&includeItemsFromAllDrives=false&supportsAllDrives=false&fields=${encodeURIComponent(fields)}`);
}
async function readFile(fileId){
  const response=await fetchWithTimeout(`${DRIVE}/files/${fileId}?alt=media`,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!response.ok)throw new Error(`GOOGLE_API_${response.status}`);
  const text=await response.text();
  if(!text.trim())return null;
  try{return JSON.parse(text)}catch(error){throw new Error(`CONFIG_INVALID_JSON: ${error.message}`)}
}
async function writeFile(fileId,content,mimeType="application/json"){
  const response=await fetchWithTimeout(`${DRIVE}/files/${fileId}?uploadType=media&fields=id,name,mimeType,parents,appProperties`,{method:"PATCH",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":mimeType},body:content});
  if(!response.ok){const body=await response.text();throw new Error(`GOOGLE_API_${response.status}: ${body.slice(0,240)}`)}
  return response.json();
}
async function createFile(metadata,media){
  if(media===undefined)return api(`${DRIVE}/files?fields=id,name,mimeType,parents,appProperties`,{method:"POST",body:JSON.stringify(metadata)});
  const file=await api(`${DRIVE}/files?fields=id,name,mimeType,parents,appProperties`,{method:"POST",body:JSON.stringify(metadata)});
  const response=await fetchWithTimeout(`${DRIVE}/files/${file.id}?uploadType=media&fields=id,name,mimeType,parents,appProperties`,{method:"PATCH",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":metadata.mimeType},body:media});
  if(!response.ok){const body=await response.text();let detail=body;try{detail=JSON.parse(body).error?.message||body}catch{}throw new Error(`GOOGLE_API_${response.status}: ${detail.slice(0,240)}`)}
  return response.json();
}
async function findOrCreateFolder(){
  const found=tagged((await files(query(APP_CONFIG.folderName,"application/vnd.google-apps.folder"))).files,"project-root");
  if(found.length>1)throw new Error("FOLDER_CONFLICT");
  if(found[0])return found[0];
  return createFile({name:APP_CONFIG.folderName,mimeType:"application/vnd.google-apps.folder",parents:["root"],appProperties:FOLDER_PROPS});
}
async function findConfig(folderId){
  const found=tagged((await files(query(APP_CONFIG.configFileName,"application/json"))).files,"binding-config");
  return found.filter(file=>file.parents?.includes(folderId));
}
async function findDatabase(folderId){
  const found=tagged((await files(query(APP_CONFIG.spreadsheetName,"application/vnd.google-apps.spreadsheet"))).files,"primary-database");
  return found.filter(file=>file.parents?.includes(folderId));
}
async function createDatabase(folderId){
  const spreadsheet=await api(`${SHEETS}/spreadsheets`,{method:"POST",body:JSON.stringify({properties:{title:APP_CONFIG.spreadsheetName}})});
  return api(`${DRIVE}/files/${spreadsheet.spreadsheetId}?addParents=${encodeURIComponent(folderId)}&removeParents=root&fields=id,name,mimeType,parents,appProperties`,{method:"PATCH",body:JSON.stringify({appProperties:DB_PROPS})});
}
async function ensureLocations(spreadsheetId){
  let metadata=await api(`${SHEETS}/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`);
  let sheet=metadata.sheets?.find(item=>item.properties.title==="Locations");
  if(!sheet){
    await api(`${SHEETS}/spreadsheets/${spreadsheetId}:batchUpdate`,{method:"POST",body:JSON.stringify({requests:[{addSheet:{properties:{title:"Locations"}}}]})});
    metadata=await api(`${SHEETS}/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`);
    sheet=metadata.sheets?.find(item=>item.properties.title==="Locations");
  }
  if(!sheet)throw new Error("LOCATIONS_SHEET_MISSING");
  locationsSheetId=sheet.properties.sheetId;
  const existing=await api(`${SHEETS}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("Locations!A1:I1")}`);
  if(!existing.values?.length)await api(`${SHEETS}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("Locations!A1:I1")}?valueInputOption=RAW`,{method:"PUT",body:JSON.stringify({range:"Locations!A1:I1",majorDimension:"ROWS",values:[LOCATION_HEADERS]})});
}

export async function initializeProject({repairMissingDatabase=false,onProgress}={}){
  const folder=await step("第1步：尋找或建立 Drive 專案資料夾",findOrCreateFolder,onProgress);
  const configs=await step("第2步：尋找設定檔",()=>findConfig(folder.id),onProgress);
  let configFromDrive=null;
  if(configs.length>1)throw new Error("CONFIG_CONFLICT");
  if(configs[0])configFromDrive=await step("第3步：讀取設定 JSON",()=>readFile(configs[0].id),onProgress);
  const databases=await step("第4步：尋找既有 Google Sheets",()=>findDatabase(folder.id),onProgress);
  if(databases.length>1)throw new Error("DATABASE_CONFLICT");
  const referencedDatabaseMissing=Boolean(configFromDrive?.spreadsheetId&&!databases.some(x=>x.id===configFromDrive.spreadsheetId));
  if(referencedDatabaseMissing&&!repairMissingDatabase)throw new Error("DATABASE_MISSING_REPAIR_REQUIRED");
  if(referencedDatabaseMissing&&repairMissingDatabase&&databases.length)throw new Error("DATABASE_REFERENCE_CONFLICT");
  const database=databases[0]||await step("第5步：建立 Google Sheets",()=>createDatabase(folder.id),onProgress);
  databaseId=database.id;
  await step("第6步：建立或確認 Locations 工作表與標題列",()=>ensureLocations(database.id),onProgress);
  const now=new Date().toISOString();
  const config={...(configFromDrive||{}),application:"personal-map",projectName:APP_CONFIG.projectName,schemaVersion:1,folderId:folder.id,spreadsheetId:database.id,createdAt:configFromDrive?.createdAt||now,updatedAt:now};
  const body=JSON.stringify(config,null,2);
  if(configs[0]&&!configFromDrive)await step("第7步：修復空白設定 JSON",()=>writeFile(configs[0].id,body),onProgress);
  else if(configs[0]&&referencedDatabaseMissing)await step("第7步：更新修復後設定 JSON",()=>writeFile(configs[0].id,body),onProgress);
  else if(!configs.length)await step("第7步：建立設定 JSON",()=>createFile({name:APP_CONFIG.configFileName,mimeType:"application/json",parents:[folder.id],appProperties:CONFIG_PROPS},body),onProgress);
  return {folder,database,config};
}
