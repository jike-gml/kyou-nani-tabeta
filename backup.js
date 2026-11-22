/* Offline, store-only ZIP writer/reader for the food log backup format. */
(function () {
  'use strict';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', {fatal:true});
  const MAX_ARCHIVE = 250 * 1024 * 1024;
  const table = new Uint32Array(256);
  for (let i=0;i<256;i++) {
    let c=i;
    for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    table[i]=c>>>0;
  }
  function crc32(bytes) {
    let crc=0xffffffff;
    for (const byte of bytes) crc=table[(crc^byte)&255]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }
  function put16(view,offset,value){view.setUint16(offset,value,true)}
  function put32(view,offset,value){view.setUint32(offset,value>>>0,true)}
  function get16(view,offset){return view.getUint16(offset,true)}
  function get32(view,offset){return view.getUint32(offset,true)}
  function bytesOf(value){
    if(typeof value==='string')return encoder.encode(value);
    if(value instanceof Uint8Array)return value;
    throw new Error('未対応のバックアップデータです。');
  }
  async function createZip(entries) {
    const body=[],directory=[];
    let position=0,directorySize=0;
    if(entries.length>10000)throw new Error('ファイル数が多すぎます。');
    for(const entry of entries){
      const name=encoder.encode(entry.name);
      const data=entry.data instanceof Blob
        ?new Uint8Array(await entry.data.arrayBuffer()):bytesOf(entry.data);
      if(!name.length||name.length>65535||position+data.byteLength>MAX_ARCHIVE)
        throw new Error('バックアップ容量が大きすぎます（上限250MB）。');
      const checksum=crc32(data);
      const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
      put32(l,0,0x04034b50);put16(l,4,20);put16(l,6,0x0800);
      put16(l,8,0);put32(l,14,checksum);put32(l,18,data.length);
      put32(l,22,data.length);put16(l,26,name.length);
      local.set(name,30);
      body.push(local,data);
      const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
      put32(c,0,0x02014b50);put16(c,4,20);put16(c,6,20);
      put16(c,8,0x0800);put16(c,10,0);put32(c,16,checksum);
      put32(c,20,data.length);put32(c,24,data.length);
      put16(c,28,name.length);put32(c,42,position);
      central.set(name,46);directory.push(central);
      position+=local.length+data.length;
      directorySize+=central.length;
    }
    if(position+directorySize+22>MAX_ARCHIVE)
      throw new Error('バックアップ容量が大きすぎます（上限250MB）。');
    const end=new Uint8Array(22),e=new DataView(end.buffer);
    put32(e,0,0x06054b50);put16(e,8,entries.length);
    put16(e,10,entries.length);put32(e,12,directorySize);
    put32(e,16,position);
    return new Blob([...body,...directory,end],{type:'application/zip'});
  }
  async function readZip(file) {
    if(file.size>MAX_ARCHIVE)throw new Error('ZIPファイルが250MBを超えています。');
    const data=new Uint8Array(await file.arrayBuffer());
    const v=new DataView(data.buffer);
    let end=-1;
    for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--){
      if(get32(v,i)===0x06054b50&&i+22+get16(v,i+20)===data.length){end=i;break}
    }
    if(end<0)throw new Error('有効なZIPファイルではありません。');
    const count=get16(v,end+10),size=get32(v,end+12);
    let pos=get32(v,end+16);
    if(count>10000||pos+size>end||get16(v,end+8)!==count)
      throw new Error('ZIPのファイル一覧が不正です。');
    const files=new Map();
    for(let i=0;i<count;i++){
      if(pos+46>data.length||get32(v,pos)!==0x02014b50)
        throw new Error('ZIPの構造が不正です。');
      const flags=get16(v,pos+8),method=get16(v,pos+10),
        checksum=get32(v,pos+16),compressed=get32(v,pos+20),
        uncompressed=get32(v,pos+24),nameLen=get16(v,pos+28),
        extra=get16(v,pos+30),comment=get16(v,pos+32),
        localOffset=get32(v,pos+42);
      if(method!==0||compressed!==uncompressed||(flags&1))
        throw new Error('このアプリで作成した無圧縮ZIPを選択してください。');
      if(pos+46+nameLen+extra+comment>data.length)
        throw new Error('ZIPのファイル名が不正です。');
      const name=decoder.decode(data.subarray(pos+46,pos+46+nameLen));
      if(!name||name.startsWith('/')||name.includes('..')||name.includes('\\')||files.has(name))
        throw new Error('ZIPに不正なファイル名があります。');
      if(localOffset+30>data.length||get32(v,localOffset)!==0x04034b50)
        throw new Error('ZIPのファイル位置が不正です。');
      const start=localOffset+30+get16(v,localOffset+26)+get16(v,localOffset+28);
      if(start+compressed>pos||start+compressed>data.length)
        throw new Error('ZIPのファイル内容が不正です。');
      const contents=data.subarray(start,start+compressed);
      if(crc32(contents)!==checksum)throw new Error('ZIPの整合性検証に失敗しました。');
      files.set(name,contents);
      pos+=46+nameLen+extra+comment;
    }
    if(pos!==get32(v,end+16)+size)
      throw new Error('ZIPのファイル一覧の長さが不正です。');
    return files;
  }
  window.FoodlogArchive={createZip,readZip,encode:text=>encoder.encode(text),
    decode:bytes=>decoder.decode(bytes)};
})();
