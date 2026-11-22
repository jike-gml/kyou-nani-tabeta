/* Enhancements: six-month text retention, history selection and portable backups. */
'use strict';
const FOODLOG_VERSION='1.0.0';
const FOODLOG_RELEASE_DATE='2026.11.22';
let foodlogPastMode='10',foodlogPastMonth='',foodlogPendingImport=null;
const foodlogMeals=['breakfast','lunch','dinner','snack'];
const foodlogById=id=>document.getElementById(id);
function photoRetentionStartDate(){
  return new Date(state.today.getFullYear(),state.today.getMonth()-2,1);
}
function pastMonthKeys(){
  return Array.from({length:6},(_,i)=>{
    const d=new Date(state.today.getFullYear(),state.today.getMonth()-i,1);
    return toDateKey(d).slice(0,7);
  });
}
function updatePastMenuOptions(){
  const select=foodlogById('pastMenuMonth');
  const months=pastMonthKeys();
  if(!months.includes(foodlogPastMonth))foodlogPastMonth=months[0];
  select.replaceChildren(...months.map(key=>{
    const [year,month]=key.split('-');
    return new Option(year+'年'+Number(month)+'月',key);
  }));
  select.value=foodlogPastMonth;
  foodlogById('pastMenuMonthField').hidden=foodlogPastMode!=='month';
  foodlogById('pastMenu10').setAttribute('aria-pressed',String(foodlogPastMode==='10'));
  foodlogById('pastMenuMonthly').setAttribute('aria-pressed',String(foodlogPastMode==='month'));
  foodlogById('pastMenu10').classList.toggle('is-selected',foodlogPastMode==='10');
  foodlogById('pastMenuMonthly').classList.toggle('is-selected',foodlogPastMode==='month');
}
function buildExtendedPastMenusText(){
  const lines=[];
  if(foodlogPastMode==='month'){
    const month=Number(foodlogPastMonth.split('-')[1]);
    lines.push('過去'+month+'月・1ヶ月のメニューは以下です。');
    const [year,m]=foodlogPastMonth.split('-').map(Number);
    const days=new Date(year,m,0).getDate();
    for(let day=days;day>=1;day--){
      const record=state.records.get(recordKey(toDateKey(new Date(year,m-1,day)),'dinner'));
      const memo=String(record?.memo||'').trim();
      if(memo)lines.push('・'+memo);
    }
  }else{
    lines.push('過去１０日間のメニューは以下です。');
    for(let offset=0;offset<10;offset++){
      const date=new Date(state.today);
      date.setDate(date.getDate()-offset);
      const record=state.records.get(recordKey(toDateKey(date),'dinner'));
      const memo=String(record?.memo||'').trim();
      if(memo)lines.push('・'+memo);
    }
  }
  return lines.join('\n');
}
function renderExtendedCalendarGrid(){
  foodlogOriginalCalendarGrid();
  if(state.calendarMode!=='all')return;
  const cells=[...els.calendarGrid.querySelectorAll('.day-cell')];
  const year=state.viewedMonth.getFullYear(),month=state.viewedMonth.getMonth();
  cells.forEach((cell,i)=>{
    const date=toDateKey(new Date(year,month,i+1));
    const list=cell.querySelector('.all-meal-list');
    if(!list)return;
    for(const meal of foodlogMeals){
      const record=state.records.get(recordKey(date,meal));
      if(!record||record.fullBlob||!String(record.memo||'').trim())continue;
      const button=document.createElement('button');
      button.type='button';
      button.className='all-meal-row '+meal+' is-text-record';
      button.title=String(record.memo).trim();
      button.setAttribute('aria-label',APP.mealNames[meal]+'：'+String(record.memo).trim());
      const mark=document.createElement('span');
      mark.className='meal-mark has-name';
      mark.textContent=APP.mealMarks[meal];
      button.appendChild(mark);
      button.addEventListener('click',()=>showTextOnlyRecord(date,meal));
      list.appendChild(button);
    }
  });
}
function showTextOnlyRecord(date,meal){
  const record=state.records.get(recordKey(date,meal));
  if(!record)return;
  window.alert(formatDate(date)+'・'+APP.mealNames[meal]+'\n'+(record.memo||'料理名未入力')+'\n（写真の保存期間は終了しています）');
}
function renderExtendedMealTimeline(records){
  const photos=records.filter(r=>Boolean(r.fullBlob));
  foodlogOriginalMealTimeline(photos);
  const textOnly=records.filter(r=>!r.fullBlob&&String(r.memo||'').trim());
  if(!textOnly.length)return;
  els.mealTimeline.querySelector('.meal-timeline-empty')?.remove();
  for(const record of textOnly){
    const entry=document.createElement('div');
    entry.className='meal-timeline-entry is-text-only';
    entry.setAttribute('role','listitem');
    const icon=document.createElement('span');
    icon.className='meal-timeline-photo text-only-photo';
    icon.textContent='写真なし';
    const meta=document.createElement('span');
    meta.className='meal-timeline-meta';
    const date=document.createElement('span');
    date.className='meal-timeline-date';
    date.textContent=formatDate(record.date);
    const name=document.createElement('span');
    name.className='meal-timeline-name';
    name.textContent=String(record.memo).trim();
    const info=document.createElement('small');
    info.className='text-only-note';
    info.textContent='料理名のみ保存中';
    meta.append(date,name,info);
    entry.append(icon,meta);
    els.mealTimeline.appendChild(entry);
  }
}
function setBackupStatus(message,isError=false){
  const status=foodlogById('settingsStatus');
  status.textContent=message;status.dataset.error=String(isError);
}
function downloadFoodlogBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=name;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function backupStamp(){
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('');
}
function csvCell(value){
  const text=String(value??'');
  return '"'+text.replace(/"/g,'""')+'"';
}
function buildFoodlogCSV(records){
  const rows=[['date','meal','memo','favorite']];
  const ordered=[...records].sort((a,b)=>b.date.localeCompare(a.date)||
    foodlogMeals.indexOf(a.meal)-foodlogMeals.indexOf(b.meal));
  for(const r of ordered)rows.push([r.date,r.meal,r.memo||'',r.favorite?'1':'0']);
  return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
async function exportFoodlogCSV(){
  const records=await getAllRecords();
  const data=buildFoodlogCSV(records);
  downloadFoodlogBlob(new Blob([data],{type:'text/csv;charset=utf-8'}),
    'foodlog_menu_'+backupStamp()+'.csv');
  setBackupStatus('料理名CSV（朝食・昼食・夕食・間食）のダウンロードを開始しました。');
}
async function exportFoodlogZIP(){
  const records=await getAllRecords();
  const archive=[{name:'manifest.json',data:JSON.stringify({
    format:'foodlog-full-v1',version:FOODLOG_VERSION,exportedAt:new Date().toISOString()
  })}];
  const metadata=[];
  for(let i=0;i<records.length;i++){
    const record=records[i];
    const {fullBlob,thumbBlob,...data}=record;
    if(fullBlob instanceof Blob){
      data.photoFull='photos/'+i+'-full.bin';
      archive.push({name:data.photoFull,data:fullBlob});
    }
    if(thumbBlob instanceof Blob){
      data.photoThumb='photos/'+i+'-thumb.bin';
      archive.push({name:data.photoThumb,data:thumbBlob});
    }
    metadata.push(data);
  }
  archive.push({name:'records.json',data:JSON.stringify(metadata)});
  archive.push({name:'settings.json',data:JSON.stringify({
    theme:document.documentElement.dataset.theme||'classic',
    art:document.documentElement.dataset.artStyle||'original'
  })});
  const blob=await FoodlogArchive.createZip(archive);
  downloadFoodlogBlob(blob,'foodlog_full_'+backupStamp()+'.zip');
  setBackupStatus('完全バックアップ（'+records.length+'件・写真を含む）のダウンロードを開始しました。保存先をご確認ください。');
}
function validateMealRow(date,meal,memo){
  if(typeof date!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(date)||
    toDateKey(parseDateKey(date))!==date||!foodlogMeals.includes(meal)||
    typeof memo!=='string'||memo.length>10000)
    throw new Error('バックアップの食事記録が不正です。');
}
function dateInRetention(date){
  return date>=toDateKey(retentionStartDate())&&date<=toDateKey(state.today);
}
function restoreRecordMeta(raw,files){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    throw new Error('記録のデータ形式が不正です。');
  validateMealRow(raw.date,raw.meal,raw.memo||'');
  if(raw.key!==recordKey(raw.date,raw.meal))
    throw new Error('記録の識別情報が一致しません。');
  const getPhoto=(name)=>{
    if(name===undefined)return null;
    if(typeof name!=='string'||!/^photos\/[0-9]+-(?:full|thumb)\.bin$/.test(name)||!files.has(name))
      throw new Error('写真のバックアップファイルが不足しています。');
    return new Blob([files.get(name)],{type:raw.mimeType||'image/webp'});
  };
  const full=getPhoto(raw.photoFull),thumb=getPhoto(raw.photoThumb);
  return {
    key:raw.key,date:raw.date,meal:raw.meal,memo:raw.memo||'',
    favorite:Boolean(raw.favorite)&&Boolean(full),
    fullBlob:full,thumbBlob:thumb,
    width:Number(raw.width)||APP.fullWidth,
    height:Number(raw.height)||APP.fullHeight,
    mimeType:typeof raw.mimeType==='string'?raw.mimeType:'image/webp',
    quality:Number(raw.quality)||APP.fullQuality,
    updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:''
  };
}
async function readFoodlogZIP(file){
  const files=await FoodlogArchive.readZip(file);
  const required=['manifest.json','records.json','settings.json'];
  if(required.some(name=>!files.has(name)))
    throw new Error('このアプリの完全バックアップではありません。');
  if(files.get('manifest.json').length>20000||files.get('settings.json').length>20000||
     files.get('records.json').length>5*1024*1024)
    throw new Error('バックアップの設定ファイルが大きすぎます。');
  const manifest=JSON.parse(FoodlogArchive.decode(files.get('manifest.json')));
  if(manifest.format!=='foodlog-full-v1')
    throw new Error('対応していないバックアップ形式です。');
  const all=JSON.parse(FoodlogArchive.decode(files.get('records.json')));
  const settings=JSON.parse(FoodlogArchive.decode(files.get('settings.json')));
  if(!Array.isArray(all)||all.length>2000||!settings||typeof settings!=='object')
    throw new Error('バックアップの記録数または設定が不正です。');
  const result=[],seen=new Set();
  let excluded=0,photosExpired=0;
  for(const raw of all){
    const r=restoreRecordMeta(raw,files);
    if(seen.has(r.key))throw new Error('同じ日付と食事区分が重複しています。');
    seen.add(r.key);
    if(!dateInRetention(r.date)){excluded++;continue}
    if(r.date<toDateKey(photoRetentionStartDate())){
      if(r.fullBlob||r.thumbBlob)photosExpired++;
      r.fullBlob=null;r.thumbBlob=null;r.favorite=false;
    }
    result.push(r);
  }
  return {mode:'zip',records:result,settings,excluded,photosExpired,
    sourceDate:manifest.exportedAt||'不明'};
}
function parseFoodlogCSV(text){
  const rows=[];let row=[],field='',quoted=false;
  const source=text.replace(/^\ufeff/,'');
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){
      if(c==='"'&&source[i+1]==='"'){field+='"';i++}
      else if(c==='"')quoted=false;
      else field+=c;
    }else if(c==='"'&&field===''){quoted=true}
    else if(c===','){row.push(field);field=''}
    else if(c==='\r'||c==='\n'){
      if(c==='\r'&&source[i+1]==='\n')i++;
      row.push(field);field='';
      if(row.some(value=>value!==''))rows.push(row);
      row=[];
    }else field+=c;
  }
  if(quoted)throw new Error('CSVの引用符が閉じていません。');
  if(field!==''||row.length){row.push(field);rows.push(row)}
  if(!rows.length||rows[0].join(',')!=='date,meal,memo,favorite')
    throw new Error('このアプリが出力した料理名CSVを選択してください。');
  if(rows.length>2001)throw new Error('CSVの記録数が多すぎます。');
  const result=[],seen=new Set();let excluded=0;
  for(const cells of rows.slice(1)){
    if(cells.length!==4)throw new Error('CSVの列数が一致しません。');
    const [date,meal,memo]=cells;
    validateMealRow(date,meal,memo);
    const key=recordKey(date,meal);
    if(seen.has(key))throw new Error('CSV内に重複する食事記録があります。');
    seen.add(key);
    if(!dateInRetention(date)){excluded++;continue}
    result.push({key,date,meal,memo});
  }
  return {mode:'csv',records:result,excluded,photosExpired:0};
}
async function readFoodlogCSV(file){
  if(file.size>5*1024*1024)throw new Error('CSVは5MB以内にしてください。');
  return parseFoodlogCSV(await file.text());
}
function previewFoodlogImport(data){
  foodlogPendingImport=data;
  const current=state.records.size;
  const photos=data.records.filter(r=>r.fullBlob).length;
  const output=data.mode==='zip'
    ?'完全復元：'+data.records.length+'件、写真'+photos+'件。'+
      (data.excluded?'保存期間外'+data.excluded+'件は復元対象外。':'')+
      (data.photosExpired?'写真期限切れ'+data.photosExpired+'件。':'')+
      (current?'現在の'+current+'件は、実行すると置き換わります。事前に現在の完全バックアップを保存してください。':'記録のない環境に復元します。')
    :'CSV取込：料理名'+data.records.length+'件。'+
      (data.excluded?'保存期間外'+data.excluded+'件は対象外。':'')+
      '既存の写真は保持し、同じ日付・食事区分の料理名のみ更新します。';
  foodlogById('importPreview').textContent=output;
  foodlogById('importActions').hidden=false;
  foodlogById('applyImport').textContent=data.mode==='zip'
    ?(current?'現在の記録を置き換えて復元':'完全バックアップを復元')
    :'料理名CSVを取り込む';
  setBackupStatus('内容を確認し、実行する場合だけ復元ボタンを押してください。');
}
async function replaceAllFoodlogRecords(records){
  await new Promise((resolve,reject)=>{
    const tx=state.db.transaction(APP.storeName,'readwrite');
    const store=tx.objectStore(APP.storeName);
    store.clear();
    for(const record of records)store.put(record);
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error||new Error('復元を保存できませんでした。'));
    tx.onerror=()=>reject(tx.error||new Error('保存処理が失敗しました。'));
  });
}
async function applyFoodlogImport(){
  const pending=foodlogPendingImport;
  if(!pending)throw new Error('読み込むファイルが選択されていません。');
  if(pending.mode==='zip'){
    if(state.records.size&&!window.confirm(
      '現在の記録を完全に置き換えます。現在のZIPバックアップは保存しましたか？\nこの操作は取り消せません。'
    ))return;
    await replaceAllFoodlogRecords(pending.records);
    if(DESIGN_THEMES.some(t=>t.id===pending.settings.theme))
      setDesignTheme(pending.settings.theme);
    if(ART_STYLES.some(t=>t.id===pending.settings.art))
      setArtStyle(pending.settings.art);
  }else{
    if(!pending.records.length)throw new Error('取り込める料理名がありません。');
    if(state.records.size&&!window.confirm(
      '同じ日付・食事区分の料理名はCSVの内容で更新します。写真は残ります。続行しますか？'
    ))return;
    const combined=new Map((await getAllRecords()).map(r=>[r.key,r]));
    for(const data of pending.records){
      const old=combined.get(data.key);
      combined.set(data.key,old?{...old,memo:data.memo,updatedAt:new Date().toISOString()}:
        {...data,fullBlob:null,thumbBlob:null,favorite:false,updatedAt:new Date().toISOString()});
    }
    await replaceAllFoodlogRecords([...combined.values()]);
  }
  await refreshRecords();
  renderHome();renderCalendar();
  foodlogPendingImport=null;
  foodlogById('importActions').hidden=true;
  foodlogById('importPreview').textContent='';
  setBackupStatus('復元しました。'+state.records.size+'件の記録を読み込んでいます。');
}
function bindEnhancementEvents(){
  foodlogById('pastMenu10').addEventListener('click',()=>{
    foodlogPastMode='10';renderPastMenus();
  });
  foodlogById('pastMenuMonthly').addEventListener('click',()=>{
    foodlogPastMode='month';renderPastMenus();
  });
  foodlogById('pastMenuMonth').addEventListener('change',event=>{
    foodlogPastMonth=event.target.value;renderPastMenus();
  });
  foodlogById('openSettings').addEventListener('click',()=>{
    const panel=foodlogById('settingsPanel');
    panel.hidden=!panel.hidden;
    foodlogById('openSettings').setAttribute('aria-expanded',String(!panel.hidden));
  });
  foodlogById('exportFull').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;setBackupStatus('完全バックアップを作成しています。');
    try{await exportFoodlogZIP()}catch(e){setBackupStatus(e.message||'書き出せませんでした。',true)}
    finally{event.currentTarget.disabled=false}
  });
  foodlogById('exportCsv').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;
    try{await exportFoodlogCSV()}catch(e){setBackupStatus(e.message||'CSVを書き出せませんでした。',true)}
    finally{event.currentTarget.disabled=false}
  });
  for(const [buttonId,inputId,mode] of [
    ['selectImportZip','importZipFile','zip'],
    ['selectImportCsv','importCsvFile','csv']
  ]){
    foodlogById(buttonId).addEventListener('click',()=>foodlogById(inputId).click());
    foodlogById(inputId).addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      event.target.value='';
      if(!file)return;
      foodlogPendingImport=null;
      foodlogById('importActions').hidden=true;
      foodlogById('importPreview').textContent='';
      setBackupStatus('ファイルの形式と内容を検証しています。');
      try{
        const data=mode==='zip'?await readFoodlogZIP(file):await readFoodlogCSV(file);
        previewFoodlogImport(data);
      }catch(e){setBackupStatus(e.message||'ファイルを読み込めませんでした。',true)}
    });
  }
  foodlogById('applyImport').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;
    try{await applyFoodlogImport()}
    catch(e){setBackupStatus(e.message||'復元できませんでした。',true)}
    finally{event.currentTarget.disabled=false}
  });
  foodlogById('cancelImport').addEventListener('click',()=>{
    foodlogPendingImport=null;
    foodlogById('importActions').hidden=true;
    foodlogById('importPreview').textContent='';
    setBackupStatus('取り込みを中止しました。現在の記録は変更していません。');
  });
}

