const reducedMotion=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
const cv=document.getElementById("game"),ctx=cv.getContext("2d");
const scoreEl=document.getElementById("score"),timeEl=document.getElementById("time"),livesEl=document.getElementById("lives");
const levelEl=document.getElementById("level"),objEl=document.getElementById("objective"),screen=document.getElementById("screen"),start=document.getElementById("start"),msg=document.getElementById("msg");
const menuBg=document.getElementById("menuBg"),mctx=menuBg.getContext("2d");
const homeScreen=document.getElementById("homeScreen"),howScreen=document.getElementById("howScreen"),diffScreen=document.getElementById("diffScreen"),endScreen=document.getElementById("endScreen");
const howBtn=document.getElementById("howBtn"),backHow=document.getElementById("backHow"),backDiff=document.getElementById("backDiff"),beginBtn=document.getElementById("beginBtn"),replayBtn=document.getElementById("replayBtn"),menuBtn=document.getElementById("menuBtn");
const endTitle=document.getElementById("endTitle"),endText=document.getElementById("endText"),endLabel=document.getElementById("endLabel");
const menuScreens={home:homeScreen,how:howScreen,diff:diffScreen,end:endScreen};
const T=36,C=29,R=19,W=cv.width,H=cv.height;
const D={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}},OP={up:"down",down:"up",left:"right",right:"left"},ORDER=["up","left","down","right"];
const MAP_COUNT=10,ITEM_COUNT=16,KEY_COUNT=4;
const info=[{name:"Blinky",color:"#ef4444",mode:"direct",corner:{r:1,c:C-2}},{name:"Pinky",color:"#ff75b5",mode:"ahead",corner:{r:R-2,c:1}},{name:"Inky",color:"#40d9e8",mode:"vector",corner:{r:R-2,c:C-2}},{name:"Clyde",color:"#f59e0b",mode:"shy",corner:{r:1,c:14}}];
const DIFFICULTIES={
 easy:{name:"Fácil",ghosts:2,step:.38,stepMin:.30,vision:8,scatter:6,chase:4,inv:2.8,baseTime:100,decay:2,slop:.35,stun:1.4,tip:"Fantasmas lentos e míopes: perseguem só quando chegam perto."},
 medium:{name:"Médio",ghosts:3,step:.30,stepMin:.22,vision:12,scatter:4,chase:6,inv:2.2,baseTime:80,decay:3,slop:.18,stun:1.0,tip:"Os fantasmas revezam entre perseguir você e patrulhar."},
 hard:{name:"Difícil",ghosts:4,step:.24,stepMin:.16,vision:99,scatter:3,chase:8,inv:1.6,baseTime:68,decay:3,slop:.05,stun:.6,tip:"Os quatro fantasmas caçam sem descanso. Boa sorte!"}
};
let map,player,ghosts,items,keys,exit,level=0,score=0,keysFound=0,lives=3,time=75,running=false,last=0,acc=0,exitHint=0;
let difficulty="medium",diff=DIFFICULTIES.medium,mode="scatter",modeTimer=0,openCache=[];

