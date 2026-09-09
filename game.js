const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('gameWrap');
const gazImg = new Image(); gazImg.src = 'Assets/gaz.png';

const ui = {
  start: document.getElementById('startScreen'), over: document.getElementById('gameOver'),
  startBtn: document.getElementById('startBtn'), againBtn: document.getElementById('againBtn'),
  bill: document.getElementById('bill'), lives: document.getElementById('lives'),
  burgers: document.getElementById('burgers'), best: document.getElementById('best'),
  finalBurgers: document.getElementById('finalBurgers'), finalScore: document.getElementById('finalScore'),
  overTitle: document.getElementById('overTitle'), overText: document.getElementById('overText'),
  message: document.getElementById('message'), dash: document.getElementById('dash')
};

let W=0,H=0,dpr=1, running=false, last=0, time=0, score=0, burgers=0, lives=3;
let best = Number(localStorage.getItem('gazBurgerBest') || 0);
ui.best.textContent = best;

const input = {x:0,y:0,active:false};
const keys = {};
let dashUntil=0, dashCooldown=0;

const gaz = {x:0,y:0,r:25,speed:175,invuln:0,face:0};
let chefs=[], cops=[], pickups=[], particles=[], obstacles=[];
let exitOpen=false, exitY=0;

function resize(){
  const rect=wrap.getBoundingClientRect();
  dpr=Math.min(devicePixelRatio||1,2);
  W=rect.width; H=rect.height;
  canvas.width=W*dpr; canvas.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
  buildMap();
}
window.addEventListener('resize',resize);

function buildMap(){
  obstacles=[
    {x:.0,y:.25,w:.22,h:.13},{x:.78,y:.24,w:.22,h:.14},
    {x:.08,y:.55,w:.22,h:.12},{x:.70,y:.55,w:.22,h:.12},
    {x:.37,y:.34,w:.26,h:.08},{x:.34,y:.68,w:.32,h:.09}
  ].map(o=>({x:o.x*W,y:o.y*H,w:o.w*W,h:o.h*H}));
  exitY=H-100;
}

function resetGame(){
  time=0;score=0;burgers=0;lives=3;chefs=[];cops=[];pickups=[];particles=[];
  exitOpen=false;dashUntil=0;dashCooldown=0;
  gaz.x=W/2; gaz.y=H*.72; gaz.invuln=0;
  for(let i=0;i<3;i++) spawnChef(true);
  for(let i=0;i<5;i++) spawnBurger();
  updateHud();
}

function startGame(){
  ui.start.classList.add('hidden'); ui.over.classList.add('hidden');
  resetGame(); running=true; last=performance.now(); requestAnimationFrame(loop);
  say("Just one burger. Again.");
}
function endGame(win=false){
  running=false;
  const final=Math.floor(score);
  if(final>best){best=final;localStorage.setItem('gazBurgerBest',best)}
  ui.best.textContent=best; ui.finalBurgers.textContent=burgers; ui.finalScore.textContent=final;
  ui.overTitle.textContent=win?'GAZ ESCAPED!':'CAUGHT!';
  ui.overText.textContent=win?'They forgot to charge him. AGAIN.':'The bill finally found him.';
  ui.over.classList.remove('hidden');
}

function spawnChef(initial=false){
  const side=Math.floor(Math.random()*4);
  let x,y;
  if(side===0){x=Math.random()*W;y=100}
  else if(side===1){x=W-30;y=130+Math.random()*(H-180)}
  else if(side===2){x=Math.random()*W;y=H-130}
  else {x=30;y=130+Math.random()*(H-180)}
  if(initial){x=Math.random()<.5?40:W-40;y=180+Math.random()*(H-280)}
  chefs.push({x,y,r:22,speed:65+time*1.7+Math.random()*15,hit:0,type:Math.random()});
}
function spawnCop(){
  const fromLeft=Math.random()<.5;
  cops.push({x:fromLeft?-35:W+35,y:150+Math.random()*(H-260),r:22,speed:90+time*1.4,hit:0});
}
function spawnBurger(){
  for(let tries=0;tries<50;tries++){
    const p={x:35+Math.random()*(W-70),y:145+Math.random()*(H-260),r:15,bob:Math.random()*6};
    if(Math.hypot(p.x-gaz.x,p.y-gaz.y)>90 && !obstacles.some(o=>circleRect(p,o))) {pickups.push(p);return}
  }
}

