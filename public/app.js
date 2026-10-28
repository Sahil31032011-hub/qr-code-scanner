(() => {
'use strict';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const storeKey = 'qrscan-history-v1';
const supportedFormats = ['qr_code','aztec','data_matrix','pdf417','code_39','code_128','ean_13','ean_8','upc_a','upc_e','itf','codabar'];
let history = loadHistory(), currentResult = null, activeType = 'url', cameraStream = null, detector = null, scanLoop = false, lastSeen = '', batchMode = false, batchItems = [], toastTimer = 0, generatedValue = '', zxingReader = null, zxingControls = null;
const toast = (message) => { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); };
function loadHistory(){ try { const x=JSON.parse(localStorage.getItem(storeKey)||'[]'); return Array.isArray(x)?x:[]; } catch(e){return [];} }
function saveHistory(){ try { localStorage.setItem(storeKey,JSON.stringify(history.slice(0,500))); } catch(e){toast('Browser storage is full. Export your history to keep it.');} }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function typeLabel(format){ const map={qr_code:'QR Code',aztec:'Aztec',data_matrix:'Data Matrix',pdf417:'PDF417',code_39:'Code 39',code_128:'Code 128',ean_13:'EAN-13',ean_8:'EAN-8',upc_a:'UPC-A',upc_e:'UPC-E',itf:'ITF',codabar:'Codabar'}; return map[String(format||'').toLowerCase()]||String(format||'Code').replace(/_/g,' ').toUpperCase(); }
function classify(value){ if(/^https?:\/\//i.test(value)) return 'Website'; if(/^WIFI:/i.test(value))return 'Wi-Fi'; if(/^BEGIN:VCARD/i.test(value))return 'Contact'; if(/^mailto:/i.test(value))return 'Email'; if(/^geo:/i.test(value))return 'Location'; if(/^BEGIN:VEVENT/i.test(value))return 'Calendar event'; return 'Text'; }
function addHistory(value,format,source){const item={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),value:String(value),format:typeLabel(format),kind:classify(String(value)),source:source||'camera',time:new Date().toISOString()};history.unshift(item);history=history.slice(0,500);saveHistory();renderHistory();return item;}
function showResult(value,format,source){currentResult={value:String(value),format:typeLabel(format),source:source||'camera'};$('#resultTitle').textContent=currentResult.format+' detected';$('#resultBadge').textContent='FOUND';$('#resultBadge').classList.add('found');$('#resultBox').innerHTML='<div class="result-value">'+escapeHtml(value)+'</div><div class="context-actions" id="contextActions"></div>';const actions=$('#contextActions');const kind=classify(String(value));if(/^https?:\/\//i.test(value)){addContextButton(actions,'Check & open link',()=>openUrlSafely(value));}else if(/^mailto:/i.test(value)){addContextButton(actions,'Compose email',()=>window.location.href=value);}else if(/^geo:/i.test(value)){addContextButton(actions,'Open map',()=>window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(value.replace(/^geo:/i,'')),'_blank','noopener,noreferrer'));}else if(/^WIFI:/i.test(value)){addContextButton(actions,'Copy Wi-Fi details',()=>copyText(value));}else{addContextButton(actions,'Search web',()=>window.open('https://www.google.com/search?q='+encodeURIComponent(value),'_blank','noopener,noreferrer'));}$('#copyResult').disabled=false;$('#openResult').disabled=!(kind==='Website'||kind==='Email'||kind==='Location');$('#openResult').textContent=kind==='Website'?'Open link':kind==='Email'?'Compose email':kind==='Location'?'Open map':'Open link';addHistory(value,format,source);if(batchMode){batchItems.unshift({value:String(value),format:typeLabel(format),time:new Date().toLocaleTimeString()});renderBatch();}toast('Code scanned successfully');}
function addContextButton(parent,label,fn){const b=document.createElement('button');b.className='mini-action';b.textContent=label;b.addEventListener('click',fn);parent.appendChild(b);}
async function copyText(text){try{await navigator.clipboard.writeText(String(text));toast('Copied to clipboard');}catch(e){const a=document.createElement('textarea');a.value=String(text);document.body.appendChild(a);a.select();try{document.execCommand('copy');toast('Copied to clipboard');}catch(_){toast('Copy is not available in this browser');}a.remove();}}
function openUrlSafely(value){let u;try{u=new URL(String(value));}catch(e){toast('This link is not a valid web address');return;}if(!['http:','https:'].includes(u.protocol)){toast('Blocked unsupported link type');return;}const host=u.hostname.toLowerCase();const suspicious=u.protocol!=='https:'||u.username||u.password||host.startsWith('xn--')||/^\d{1,3}(\.\d{1,3}){3}$/.test(host);if(suspicious&&!confirm('Safety check: this link uses an unusual or unencrypted address. Only continue if you trust the source.\n\n'+u.href))return;window.open(u.href,'_blank','noopener,noreferrer');}
$('#copyResult').addEventListener('click',()=>currentResult&&copyText(currentResult.value));
$('#openResult').addEventListener('click',()=>{if(!currentResult)return;const v=currentResult.value;if(/^https?:\/\//i.test(v))openUrlSafely(v);else if(/^mailto:/i.test(v))window.location.href=v;else if(/^geo:/i.test(v))window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(v.replace(/^geo:/i,'')),'_blank','noopener,noreferrer');});
async function startCamera(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Camera needs HTTPS and a supported browser. Open the secure app URL and allow camera access.');return;}const video=$('#video');$('#cameraPlaceholder').hidden=true;video.hidden=false;$('#cameraOverlay').hidden=false;lastSeen='';try{if('BarcodeDetector'in window){const available=window.BarcodeDetector.getSupportedFormats?await window.BarcodeDetector.getSupportedFormats():supportedFormats;const formats=supportedFormats.filter(f=>available.includes(f));if(formats.length){detector=new window.BarcodeDetector({formats});cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});video.srcObject=cameraStream;await video.play();scanLoop=true;scanFrame();toast('Camera is ready');return;}}if(window.ZXing&&window.ZXing.BrowserMultiFormatReader){zxingReader=new window.ZXing.BrowserMultiFormatReader();scanLoop=true;zxingControls=await zxingReader.decodeFromVideoDevice(undefined,video,(result,err,controls)=>{if(controls)zxingControls=controls;if(!scanLoop)return;if(result&&result.getText){const value=result.getText();if(value&&value!==lastSeen){lastSeen=value;showResult(value,result.getBarcodeFormat?result.getBarcodeFormat():'QR Code','camera');if(!batchMode){stopCamera();return;}setTimeout(()=>{lastSeen='';},1300);}}});toast('Camera is ready');return;}throw new Error('Scanner library did not load');}catch(e){stopCamera();toast(e&&e.name==='NotAllowedError'?'Camera permission was denied. Click the site icon near the address bar and allow camera access.':(e&&e.name==='NotFoundError'?'No camera was found on this device.':'Camera could not start. Check permissions and reload the page.'));}}
async function scanFrame(){if(!scanLoop||!detector||!$('#video').videoWidth){if(scanLoop)requestAnimationFrame(scanFrame);return;}try{const hits=await detector.detect($('#video'));if(hits&&hits.length){const found=hits[0];if(found.rawValue&&found.rawValue!==lastSeen){lastSeen=found.rawValue;showResult(found.rawValue,found.format,'camera');if(!batchMode){stopCamera();return;}setTimeout(()=>{lastSeen='';},1300);}}}catch(e){}if(scanLoop)requestAnimationFrame(scanFrame);}
function stopCamera(){scanLoop=false;if(zxingControls){try{zxingControls.stop();}catch(e){}zxingControls=null;}if(zxingReader){try{zxingReader.reset();}catch(e){}zxingReader=null;}if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}const video=$('#video');try{video.pause();}catch(e){}video.srcObject=null;video.hidden=true;$('#cameraOverlay').hidden=true;$('#cameraPlaceholder').hidden=false;}
$('#startCamera').addEventListener('click',startCamera);$('#stopCamera').addEventListener('click',stopCamera);window.addEventListener('pagehide',stopCamera);
$('#torchBtn').addEventListener('click',async()=>{const track=cameraStream&&cameraStream.getVideoTracks()[0];if(!track){toast('Start the camera first');return;}try{const caps=track.getCapabilities();if(!caps.torch){toast('Flashlight is not supported by this camera');return;}const settings=track.getSettings();await track.applyConstraints({advanced:[{torch:!settings.torch}]});toast(settings.torch?'Flashlight off':'Flashlight on');}catch(e){toast('Flashlight is not available on this device');}});
$('#zoomRange').addEventListener('input',async e=>{const track=cameraStream&&cameraStream.getVideoTracks()[0];if(!track)return;try{const caps=track.getCapabilities();if(caps.zoom)await track.applyConstraints({advanced:[{zoom:Math.min(caps.zoom.max,Math.max(caps.zoom.min,Number(e.target.value)))}]});}catch(e){}});
$('#zoomOut').addEventListener('click',()=>{const x=$('#zoomRange');x.value=String(Math.max(1,Number(x.value)-.25));x.dispatchEvent(new Event('input'));});$('#zoomIn').addEventListener('click',()=>{const x=$('#zoomRange');x.value=String(Math.min(3,Number(x.value)+.25));x.dispatchEvent(new Event('input'));});
function openGallery(){ $('#galleryInput').click(); }
$('#galleryTrigger').addEventListener('click',openGallery);
$('#galleryInput').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{let found=[];if('BarcodeDetector'in window){const available=window.BarcodeDetector.getSupportedFormats?await window.BarcodeDetector.getSupportedFormats():supportedFormats;const d=new window.BarcodeDetector({formats:supportedFormats.filter(f=>available.includes(f))});const bitmap=await createImageBitmap(file);try{found=await d.detect(bitmap);}finally{bitmap.close();}}else if(window.ZXing&&window.ZXing.BrowserMultiFormatReader){const img=new Image(),url=URL.createObjectURL(file);try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const reader=new window.ZXing.BrowserMultiFormatReader();const result=await reader.decodeFromImageElement(img);if(result)found=[{rawValue:result.getText(),format:result.getBarcodeFormat?result.getBarcodeFormat():'QR Code'}];reader.reset();}finally{URL.revokeObjectURL(url);}}else throw new Error('Scanner libraries unavailable');if(found.length)showResult(found[0].rawValue,found[0].format,'gallery');else toast('No supported code found in that image');}catch(err){toast('Could not read that image. Try a clearer photo or a sharper crop.');}e.target.value='';});
function renderBatch(){ $('#batchCount').textContent=batchItems.length+' code'+(batchItems.length===1?'':'s');$('#batchList').innerHTML=batchItems.length?batchItems.map((x,i)=>'<div class="batch-item"><b>'+escapeHtml(x.format)+'</b> · '+escapeHtml(x.value)+'<small>Scan '+(batchItems.length-i)+' · '+escapeHtml(x.time)+'</small></div>').join(''):'<p>No codes collected yet.</p>'; }
function setBatchMode(on){batchMode=on;$('#batchPanel').hidden=!on;$('#batchToggle').classList.toggle('selected',on);$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===(on?'batch':'camera')));if(on)toast('Batch mode enabled. Start the camera to collect codes.');}
$('#batchToggle').addEventListener('click',()=>setBatchMode(!batchMode));$('#clearBatch').addEventListener('click',()=>{batchItems=[];renderBatch();});$('#exportBatch').addEventListener('click',()=>{if(!batchItems.length){toast('No batch scans to export yet');return;}const rows=[['Type','Value','Scanned at'],...batchItems.map(x=>[x.format,x.value,x.time])];const csv=rows.map(row=>row.map(v=>'\"'+String(v).replace(/\"/g,'\"\"')+'\"').join(',')).join('\r\n');downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),'qr-scan-batch.csv');toast('Batch CSV exported');});$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab==='camera'){setBatchMode(false);$('#cameraStage').scrollIntoView({behavior:'smooth',block:'center'});}if(b.dataset.tab==='gallery')openGallery();if(b.dataset.tab==='batch')setBatchMode(true);}));
function renderHistory(){const query=($('#historySearch').value||'').toLowerCase();const shown=history.filter(x=>(x.value+' '+x.format+' '+x.kind).toLowerCase().includes(query));$('#historyCount').textContent=history.length;const list=$('#historyList');if(!shown.length){list.innerHTML='<div class="history-empty"><span>◷</span><h4>'+(history.length?'No matches found.':'A clean slate.')+'</h4><p>'+(history.length?'Try a different search term.':'Scan a code and it will appear here.')+'</p>'+(history.length?'':'<a href="#scanner" class="text-link">Scan your first code ↗</a>')+'</div>';return;}list.innerHTML=shown.map(x=>'<div class="history-row"><div class="history-icon">'+(x.kind==='Website'?'↗':x.kind==='Wi-Fi'?'⌁':x.kind==='Email'?'✉':'⌗')+'</div><div class="history-detail"><b>'+escapeHtml(x.kind)+' · '+escapeHtml(x.format)+'</b><p title="'+escapeHtml(x.value)+'">'+escapeHtml(x.value)+'</p><small>'+escapeHtml(new Date(x.time).toLocaleString())+' · '+escapeHtml(x.source)+'</small></div><div class="history-row-actions"><button data-copy="'+escapeHtml(x.id)+'">Copy</button><button data-delete="'+escapeHtml(x.id)+'" aria-label="Delete scan">×</button></div></div>').join('');$$('[data-copy]',list).forEach(b=>b.addEventListener('click',()=>{const x=history.find(y=>y.id===b.dataset.copy);if(x)copyText(x.value);}));$$('[data-delete]',list).forEach(b=>b.addEventListener('click',()=>{history=history.filter(x=>x.id!==b.dataset.delete);saveHistory();renderHistory();toast('Scan removed');}));}
$('#historySearch').addEventListener('input',renderHistory);
$('#clearHistory').addEventListener('click',()=>{if(!history.length){toast('History is already empty');return;}if(confirm('Clear all scan history saved in this browser?')){history=[];saveHistory();renderHistory();toast('History cleared');}});
$('#exportCsv').addEventListener('click',()=>{if(!history.length){toast('There is no scan history to export yet');return;}const rows=[['Timestamp','Type','Format','Source','Value'],...history.map(x=>[x.time,x.kind,x.format,x.source,x.value])];const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),'qr-scan-history.csv');toast('CSV export downloaded');});
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const fields={
url:'<label class="input-label" for="genValue">Website URL</label><input class="text-input" id="genValue" placeholder="https://example.com" value="https://example.com" autocomplete="url"><p class="field-hint">Include https:// for the best results.</p>',
text:'<label class="input-label" for="genValue">Your message</label><textarea class="text-input" id="genValue" rows="4" placeholder="Type something to share..."></textarea><p class="field-hint">Any short note, instruction, or plain text.</p>',
wifi:'<div class="field-grid"><div class="field-span"><label class="input-label" for="wifiName">Network name (SSID)</label><input class="text-input" id="wifiName" placeholder="My Wi-Fi"></div><div><label class="input-label" for="wifiPass">Password</label><input class="text-input" id="wifiPass" placeholder="Password" type="password"></div><div><label class="input-label" for="wifiSecurity">Security</label><select class="select-input" id="wifiSecurity"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">No password</option></select></div></div><p class="field-hint">Anyone who scans this code may be able to join this network.</p>',
email:'<div class="field-grid"><div class="field-span"><label class="input-label" for="emailAddress">Email address</label><input class="text-input" id="emailAddress" type="email" placeholder="hello@example.com"></div><div class="field-span"><label class="input-label" for="emailSubject">Subject</label><input class="text-input" id="emailSubject" placeholder="Hello there"></div><div class="field-span"><label class="input-label" for="emailBody">Message (optional)</label><textarea class="text-input" id="emailBody" rows="3" placeholder="Write a quick note..."></textarea></div></div>',
contact:'<div class="field-grid"><div><label class="input-label" for="contactName">Full name</label><input class="text-input" id="contactName" placeholder="Alex Morgan"></div><div><label class="input-label" for="contactPhone">Phone</label><input class="text-input" id="contactPhone" type="tel" placeholder="+91 98765 43210"></div><div class="field-span"><label class="input-label" for="contactEmail">Email (optional)</label><input class="text-input" id="contactEmail" type="email" placeholder="alex@example.com"></div></div>',
barcode:'<label class="input-label" for="genValue">Barcode value</label><input class="text-input" id="genValue" placeholder="123456789012" inputmode="numeric"><div style="margin-top:13px"><label class="input-label" for="barcodeFormat">Barcode format</label><select class="select-input" id="barcodeFormat"><option value="CODE128">Code 128 (general purpose)</option><option value="EAN13">EAN-13 (12 or 13 digits)</option><option value="UPC">UPC-A (12 digits)</option><option value="CODE39">Code 39</option></select></div><p class="field-hint">Use a format accepted by the selected barcode standard.</p>'
};
$$('[data-type]').forEach(b=>b.addEventListener('click',()=>{activeType=b.dataset.type;$$('[data-type]').forEach(x=>x.classList.toggle('selected',x===b));$('#dynamicFields').innerHTML=fields[activeType];$('#previewTitle').textContent=({url:'A link to share',text:'A message to share',wifi:'Wi-Fi access',email:'An email shortcut',contact:'A contact card',barcode:'A scannable barcode'})[activeType];$('#previewSubtitle').textContent=activeType==='barcode'?'Barcode · High contrast':'QR code · High contrast';$('#generatedCode').innerHTML='<div class="placeholder-qr">⌗</div><p>Your code will appear here</p>';$('#downloadCode').disabled=true;$('#copyCode').disabled=true;$('#shareCode').disabled=true;generatedValue='';}));
function getValue(){if(activeType==='url'){let v=$('#genValue').value.trim();if(v&&!/^https?:\/\//i.test(v))v='https://'+v;return v;}if(activeType==='text')return $('#genValue').value.trim();if(activeType==='wifi'){const s=$('#wifiSecurity').value,n=$('#wifiName').value,p=$('#wifiPass').value;return 'WIFI:T:'+s+';S:'+n.replace(/[\\;,:"]/g,'\\$&')+';P:'+p.replace(/[\\;,:"]/g,'\\$&')+';;';}if(activeType==='email'){const a=$('#emailAddress').value.trim(),s=$('#emailSubject').value,b=$('#emailBody').value;return 'mailto:'+a+(s||b?'?'+(s?'subject='+encodeURIComponent(s):'')+(s&&b?'&':'')+(b?'body='+encodeURIComponent(b):''):'');}if(activeType==='contact'){const n=$('#contactName').value.trim(),p=$('#contactPhone').value.trim(),e=$('#contactEmail').value.trim();return 'BEGIN:VCARD\\nVERSION:3.0\\nFN:'+n+'\\nTEL:'+p+(e?'\\nEMAIL:'+e:'')+'\\nEND:VCARD';}return $('#genValue').value.trim();}
$('#generatorForm').addEventListener('submit',async e=>{e.preventDefault();const value=getValue();if(!value){toast('Add some content first');return;}const container=$('#generatedCode');container.innerHTML='';generatedValue=value;try{if(activeType==='barcode'){if(!window.JsBarcode)throw new Error('Barcode generator is still loading. Try again in a moment.');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');container.appendChild(svg);window.JsBarcode(svg,value,{format:$('#barcodeFormat').value,lineColor:'#111827',background:'#f1f3fa',width:2,height:95,displayValue:true,margin:8,font:'DM Mono',fontSize:13});}else{if(typeof window.QRCode!=='function')throw new Error('QR generator did not load. Check your internet connection and reload the page.');const level=$('#qrErrorLevel').value,levels=window.QRCode.CorrectLevel||{L:1,M:0,Q:3,H:2};new window.QRCode(container,{text:value,width:220,height:220,colorDark:$('#qrForeground').value,colorLight:$('#qrBackground').value,correctLevel:levels[level]??0});}$('#downloadCode').disabled=false;$('#copyCode').disabled=false;$('#shareCode').disabled=false;$('#previewSubtitle').textContent=activeType==='barcode'?'Barcode · '+$('#barcodeFormat').value:'QR code · High contrast';toast('Your code is ready to share');}catch(err){container.innerHTML='<p class="result-value" style="color:#b03d51">'+escapeHtml(err.message||'Could not generate this code')+'</p>';toast(err.message||'Could not generate code');}});
$('#downloadCode').addEventListener('click',()=>{const svg=$('#generatedCode svg');const canvas=$('#generatedCode canvas');if(canvas){canvas.toBlob(blob=>blob&&downloadBlob(blob,'qr-code.png'));return;}if(svg){const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');const blob=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'});downloadBlob(blob,'barcode.svg');}});

$('#copyCode').addEventListener('click', () => {
  if (generatedValue) {
    copyText(generatedValue);
  }
});

$('#shareCode').addEventListener('click', async () => {
  if (!generatedValue) {
    toast('Generate a code first');
    return;
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'QR Scan code',
        text: generatedValue
      });
    } else {
      await copyText(generatedValue);
      toast('Sharing unavailable; text/link copied instead');
    }
  } catch (err) {
    if (err.name === 'AbortError') return;

    await copyText(generatedValue);
    toast('Share unavailable; text/link copied instead');
  }
});

$('#qrForeground').addEventListener('input', () => {
  if (generatedValue && activeType !== 'barcode') {
    $('#generatorForm').requestSubmit();
  }
});

$('#qrBackground').addEventListener('input', () => {
  if (generatedValue && activeType !== 'barcode') {
    $('#generatorForm').requestSubmit();
  }
});

$('#qrErrorLevel').addEventListener('change', () => {
  if (generatedValue && activeType !== 'barcode') {
    $('#generatorForm').requestSubmit();
  }
});


const themeKey='qrscan-theme-v1';
let settingsCloseTimer=0;

function systemTheme(){
  return window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function applyTheme(choice,announce=true){
  const resolved=choice==='system'?systemTheme():choice;
  document.body.dataset.theme=resolved;
  document.documentElement.style.colorScheme=resolved;

  $$('[data-theme-choice]').forEach(b=>{
    const active=b.dataset.themeChoice===choice;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });

  try{
    localStorage.setItem(themeKey,choice);
  }catch(e){}

  const meta=$('meta[name="theme-color"]');
  if(meta) meta.content=resolved==='light'?'#f5f7fc':'#10131d';

  if(announce){
    toast(
      (choice==='system'?'System':choice==='light'?'Light':'Dark')
      +' mode enabled'
    );
  }
}

function openSettings(){
  clearTimeout(settingsCloseTimer);

  const panel=$('#settingsPanel');
  const backdrop=$('#settingsBackdrop');

  panel.hidden=false;
  backdrop.hidden=false;
  panel.classList.remove('is-closing');
  panel.setAttribute('aria-hidden','false');
  backdrop.setAttribute('aria-hidden','false');

  requestAnimationFrame(()=>{
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
  });

  document.body.classList.add('settings-open');
  $('#settingsToggle').setAttribute('aria-expanded','true');

  setTimeout(()=>$('#settingsClose').focus(),80);
}

function closeSettings(){
  const panel=$('#settingsPanel');
  const backdrop=$('#settingsBackdrop');

  if(panel.hidden) return;

  panel.classList.remove('is-open');
  panel.classList.add('is-closing');
  backdrop.classList.remove('is-open');
  panel.setAttribute('aria-hidden','true');
  $('#settingsToggle').setAttribute('aria-expanded','false');
  document.body.classList.remove('settings-open');

  clearTimeout(settingsCloseTimer);

  settingsCloseTimer=setTimeout(()=>{
    panel.hidden=true;
    backdrop.hidden=true;
    panel.classList.remove('is-closing');
  },360);

  $('#settingsToggle').focus({preventScroll:true});
}

$('#settingsToggle').addEventListener('click',openSettings);
$('#settingsClose').addEventListener('click',closeSettings);
$('#settingsBackdrop').addEventListener('click',closeSettings);

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!$('#settingsPanel').hidden){
    closeSettings();
  }
});

$$('[data-theme-choice]').forEach(b=>{
  b.addEventListener('click',()=>applyTheme(b.dataset.themeChoice));
});

const savedTheme=(()=>{
  try{
    return localStorage.getItem(themeKey)||'system';
  }catch(e){
    return 'system';
  }
})();

applyTheme(savedTheme,false);

if(window.matchMedia){
  const scheme=window.matchMedia('(prefers-color-scheme: light)');

  scheme.addEventListener?.('change',()=>{
    let choice='system';

    try{
      choice=localStorage.getItem(themeKey)||'system';
    }catch(e){}

    if(choice==='system'){
      applyTheme('system',false);
    }
  });
}

$('#menuToggle').addEventListener('click',()=>$('#nav')?.classList.toggle('mobile-open'));
$('.menu-toggle').addEventListener('click',()=>$('.nav').classList.toggle('mobile-open'));
$$('.nav a').forEach(a=>a.addEventListener('click',()=>$('.nav').classList.remove('mobile-open')));
$('#year').textContent=new Date().getFullYear();
renderHistory();renderBatch();
const revealObserver='IntersectionObserver'in window?new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target);}}),{threshold:.12,rootMargin:'0px 0px -35px 0px'}):null;
$$('.reveal').forEach((el,i)=>{if(revealObserver)revealObserver.observe(el);else el.classList.add('visible');});
let installPrompt=null;const installButton=$('#installApp');window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;installButton.hidden=false;});installButton.addEventListener('click',async()=>{if(!installPrompt){toast('Use your browser menu and choose Install app or Add to Home Screen');return;}installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;installButton.hidden=true;if(choice&&choice.outcome==='accepted')toast('App installation started');});window.addEventListener('appinstalled',()=>{installButton.hidden=true;toast('QR Scan installed successfully');});if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>toast('Offline support could not start in this browser')));
  
