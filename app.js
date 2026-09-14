import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// ---------- UI helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const toast = (message) => {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
};

// ---------- Garage ambience ----------
let audioCtx, ambienceSource;
$('#soundBtn').addEventListener('click', async () => {
  const btn = $('#soundBtn');
  const enabled = btn.getAttribute('aria-pressed') === 'true';
  if (enabled) {
    ambienceSource?.stop();
    ambienceSource = null;
    btn.setAttribute('aria-pressed', 'false');
    return;
  }
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  const length = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * .22;
  const source = audioCtx.createBufferSource();
  const low = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  source.loop = true;
  low.type = 'lowpass';
  low.frequency.value = 260;
  gain.gain.value = .018;
  source.connect(low).connect(gain).connect(audioCtx.destination);
  source.start();
  ambienceSource = source;
  btn.setAttribute('aria-pressed', 'true');
});

// ---------- Image upload ----------
const photoInput = $('#photoInput');
const uploadZone = $('#uploadZone');
const showImage = (file) => {
  if (!file || !file.type.startsWith('image/')) return toast('Please choose an image file.');
  if (file.size > 12 * 1024 * 1024) return toast('Image is too large. Keep it under 12 MB.');
  const reader = new FileReader();
  reader.onload = () => {
    $('#previewImg').src = reader.result;
    $('#previewName').textContent = file.name;
    $('#imagePreview').hidden = false;
    uploadZone.style.display = 'none';
  };
  reader.readAsDataURL(file);
};
$('#browseBtn').addEventListener('click', (e) => { e.stopPropagation(); photoInput.click(); });
uploadZone.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => showImage(photoInput.files[0]));
['dragenter','dragover'].forEach(type => uploadZone.addEventListener(type, e => { e.preventDefault(); uploadZone.classList.add('dragover'); }));
['dragleave','drop'].forEach(type => uploadZone.addEventListener(type, e => { e.preventDefault(); uploadZone.classList.remove('dragover'); }));
uploadZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    photoInput.files = dt.files;
    showImage(file);
  }
});
$('#removeImageBtn').addEventListener('click', () => {
  photoInput.value = '';
  $('#imagePreview').hidden = true;
  uploadZone.style.display = '';
});

$$('[data-symptom]').forEach(btn => btn.addEventListener('click', () => {
  $('#symptom').value = btn.dataset.symptom;
  $('#symptom').focus();
}));