function circleRect(c,r){
  const nx=Math.max(r.x,Math.min(c.x,r.x+r.w)), ny=Math.max(r.y,Math.min(c.y,r.y+r.h));
  return Math.hypot(c.x-nx,c.y-ny)<c.r;
}
function blocked(x,y,r){
  if(x<r+5||x>W-r-5||y<125+r||y>H-45-r)return true;
  return obstacles.some(o=>circleRect({x,y,r},o));
}
function moveEntity(e,dx,dy){
  const nx=e.x+dx,ny=e.y+dy;
  if(!blocked(nx,e.y,e.r))e.x=nx;
  if(!blocked(e.x,ny,e.r))e.y=ny;
}

function update(dt){
  time+=dt;
  if(time>10 && chefs.length<4+Math.floor(time/18)) spawnChef();
  if(time>22 && cops.length<Math.min(3,1+Math.floor((time-22)/25))) spawnCop();
  if(time>32) exitOpen=true;

  let dx=input.x,dy=input.y;
  if(keys.ArrowLeft||keys.a)dx-=1;if(keys.ArrowRight||keys.d)dx+=1;
  if(keys.ArrowUp||keys.w)dy-=1;if(keys.ArrowDown||keys.s)dy+=1;
  const len=Math.hypot(dx,dy)||1;
  const speed=gaz.speed*(performance.now()<dashUntil?2.55:1);
  if(Math.hypot(dx,dy)>0.1){moveEntity(gaz,dx/len*speed*dt,dy/len*speed*dt);gaz.face=Math.atan2(dy,dx)}
  gaz.invuln=Math.max(0,gaz.invuln-dt);
  dashCooldown=Math.max(0,dashCooldown-dt);

  for(const e of [...chefs,...cops]){
    const a=Math.atan2(gaz.y-e.y,gaz.x-e.x);
    const sp=e.speed*(e.hit>0?.25:1);
    moveEntity(e,Math.cos(a)*sp*dt,Math.sin(a)*sp*dt);
    e.hit=Math.max(0,e.hit-dt);
    if(Math.hypot(gaz.x-e.x,gaz.y-e.y)<gaz.r+e.r-5 && gaz.invuln<=0){
      lives--;gaz.invuln=1.25;score=Math.max(0,score-40);burst(gaz.x,gaz.y,12);
      say(lives?"MOVE, GAZ!":"They've got him!");
      if(lives<=0){updateHud();endGame(false);return}
    }
  }

  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];p.bob+=dt*4;
    if(Math.hypot(gaz.x-p.x,gaz.y-p.y)<gaz.r+p.r){
      burgers++;score+=100;pickups.splice(i,1);burst(p.x,p.y,10);say("+1 burger. Still £0.00.");
      spawnBurger();
    }
  }

  // Dash through enemies knocks them back.
  if(performance.now()<dashUntil){
    for(const e of [...chefs,...cops]){
      if(Math.hypot(gaz.x-e.x,gaz.y-e.y)<75){e.hit=.7;const a=Math.atan2(e.y-gaz.y,e.x-gaz.x);e.x+=Math.cos(a)*70;e.y+=Math.sin(a)*70;score+=15}
    }
  }

  if(exitOpen && gaz.y>H-120 && gaz.x>W*.32 && gaz.x<W*.68){
    score+=Math.max(0,Math.floor(1000-time*10))+burgers*100;endGame(true);return;
  }
  if(Math.random()<dt*.9 && particles.length<90)burst(gaz.x+(Math.random()-.5)*25,gaz.y+(Math.random()-.5)*25,1);
  particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});
  particles=particles.filter(p=>p.life>0);
  updateHud();
}

function burst(x,y,n){
  for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*110,vy:(Math.random()-.5)*110,life:.35+Math.random()*.45,r:2+Math.random()*4});
}
function say(text){
  ui.message.textContent=text;ui.message.classList.add('show');
  clearTimeout(say.t);say.t=setTimeout(()=>ui.message.classList.remove('show'),1300);
}
function updateHud(){
  ui.bill.textContent=(0).toFixed(2);
  ui.burgers.textContent=burgers;
  ui.lives.textContent='♥ '.repeat(lives).trim()+(lives<3?' ♡'.repeat(3-lives):'');
}

