/* AMV Conectar — Cobrinha 404, sem bibliotecas ou conexões externas. */
(() => {
  "use strict";
  const game = document.getElementById("amv-snake");
  if (!game) return;
  const canvas = game.querySelector("#amv-snake-canvas");
  const ctx = canvas && canvas.getContext("2d");
  const playButton = game.querySelector("[data-snake-play]");
  const pauseButton = game.querySelector("[data-snake-pause]");
  const resetButton = game.querySelector("[data-snake-reset]");
  const scoreLabel = game.querySelector("[data-snake-score]");
  const bestLabel = game.querySelector("[data-snake-best]");
  const status = game.querySelector("[data-snake-status]");
  const overlay = game.querySelector("[data-snake-overlay]");
  const overlayTitle = game.querySelector("[data-snake-overlay-title]");
  const overlayText = game.querySelector("[data-snake-overlay-text]");
  if (!ctx || !playButton || !pauseButton || !resetButton || !scoreLabel || !bestLabel || !status || !overlay || !overlayTitle || !overlayText) return;

  const COLS = 18, ROWS = 18, CELL = 24, SIDE = CELL * COLS;
  const ARROWS = {
    ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1},
    ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0},
    w: {x:0,y:-1}, s: {x:0,y:1},
    a: {x:-1,y:0}, d: {x:1,y:0}
  };
  const SAVE_KEY = "amv-snake-record-session";
  let best = 0;
  try { best = Math.max(0,Number(sessionStorage.getItem(SAVE_KEY)) || 0); } catch (_) {}
  let snake, food, direction, queuedDirection, score, state = "idle", timer = null;
  let countdownTimer = null;
  let countdownValue = 3;
  let turnQueued = false;
  let pointerStart = null;

  const pixelRatio = Math.min(2,Math.max(1,window.devicePixelRatio || 1));
  canvas.width = Math.round(SIDE * pixelRatio);
  canvas.height = Math.round(SIDE * pixelRatio);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);

  function rnd(max) {return Math.floor(Math.random() * max);}
  function equal(a,b) {return a.x === b.x && a.y === b.y;}
  function setStatus(message) { status.textContent = message; }
  function setOverlay(title,text){
    overlay.hidden = false;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
  }
  function hideOverlay() {overlay.hidden = true;}
  function updateControls(){
    scoreLabel.textContent = String(score);
    bestLabel.textContent = String(best);
    playButton.textContent = state === "countdown" ? "Preparando..." :
      state === "running" ? "Jogando..." :
      state === "paused" ? "Continuar" :
      state === "over" || state === "won" ? "Jogar de novo" : "Jogar";
    playButton.disabled = state === "running" || state === "countdown";
    pauseButton.disabled = state === "idle" || state === "countdown" || state === "over" || state === "won";
    pauseButton.textContent = state === "paused" ? "Retomar" : "Pausar";
  }
  function saveRecord(){
    if (score <= best) return;
    best = score;
    try {sessionStorage.setItem(SAVE_KEY,String(best));} catch (_) {}
  }
  function placeFood(){
    const empty = [];
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const pos = {x,y};
      if(!snake.some(segment=>equal(segment,pos)))empty.push(pos);
    }
    food = empty.length ? empty[rnd(empty.length)] : null;
    return !!food;
  }
  function resetGame(){
    clearTimeout(timer);
    clearTimeout(countdownTimer);
    timer = null;
    countdownTimer = null;
    snake = [{x:8,y:9},{x:7,y:9},{x:6,y:9}];
    direction = {x:1,y:0};
    queuedDirection = direction;
    turnQueued = false;
    score = 0;
    placeFood();
    state = "idle";
    overlay.classList.remove("amv-snake-overlay--countdown");
    setOverlay("Pronto para jogar?","Coma os pontos laranja, cresça e evite bater!");
    setStatus("Use Jogar, as setas ou WASD para começar.");
    updateControls();
    render();
  }
  function roundRect(x,y,w,h,r,color){
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    ctx.fill();
  }
  function render(){
    ctx.clearRect(0,0,SIDE,SIDE);
    ctx.fillStyle="#071b32";
    ctx.fillRect(0,0,SIDE,SIDE);
    ctx.strokeStyle="rgba(127,177,211,.075)";
    ctx.lineWidth=1;
    for(let i=0;i<=COLS;i++){
      const v=i*CELL+.5;
      ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,SIDE);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,v);ctx.lineTo(SIDE,v);ctx.stroke();
    }
    if(food){
      const x=food.x*CELL+CELL/2, y=food.y*CELL+CELL/2;
      ctx.save();
      ctx.shadowColor="#ff943f";ctx.shadowBlur=17;
      ctx.fillStyle="#ff9f53";
      ctx.beginPath();ctx.arc(x,y,CELL*.30,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle="#ffe0ae";
      ctx.beginPath();ctx.arc(x-2,y-2,CELL*.085,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    snake.forEach((part,index)=>{
      const x=part.x*CELL+2.3,y=part.y*CELL+2.3;
      roundRect(x,y,CELL-4.6,CELL-4.6,5.2,index===0?"#f79a4c":
        index%2===0?"#469fc4":"#56b5d6");
      if(index===0){
        const cx=part.x*CELL+CELL/2,cy=part.y*CELL+CELL/2;
        // Olhos acompanham a direção e indicam a cabeça.
        const crossX=direction.y*4,crossY=direction.x*4;
        const forwardX=direction.x*4,forwardY=direction.y*4;
        ctx.fillStyle="#08192c";
        for(const sign of [-1,1]){
          ctx.beginPath();
          ctx.arc(cx+forwardX+crossX*sign,cy+forwardY+crossY*sign,2.05,0,Math.PI*2);
          ctx.fill();
        }
      }
    });
  }
  function scheduleTick(){
    clearTimeout(timer);
    if(state!=="running")return;
    // 260 ms no início (em vez de 155 ms); acelera 10 ms a cada 30 pontos.
    // A velocidade mínima mantém o jogo responsivo sem ficar impossível.
    const delay=Math.max(110,260-Math.floor(score/30)*10);
    timer=window.setTimeout(tick,delay);
  }
  function lose(){
    clearTimeout(timer);timer=null;
    state="over";
    overlay.classList.remove("amv-snake-overlay--countdown");
    saveRecord();
    setOverlay("Fim de jogo!", "Você fez "+score+" pontos. Que tal tentar novamente?");
    setStatus("Fim de jogo! Pontuação: "+score+". Pressione Jogar de novo.");
    updateControls();render();
  }
  function tick(){
    if(state!=="running")return;
    direction=queuedDirection;
    turnQueued=false;
    const next={x:snake[0].x+direction.x,y:snake[0].y+direction.y};
    const eating=food && equal(next,food);
    const occupied=eating?snake:snake.slice(0,-1);
    if(next.x<0 || next.x>=COLS || next.y<0 || next.y>=ROWS || occupied.some(part=>equal(part,next))){
      lose();return;
    }
    snake.unshift(next);
    if(eating){
      score+=10;
      saveRecord();
      if(!placeFood()){
        state="won";
        clearTimeout(timer);timer=null;
        setOverlay("Você venceu!","Tabuleiro completo! Uma conexão lendária.");
        setStatus("Parabéns! Você preencheu o tabuleiro inteiro.");
        updateControls();render();return;
      }
      updateControls();
    }else snake.pop();
    render();
    scheduleTick();
  }
  function run(){
    state="running";
    overlay.classList.remove("amv-snake-overlay--countdown");
    hideOverlay();
    setStatus("Partida em andamento. Boa sorte!");
    updateControls();
    canvas.focus({preventScroll:true});
    scheduleTick();
  }
  function countdown(){
    state="countdown";
    countdownValue=3;
    overlay.classList.add("amv-snake-overlay--countdown");
    setOverlay(String(countdownValue),"Prepare-se! A cobrinha só começa depois da contagem.");
    setStatus("Preparando a partida: 3, 2, 1...");
    updateControls();
    canvas.focus({preventScroll:true});
    function next(){
      if(state!=="countdown")return;
      countdownValue--;
      if(countdownValue===0){ countdownTimer=null; run(); return; }
      overlayTitle.textContent=String(countdownValue);
      countdownTimer=window.setTimeout(next,1000);
    }
    countdownTimer=window.setTimeout(next,1000);
  }
  function start(){
    if(state==="running" || state==="countdown")return;
    if(state==="over" || state==="won")resetGame();
    if(state==="paused"){run();return;}
    countdown();
  }
  function pause(){
    if(state==="running"){
      clearTimeout(timer);timer=null;
      state="paused";
      setOverlay("Partida pausada","Pressione Continuar para voltar ao jogo.");
      setStatus("Jogo pausado. Sua pontuação está segura.");
      updateControls();
    }else if(state==="paused")start();
  }
  function steer(dir){
    if(!dir)return;
    if(state==="over"||state==="won")return;
    if(turnQueued && (state==="running" || state==="countdown"))return;
    if(dir.x === -direction.x && dir.y === -direction.y)return;
    queuedDirection={x:dir.x,y:dir.y};
    turnQueued=true;
    if(state==="idle")start();
  }
  playButton.addEventListener("click",start);
  pauseButton.addEventListener("click",pause);
  resetButton.addEventListener("click",()=>{resetGame();start();});
  game.querySelectorAll("[data-snake-dir]").forEach(button=>{
    button.addEventListener("click",()=>{
      const key = "Arrow"+button.dataset.snakeDir[0].toUpperCase()+button.dataset.snakeDir.slice(1);
      steer(ARROWS[key]);
      canvas.focus({preventScroll:true});
    });
  });
  document.addEventListener("keydown",event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const target=event.target;
    if(target && (target.matches("input,textarea,select,[contenteditable]")))return;
    const gameFocused=game.contains(document.activeElement);
    if(!gameFocused && state!=="running" && state!=="countdown")return;
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(ARROWS[key]){
      event.preventDefault();
      steer(ARROWS[key]);
    }else if(event.code==="Space" && (gameFocused || state==="running")){
      if(target&&target.tagName==="BUTTON")return;
      event.preventDefault();
      if(state==="idle" || state==="over" || state==="won")start();
      else pause();
    }
  });
  canvas.addEventListener("pointerdown",event=>{
    if(event.pointerType!=="touch" && event.pointerType!=="pen")return;
    pointerStart={x:event.clientX,y:event.clientY};
  });
  canvas.addEventListener("pointerup",event=>{
    if(!pointerStart)return;
    const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;
    pointerStart=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;
    steer(Math.abs(dx)>Math.abs(dy)?
      {x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)});
  });
  canvas.addEventListener("pointercancel",()=>{pointerStart=null;});
  function suspendHidden(){
    if(state==="running")pause();
    if(state==="countdown")resetGame(); // Não deixa o jogo começar sozinho em segundo plano.
  }
  document.addEventListener("visibilitychange",()=>{if(document.hidden)suspendHidden();});
  window.addEventListener("blur",suspendHidden);
  resetGame();
})();