// ---------- Diagnostic engine ----------
const rules = [
  {
    id:'battery', title:'Weak battery / battery connection', base:88,
    keywords:['will not start','won’t start','wont start','clicking','rapid clicking','dim lights','slow crank','cranks slowly','battery','no start'],
    detail:'Low battery voltage or a poor terminal connection can cause slow cranking, rapid clicking, and dim electrical systems.',
    next:'Check battery voltage and terminal condition. A healthy resting 12 V battery is typically around 12.6 V; have the charging system tested if the problem returns.'
  },
  {
    id:'alternator', title:'Charging system / alternator fault', base:72,
    keywords:['battery light','alternator','dies while driving','lights flicker','electrical','charging','battery keeps dying'],
    detail:'A charging fault can drain the battery while driving and may cause flickering lights or a battery warning lamp.',
    next:'Limit unnecessary electrical loads and have alternator output, belt condition, and charging voltage checked.'
  },
  {
    id:'cooling', title:'Cooling system problem', base:91,
    keywords:['overheat','overheating','temperature high','steam','coolant','hot engine','radiator','temperature gauge','boiling'],
    detail:'Low coolant, a leak, thermostat issue, fan failure, or water-pump problem can cause engine temperature to rise rapidly.',
    next:'Stop the engine if temperature is in the red. Allow it to cool completely before any visual coolant-level or leak inspection.'
  },
  {
    id:'brakes', title:'Brake pad / rotor or hydraulic issue', base:90,
    keywords:['brake','braking','grinding','squeal when braking','soft pedal','pedal goes','brake noise','stopping distance'],
    detail:'Grinding, abnormal pedal feel, or reduced stopping performance can indicate worn friction components or a hydraulic fault.',
    next:'Avoid unnecessary driving and arrange a brake inspection. If pedal pressure is poor or braking is reduced, do not drive the vehicle.'
  },
  {
    id:'misfire', title:'Engine misfire / ignition issue', base:84,
    keywords:['check engine','shakes','shaking','rough idle','misfire','hesitation','jerking','engine light','vibration at idle'],
    detail:'A misfire can come from spark plugs, ignition coils, fueling, vacuum leaks, or other combustion-related faults.',
    next:'Read OBD-II fault codes before replacing parts. If the check-engine light is flashing, reduce load and stop driving as soon as safely possible.'
  },
  {
    id:'belt', title:'Accessory belt / pulley concern', base:77,
    keywords:['squeal','squealing','chirp','belt','noise with rpm','whine','whining'],
    detail:'A worn belt, tensioner, idler pulley, or accessory bearing may produce a squeal or chirp that follows engine RPM.',
    next:'Inspect the belt path visually with the engine off. Have belt tension and pulley bearings checked if noise persists.'
  },
  {
    id:'oil', title:'Oil pressure / lubrication concern', base:93,
    keywords:['oil light','oil pressure','ticking engine','knocking','low oil','oil warning','metal knock'],
    detail:'Low oil level or pressure can damage internal engine components very quickly.',
    next:'Shut the engine off and verify oil level only when safe. Do not continue driving with an oil-pressure warning illuminated.'
  },
  {
    id:'transmission', title:'Transmission / driveline issue', base:79,
    keywords:['transmission','gear slipping','slipping','hard shift','won’t shift','wont shift','clunk','gearbox','delay in gear'],
    detail:'Delayed engagement, harsh shifts, or slipping can be related to fluid condition, control systems, clutch packs, or driveline components.',
    next:'Avoid hard acceleration. Check for warning messages or leaks and arrange a transmission scan/inspection.'
  },
  {
    id:'tires', title:'Tire / wheel balance or alignment issue', base:74,
    keywords:['steering shake','wheel shake','vibration at speed','tire','tyre','pulls left','pulls right','alignment','flat tire'],
    detail:'Speed-related vibration or pulling can be caused by tire pressure, damage, wheel balance, alignment, or suspension wear.',
    next:'Check tire pressure and visible damage. A bulge, exposed cord, or rapidly losing tire should not be driven on.'
  },
  {
    id:'fuel', title:'Fuel / air delivery issue', base:68,
    keywords:['loss of power','no power','stalls','stalling','fuel smell','hard start','bogging','poor acceleration'],
    detail:'Fuel delivery, air metering, vacuum leaks, or sensor faults can cause poor acceleration, stalling, or difficult starting.',
    next:'Scan for stored fault codes and inspect for obvious intake leaks. Strong raw-fuel odor requires immediate caution.'
  }
];

const urgentTerms = ['brake pedal goes','no brakes','brakes failed','oil pressure','oil warning','steam','overheating','temperature red','fire','smoke from engine','fuel leak','strong fuel smell','tire blowout','wheel loose'];

function scoreDiagnosis(text) {
  const clean = text.toLowerCase().replace(/[’]/g,"'");
  const scored = rules.map(rule => {
    let hits = 0;
    rule.keywords.forEach(k => { if (clean.includes(k)) hits++; });
    const score = hits ? Math.min(97, rule.base + (hits - 1) * 3) : Math.max(8, rule.base - 56);
    return {...rule, hits, score};
  }).filter(r => r.hits > 0).sort((a,b) => b.score - a.score);

  if (!scored.length) {
    scored.push(
      {title:'General engine / vehicle system fault', score:58, detail:'The description does not strongly match one specific symptom pattern. A scan for diagnostic trouble codes and a visual inspection are the best starting points.', next:'Note exactly when the symptom occurs, check dashboard warnings, and obtain an OBD-II scan before replacing parts.'},
      {title:'Electrical or sensor-related issue', score:36, detail:'Intermittent vehicle symptoms are often influenced by voltage, connections, sensors, or control-system faults.', next:'Check battery condition and capture any stored or pending fault codes.'}
    );
  }
  return scored.slice(0,3);
}

function buildReport(text) {
  const causes = scoreDiagnosis(text);
  const clean = text.toLowerCase();
  const urgent = urgentTerms.some(t => clean.includes(t));
  const mediumSignals = ['check engine','grinding','hard shift','stall','vibration','warning','leak','squeal'];
  const moderate = mediumSignals.some(t => clean.includes(t));
  const risk = urgent ? 'HIGH' : moderate ? 'MODERATE' : 'LOW';
  const primary = causes[0];
  return {
    risk,
    title: primary.title,
    summary: `The symptom pattern most strongly points to ${primary.title.toLowerCase()}. This is a probability-based preliminary triage, not a confirmed repair diagnosis.`,
    causes,
    next: urgent ? 'Park safely, switch the vehicle off when appropriate, and arrange professional inspection or recovery before further driving.' : primary.next,
    safety: urgent ? 'Safety flag: your description includes a symptom that can become unsafe or cause major damage. Avoid driving until the vehicle is assessed.' : 'If the symptom suddenly worsens, a red warning lamp appears, braking/steering changes, or you see smoke/steam, stop driving and seek professional help.'
  };
}