function draw(){
  ctx.clearRect(0,0,W,H);
  drawDiner();
  drawPickups();
  drawExit();
  chefs.forEach(e=>drawChef(e));
  cops.forEach(e=>drawCop(e));
  drawGaz();
  particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/.7);ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1});
}

function roundRect(x,y,w,h,r,fill,stroke){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke()}
}
function drawDiner(){
  ctx.fillStyle="#d8d1c6";ctx.fillRect(0,0,W,H);
  // floor tiles
  ctx.strokeStyle="#c4bcb0";ctx.lineWidth=1;
  const tile=48;for(let x=0;x<W;x+=tile){ctx.beginPath();ctx.moveTo(x,105);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=105;y<H;y+=tile){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  // counter
  ctx.fillStyle="#5b2c1f";ctx.fillRect(0,105,W,65);
  ctx.fillStyle="#8d4a30";ctx.fillRect(0,105,W,12);
  ctx.fillStyle="#1f2937";ctx.font="900 16px Arial";ctx.textAlign="center";ctx.fillText("🍔  BURGERS  •  FRIES  •  REGRET  🍔",W/2,143);
  // booths
  [[8,.26],[W-115,.25],[10,.72],[W-120,.72]].forEach(([x,y])=>{
    const yy=y*H;roundRect(x,yy,105,55,12,"#b83b32");roundRect(x+8,yy+8,89,38,9,"#d04a3e");
  });
  // tables
  [[.18,.39],[.82,.39],[.18,.62],[.82,.62]].forEach(([x,y])=>{
    const xx=x*W,yy=y*H;roundRect(xx-38,yy-23,76,46,8,"#9b5a35");ctx.fillStyle="#f0c59b";ctx.fillRect(xx-30,yy-15,60,30);
  });
  // caution
  ctx.save();ctx.translate(W*.5,H*.48);ctx.rotate(-.08);roundRect(-32,-28,64,56,5,"#f4c62d","#222");ctx.fillStyle="#222";ctx.font="900 10px Arial";ctx.textAlign="center";ctx.fillText("CAUTION",0,-4);ctx.font="20px Arial";ctx.fillText("⚠",0,19);ctx.restore();
  // wall posters
  ctx.fillStyle="#fff4d6";ctx.font="900 12px Arial";ctx.textAlign="center";ctx.fillText("NICE BURGERS",W*.1,95);ctx.fillText("SHAME ABOUT",W*.9,95);
}
function drawExit(){
  const x=W*.32,w=W*.36,y=H-62;
  ctx.save();ctx.shadowBlur=exitOpen?18:0;ctx.shadowColor="#35ff73";
  roundRect(x,y,w,50,10,exitOpen?"#2bcf57":"#58616b","#18202a");ctx.restore();
  ctx.fillStyle="#fff";ctx.font="1000 22px Arial";ctx.textAlign="center";ctx.fillText(exitOpen?"EXIT!":"EXIT LOCKED",W/2,y+33);
  if(!exitOpen && time>25){ctx.fillStyle="#ef3d32";ctx.font="900 11px Arial";ctx.fillText("THEY'RE WAITING OUTSIDE",W/2,y-7)}
}
function drawPickups(){
  pickups.forEach(p=>{ctx.save();ctx.translate(p.x,p.y+Math.sin(p.bob)*3);ctx.font="27px Arial";ctx.textAlign="center";ctx.fillText("🍔",0,9);ctx.restore()});
}
function drawChef(e){
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.sin(time*5+e.x)*.06);
  ctx.font="40px Arial";ctx.textAlign="center";ctx.fillText(e.hit>0?"😵‍💫":"👨‍🍳",0,13);
  ctx.fillStyle="#222";ctx.font="900 9px Arial";ctx.fillText("GET GAZ!",0,30);ctx.restore();
}
function drawCop(e){
  ctx.save();ctx.translate(e.x,e.y);ctx.font="42px Arial";ctx.textAlign="center";ctx.fillText("👮",0,14);ctx.fillStyle="#1d4ed8";ctx.font="900 9px Arial";ctx.fillText("STOP!",0,31);ctx.restore();
}
function drawGaz(){
  ctx.save();ctx.translate(gaz.x,gaz.y);
  if(gaz.invuln>0 && Math.floor(gaz.invuln*12)%2===0)ctx.globalAlpha=.45;
  // body
  ctx.fillStyle="#1677c9";ctx.beginPath();ctx.ellipse(0,28,22,27,0,0,Math.PI*2);ctx.fill();
  // legs
  ctx.strokeStyle="#172033";ctx.lineWidth=9;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(-9,45);ctx.lineTo(-19,62);ctx.moveTo(9,45);ctx.lineTo(19,61);ctx.stroke();
  // head
  const size=52;ctx.save();ctx.beginPath();ctx.arc(0,-3,size/2,0,Math.PI*2);ctx.clip();
  if(gazImg.complete && gazImg.naturalWidth>0)ctx.drawImage(gazImg,-size/2,-size/2-2,size,size);
  else {ctx.fillStyle="#d99070";ctx.beginPath();ctx.arc(0,0,size/2,0,Math.PI*2);ctx.fill()}
  ctx.restore();
  ctx.strokeStyle="#222";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-3,size/2,0,Math.PI*2);ctx.stroke();
  // sunglasses for cheeky hero look
  ctx.fillStyle="#111";ctx.fillRect(-18,-9,14,8);ctx.fillRect(4,-9,14,8);ctx.fillRect(-4,-7,8,3);
  ctx.restore();
}