let foodlogOriginalCalendarGrid,foodlogOriginalMealTimeline;
function wireFoodlogUpgrade(){
  const controls=document.createElement('div');
  controls.className='past-period-controls';
  controls.setAttribute('role','group');
  controls.setAttribute('aria-label','過去メニューの期間');
  controls.innerHTML=[
    '<button type="button" id="pastMenu10" class="secondary-button is-selected">10日分</button>',
    '<button type="button" id="pastMenuMonthly" class="secondary-button">1ヶ月分</button>',
    '<label id="pastMenuMonthField" hidden>表示する月 <select id="pastMenuMonth" aria-label="表示する月"></select></label>'
  ].join('');
  foodlogById('pastMenusText').before(controls);
  const settings=document.createElement('div');
  settings.className='backup-controls';
  settings.innerHTML=[
    '<button id="openSettings" class="past-menu-open" type="button" aria-expanded="false" aria-controls="settingsPanel">⚙ 設定・バックアップ</button>',
    '<section id="settingsPanel" class="past-menu-panel settings-panel" hidden aria-label="設定とバックアップ">',
    '<strong>データのエクスポート</strong>',
    '<p>完全バックアップは機種変更・再インストール時の復元に使用します。写真は現在保存中のものだけが含まれます。</p>',
    '<div class="setting-actions">',
    '<button id="exportFull" type="button" class="secondary-button">完全データを保存（ZIP）</button>',
    '<button id="exportCsv" type="button" class="secondary-button">料理名一覧を保存（CSV）</button>',
    '</div><strong>データのインポート</strong>',
    '<p>ZIPは記録・写真・設定を丸ごと復元します。CSVは料理名だけを追加・更新します。</p>',
    '<div class="setting-actions">',
    '<button id="selectImportZip" type="button" class="secondary-button">ZIPから復元</button>',
    '<button id="selectImportCsv" type="button" class="secondary-button">CSVを取り込む</button>',
    '</div>',
    '<input id="importZipFile" type="file" accept=".zip,application/zip" hidden />',
    '<input id="importCsvFile" type="file" accept=".csv,text/csv" hidden />',
    '<p id="importPreview" class="import-preview" role="status"></p>',
    '<div id="importActions" class="setting-actions" hidden>',
    '<button id="applyImport" type="button" class="primary-button">復元する</button>',
    '<button id="cancelImport" type="button" class="secondary-button">キャンセル</button>',
    '</div><p id="settingsStatus" class="status" role="status" aria-live="polite"></p>',
    '</section>',
    '<p class="app-version" aria-label="アプリのバージョン">Version 1.0.0 ｜ 更新日：2026.11.22</p>'
  ].join('');
  foodlogById('homeStatus').after(settings);
  const css=document.createElement('style');
  css.textContent=[
    '.past-period-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}',
    '.past-period-controls>button{min-height:43px}',
    '.past-period-controls .is-selected{border-color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent)}',
    '#pastMenuMonthField{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:730;font-size:.9rem}',
    '#pastMenuMonthField select{min-height:44px;max-width:67%;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text)}',
    '.settings-panel{display:grid;gap:9px}',
    '.settings-panel strong{font-size:.97rem}',
    '.settings-panel p{margin:0;color:var(--muted);font-size:.82rem;line-height:1.55}',
    '.settings-panel .setting-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
    '.settings-panel .setting-actions button{min-height:46px;padding:8px 5px;font-size:.78rem;line-height:1.4}',
    '.settings-panel .import-preview{padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--warm-2)}',
    '.settings-panel .import-preview:empty{display:none}',
    '.settings-panel #settingsStatus[data-error="true"]{color:var(--danger)}',
    '.app-version{text-align:center;margin:16px 0 3px;color:var(--muted);font-size:.69rem;letter-spacing:.02em}',
    '.calendar-grid.is-all .all-meal-row.is-text-record{background:var(--warm-2);color:var(--text);border:1px solid var(--line);box-shadow:none}',
    '.meal-timeline-entry.is-text-only{grid-template-columns:84px minmax(0,1fr);gap:10px;padding:8px}',
    '.meal-timeline-photo.text-only-photo{display:flex;align-items:center;justify-content:center;width:84px;height:70px;flex:0 0 84px;background:var(--warm-2);border:1px dashed var(--line);color:var(--muted);font-size:.75rem;font-weight:750}',
    '.text-only-note{color:var(--muted);font-size:.68rem}'
  ].join('\n');
  document.head.appendChild(css);
  bindEnhancementEvents();
}
(function installFoodlogUpgrade(){
  retentionStartDate=function(){
    return new Date(state.today.getFullYear(),state.today.getMonth()-5,1);
  };
  purgeExpiredRecords=async function(){
    const textCutoff=toDateKey(retentionStartDate());
    const photoCutoff=toDateKey(photoRetentionStartDate());
    const all=await getAllRecords();
    for(const record of all){
      if(typeof record.date!=='string')continue;
      if(record.date<textCutoff){await deleteRecord(record.key);continue}
      if(record.date<photoCutoff&&(record.fullBlob||record.thumbBlob||record.favorite))
        await putRecord({...record,fullBlob:null,thumbBlob:null,favorite:false});
    }
  };
  buildPastMenusText=buildExtendedPastMenusText;
  renderPastMenus=function(){
    updatePastMenuOptions();
    els.pastMenusText.textContent=buildPastMenusText();
    els.pastMenusStatus.textContent='';
  };
  foodlogOriginalCalendarGrid=renderCalendarGrid;
  renderCalendarGrid=renderExtendedCalendarGrid;
  foodlogOriginalMealTimeline=renderMealTimeline;
  renderMealTimeline=renderExtendedMealTimeline;
  getMealTimelineRecords=function(meal){
    const startKey=toDateKey(retentionStartDate()),todayKey=toDateKey(state.today);
    return [...state.records.values()]
      .filter(r=>r.meal===meal&&(r.fullBlob||String(r.memo||'').trim())&&r.date>=startKey&&r.date<=todayKey)
      .sort((a,b)=>b.date.localeCompare(a.date));
  };
  const oldHeader=renderMonthHeader;
  renderMonthHeader=function(){
    oldHeader();
    els.retentionLabel.textContent='写真3か月・料理名6か月を保持';
  };
  const oldCalendar=renderCalendar;
  renderCalendar=function(){
    oldCalendar();
    if(!state.favoritesMode){
      els.calendarSubtitle.textContent=state.calendarMode==='all'
        ?'直近6か月の記録（写真は3か月）'
        :'直近6か月・新しい順・'+getMealTimelineRecords(state.calendarMode).length+'件';
    }
  };
  const oldHome=renderHome;
  renderHome=function(){
    oldHome();
    const date=toDateKey(state.today);
    for(const button of els.homeMealButtons){
      const rec=state.records.get(recordKey(date,button.dataset.homeMeal));
      if(rec&&!rec.fullBlob){
        button.disabled=false;
        button.classList.remove('is-recorded');
        const label=button.querySelector('small');
        if(label)label.textContent='＋ 写真を記録';
      }
    }
  };
  document.addEventListener('DOMContentLoaded',wireFoodlogUpgrade);
})();