function seeded(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shuffled(values,random){let result=values.slice();for(let i=result.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
function createMap(seed){
 let random=seeded(seed),grid=Array.from({length:R},()=>Array(C).fill("1")),stack=[{r:1,c:1}],directions=[{dr:-2,dc:0},{dr:2,dc:0},{dr:0,dc:-2},{dr:0,dc:2}];
 grid[1][1]="0";
 while(stack.length){
  let current=stack[stack.length-1],choices=shuffled(directions,random).filter(d=>{let r=current.r+d.dr,c=current.c+d.dc;return r>0&&r<R-1&&c>0&&c<C-1&&grid[r][c]=="1"});
  if(!choices.length){stack.pop();continue}
  let next=choices[0],nr=current.r+next.dr,nc=current.c+next.dc;grid[nr][nc]="0";grid[(current.r+nr)/2][(current.c+nc)/2]="0";stack.push({r:nr,c:nc})
 }
 for(let r=1;r<R-1;r++)for(let c=1;c<C-1;c++)if(grid[r][c]=="1"&&((r%2==1&&c%2==0)||(r%2==0&&c%2==1))&&random()<.24)grid[r][c]="0";
 return grid.map(row=>row.join(""))
}
const maps=Array.from({length:MAP_COUNT},(_,i)=>createMap(104729+i*7919));

/* Logo Barbosa — decorativo, exibido no fundo animado (não no mapa) */
const barbosaImg=new Image();
let barbosaReady=false;
barbosaImg.onload=()=>{
 barbosaReady=true;
 if(!running)draw();
 window.dispatchEvent(new Event("barbosa-ready"));
};
barbosaImg.src="Img/logo barbosa.png";

function openCells(){if(openCache.length)return openCache;openCache=[];for(let r=0;r<R;r++)for(let c=0;c<C;c++)if(map[r][c]=="0")openCache.push({r,c});return openCache}
function can(r,c){return r>=0&&r<R&&c>=0&&c<C&&map[r][c]=="0"}
function cellKey(cell){return cell.r+","+cell.c}
function search(start){
 let distances=Array(R*C).fill(-1),previous=Array(R*C).fill(null),queue=[start],startIndex=start.r*C+start.c;
 distances[startIndex]=0;
 for(let i=0;i<queue.length;i++){
  let current=queue[i],currentIndex=current.r*C+current.c;
  for(let direction of ORDER){let step=D[direction],r=current.r+step.y,c=current.c+step.x;if(!can(r,c))continue;let index=r*C+c;if(distances[index]!==-1)continue;distances[index]=distances[currentIndex]+1;previous[index]=current;queue.push({r,c})}
 }
 return{distances,previous}
}
function findExit(start,starts){
 let {distances}=search(start),reserved=new Set(starts.map(cellKey)),candidates=openCells().filter(cell=>!reserved.has(cellKey(cell))&&distances[cell.r*C+cell.c]>=0);
 candidates.sort((a,b)=>distances[b.r*C+b.c]-distances[a.r*C+a.c]||b.r-a.r||b.c-a.c);
 return candidates[0]||{r:R-2,c:C-2}
}
function findPath(start,end){
 let {distances,previous}=search(start),path=[],current=end;
 if(distances[end.r*C+end.c]<0)return path;
 while(current){path.push(current);if(current.r==start.r&&current.c==start.c)break;current=previous[current.r*C+current.c]}
 return path.reverse()
}
function makeItems(path,cells,reserved){
 let selected=[],used=new Set(),random=seeded(7000+level*101);
 function add(cell){if(!cell||reserved.has(cellKey(cell))||used.has(cellKey(cell)))return;used.add(cellKey(cell));selected.push(cell)}
 for(let i=0;i<ITEM_COUNT;i++){let index=path.length?Math.min(path.length-1,Math.floor((i+1)*path.length/(ITEM_COUNT+1))):0;add(path[index])}
 for(let cell of shuffled(cells,random)){if(selected.length>=ITEM_COUNT)break;add(cell)}
 return selected.slice(0,ITEM_COUNT).map((cell,i)=>({...cell,type:i%4==0?"book":"coin",got:false}))
}
function makeKeys(path,cells,reserved,itemCells){
 let selected=[],used=new Set(itemCells.map(cellKey)),random=seeded(9100+level*131);
 function add(cell){if(!cell||reserved.has(cellKey(cell))||used.has(cellKey(cell)))return;used.add(cellKey(cell));selected.push(cell)}
 for(let i=0;i<KEY_COUNT;i++){let index=path.length?Math.min(path.length-1,Math.floor((i+1)*path.length/(KEY_COUNT+1))):0;add(path[index])}
 for(let cell of shuffled(cells,random)){if(selected.length>=KEY_COUNT)break;add(cell)}
 return selected.slice(0,KEY_COUNT).map(cell=>({...cell,got:false}))
}
function setup(){
 diff=DIFFICULTIES[difficulty];map=maps[level];openCache=[];let cells=openCells(),startCell={r:1,c:1},midRow=Math.floor((R-1)/2),midCol=Math.floor((C-1)/2),starts=[{r:midRow-2,c:midCol-5},{r:midRow-2,c:midCol+5},{r:midRow+2,c:midCol-5},{r:midRow+2,c:midCol+5}];
 exit=findExit(startCell,starts);keysFound=0;exitHint=0;player={...startCell,dir:"right",next:"right",inv:diff.inv,speed:8,progress:0};
 let path=findPath(startCell,exit),reserved=new Set([startCell,exit,...starts].map(cellKey));items=makeItems(path,cells,reserved);keys=makeKeys(path,cells,reserved,items);
 ghosts=info.slice(0,diff.ghosts).map((g,i)=>({...g,r:starts[i].r,c:starts[i].c,dir:ORDER[(i+level)%4],cool:.35+i*.15,prevR:starts[i].r,prevC:starts[i].c}));
 mode="scatter";modeTimer=diff.scatter;time=Math.max(40,diff.baseTime-level*diff.decay);levelEl.textContent=level+1;updateHUD()
}
function dist(a,b){return Math.hypot(a.c-b.c,a.r-b.r)}
function nearestOpen(r,c){let cells=openCells(),best=cells[0],bestDistance=Infinity;for(let cell of cells){let value=(cell.r-r)**2+(cell.c-c)**2;if(value<bestDistance){bestDistance=value;best=cell}}return best}
function options(g){let available=ORDER.filter(direction=>can(g.r+D[direction].y,g.c+D[direction].x)),forward=available.filter(direction=>direction!=OP[g.dir]);return forward.length?forward:available}
function target(g){
 if(mode=="scatter"||dist(g,player)>diff.vision)return nearestOpen(g.corner.r,g.corner.c);
 let point;
 if(g.mode=="direct")point={r:player.r,c:player.c};
 else if(g.mode=="ahead"){let r=player.r,c=player.c,d=D[player.dir];for(let i=0;i<4;i++){r+=d.y;c+=d.x}point={r,c}}
 else if(g.mode=="shy")point=dist(g,player)>10?{r:player.r,c:player.c}:g.corner;
 else{let b=ghosts[0],p={r:player.r+2*D[player.dir].y,c:player.c+2*D[player.dir].x};point={r:p.r*2-b.r,c:p.c*2-b.c}}
 return nearestOpen(point.r,point.c)
}
function pathDistance(from,to){
 let distances=Array(R*C).fill(-1),queue=[to],toIndex=to.r*C+to.c;distances[toIndex]=0;
 for(let i=0;i<queue.length;i++){let current=queue[i],currentIndex=current.r*C+current.c;for(let direction of ORDER){let step=D[direction],r=current.r+step.y,c=current.c+step.x;if(!can(r,c))continue;let index=r*C+c;if(distances[index]!==-1)continue;distances[index]=distances[currentIndex]+1;queue.push({r,c})}}
 return distances[from.r*C+from.c]
}
function ghostStep(){return Math.max(diff.stepMin,diff.step-level*.012)}
function choose(g,goal){let available=options(g);if(!available.length)return OP[g.dir];if(Math.random()<diff.slop)return available[Math.floor(Math.random()*available.length)];let best=available[0],bestDistance=Infinity;for(let direction of available){let step=D[direction],next={r:g.r+step.y,c:g.c+step.x},value=pathDistance(next,goal);if(value<0)value=dist(next,goal);if(value<bestDistance||value==bestDistance&&direction==g.dir){bestDistance=value;best=direction}}return best}
function updateGhost(g,dt){
 g.cool-=dt;if(g.cool>0)return;g.cool=ghostStep();
 let oldR=g.r,oldC=g.c;g.dir=choose(g,target(g));let step=D[g.dir],r=g.r+step.y,c=g.c+step.x;
 if(can(r,c)){g.r=r;g.c=c}
 if(g.r==oldR&&g.c==oldC){let reverse=OP[g.dir];step=D[reverse];r=g.r+step.y;c=g.c+step.x;if(can(r,c)){g.dir=reverse;g.r=r;g.c=c}}
}
/* Colisão com fantasmas — verificada a cada frame de update(),
   independente de g.cool e de atordoamento. Detecta:
   - mesma célula no fim do ciclo (ou célula atravessada no percurso)
   - cruzamento (troca de células) no mesmo ciclo */
function checkTeacherContact(prevPlayer){
 if(player.inv>0||lives<=0)return;
 let path=(player.path&&player.path.length)?player.path:[{r:player.r,c:player.c}];
 for(let i=0;i<ghosts.length;i++){
  let g=ghosts[i],sameCell=g.r==player.r&&g.c==player.c;
  if(!sameCell){
   for(let j=0;j<path.length;j++){
    if(path[j].r==g.r&&path[j].c==g.c){sameCell=true;break}
   }
  }
  let crossed=g.r==prevPlayer.r&&g.c==prevPlayer.c&&g.prevR==player.r&&g.prevC==player.c;
  if(sameCell||crossed){hit();return}
 }
}
function hit(){
 lives--;score=Math.max(0,score-150);player.inv=diff.inv;player.progress=0;
 mode="scatter";modeTimer=diff.scatter;ghosts.forEach(g=>g.cool=diff.stun);
 show("Fantasma pegou você! -1 vida");
 if(lives<=0){end(false,"Você ficou sem vidas!");return}
 player.r=1;player.c=1;player.dir="right";player.next="right"
}
function collect(){
 items.forEach(item=>{if(!item.got&&item.r==player.r&&item.c==player.c){item.got=true;let value=item.type=="coin"?100:150;score+=value;show(item.type=="coin"?"+100 pontos!":"+150 pontos!")}});
 keys.forEach(key=>{if(!key.got&&key.r==player.r&&key.c==player.c){key.got=true;keysFound++;score+=200;show("Chave encontrada! "+keysFound+"/"+KEY_COUNT)}})
}
function next(){
 if(keysFound<KEY_COUNT){if(exitHint<=0){show("Faltam "+(KEY_COUNT-keysFound)+" chaves para a saída!");exitHint=1.5}return}
 if(level==maps.length-1){end(true,"Você escapou da Setec!");return}
 score+=300;level++;setup();show("Fase "+(level+1)+"!")
}
function update(dt){
 if(exitHint>0)exitHint-=dt;acc+=dt;if(acc>=1){let seconds=Math.floor(acc);time-=seconds;acc-=seconds;if(time<=0){time=0;end(false,"O tempo acabou!");return}}
 modeTimer-=dt;if(modeTimer<=0){if(mode=="scatter"){mode="chase";modeTimer=diff.chase}else{mode="scatter";modeTimer=diff.scatter}}
 if(player.inv>0)player.inv-=dt;
 let prevPlayer={r:player.r,c:player.c};
 movePlayer(dt);
 ghosts.forEach(g=>{g.prevR=g.r;g.prevC=g.c;updateGhost(g,dt)});
 checkTeacherContact(prevPlayer);
 collect();
 if(player.r==exit.r&&player.c==exit.c&&keysFound==KEY_COUNT)next();updateHUD()
}
function showScreen(name){Object.values(menuScreens).forEach(el=>el.classList.add("hidden"));if(menuScreens[name])menuScreens[name].classList.remove("hidden");screen.classList.remove("hidden");if(!reducedMotion)startMenuLoop()}
function end(win,title){
 running=false;
 endScreen.classList.toggle("is-win",!!win);
 endScreen.classList.toggle("is-lose",!win);
 setTimeout(()=>{endLabel.textContent=win?"VITÓRIA":"FIM DE JOGO";endTitle.textContent=win?"Você conseguiu!":title;endText.innerHTML=(win?"Você completou as 10 fases!":"Tente novamente e melhore sua pontuação.")+"<br><br><b>Pontuação: "+score+"</b>";showScreen("end")},180)
}
function updateHUD(){scoreEl.textContent=score;timeEl.textContent=time;livesEl.innerHTML=Array.from({length:3},(_,i)=>'<span class="heart'+(i<lives?' on':'')+'"><svg viewBox="0 0 11 10" shape-rendering="crispEdges" aria-hidden="true"><path d="M2 1h2v1H2zM7 1h2v1H7zM1 2h8v1H1zM0 3h11v1H0zM0 4h11v1H0zM1 5h9v1H1zM2 6h7v1H2zM3 7h5v1H3zM4 8h3v1H4zM5 9h1v1H5z" fill="currentColor"/></svg></span>').join("");objEl.textContent=keysFound==KEY_COUNT?"Saída liberada!":"Chaves: "+keysFound+"/"+KEY_COUNT}
function show(text){msg.textContent=text;msg.classList.remove("hidden");clearTimeout(show.timer);show.timer=setTimeout(()=>msg.classList.add("hidden"),1200)}
function movePlayer(dt){
  player.path=[];
  player.progress+=dt*player.speed;let steps=Math.floor(player.progress);if(steps<=0)return;player.progress-=steps;
  for(let i=0;i<steps;i++){
   if(can(player.r+D[player.next].y,player.c+D[player.next].x))player.dir=player.next;
   let step=D[player.dir],r=player.r+step.y,c=player.c+step.x;
   if(!can(r,c))break;
    if(r==exit.r&&c==exit.c&&keysFound<KEY_COUNT){if(exitHint<=0){show("A saída está trancada! Colete as quatro chaves.");exitHint=1.5}break}
   player.r=r;player.c=c;player.path.push({r,c});
  }
}
function loop(now){if(!running)return;let dt=Math.min((now-last)/1000,.05);last=now;update(dt);draw();requestAnimationFrame(loop)}
function begin(){if(running)return;level=0;score=0;lives=3;setup();running=true;msg.classList.add("hidden");screen.classList.add("hidden");last=performance.now();requestAnimationFrame(loop)}
const diffButtons=[...document.querySelectorAll("#difficulty .diff-btn")],diffInfo=document.getElementById("diffInfo");
function selectDifficulty(name){difficulty=name;diff=DIFFICULTIES[name];diffButtons.forEach(b=>b.classList.toggle("active",b.dataset.diff===name));if(diffInfo)diffInfo.textContent=DIFFICULTIES[name].tip;timeEl.textContent=Math.max(40,DIFFICULTIES[name].baseTime)}
if(diffButtons.length)selectDifficulty(difficulty);
diffButtons.forEach(b=>b.addEventListener("click",()=>selectDifficulty(b.dataset.diff)));
start.onclick=()=>showScreen("diff");
howBtn.onclick=()=>showScreen("how");
backHow.onclick=()=>showScreen("home");
backDiff.onclick=()=>showScreen("home");
beginBtn.onclick=begin;
replayBtn.onclick=begin;
menuBtn.onclick=()=>showScreen("home");
addEventListener("keydown",e=>{let m={w:"up",arrowup:"up",s:"down",arrowdown:"down",a:"left",arrowleft:"left",d:"right",arrowright:"right"}[e.key.toLowerCase()];if(m&&running){player.next=m;e.preventDefault()}if(!running){if(e.key=="Enter"){if(!diffScreen.classList.contains("hidden"))begin();else if(!homeScreen.classList.contains("hidden"))showScreen("diff");else if(!endScreen.classList.contains("hidden"))begin()}if(e.key=="Escape"&&!screen.classList.contains("hidden"))showScreen("home")}});

function draw(){
 ctx.fillStyle="#070d18";ctx.fillRect(0,0,W,H);
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){let x=c*T,y=r*T;
  if(map[r][c]=="0"){
   ctx.fillStyle=(r+c)%2?"#0c1628":"#0e1a30";ctx.fillRect(x,y,T,T);
   ctx.fillStyle="#132844";ctx.fillRect(x+T/2-1,y+T/2-1,2,2);
  }}
 for(let r=0;r<R;r++)for(let c=0;c<C;c++)if(map[r][c]=="1")drawWall(c*T,r*T,r,c);
 drawExitDoor();
 items.forEach(item=>{if(!item.got)item.type=="coin"?coin(item.c*T+T/2,item.r*T+T/2):book(item.c*T+T/2,item.r*T+T/2)});
 keys.forEach(key=>{if(!key.got)drawKey(key.c*T+T/2,key.r*T+T/2)});
 ghosts.forEach(ghost);hero();
}
function drawWall(x,y,r,c){
 ctx.fillStyle="#132645";ctx.fillRect(x,y,T,T);
 ctx.fillStyle="#1a3054";ctx.fillRect(x+2,y+2,T-4,T-4);
 if(r==0||map[r-1][c]=="0"){ctx.fillStyle="#274878";ctx.fillRect(x+2,y+2,T-4,3)}
 if(c==0||map[r][c-1]=="0"){ctx.fillStyle="#213e66";ctx.fillRect(x+2,y+2,3,T-4)}
 if(r==R-1||map[r+1][c]=="0"){ctx.fillStyle="#0a1424";ctx.fillRect(x+2,y+T-5,T-4,3)}
 if(c==C-1||map[r][c+1]=="0"){ctx.fillStyle="#0c1830";ctx.fillRect(x+T-5,y+2,3,T-4)}
 ctx.fillStyle="#152a4a";
 ctx.fillRect(x+6,y+Math.floor(T/2),T-12,1);
 ctx.fillRect(x+Math.floor(T/2),y+6,1,Math.floor(T/2)-6);
}
function drawExitDoor(){
 let unlocked=keysFound==KEY_COUNT,x=exit.c*T,y=exit.r*T;
 ctx.fillStyle=unlocked?"#0d2218":"#1c0e14";ctx.fillRect(x+2,y+2,T-4,T-4);
 ctx.fillStyle=unlocked?"#143524":"#2a141c";ctx.fillRect(x+5,y+5,T-10,T-10);
 ctx.strokeStyle=unlocked?"#3a8f5e":"#7a3840";ctx.lineWidth=2;
 ctx.strokeRect(x+4,y+4,T-8,T-8);
 if(unlocked){
  ctx.fillStyle="#5cbc84";
  ctx.beginPath();ctx.moveTo(x+T/2-5,y+T/2-4);ctx.lineTo(x+T/2+5,y+T/2);ctx.lineTo(x+T/2-5,y+T/2+4);ctx.closePath();ctx.fill();
 }else{
  ctx.fillStyle="#8a4a50";ctx.fillRect(x+T/2-4,y+T/2-1,8,7);
  ctx.strokeStyle="#8a4a50";ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(x+T/2,y+T/2-2,3,Math.PI,0);ctx.stroke();
 }
 ctx.font="bold 7px ui-monospace,monospace";ctx.textAlign="center";
 ctx.fillStyle=unlocked?"#7ad4a0":"#9a6068";
 ctx.fillText(unlocked?"SAÍDA":"TRANCADA",x+T/2,y+T-6);ctx.textAlign="left";
}
function drawKey(x,y){
 x=Math.round(x);y=Math.round(y);
 ctx.save();
 ctx.strokeStyle="#c9a227";ctx.lineWidth=3;ctx.lineCap="square";ctx.lineJoin="miter";
 ctx.beginPath();ctx.arc(x-6,y-5,5,0,Math.PI*2);
 ctx.moveTo(x-2,y-1);ctx.lineTo(x+9,y+10);
 ctx.moveTo(x+6,y+5);ctx.lineTo(x+9,y+8);
 ctx.moveTo(x+4,y+7);ctx.lineTo(x+7,y+10);
 ctx.stroke();
 ctx.strokeStyle="#f0d878";ctx.lineWidth=1;
 ctx.beginPath();ctx.arc(x-7,y-6,3.2,Math.PI*1.1,Math.PI*1.7);ctx.stroke();
 ctx.restore();
}
function hero(){
 let x=Math.round(player.c*T+T/2),y=Math.round(player.r*T+T/2);
 if(player.inv>0&&Math.floor(player.inv*10)%2)return;
 ctx.fillStyle="rgba(0,0,0,.28)";
 ctx.beginPath();ctx.ellipse(x,y+11,9,2.5,0,0,7);ctx.fill();
 ctx.fillStyle="#a8741c";round(x-11,y-2,5,11,1);
 ctx.fillStyle="#c48a28";ctx.fillRect(x-10,y-1,3,4);
 ctx.fillStyle="#2a62b8";round(x-8,y-3,16,14,3);
 ctx.fillStyle="#3578d4";ctx.fillRect(x-6,y-1,12,5);
 ctx.fillStyle="#1e4a90";ctx.fillRect(x-8,y+8,16,3);
 ctx.fillStyle="#efb58d";ctx.beginPath();ctx.arc(x,y-8,7,0,7);ctx.fill();
 ctx.fillStyle="#2a2030";ctx.beginPath();ctx.arc(x,y-10,7,Math.PI,0);ctx.fill();
 ctx.fillRect(x-7,y-10,14,2);
 let ex=0,ey=0;
 if(player.dir=="left")ex=-2;else if(player.dir=="right")ex=2;else if(player.dir=="up")ey=-1;else ey=1;
 ctx.fillStyle="#1a2233";
 ctx.fillRect(x-4+ex,y-8+ey,2,2);ctx.fillRect(x+2+ex,y-8+ey,2,2);
 ctx.fillStyle="#1a2233";ctx.fillRect(x-7,y+10,5,2);ctx.fillRect(x+2,y+10,5,2);
 ctx.fillStyle="#d4dce8";ctx.fillRect(x-6,y+10,3,1);ctx.fillRect(x+3,y+10,3,1);
}
function ghost(g){
 let x=Math.round(g.c*T+T/2),y=Math.round(g.r*T+T/2);
 ctx.fillStyle="rgba(0,0,0,.28)";
 ctx.beginPath();ctx.ellipse(x,y+11,10,2.5,0,0,7);ctx.fill();
 ctx.fillStyle=g.color;
 ctx.beginPath();ctx.arc(x,y-2,11,Math.PI,0);
 ctx.lineTo(x+11,y+8);
 ctx.lineTo(x+7,y+8);ctx.lineTo(x+4,y+5);ctx.lineTo(x,y+8);ctx.lineTo(x-4,y+5);ctx.lineTo(x-7,y+8);ctx.lineTo(x-11,y+8);
 ctx.closePath();ctx.fill();
 ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillRect(x-11,y+4,22,4);
 let d=D[g.dir]||{x:0,y:0};
 ctx.fillStyle="#f4f7fc";
 ctx.beginPath();ctx.arc(x-5,y-3,3.5,0,7);ctx.arc(x+5,y-3,3.5,0,7);ctx.fill();
 ctx.fillStyle="#1a2740";
 ctx.beginPath();ctx.arc(x-5+d.x*1.5,y-3+d.y*1.5,1.8,0,7);ctx.arc(x+5+d.x*1.5,y-3+d.y*1.5,1.8,0,7);ctx.fill();
 ctx.font="bold 7px ui-monospace,monospace";ctx.textAlign="center";
 ctx.fillStyle="rgba(200,215,240,.5)";
 ctx.fillText(g.name,x,y+26);ctx.textAlign="left";
}
function coin(x,y){
 x=Math.round(x);y=Math.round(y);
 ctx.fillStyle="rgba(0,0,0,.22)";
 ctx.beginPath();ctx.ellipse(x,y+8,7,2,0,0,7);ctx.fill();
 ctx.fillStyle="#8a6618";ctx.beginPath();ctx.arc(x,y+1,8,0,7);ctx.fill();
 ctx.fillStyle="#e0bc4e";ctx.beginPath();ctx.arc(x,y,8,0,7);ctx.fill();
 ctx.fillStyle="#f5dc8a";ctx.beginPath();ctx.arc(x-2,y-2,3,0,7);ctx.fill();
 ctx.fillStyle="#8a6618";ctx.font="bold 9px ui-monospace,monospace";ctx.textAlign="center";
 ctx.fillText("$",x,y+3);ctx.textAlign="left";
}
function book(x,y){
 x=Math.round(x);y=Math.round(y);
 ctx.fillStyle="rgba(0,0,0,.22)";
 ctx.beginPath();ctx.ellipse(x,y+8,9,2,0,0,7);ctx.fill();
 ctx.fillStyle="#4a38a0";round(x-9,y-7,18,14,2);
 ctx.fillStyle="#d4c8f0";ctx.fillRect(x+5,y-5,3,11);
 ctx.fillStyle="#5c48b8";ctx.fillRect(x-7,y-5,2,10);
 ctx.fillStyle="#8a78d0";ctx.fillRect(x-3,y-3,6,1);ctx.fillRect(x-3,y+1,4,1);
}
function round(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill()}
setup();draw();

/* ---------- fundo animado do menu (parallax arcade) ---------- */
const MW=menuBg.width,MH=menuBg.height;
const MENU_COLORS=["#3fd0ef","#f5c542","#ff75b5","#4ecf8a","#7aa8ff","#8ee9f8","#ff8a3d"];
const rand=(a,b)=>a+Math.random()*(b-a);

const menuDust=Array.from({length:42},()=>({x:rand(0,MW),y:rand(0,MH),s:Math.random()<.55?3:5,sp:rand(8,22),drift:rand(-8,8),ph:rand(0,6.28),c:MENU_COLORS[Math.floor(Math.random()*MENU_COLORS.length)],a:rand(.14,.4)}));
const menuPluses=Array.from({length:18},()=>({x:rand(20,MW-20),y:rand(20,MH-20),s:Math.random()<.4?3:4,ph:rand(0,6.28),c:Math.random()<.6?"#3d6db5":"#5da9ff"}));
const menuStreaks=Array.from({length:6},()=>({x:rand(-MW*.3,MW),y:rand(30,MH-30),len:rand(50,150),sp:rand(70,170),c:MENU_COLORS[Math.floor(Math.random()*MENU_COLORS.length)],a:rand(.0,.5),life:rand(0,6),max:rand(4,9)}));
const menuGhosts=Array.from({length:3},(_,i)=>({x:rand(0,MW),baseY:rand(70,MH-110),y:0,s:rand(2.5,4),sp:rand(7,15)*(i%2?1:-1),amp:rand(8,20),ph:rand(0,6.28),c:["#ef4444","#ff75b5","#40d9e8"][i],a:rand(.07,.13)}));
const menuProps=[
 {type:"notebook",x:rand(90,180),baseY:rand(200,320),y:0,s:rand(3.2,4),sp:-rand(4,9),amp:rand(8,16),ph:rand(0,6.28),a:.9,depth:.35},
 {type:"pencil",x:rand(100,200),baseY:rand(430,540),y:0,s:rand(3,4),sp:rand(5,11),amp:rand(7,15),ph:rand(0,6.28),a:.9,depth:.5},
 {type:"plane",x:rand(820,940),baseY:rand(180,300),y:0,s:rand(3,4),sp:-rand(8,16),amp:rand(10,20),ph:rand(0,6.28),a:.95,depth:.6},
 {type:"books",x:rand(850,940),baseY:rand(480,560),y:0,s:rand(2.6,3.4),sp:rand(3,8),amp:rand(6,12),ph:rand(0,6.28),a:.9,depth:.4}
];
const GHOST_SHAPE=["..####..","########","##.##.##","########","########","##.##.##","#.#..#.#"];
const menuVignette=mctx.createRadialGradient(MW/2,MH/2,MH*.3,MW/2,MH/2,MW*.72);
menuVignette.addColorStop(0,"rgba(0,0,0,0)");menuVignette.addColorStop(1,"rgba(0,0,0,.62)");
let menuT=0,menuLast=0,glitchLeft=0,glitchNext=2.8;

function menuShape(shape,x,y,s,color,alpha){mctx.save();mctx.globalAlpha=alpha;mctx.fillStyle=color;for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]=="#")mctx.fillRect(x+c*s,y+r*s,s,s);mctx.restore()}