const resultViews = ['#emptyResult','#loadingResult','#diagnosisResult'];
function showResult(id){ resultViews.forEach(s => $(s).hidden = s !== id); }

async function animateAnalysis() {
  showResult('#loadingResult');
  $('#diagnoseBtn').classList.add('loading');
  $('#diagnoseBtn').disabled = true;
  const stages = [
    [18,'Reading vehicle symptom pattern'],
    [42,'Comparing likely vehicle systems'],
    [68,'Evaluating safety and urgency'],
    [88,'Ranking probable causes'],
    [100,'Preparing next steps']
  ];
  for (const [pct,label] of stages) {
    $('#progressBar').style.width = `${pct}%`;
    $('#loadingText').textContent = label;
    $('#scanPercent').textContent = `${pct}%`;
    await new Promise(r => setTimeout(r, 330));
  }
}

function renderReport(report) {
  $('#reportTitle').textContent = report.title;
  $('#reportSummary').textContent = report.summary + (photoInput.files[0] ? ' Your uploaded photo is attached to this session; the GitHub Pages demo does not claim pixel-level fault identification.' : '');
  const badge = $('#riskBadge');
  badge.textContent = `${report.risk} RISK`;
  badge.className = `risk-badge ${report.risk === 'HIGH' ? 'high' : report.risk === 'LOW' ? 'low' : ''}`;
  $('#causeList').innerHTML = report.causes.map((c,i) => `
    <div class="cause">
      <div class="cause-top"><strong>${i+1}. ${c.title}</strong><span>${c.score}%</span></div>
      <div class="meter"><i style="width:${c.score}%"></i></div>
      <p>${c.detail}</p>
    </div>`).join('');
  $('#nextStep').textContent = report.next;
  $('#safetyNote').textContent = report.safety;
  $('#safetyNote').className = `safety-note ${report.risk === 'HIGH' ? 'urgent' : ''}`;
  showResult('#diagnosisResult');
  $('#diagnoseBtn').classList.remove('loading');
  $('#diagnoseBtn').disabled = false;
  $('#scanPercent').textContent = 'READY';
}

$('#diagnosticForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const symptom = $('#symptom').value.trim();
  if (symptom.length < 8) return toast('Describe the symptom in a little more detail.');
  await animateAnalysis();
  renderReport(buildReport(symptom));
});

$('#resetBtn').addEventListener('click', () => {
  $('#symptom').value = '';
  showResult('#emptyResult');
  $('#progressBar').style.width = '0';
  $('#symptom').focus();
});

// ---------- Three.js interactive garage ----------
const stage = $('#three-stage');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07090d, .033);
const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, .1, 140);
camera.position.set(10, 5.7, 13);
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xa9c7e8,0x20170f,.7));
const key = new THREE.DirectionalLight(0xffd2a3,3.4); key.position.set(-6,10,8); key.castShadow=true; key.shadow.mapSize.set(1024,1024); scene.add(key);
const rim = new THREE.PointLight(0xff7417,22,18,2); rim.position.set(5,3,-3); scene.add(rim);
const cool = new THREE.PointLight(0x7ca7ff,13,16,2); cool.position.set(-7,4,1); scene.add(cool);

const mat = (color, rough=.6, metal=.1) => new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const orange = new THREE.MeshStandardMaterial({color:0xe9570a,roughness:.27,metalness:.55});
const dark = mat(0x111419,.5,.55), black = mat(0x050607,.58,.25), rubber = mat(0x08090a,.92,.05);
const silver = mat(0xa6adb5,.24,.92), concrete = mat(0x1a1d21,.9,.04);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(34,34),concrete); floor.rotation.x=-Math.PI/2; floor.position.y=-1.15; floor.receiveShadow=true; scene.add(floor);
const grid = new THREE.GridHelper(34,34,0x30353c,0x20242a); grid.position.y=-1.13; grid.material.opacity=.3; grid.material.transparent=true; scene.add(grid);