/* ==========================================
   INTERACTIVE POINTER — MOUSE + TOUCH
========================================== */

const pointerGlow = document.createElement('div');
pointerGlow.id = 'pointerGlow';
pointerGlow.setAttribute('aria-hidden', 'true');
document.body.appendChild(pointerGlow);

let pointerHideTimer = null;
let pointerTapTimer = null;

function movePointerGlow(x, y) {
  pointerGlow.style.left = `${x}px`;
  pointerGlow.style.top = `${y}px`;
  pointerGlow.classList.add('pointer-visible');
}

document.addEventListener('pointermove', (event) => {
  clearTimeout(pointerHideTimer);
  movePointerGlow(event.clientX, event.clientY);

  if (event.pointerType === 'touch') {
    pointerHideTimer = setTimeout(() => {
      pointerGlow.classList.remove('pointer-visible');
    }, 700);
  }
}, { passive: true });

document.addEventListener('pointerdown', (event) => {
  clearTimeout(pointerHideTimer);
  clearTimeout(pointerTapTimer);

  movePointerGlow(event.clientX, event.clientY);
  pointerGlow.classList.add('pointer-tap');

  pointerTapTimer = setTimeout(() => {
    pointerGlow.classList.remove('pointer-tap');
  }, 220);

  if (event.pointerType === 'touch') {
    pointerHideTimer = setTimeout(() => {
      pointerGlow.classList.remove('pointer-visible');
    }, 900);
  }
}, { passive: true });

document.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') {
    clearTimeout(pointerHideTimer);
    pointerHideTimer = setTimeout(() => {
      pointerGlow.classList.remove('pointer-visible');
    }, 700);
  }
}, { passive: true });

document.addEventListener('pointerleave', (event) => {
  if (event.pointerType === 'mouse') {
    pointerGlow.classList.remove('pointer-visible', 'pointer-tap');
  }
}, { passive: true });

document.addEventListener('pointercancel', () => {
  pointerGlow.classList.remove('pointer-visible', 'pointer-tap');
}, { passive: true });

})();