function menuNotebook(x,y,s,a){
 mctx.save();mctx.globalAlpha=a;
 mctx.translate(x+7*s,y+8*s);mctx.rotate(-.18);mctx.translate(-7*s,-8*s);
 mctx.fillStyle="#1e3f8a";mctx.fillRect(0,0,14*s,16*s);
 mctx.fillStyle="#2a55b8";mctx.fillRect(s,s,12*s,14*s);
 mctx.fillStyle="#7fd4ff";mctx.fillRect(3*s,4*s,8*s,4*s);
 mctx.fillStyle="#5da9ff";mctx.fillRect(4*s,5*s,6*s,2*s);
 mctx.fillStyle="#c9d8f5";for(let i=0;i<5;i++)mctx.fillRect(0,(2+i*3)*s,s,1.4*s);
 mctx.fillStyle="#8fb2e8";mctx.fillRect(2*s,11*s,10*s,.8*s);mctx.fillRect(2*s,13*s,7*s,.8*s);
 mctx.restore()
}
function menuPencil(x,y,s,a){
 mctx.save();mctx.globalAlpha=a;
 mctx.translate(x+5*s,y+s);mctx.rotate(.5);mctx.translate(-5*s,-s);
 mctx.fillStyle="#f6c945";mctx.fillRect(0,0,10*s,2*s);
 mctx.fillStyle="#ffe680";mctx.fillRect(0,0,10*s,s);
 mctx.fillStyle="#d99a1f";mctx.fillRect(0,s,10*s,s);
 mctx.fillStyle="#ff75b5";mctx.fillRect(-1.5*s,s*.5,s,2*s);
 mctx.fillStyle="#e8e8f0";mctx.fillRect(-.6*s,s*.5,.6*s,2*s);
 mctx.fillStyle="#d9a25c";mctx.fillRect(10*s,0,s,2*s);
 mctx.fillStyle="#2b2b33";mctx.fillRect(11*s,.4*s,s,1.2*s);
 mctx.restore()
}
function menuPlane(x,y,s,a){
 mctx.save();mctx.globalAlpha=a*.35;mctx.strokeStyle="#40d9e8";mctx.lineWidth=Math.max(1,s*.6);mctx.setLineDash([s*1.6,s*2.2]);
 mctx.beginPath();mctx.moveTo(x-26*s,y+18*s);mctx.quadraticCurveTo(x-12*s,y+6*s,x+2*s,y+3*s);mctx.stroke();mctx.setLineDash([]);
 mctx.globalAlpha=a;
 const PLANE=["......#",".....##","#######","..####.","...#..."];
 menuShape(PLANE,x,y,s,"#40d9e8",a);
 menuShape(PLANE,x,y,s*.6,"#9ff3ff",a*.7);
 mctx.restore()
}
function menuBooks(x,y,s,a){
 mctx.save();mctx.globalAlpha=a;
 const stack=[["#3b6fe0","#7fb0ff","#e8f0ff"],["#e05a8a","#ff9ec2","#fff0f5"],["#3ecf8e","#8affc4","#eafff3"]];
 stack.forEach((b,i)=>{let yy=y+(2-i)*3.4*s; mctx.fillStyle=b[0];mctx.fillRect(x,yy,12*s,3*s);mctx.fillStyle=b[1];mctx.fillRect(x,yy,12*s,s);mctx.fillStyle=b[2];mctx.fillRect(x+10.6*s,yy+.6*s,s,1.8*s)});
 mctx.restore()
}