// garage walls and ceiling ribs
const back = new THREE.Mesh(new THREE.BoxGeometry(28,10,.25),mat(0x101318,.96,.05)); back.position.set(0,3,-8); back.receiveShadow=true; scene.add(back);
for(let x=-11;x<=11;x+=2.2){ const rib=new THREE.Mesh(new THREE.BoxGeometry(.06,8,.08),mat(0x252a31,.7,.5)); rib.position.set(x,3,-7.82); scene.add(rib); }
for(let x=-9;x<=9;x+=6){
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(3.5,.08,.32),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffd6ad,emissiveIntensity:2.4}));
  lamp.position.set(x,7.6,-2); scene.add(lamp);
}

// tool cabinets
function box(w,h,d,color,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,.52,.45));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
const cabinet=box(3.4,2.25,.9,0x15191f,-9,0,-7.2);
for(let y=-.7;y<.8;y+=.46){const line=box(3,.035,.03,0x777d84,-9,y,-6.73);}
box(1.2,2.7,1,0xb73a0a,8,.2,-7.1);
// tire rack
for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.TorusGeometry(.52,.16,14,28),rubber);t.rotation.y=Math.PI/2;t.position.set(9.4,-.35+i*1.1,-5.7);t.castShadow=true;scene.add(t)}

// lift posts
[-3.8,3.8].forEach(x=>{box(.34,5,.34,0x252b31,x,1.3,-.1); box(1.7,.16,.32,0x3c4248,x,0,-.1)});

// car group
const car = new THREE.Group(); car.position.set(1.1,-.38,.5); scene.add(car);
const lower=new THREE.Mesh(new THREE.BoxGeometry(5.5,.65,2.45),orange); lower.position.y=.22; lower.castShadow=true; car.add(lower);
const hood=new THREE.Mesh(new THREE.BoxGeometry(2.05,.22,2.35),orange); hood.position.set(-1.92,.72,0); hood.rotation.z=-.035; hood.castShadow=true; car.add(hood);
const rear=new THREE.Mesh(new THREE.BoxGeometry(1.45,.48,2.38),orange); rear.position.set(2.1,.72,0); car.add(rear);
const cabin=new THREE.Mesh(new THREE.BoxGeometry(2.35,.95,2.05),dark); cabin.position.set(.45,1.02,0); cabin.scale.set(1,1,.94); car.add(cabin);
const glassMat=new THREE.MeshPhysicalMaterial({color:0x192a33,roughness:.12,metalness:.1,transmission:.12,transparent:true,opacity:.9});
const windshield=new THREE.Mesh(new THREE.BoxGeometry(.8,.65,2.08),glassMat); windshield.position.set(-.48,1.25,0); windshield.rotation.z=-.55; car.add(windshield);
const rearGlass=windshield.clone();rearGlass.position.x=1.36;rearGlass.rotation.z=.55;car.add(rearGlass);
const spoiler=new THREE.Mesh(new THREE.BoxGeometry(.18,.15,2.65),dark); spoiler.position.set(2.72,1.04,0); car.add(spoiler);
const spoilerTop=new THREE.Mesh(new THREE.BoxGeometry(.65,.09,2.9),dark); spoilerTop.position.set(2.82,1.42,0); car.add(spoilerTop);

function wheel(x,z){const g=new THREE.Group();const tire=new THREE.Mesh(new THREE.CylinderGeometry(.53,.53,.42,30),rubber);tire.rotation.x=Math.PI/2;tire.castShadow=true;g.add(tire);const rimMesh=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.44,12),silver);rimMesh.rotation.x=Math.PI/2;g.add(rimMesh);g.position.set(x,.12,z);car.add(g);return g}
const wheels=[wheel(-1.75,1.23),wheel(-1.75,-1.23),wheel(1.75,1.23),wheel(1.75,-1.23)];
// lights
[-.72,.72].forEach(z=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.08,.25,.55),new THREE.MeshStandardMaterial({color:0xffe1b0,emissive:0xffbd68,emissiveIntensity:3}));l.position.set(-2.79,.66,z);car.add(l)});

