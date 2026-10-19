'use strict';
const voice={analysis:null,text:'',confirmed:false,busy:false,connected:false,recognition:null,listening:false,request:0};
function intakeMode(mode){const structured=mode==='structured';document.body.classList.toggle('voice-mode',!structured&&!voice.confirmed);document.body.classList.toggle('voice-review',!structured&&voice.confirmed);$('explainCard').hidden=structured;$('structuredMode').setAttribute('aria-pressed',String(structured));$('structuredMode').textContent=structured?'Back to guided estimate':'Open full calculator';}
$('structuredMode').onclick=()=>intakeMode(document.body.classList.contains('voice-mode')||document.body.classList.contains('voice-review')?'structured':'voice');
const areaCards=[
 ['Accounting, Billing & Finance','Finance & billing','Invoices, payments, budgets and reconciliation'],
 ['Back Office & Administration','Operations & administration','Internal requests, records and recurring admin'],
 ['Orders, Inventory & Fulfillment','Warehouse & fulfillment','Stock, orders, picking, shipping and replenishment'],
 ['Customer Service & Returns','Customer service','Support requests, returns and customer updates'],
 ['Sales & Customer Relationships','Sales & relationships','Lead handling, follow-up and customer records'],
 ['People, Payroll & HR','People & HR','Onboarding, payroll support and staff processes'],
 ['Storefront & Conversion','Storefront & conversion','Product information, merchandising and shopping experience'],
 ['Content Machine & Social Publishing','Content machine','Connected content creation across channels'],
 ['SEO & GEO','SEO & GEO','Search visibility, content optimization and reporting'],
 ['Email & Lifecycle Marketing','Email marketing','Campaigns, lifecycle journeys and newsletters'],
 ['Paid Advertising','Paid advertising','Campaign operations, creative and performance reporting'],
 ['Another Business Process','Something else','A process that does not fit the areas above']
];
function renderJourney(){
 $('areaChoices').innerHTML=areaCards.map(([id,title,desc])=>`<button class="area-card" type="button" data-area="${esc(id)}" aria-pressed="false"><strong>${esc(title)}</strong><small>${esc(desc)}</small></button>`).join('');
 $('areaChoices').addEventListener('click',e=>{const b=e.target.closest('[data-area]');if(!b)return;document.querySelectorAll('.area-card').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));choose('workflow');$('area').value=b.dataset.area;refreshDepartment('area');voice.startingArea=b.dataset.area;voice.startingService='workflow';voice.serviceChoice='unsure';const selected=areaCards.find(x=>x[0]===b.dataset.area);$('selectedAreaChip').innerHTML=`<span>Starting area</span><strong>${esc(selected?.[1]||b.dataset.area)}</strong><button type="button" id="changeArea">Change</button>`;$('explanationPanel').hidden=false;$('processText').focus();});
 $('explainCard').addEventListener('click',e=>{if(e.target.id==='changeArea'){$('explanationPanel').hidden=true;$('areaPicker').hidden=false;document.querySelector('[data-journey="2"]').classList.remove('current');document.querySelector('[data-journey="1"]').classList.add('current');}});
 $('teamSetup').onclick=()=>{choose('team');intakeMode('structured');};$('googleSetup').onclick=()=>{choose('google');intakeMode('structured');};
 $('processText').addEventListener('input',()=>{$('analyzeProcess').disabled=!voice.connected||$('processText').value.trim().length<30;});
}
function voiceMessage(text){$('analysisStatus').textContent=text;}
async function checkIntake(){try{const r=await fetch('/api/intake/status',{cache:'no-store'});const d=await r.json();voice.connected=r.ok&&d.configured;$('aiConnection').textContent=voice.connected?'AI description organizer ready · prices stay in the calculator':'AI setup pending · the full calculator is available';}catch{$('aiConnection').textContent='Could not check AI connection. The full calculator is available.';voice.connected=false;}recordingControls();}
$('checkAI').onclick=checkIntake;
function invalidateVoice(){voice.request++;voice.analysis=null;voice.confirmed=false;$('scopeReview').hidden=true;$('followupPanel').hidden=true;$('voiceCommercial').hidden=true;intakeMode('voice');voiceMessage('Description changed. Organize it again to refresh the scope.');}
$('processText').addEventListener('input',invalidateVoice);
$('clearExplanation').onclick=()=>{cancelRecording();$('processText').value='';voice.text='';voice.startingArea='';voice.startingService='';voice.serviceChoice='';$('areaPicker').hidden=false;$('explanationPanel').hidden=true;document.querySelectorAll('.area-card').forEach(x=>x.setAttribute('aria-pressed','false'));document.querySelectorAll('.journey-step').forEach((x,i)=>x.classList.toggle('current',i===0));invalidateVoice();voiceMessage('Choose the business area for a new estimate.');};
// Record locally, then send the bounded clip for transcription only on Stop.
Object.assign(voice,{recording:null,stream:null,clip:null,clipName:'process.webm',starting:false,transcribing:false,recordTimer:null,recordRequest:0,discardRecording:false});
function recordingControls(){
 $('dictateProcess').textContent='Voice input · soon';
 $('dictateProcess').setAttribute('aria-pressed','false');
 $('dictateProcess').disabled=true;
 $('analyzeProcess').disabled=!voice.connected||voice.busy||$('processText').value.trim().length<30;
 $('processText').readOnly=voice.starting||voice.listening||voice.transcribing;
 $('audioUpload').disabled=voice.starting||voice.listening||voice.transcribing||voice.busy;
 $('retryTranscription').hidden=!voice.clip||voice.listening||voice.starting;
 $('retryTranscription').disabled=voice.transcribing||voice.busy;
}
function releaseMicrophone(){clearTimeout(voice.recordTimer);voice.stream?.getTracks().forEach(t=>t.stop());voice.stream=null;}
function cancelRecording(){
 voice.recordRequest++;voice.discardRecording=true;
 if(voice.recording?.state==='recording')voice.recording.stop();
 releaseMicrophone();voice.listening=false;voice.starting=false;voice.transcribing=false;voice.clip=null;recordingControls();
}
async function transcribeClip(){
 if(!voice.clip||voice.transcribing||voice.busy)return;
 const clip=voice.clip,request=++voice.recordRequest,prefix=$('processText').value.trim();
 voice.transcribing=true;recordingControls();voiceMessage('Transcribing your recording… Your existing text is preserved.');
 try{
  const data=new FormData();data.append('file',clip,voice.clipName);
  const r=await fetch('/api/intake/transcribe',{method:'POST',body:data,signal:AbortSignal.timeout(90000)});
  const d=await r.json();if(request!==voice.recordRequest)return;
  if(!r.ok||typeof d.text!=='string')throw Error(d.error||'Could not transcribe the recording.');
  const text=d.text.trim();if(!text)throw Error('No speech was detected. Record again or type your explanation.');
  if((prefix+'\n\n'+text).length>18000)throw Error('The combined explanation is too long. Shorten your existing text, then retry transcription.');
  $('processText').value=(prefix?prefix+'\n\n':'')+text;invalidateVoice();voice.clip=null;
  voiceMessage('Transcript ready. Review or edit it, then click Analyze my process.');
 }catch(e){if(request===voice.recordRequest)voiceMessage(e.name==='TimeoutError'?'Transcription timed out. Your recording is still available; click Retry transcription.':e.message+' Your existing text is preserved. Retry transcription or record again.');}
 finally{if(request===voice.recordRequest){voice.transcribing=false;recordingControls();}}
}
async function recordProcess(){
 if(voice.listening){voice.recording.stop();return;}
 if(voice.starting||voice.transcribing||voice.busy)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){voiceMessage('Microphone recording is unavailable here. Open the calculator in a browser tab, upload an audio file, or type your explanation.');return;}
 const policy=document.permissionsPolicy||document.featurePolicy;
 if(policy?.allowsFeature&&!policy.allowsFeature('microphone')){voiceMessage('This embedded preview blocks microphone access. Open the calculator in a browser tab using the link below, then allow the microphone. Your current text stays here.');return;}
 const request=++voice.recordRequest;voice.starting=true;recordingControls();voiceMessage('Allow microphone access when your browser asks. If no prompt appears, open this calculator in a browser tab using the link below.');
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  if(request!==voice.recordRequest){stream.getTracks().forEach(t=>t.stop());return;}
  voice.stream=stream;const Recorder=window.MediaRecorder;
  const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>Recorder.isTypeSupported?.(t));
  const r=new Recorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:64000});
  const chunks=[];let bytes=0;voice.recording=r;voice.discardRecording=false;voice.clip=null;
  r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>20*1024*1024&&r.state==='recording')r.stop();}};
  r.onerror=()=>{voice.discardRecording=true;releaseMicrophone();voice.listening=false;voice.starting=false;recordingControls();voiceMessage('The microphone recording failed. Try again, upload audio, or type your explanation.');};
  r.onstop=()=>{
   releaseMicrophone();voice.listening=false;voice.starting=false;
   if(voice.discardRecording||request!==voice.recordRequest){recordingControls();return;}
   const type=r.mimeType||chunks[0]?.type||mime||'audio/webm';
   voice.clip=new Blob(chunks,{type});voice.clipName=type.includes('mp4')?'process.mp4':'process.webm';recordingControls();
   if(!voice.clip.size||bytes>20*1024*1024){voice.clip=null;recordingControls();voiceMessage('The recording was empty or too large. Try a shorter recording.');return;}
   transcribeClip();
  };
  invalidateVoice();r.start(1000);voice.starting=false;voice.listening=true;recordingControls();
  voiceMessage('Recording. Explain your process, then click Stop & transcribe. Up to 5 minutes; text appears after you stop.');
  voice.recordTimer=setTimeout(()=>{if(r.state==='recording')r.stop();},300000);
 }catch(e){releaseMicrophone();if(request!==voice.recordRequest)return;voice.starting=false;recordingControls();
  const messages={NotAllowedError:'Microphone access was blocked. Open the calculator in a browser tab, allow its microphone permission, then try again.',NotFoundError:'No microphone was found. Connect one, upload audio, or type.',NotReadableError:'Your microphone is unavailable or in use by another app. Close that app and try again.'};
  voiceMessage(messages[e.name]||'Could not start recording. Open the calculator in a browser tab, upload audio, or type.');
 }
}
$('dictateProcess').onclick=recordProcess;
$('retryTranscription').onclick=transcribeClip;
$('audioUpload').onchange=()=>{const file=$('audioUpload').files?.[0];if(!file)return;if(file.size>20*1024*1024){voiceMessage('Please choose an audio file smaller than 20 MB.');$('audioUpload').value='';return;}voice.clip=file;voice.clipName=file.name;invalidateVoice();transcribeClip();$('audioUpload').value='';};
window.addEventListener?.('pagehide',cancelRecording);
recordingControls();
async function analyzeProcess(){const text=$('processText').value.trim();if(text.length<30){voiceMessage('Please explain a little more—at least 30 characters.');return;}if(voice.listening||voice.starting||voice.transcribing)return;voice.busy=true;const request=++voice.request;recordingControls();voiceMessage('Organizing your description into the estimate fields…');
 try{const r=await fetch('/api/intake/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,area:voice.startingArea||$('area').value,service:voice.serviceChoice||voice.startingService||$('service').value}),signal:AbortSignal.timeout(65000)});const d=await r.json();if(request!==voice.request)return;if(!r.ok||d.status!=='success')throw Error(d.error||'Analysis did not complete.');const analysis=AOCIntake.validate(d.analysis,text,AOCDept.data.catalog);voice.analysis=analysis;voice.text=text;voice.confirmed=false;applyVoiceScope(analysis.scope);renderVoiceReview();document.querySelector('[data-journey="1"]').classList.remove('current');document.querySelector('[data-journey="2"]').classList.add('current');voiceMessage('Check the organized scope. Correct anything that is wrong; the estimate fields below are editable.');}
 catch(e){if(request===voice.request)voiceMessage(e.name==='TimeoutError'?'Analysis timed out. Your text is preserved; try a shorter explanation.':e.message);}
 finally{voice.busy=false;recordingControls();}
}
 $('analyzeProcess').onclick=analyzeProcess;
function applyVoiceScope(scope){
 $('calculator').reset();choose(scope.service||'workflow');
 if(scope.area){$('area').value=scope.area;refreshDepartment('area');voice.startingArea=scope.area;const selected=areaCards.find(x=>x[0]===scope.area);$('selectedAreaChip').innerHTML=`<span>Starting area · confirm or change</span><strong>${esc(selected?.[1]||scope.area)}</strong><button type="button" id="changeArea">Change</button>`;document.querySelectorAll('.area-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area===scope.area)));$('areaPicker').hidden=false;$('explanationPanel').hidden=false;}if(scope.task){$('task').value=scope.task;refreshDepartment('task');}
 for(const [key,v]of Object.entries(scope)){if(v===null||v===undefined||['service','area','task','appNames'].includes(key))continue;
  if(Array.isArray(v)){const entries=document.querySelectorAll(`[name="${key}"]`);entries.forEach(n=>{n.checked=v.includes(n.value)||key==='currentHandlers'&&v.includes(handlerMap[n.value]);});if(key==='teams'){$('otherTeams').value=v.filter(x=>!teams.includes(x)).join(', ');}continue;}
  const target=$(key);if(target)target.value=String(v);
 }
 appTokens=scope.appNames?scope.appNames.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean):[];renderApps();refreshConditional();
 // Delivery-volume controls are conditional; apply their values after they exist.
 for(const key of ['monthlyPages','monthlyArticles','monthlyOutputs'])if($(key)&&scope[key]!==null&&scope[key]!==undefined)$(key).value=scope[key];
 markDirty();updatePreview();
}
function missingVoiceFields(){
 const s=readScope(),required=['area','task'];if($('taskAnswer')&&!$('taskAnswer').disabled)required.push('taskAnswer');required.push('appNames','steps','exceptions','people','sourceAnswer','teams','actionAnswer','changeImpact','impact','legacy','trainingAudience');if(s.service==='agent')required.push('agentDecision');if(s.legacy==='yes')required.push('legacyName');
 if(s.area==='Content Machine & Social Publishing')required.push('capabilities','channels','formats','sources','brands','languages','approvals','publishing','reporting');
 if(s.area==='SEO & GEO'){required.push('capabilities','brands','languages','markets','seoExecution','reporting');if(!$('pageScope').hidden)required.push('initialPages');if(!$('keywordScope').hidden)required.push('keywords');}
 if(s.management==='yes'){required.push('cadence','tier');if(marketing()){required.push('deliveryMode');if(s.deliveryMode==='managed')required.push(s.area==='SEO & GEO'?'monthlyPages':'monthlyOutputs');if(s.deliveryMode==='managed'&&s.area==='SEO & GEO')required.push('monthlyArticles');}}
 return [...new Set(required)].filter(key=>{if(key==='teams')return !s.teams.length&&!s.otherTeams;if(Array.isArray(s[key]))return !s[key].length;if(['people','brands','languages','markets','initialPages','keywords'].includes(key))return s[key]===null||s[key]===undefined||s[key]<1;return s[key]===null||s[key]===undefined||s[key]==='';});
}
const voiceLabels={area:'Which part of the business does this belong to?',task:'Which starting point best fits?',appNames:'Which apps are involved?',steps:'Does it usually follow the same steps?',exceptions:'How should unusual cases be handled?',people:'How many people take part?',sourceAnswer:'Do you have instructions or examples?',teams:'Which teams take part?',actionAnswer:'Where should your team approve changes?',changeImpact:'Could it change money, orders, stock or sensitive records?',impact:'What happens if this process stops?',legacy:'Is any older or custom software involved?',legacyName:'What is the older / custom system called?',trainingAudience:'Who needs training?',agentDecision:'What decisions should the agent help with?',brands:'How many brands / websites?',languages:'How many languages?',markets:'How many markets?',initialPages:'How many pages initially?',keywords:'How many topics / keywords?',cadence:'How often should the system run?',tier:'Which support coverage do you want?',deliveryMode:'Maintenance, or managed service delivery too?'};
function questionControl(key){const original=$(key),label=voiceLabels[key]||document.querySelector(`label[for="${key}"]`)?.textContent||key;let control;
 if(AOCIntake.arrays.includes(key)){const options=[...document.querySelectorAll(`[name="${key}"]`)].map(n=>n.value);control=`<input id="answer-${key}" data-answer="${key}" type="text" placeholder="Separate answers with commas"><small class="hint">${esc(options.length?'Choices: '+options.join('; '):'Enter the team names, separated by commas.')}</small>`;}
 else if(original?.tagName==='SELECT')control=`<select id="answer-${key}" data-answer="${key}">${original.innerHTML}</select>`;
 else control=`<input id="answer-${key}" data-answer="${key}" type="${original?.type==='number'?'number':'text'}" ${original?.type==='number'?'min="0" step="any"':''}>`;
 return `<div class="field"><label for="answer-${key}">${esc(label)}</label>${control}</div>`;
}
function renderVoiceReview(){const a=voice.analysis;if(!a)return;const s=readScope(),r=AOCModel.calculate(s,rules,pricing),missing=missingVoiceFields();
 const displayFields=[['task','Starting point'],['taskAnswer','How the work varies'],['appNames','Apps or tools'],['people','People involved'],['teams','Teams involved'],['volume','Approximate monthly volume'],['hours','Current staff time'],['sourceAnswer','Instructions / examples'],['steps','How consistent the steps are'],['exceptions','Unusual cases'],['actionAnswer','Approval and action'],['changeImpact','Sensitive changes'],['impact','If it stops working'],['legacy','Older or custom software'],['cadence','How often it runs']];
 const captured=displayFields.filter(([k])=>{const v=s[k];return Array.isArray(v)?v.length>0:v!==null&&v!==undefined&&v!=='';}).map(([k,label])=>{let val=s[k];if(k==='teams')val=[...(Array.isArray(val)?val:[val]),s.otherTeams||''].filter(Boolean).join(', ');if(k==='impact')val={low:'We can work around it for a few days',medium:'Daily work would be disrupted',high:'An essential operation could be interrupted',unknown:'Not sure yet'}[val]||val;if(k==='changeImpact')val=val==='Yes'?'Yes, it can affect sensitive records or money':'No / not sure';return `<div class="captured-item"><span>${esc(label)}</span><strong>${esc(Array.isArray(val)?val.join(', '):String(val))}</strong></div>`;}).join('');
 const recognized=displayFields.filter(([k])=>{const v=s[k];return Array.isArray(v)?v.length>0:v!==null&&v!==undefined&&v!=='';}).length;
 $('scopeReview').hidden=false;$('scopeSummary').innerHTML=`<div class="eyebrow">ONE CONNECTED SYSTEM · DRAFT SCOPE</div><div class="scope-heading"><div><h2>${esc(a.title)}</h2><p>${esc(a.summary)}</p></div><span class="recognized-count">${recognized} details<br>recognized</span></div><div class="recommendation"><strong>AOC’s starting recommendation</strong><span>${s.service==='agent'?'AI agent, with supporting automations where useful':'Workflow automation'} · You can change this in the full calculator.</span></div><h3>What we understood</h3><ul>${a.responsibilities.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="captured-grid">${captured||'<p class="fine">No structured details were confirmed yet. Use the quick questions or edit the full scope below.</p>'}</div><details class="evidence-details"><summary>See what was inferred from your description</summary>${a.evidence.map(e=>`<p class="fine"><strong>${esc(voiceLabels[e.field]||document.querySelector(`label[for="${e.field}"]`)?.textContent||e.field)}</strong>: “${esc(e.quote)}”</p>`).join('')}${a.inferences.length?'<h3>Interpretations to check</h3>'+a.inferences.map(e=>`<p class="fine">${esc(voiceLabels[e.field]||document.querySelector(`label[for="${e.field}"]`)?.textContent||e.field)}: ${esc(e.reason)}</p>`).join(''):''}</details>${a.boundaries.length?warning('Items to verify later',a.boundaries):''}`;
 $('followupPanel').hidden=!missing.length;$('followupFields').innerHTML=missing.slice(0,5).map(questionControl).join('');$('followupCount').textContent=missing.length?'A few details could improve this estimate · '+missing.length+' still unknown':'Scope ready to confirm';
 $('confirmScope').disabled=false;$('confirmScope').textContent=missing.length?'Confirm known scope & view partial estimate':'Confirm scope & calculate';
 $('voiceCommercial').hidden=false;const management=$('management').value;$('voiceManagement').value=management;$('voiceTier').value=$('tier').value;$('voiceTierField').hidden=management!=='yes';
 $('voiceReviewNotice').textContent='The description fills fields in AOC’s existing calculator. Confirming the scope uses its saved rules; AI does not set fees. Unknown costs and feasibility remain visible.';
}
$('applyAnswers').onclick=()=>{if(!voice.analysis)return;const s=readScope();for(const input of document.querySelectorAll('[data-answer]')){if(input.value==='')continue;const key=input.dataset.answer;s[key]=AOCIntake.arrays.includes(key)?input.value.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean):input.type==='number'?Number(input.value):input.value;}voice.analysis.scope={...voice.analysis.scope,...s};applyVoiceScope(voice.analysis.scope);renderVoiceReview();};
$('voiceManagement').onchange=()=>{$('management').value=$('voiceManagement').value;refreshConditional();updatePreview();renderVoiceReview();};$('voiceTier').onchange=()=>{$('tier').value=$('voiceTier').value;refreshConditional();updatePreview();renderVoiceReview();};
$('confirmScope').onclick=()=>{if(!voice.analysis)return;voice.confirmed=true;voice.analysis.scope=readScope();document.querySelector('[data-journey="2"]').classList.remove('current');document.querySelector('[data-journey="3"]').classList.add('current');intakeMode('voice');calculate({preventDefault(){}});voiceMessage('Calculated from the scope you confirmed. Use the editable form to adjust costs, coverage or any scope detail.');};
$('editVoiceScope').onclick=()=>intakeMode('structured');
// A structured edit invalidates any prior voice confirmation; the form’s own stale-result controls remain active.
function invalidateEditedScope(){if(!voice.analysis)return;voice.analysis=null;voice.confirmed=false;$('scopeReview').hidden=true;$('followupPanel').hidden=true;$('voiceCommercial').hidden=true;voiceMessage('Your manual form edits are active. Calculate in the form, or analyze the explanation again to regenerate its summary.');}
$('calculator').addEventListener('input',invalidateEditedScope);$('calculator').addEventListener('change',invalidateEditedScope);$('calculator').addEventListener('click',e=>{if(e.target.closest?.('.service'))invalidateEditedScope();});
const clearCalculator=$('clearBtn').onclick;$('clearBtn').onclick=()=>{clearCalculator();$('clearExplanation').onclick();};
renderJourney();intakeMode('voice');checkIntake();