function drawMcAvatar(){
 const av=document.getElementById("mcAvatar");if(!av)return;
 const a=av.getContext("2d"),U=1;
 a.clearRect(0,0,32,32);
 a.fillStyle="#0d1b33";a.fillRect(0,0,32,32);
 a.fillStyle="#12305c";for(let i=0;i<10;i++)a.fillRect((i*7)%32,(i*11)%32,U,U);
 a.fillStyle="#2563eb";a.fillRect(6,25,20,7);a.fillStyle="#3b82f6";a.fillRect(8,25,16,2);
 a.fillStyle="#22d3ee";a.fillRect(13,25,6,2);
 a.fillStyle="#efb58d";a.fillRect(12,22,8,4);a.fillRect(11,23,10,2);
 a.fillStyle="#e8a878";a.fillRect(12,22,8,1);
 a.fillStyle="#f0b892";a.fillRect(9,10,14,13);a.fillRect(10,8,12,2);a.fillRect(8,12,1,8);a.fillRect(23,12,1,8);
 a.fillStyle="#3a2a1e";a.fillRect(8,5,16,5);a.fillRect(7,7,2,7);a.fillRect(23,7,2,9);a.fillRect(9,4,14,2);
 a.fillStyle="#4a3626";a.fillRect(8,5,16,1);a.fillRect(9,9,3,2);a.fillRect(20,9,3,2);a.fillRect(7,10,2,4);
 a.fillStyle="#1a2233";a.fillRect(11,13,3,3);a.fillRect(18,13,3,3);
 a.fillStyle="#fff";a.fillRect(11,13,2,2);a.fillRect(18,13,2,2);
 a.fillStyle="#2b3a55";a.fillRect(12,14,2,2);a.fillRect(19,14,2,2);
 a.fillStyle="#3a2a1e";a.fillRect(10,11,5,1);a.fillRect(17,11,5,1);
 a.fillStyle="#d9936a";a.fillRect(15,16,2,2);
 a.fillStyle="#c47a55";a.fillRect(13,19,6,1);
 a.fillStyle="#9d7cff";a.fillRect(9,27,3,3);a.fillStyle="#ff75b5";a.fillRect(20,27,3,3)
}