// clickable hotspots (subtle holographic markers)
const interactive=[];
function hotspot(name,index,description,position,view){
  const g=new THREE.Group();
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(.11,18,18),new THREE.MeshStandardMaterial({color:0xff7a1a,emissive:0xff5a00,emissiveIntensity:3}));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.24,.018,10,34),new THREE.MeshBasicMaterial({color:0xffa75e,transparent:true,opacity:.7}));ring.rotation.x=Math.PI/2;
  g.add(sphere,ring);g.position.copy(position);g.userData={name,index,description,view};car.add(g);interactive.push(g);return g
}
hotspot('Engine & cooling','SYSTEM 01','Check temperature, fluids, belts, leaks and engine-bay noises.',new THREE.Vector3(-1.95,1.05,0),'engine');
hotspot('Front brakes & tires','SYSTEM 02','Inspect brake feel/noise, tire pressure, tread and wheel vibration.',new THREE.Vector3(-1.72,.6,1.28),'wheels');
hotspot('Battery & charging','SYSTEM 03','Starting, dim lights and electrical faults often begin here.',new THREE.Vector3(-1.3,1.08,-.72),'electrical');

const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(2,2);
let targetPos=new THREE.Vector3(10,5.7,13), targetLook=new THREE.Vector3(0,.2,0), currentLook=new THREE.Vector3(0,.2,0);
let garageMode=false, pointerX=0,pointerY=0;
const views={
  overview:{pos:new THREE.Vector3(9,4.6,11),look:new THREE.Vector3(0,.25,0),name:'Interactive vehicle',index:'SYSTEM 00',description:'Explore the vehicle and select a system for a closer look.'},
  engine:{pos:new THREE.Vector3(-5.9,3.1,5.4),look:new THREE.Vector3(-1.1,.65,.2),name:'Engine & cooling',index:'SYSTEM 01',description:'Cooling, belts, fluids, ignition and engine-bay symptoms.'},
  wheels:{pos:new THREE.Vector3(-1.5,1.7,6.4),look:new THREE.Vector3(-.65,-.1,.9),name:'Brakes & wheels',index:'SYSTEM 02',description:'Tires, brake hardware, vibration and steering-related symptoms.'},
  electrical:{pos:new THREE.Vector3(-4.7,3.6,-3.4),look:new THREE.Vector3(-.6,.55,-.5),name:'Battery & electrical',index:'SYSTEM 03',description:'Battery health, starting and charging-system checks.'}
};
function setView(name='overview'){
  const v=views[name]||views.overview; targetPos.copy(v.pos); targetLook.copy(v.look);
  $('#partName').textContent=v.name; $('#partIndex').textContent=v.index; $('#partDescription').textContent=v.description;
  $$('.garage-controls button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
}
$$('.garage-controls button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('#focusCarBtn').addEventListener('click',()=>{document.querySelector('#garage').scrollIntoView({behavior:'smooth'});setView('overview')});

window.addEventListener('pointermove',e=>{pointerX=(e.clientX/innerWidth-.5);pointerY=(e.clientY/innerHeight-.5);pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1});
window.addEventListener('click',e=>{
  if(!garageMode || e.target.closest('button,a,input,textarea,form,.glass')) return;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(interactive,true);
  if(hits.length){let obj=hits[0].object;while(obj.parent&&!obj.userData.name)obj=obj.parent;if(obj.userData.view){setView(obj.userData.view);toast(`${obj.userData.name} selected`);}}
});

const garageObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.target.id==='garage'){
    garageMode=entry.isIntersecting && entry.intersectionRatio>.2;
    if(garageMode)setView('overview');
    else if(entry.boundingClientRect.top>0){targetPos.set(10,5.7,13);targetLook.set(0,.2,0)}
  }
}),{threshold:[.2,.45]});
garageObserver.observe($('#garage'));

function animate(t){
  requestAnimationFrame(animate);
  const time=t*.001;
  interactive.forEach((g,i)=>{g.children[1].rotation.z=time*(.8+i*.12);g.children[1].scale.setScalar(1+Math.sin(time*2+i)*.1)});
  wheels.forEach(w=>w.rotation.z=Math.sin(time*.35)*.006);
  rim.intensity=20+Math.sin(time*.8)*2;
  camera.position.lerp(targetPos,.035);
  currentLook.lerp(targetLook,.05);
  const parallax=garageMode? .16:.32;
  camera.position.x += pointerX*parallax*.02;
  camera.position.y -= pointerY*parallax*.012;
  camera.lookAt(currentLook);
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8))});

// small scroll-reactive scene drift
window.addEventListener('scroll',()=>{
  if(garageMode)return;
  const p=Math.min(1,scrollY/(innerHeight*1.4));
  targetPos.set(10-p*2,5.7-p*.8,13-p*1.6);
},{passive:true});