function loop(now){
  if(!running)return;
  const dt=Math.min(.033,(now-last)/1000);last=now;
  update(dt);draw();requestAnimationFrame(loop);
}

// joystick
const joy=document.getElementById('joystick'),stick=joy.querySelector('.stick');
let joyTouchId=null,joyMouseDown=false;
function joyMove(clientX,clientY){
  const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=clientX-cx,dy=clientY-cy,max=r.width*.34;const l=Math.hypot(dx,dy);
  if(l>max){dx=dx/l*max;dy=dy/l*max}
  stick.style.transform=`translate(${dx}px,${dy}px)`;
  input.x=dx/max;input.y=dy/max;
}
function releaseJoystick(){
  joyTouchId=null;joyMouseDown=false;input.active=false;input.x=input.y=0;
  stick.style.transform='translate(0,0)';
}
function touchById(touches,id){
  for(const touch of touches)if(touch.identifier===id)return touch;
  return null;
}
joy.addEventListener('touchstart',e=>{
  if(joyTouchId!==null)return;
  const touch=e.changedTouches[0];
  joyTouchId=touch.identifier;input.active=true;joyMove(touch.clientX,touch.clientY);
  e.preventDefault();
},{passive:false});
document.addEventListener('touchmove',e=>{
  if(joyTouchId===null)return;
  const touch=touchById(e.touches,joyTouchId);
  if(touch){joyMove(touch.clientX,touch.clientY);e.preventDefault()}
},{passive:false});
document.addEventListener('touchend',e=>{
  if(joyTouchId!==null&&!touchById(e.touches,joyTouchId)){releaseJoystick();e.preventDefault()}
},{passive:false});
document.addEventListener('touchcancel',e=>{
  if(joyTouchId!==null){releaseJoystick();e.preventDefault()}
},{passive:false});

// Mouse fallback keeps the controls usable on desktop without relying on touch emulation.
joy.addEventListener('mousedown',e=>{
  if(joyTouchId!==null)return;
  joyMouseDown=true;input.active=true;joyMove(e.clientX,e.clientY);e.preventDefault();
});
document.addEventListener('mousemove',e=>{if(joyMouseDown)joyMove(e.clientX,e.clientY)});
document.addEventListener('mouseup',()=>{if(joyMouseDown)releaseJoystick()});
window.addEventListener('blur',releaseJoystick);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseJoystick()});

function dash(){
  if(!running||dashCooldown>0)return;
  dashUntil=performance.now()+650;dashCooldown=2.3;burst(gaz.x,gaz.y,18);say("DASH!");
}
ui.dash.addEventListener('touchstart',e=>{e.preventDefault();dash()},{passive:false});
ui.dash.addEventListener('mousedown',e=>{e.preventDefault();dash()});
window.addEventListener('keydown',e=>{keys[e.key]=true;if(e.key===' '||e.key==='Shift')dash()});
window.addEventListener('keyup',e=>keys[e.key]=false);
ui.startBtn.addEventListener('click',startGame);
ui.againBtn.addEventListener('click',startGame);

resize();
gazImg.onload=()=>draw();
draw();