function drawMenuBg(dt){
 mctx.fillStyle="#060a1c";mctx.fillRect(0,0,MW,MH);
 const pulse=.5+.5*Math.sin(menuT*.6);
 const horizon=mctx.createLinearGradient(0,MH*.55,0,MH);
 horizon.addColorStop(0,"rgba(20,40,90,0)");horizon.addColorStop(1,"rgba(38,70,140,"+(.22+.06*pulse)+")");
 mctx.fillStyle=horizon;mctx.fillRect(0,MH*.55,MW,MH*.45);
 mctx.fillStyle="#2e5fa8";
 for(let i=0;i<3;i++){let x=((menuT*7+i*380)%(MW+180))-90;mctx.globalAlpha=.04;mctx.fillRect(x,0,90,MH)}
 mctx.globalAlpha=1;

 const gFar=72,gNear=36;
 const oxFar=(menuT*3)%gFar,oyFar=(menuT*2)%gFar;
 mctx.strokeStyle="#13224a";mctx.lineWidth=1;mctx.beginPath();
 for(let x=-gFar+oxFar;x<=MW+gFar;x+=gFar){mctx.moveTo(x,0);mctx.lineTo(x,MH)}
 for(let y=-gFar+oyFar;y<=MH+gFar;y+=gFar){mctx.moveTo(0,y);mctx.lineTo(MW,y)}
 mctx.stroke();
 const oxNear=(menuT*8)%gNear,oyNear=(menuT*5)%gNear;
 mctx.strokeStyle="#1b3061";mctx.lineWidth=1.4;mctx.beginPath();
 for(let x=-gNear+oxNear;x<=MW+gNear;x+=gNear){mctx.moveTo(x,0);mctx.lineTo(x,MH)}
 for(let y=-gNear+oyNear;y<=MH+gNear;y+=gNear){mctx.moveTo(0,y);mctx.lineTo(MW,y)}
 mctx.stroke();
 mctx.strokeStyle="#24427c";mctx.lineWidth=2;mctx.beginPath();
 for(let x=-gFar*2+oxNear*.5;x<=MW+gFar;x+=gFar*2){mctx.moveTo(x,0);mctx.lineTo(x,MH)}
 mctx.stroke();

 menuPluses.forEach(p=>{const tw=.25+.35*(.5+.5*Math.sin(menuT*1.4+p.ph));mctx.globalAlpha=tw;mctx.fillStyle=p.c;mctx.fillRect(p.x-p.s,p.y,p.s*2+1,1.5);mctx.fillRect(p.x,p.y-p.s,1.5,p.s*2+1)});
 mctx.globalAlpha=1;

 const px=Math.sin(menuT*.25)*10,py=Math.cos(menuT*.18)*6;
 menuProps.forEach(p=>{
  p.x+=p.sp*dt;if(p.x>MW+90)p.x=-90;if(p.x<-90)p.x=MW+90;
  p.y=p.baseY+Math.sin(menuT*.6+p.ph)*p.amp+py*p.depth;
  const xx=p.x+px*p.depth;
  if(p.type==="notebook")menuNotebook(xx,p.y,p.s,p.a);
  else if(p.type==="pencil")menuPencil(xx,p.y,p.s,p.a);
  else if(p.type==="plane")menuPlane(xx,p.y,p.s,p.a);
  else menuBooks(xx,p.y,p.s,p.a)
 });

 menuGhosts.forEach(gh=>{gh.x+=gh.sp*dt;if(gh.x>MW+80)gh.x=-80;if(gh.x<-80)gh.x=MW+80;gh.y=gh.baseY+Math.sin(menuT*.7+gh.ph)*gh.amp+py*.2;menuShape(GHOST_SHAPE,gh.x,gh.y,gh.s,gh.c,gh.a)});

 /* logo Barbosa flutuando no fundo do menu (decorativo, em movimento) */
 if(typeof barbosaReady!=="undefined"&&barbosaReady&&typeof barbosaImg!=="undefined"&&barbosaImg.naturalWidth){
  const logos=[
   {x:MW*.16+Math.sin(menuT*.28)*14,y:MH*.7+Math.cos(menuT*.22)*10,s:MW<700?110:170,a:.28},
   {x:MW*.84+Math.cos(menuT*.25)*12,y:MH*.28+Math.sin(menuT*.3)*8,s:MW<700?90:140,a:.24},
   {x:MW*.55+Math.sin(menuT*.2*.7+1)*9,y:MH*.88+Math.cos(menuT*.19)*6,s:MW<700?70:110,a:.18}
  ];
  mctx.imageSmoothingEnabled=true;
  for(let i=0;i<logos.length;i++){
   const L=logos[i];
   mctx.globalAlpha=L.a*(.85+.15*Math.sin(menuT*.6+i));
   mctx.drawImage(barbosaImg,L.x-L.s/2,L.y-L.s/2,L.s,L.s);
  }
  mctx.globalAlpha=1;
 }

 menuStreaks.forEach(s=>{
  s.life+=dt;if(s.life>s.max){s.life=0;s.max=rand(4,9);s.x=rand(-MW*.3,-20);s.y=rand(30,MH-30);s.len=rand(50,150);s.sp=rand(70,170);s.c=MENU_COLORS[Math.floor(Math.random()*MENU_COLORS.length)]}
  s.x+=s.sp*dt;
  const k=Math.sin(Math.PI*Math.min(1,s.life/s.max));
  mctx.globalAlpha=s.a*k;mctx.fillStyle=s.c;
  mctx.fillRect(s.x,s.y,s.len,2);mctx.fillRect(s.x+s.len*.3,s.y-3,s.len*.3,1);
  mctx.globalAlpha=s.a*k*.35;mctx.fillRect(s.x,s.y-1,s.len,4)
 });
 mctx.globalAlpha=1;

 menuDust.forEach(d=>{d.y-=d.sp*dt;d.x+=Math.sin(menuT*.8+d.ph)*d.drift*dt;if(d.y<-12){d.y=MH+10;d.x=rand(0,MW)}if(d.x<-10)d.x=MW+10;if(d.x>MW+10)d.x=-10;mctx.globalAlpha=d.a*(.7+.3*Math.sin(menuT*2.2+d.ph));mctx.fillStyle=d.c;mctx.fillRect(d.x,d.y,d.s,d.s)});
 mctx.globalAlpha=1;
 mctx.fillStyle=menuVignette;mctx.fillRect(0,0,MW,MH);

 if(!reducedMotion){
  glitchNext-=dt;
  if(glitchLeft<=0&&glitchNext<=0){glitchLeft=rand(.06,.14);glitchNext=rand(2.6,5.4)}
  if(glitchLeft>0){
   glitchLeft-=dt;
   for(let i=0;i<3;i++){
    const sy=rand(0,MH-24),sh=rand(8,26),off=rand(-14,14);
    mctx.globalAlpha=.55;mctx.drawImage(menuBg,0,sy,MW,sh,off,sy,MW,sh);
    mctx.globalAlpha=.12;mctx.fillStyle=i%2?"#35e0ff":"#ff75b5";mctx.fillRect(0,sy,MW,sh)
   }
   mctx.globalAlpha=1
  }
 }
}

let menuRunning=false;
function startMenuLoop(){if(reducedMotion||menuRunning)return;menuRunning=true;menuLast=0;requestAnimationFrame(menuLoop)}
function stopMenuLoop(){menuRunning=false}
function menuLoop(now){
 if(!menuRunning)return;
 if(!menuLast)menuLast=now;
 const dt=Math.min((now-menuLast)/1000,.06);menuLast=now;
 if(screen.classList.contains("hidden")){menuRunning=false;return}
 menuT+=dt;drawMenuBg(dt);
 requestAnimationFrame(menuLoop);
}
drawMcAvatar();
if(reducedMotion){drawMenuBg(0)}else{startMenuLoop()}

/* ============================================================
   FUNDO AMBIENTE — camadas atrás do shell
   grade digital · partículas · pontos · linhas · props escolares
   · glitch discreto · parallax sutil
   ============================================================ */
(function initAmbient(){
 const canvas=document.getElementById("ambientCanvas");
 if(!canvas||!canvas.getContext)return;
 const actx=canvas.getContext("2d");
 if(!actx)return;
 let AW=0,AH=0,ADPR=1,ambT=0,ambLast=0,ambRunning=false;
 let parX=0,parY=0,tarX=0,tarY=0;
 const ARand=(a,b)=>a+Math.random()*(b-a);
  const AMB_COLORS=["#3fd0ef","#f5c542","#7aa8ff","#8ee9f8","#ff75b5","#e8f1ff"];
  const PARTS=[],LINES=[],PROPS=[],LOGOS=[];
  let glitchLeft=0,glitchNext=3;

 const SHAPES={
  pencil:["....####..","...######.","..###..###","..##....##","..#......#","..#......#","..#......#","..#######.","..#wwww#.","..#....#.."],
  notebook:[".########.",".#bbbbbb#.",".#bbbbbb#.",".#bbbbbb#.",".#bbbbbb#.",".#bbbbbb#.",".#bbbbbb#.",".#bbbbbb#.",".########."],
  sheet:[".########.",".#......#.",".#.####.#.",".#......#.",".#.####.#.",".#......#.",".#.####.#.",".#......#.",".########."],
  ruler:["##########","#555555555#".slice(0,10),"#555555555#".slice(0,10),"##########"]
 };

  function seedAmbient(){
   PARTS.length=0;LINES.length=0;PROPS.length=0;LOGOS.length=0;
   /* logo Barbosa flutuando no fundo — profundidades diferentes (parallax) */
   const logoSlots=[
    {x:.14,y:.68,depth:.45,size:180,alpha:.32,amp:10,ph:.4,drift:5},
    {x:.86,y:.22,depth:.3,size:150,alpha:.26,amp:12,ph:2.1,drift:-4},
    {x:.72,y:.82,depth:.2,size:120,alpha:.2,amp:8,ph:4.2,drift:3}
   ];
   for(let i=0;i<logoSlots.length;i++)LOGOS.push({...logoSlots[i]});
   const count=AW<700?28:48;
  for(let i=0;i<count;i++){
   PARTS.push({
    x:ARand(0,AW),y:ARand(0,AH),
    s:Math.random()<.6?2:3,
    sp:ARand(6,18),drift:ARand(-6,6),
    ph:ARand(0,6.28),
    depth:ARand(.25,1),
    c:AMB_COLORS[Math.floor(Math.random()*AMB_COLORS.length)],
    a:ARand(.12,.4)
   });
  }
  for(let i=0;i<4;i++){
   LINES.push({
    y:ARand(0,AH),len:ARand(60,180),
    sp:ARand(40,110)*(Math.random()<.5?-1:1),
    x:ARand(-200,AW),
    depth:ARand(.3,.9),
    c:Math.random()<.5?"#3fd0ef":"#f5c542",
    a:ARand(.05,.14)
   });
  }
  const kinds=["pencil","notebook","sheet","ruler"];
  const slots=[
   {x:.08,y:.22},{x:.9,y:.28},{x:.12,y:.74},{x:.86,y:.7},{x:.5,y:.08}
  ];
  for(let i=0;i<5;i++){
   PROPS.push({
    kind:kinds[i%kinds.length],
    x:slots[i].x,y:slots[i].y,
    s:ARand(1.6,2.4),
    ph:ARand(0,6.28),
    amp:ARand(4,10),
    sp:ARand(2,6)*(i%2?1:-1),
    depth:ARand(.3,.7),
    rot:ARand(-.4,.4),
    c:["#f5c542","#3fd0ef","#8ee9f8","#ff75b5","#7aa8ff"][i%5]
   });
  }
 }

 function resizeAmbient(){
  ADPR=Math.min(window.devicePixelRatio||1,1.5);
  AW=window.innerWidth;AH=window.innerHeight;
  canvas.width=Math.max(1,Math.round(AW*ADPR));
  canvas.height=Math.max(1,Math.round(AH*ADPR));
  actx.setTransform(ADPR,0,0,ADPR,0,0);
  seedAmbient();
  drawAmbient(0,true);
 }

 function drawShape(shape,x,y,s,color,alpha){
  actx.save();actx.globalAlpha=alpha;actx.fillStyle=color;
  for(let r=0;r<shape.length;r++)
   for(let c=0;c<shape[r].length;c++)
    if(shape[r][c]!=="."&&shape[r][c]!==" ")
     actx.fillRect(Math.round(x+c*s),Math.round(y+r*s),Math.ceil(s),Math.ceil(s));
  actx.restore();
 }

 function drawAmbient(dt,single){
  if(!AW||!AH)return;
  ambT+=dt;
  parX+=(tarX-parX)*Math.min(1,dt*3);
  parY+=(tarY-parY)*Math.min(1,dt*3);

  actx.clearRect(0,0,AW,AH);

  /* camada 2 — grade digital animada (duas profundidades) */
  const gFar=72,gNear=40;
  const oxFar=(ambT*3)%gFar+parX*.25,oyFar=(ambT*2)%gFar+parY*.25;
  actx.strokeStyle="rgba(30,58,92,.55)";actx.lineWidth=1;
  actx.beginPath();
  for(let x=-gFar+oxFar;x<=AW+gFar;x+=gFar){actx.moveTo(x,0);actx.lineTo(x,AH)}
  for(let y=-gFar+oyFar;y<=AH+gFar;y+=gFar){actx.moveTo(0,y);actx.lineTo(AW,y)}
  actx.stroke();
  const oxNear=(ambT*6)%gNear+parX*.5,oyNear=(ambT*4)%gNear+parY*.5;
  actx.strokeStyle="rgba(42,90,128,.35)";actx.lineWidth=1;
  actx.beginPath();
  for(let x=-gNear+oxNear;x<=AW+gNear;x+=gNear){actx.moveTo(x,0);actx.lineTo(x,AH)}
  for(let y=-gNear+oyNear;y<=AH+gNear;y+=gNear){actx.moveTo(0,y);actx.lineTo(AW,y)}
  actx.stroke();
  /* nós luminosos nos cruzamentos da grade próxima */
  actx.fillStyle="rgba(63,208,239,.16)";
  for(let x=-gNear+oxNear;x<=AW+gNear;x+=gNear*2)
   for(let y=-gNear+oyNear;y<=AH+gNear;y+=gNear*2)
    actx.fillRect(Math.round(x)-1,Math.round(y)-1,2,2);

  /* camada 3 — linhas digitais discretas */
  for(let i=0;i<LINES.length;i++){
   let L=LINES[i];
   if(!single){
    L.x+=L.sp*dt;
    if(L.sp>0&&L.x>AW+40)L.x=-L.len-40;
    if(L.sp<0&&L.x<-L.len-40)L.x=AW+40;
   }
   let yy=L.y+parY*L.depth*.4;
   actx.globalAlpha=L.a;
   actx.fillStyle=L.c;
   actx.fillRect(Math.round(L.x),Math.round(yy),L.len,1);
   actx.globalAlpha=L.a*.4;
   actx.fillRect(Math.round(L.x+L.len*.2),Math.round(yy+2),L.len*.5,1);
  }
  actx.globalAlpha=1;

  /* camada 3 — pontos luminosos em profundidade */
  for(let i=0;i<PARTS.length;i++){
   let p=PARTS[i];
   if(!single&&!reducedMotion){
    p.y-=p.sp*dt;
    p.x+=Math.sin(ambT*.7+p.ph)*p.drift*dt;
    if(p.y<-8){p.y=AH+6;p.x=ARand(0,AW)}
    if(p.x<-8)p.x=AW+6;if(p.x>AW+8)p.x=-6;
   }
   let a=p.a*(.7+.3*Math.sin(ambT*1.8+p.ph));
   actx.globalAlpha=a;
   actx.fillStyle=p.c;
   let px=Math.round(p.x+parX*p.depth*.6),py=Math.round(p.y+parY*p.depth*.6);
   actx.fillRect(px,py,p.s,p.s);
   if(p.s>2){
    actx.globalAlpha=a*.25;
    actx.fillRect(px-1,py-1,p.s+2,p.s+2);
   }
  }
  actx.globalAlpha=1;

  /* camada 4 — elementos escolares pixelados (parallax) */
  for(let i=0;i<PROPS.length;i++){
   let pr=PROPS[i];
   if(!single&&!reducedMotion){
    pr.x+=pr.sp*dt*.001;
    if(pr.x>1.05)pr.x=-.05;
    if(pr.x<-.05)pr.x=1.05;
   }
   let bob=Math.sin(ambT*.5+pr.ph)*pr.amp;
   let x=pr.x*AW+parX*pr.depth;
   let y=pr.y*AH+bob+parY*pr.depth;
   actx.save();
   actx.translate(x,y);
   actx.rotate(single?pr.rot:pr.rot+Math.sin(ambT*.3+pr.ph)*.05);
   let s=pr.s;
   if(pr.kind==="pencil"){
    drawShape(SHAPES.pencil,-5*s,-4*s,s,pr.c,.5);
    drawShape(SHAPES.pencil,-5*s,-4*s,s*.55,"#8ee9f8",.35);
   }else if(pr.kind==="notebook"){
    drawShape(SHAPES.notebook,-5*s,-4*s,s,"#1a3054",.55);
    drawShape(SHAPES.notebook,-5*s,-4*s,s,pr.c,.4);
   }else if(pr.kind==="sheet"){
    drawShape(SHAPES.sheet,-5*s,-4*s,s,"#e8f1ff",.2);
    drawShape(SHAPES.sheet,-5*s,-4*s,s,pr.c,.35);
   }else{
    actx.globalAlpha=.4;
    actx.fillStyle=pr.c;
    actx.fillRect(Math.round(-6*s),Math.round(-1.5*s),Math.round(12*s),Math.max(2,Math.round(3*s)));
    actx.globalAlpha=.55;
    for(let k=0;k<5;k++)actx.fillRect(Math.round((-5+k*2.4)*s),Math.round(-1.5*s),1,Math.max(2,Math.round(3*s)));
   }
   actx.restore();
  }
  actx.globalAlpha=1;

  /* camada 3,5 — logo Barbosa decorativo no fundo (parallax + flutuação) */
  if(typeof barbosaReady!=="undefined"&&barbosaReady&&typeof barbosaImg!=="undefined"&&barbosaImg.naturalWidth){
   for(let i=0;i<LOGOS.length;i++){
    let lg=LOGOS[i];
    if(!single&&!reducedMotion){
     lg.x+=lg.drift*dt*.0008;
     if(lg.x>1.08)lg.x=-.08;
     if(lg.x<-.08)lg.x=1.08;
    }
    let bob=Math.sin(ambT*.45+lg.ph)*lg.amp;
    let x=lg.x*AW+parX*lg.depth;
    let y=lg.y*AH+bob+parY*lg.depth;
    let size=lg.size*(AW<700?.72:1);
    let pulse=.85+.15*Math.sin(ambT*.7+lg.ph);
    actx.globalAlpha=lg.alpha*pulse;
    actx.imageSmoothingEnabled=true;
    actx.drawImage(barbosaImg,x-size/2,y-size/2,size,size);
   }
   actx.globalAlpha=1;
  }

  /* camada 4 — glitch discreto e raro */
  if(!single&&!reducedMotion){
   glitchNext-=dt;
   if(glitchLeft<=0&&glitchNext<=0){glitchLeft=ARand(.05,.12);glitchNext=ARand(3.5,7)}
   if(glitchLeft>0){
    glitchLeft-=dt;
    for(let i=0;i<2;i++){
     let sy=ARand(0,AH-10),sh=ARand(2,5);
     actx.globalAlpha=.1;
     actx.fillStyle=i%2?"#3fd0ef":"#ff75b5";
     actx.fillRect(ARand(-8,8),sy,AW,sh);
    }
    actx.globalAlpha=1;
   }
  }
 }

 function ambientLoop(now){
  if(!ambRunning)return;
  if(!ambLast)ambLast=now;
  const dt=Math.min((now-ambLast)/1000,.06);
  ambLast=now;
  drawAmbient(dt,false);
  requestAnimationFrame(ambientLoop);
 }

 function startAmbient(){
  if(reducedMotion||ambRunning)return;
  ambRunning=true;ambLast=0;requestAnimationFrame(ambientLoop);
 }

  window.addEventListener("barbosa-ready",()=>drawAmbient(0,true));
  window.addEventListener("resize",()=>{clearTimeout(resizeAmbient.t);resizeAmbient.t=setTimeout(resizeAmbient,150)},{passive:true});
 window.addEventListener("pointermove",e=>{
  tarX=(e.clientX/Math.max(1,window.innerWidth)-.5)*18;
  tarY=(e.clientY/Math.max(1,window.innerHeight)-.5)*12;
 },{passive:true});
 document.addEventListener("visibilitychange",()=>{
  if(document.hidden)ambRunning=false;
  else startAmbient();
 });

 resizeAmbient();
 if(!reducedMotion)startAmbient();
})();
