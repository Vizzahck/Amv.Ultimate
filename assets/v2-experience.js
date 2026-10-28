/* AMV Ultimate V2 — transições, busca Ctrl+K, leitura e campo de conexões.
   Nenhuma dependência externa. Mantém links/FAQ/formulários nativos. */
(() => {
  "use strict";
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer:fine)");
  const baseDir = new URL("index.html",document.baseURI).pathname.replace(/index\.html$/,"");
  const pageItems = [
    ["Início","index.html#inicio","Página inicial e apresentação da AMV","Página","⌂"],
    ["Quem somos","quem-somos.html","Conheça a agência experimental do SENAC Pinheiro","Institucional","✦"],
    ["Missão","missao.html","Propósito e missão da AMV Conectar","Institucional","✧"],
    ["Visão","visao.html","Objetivos e visão da agência","Institucional","✧"],
    ["Valores","valores.html","Ética, colaboração, inovação e criatividade","Institucional","✧"],
    ["Projeto Integrador","projeto-integrador.html","Teoria e prática no curso de Marketing e Vendas","Institucional","✦"],
    ["Serviços","index.html#servicos","Estratégia, marketing digital, branding e campanhas","Página","◇"],
    ["Portfólio e projetos","projetos.html","Vitrine conceitual e processos criativos","Página","◇"],
    ["Equipe","equipe.html","Conheça as áreas e a organização da equipe AMV","Página","♧"],
    ["Diferenciais","index.html#diferenciais","Estratégia, criatividade e conexão","Página","✦"],
    ["Contato","index.html#contato","WhatsApp, e-mail, localização e formulário","Contato","✉"],
    ["Privacidade e Cookies","privacidade.html","Saiba como dados e preferências são tratados","Informações","◈"],
    ["Estratégia de Marketing","index.html#servicos","Planejamento e direcionamento para marcas","Serviço","◇"],
    ["Marketing Digital","index.html#servicos","Presença digital e alcance de público","Serviço","◇"],
    ["Branding e identidade visual","index.html#servicos","Identidade e posicionamento de marca","Serviço","◇"],
    ["Conteúdo e Comunicação","index.html#servicos","Conteúdo para fortalecer relacionamentos","Serviço","◇"],
    ["Redes Sociais","index.html#servicos","Planejamento de conteúdo e redes sociais","Serviço","◇"],
    ["Campanhas","index.html#servicos","Planejamento e execução de campanhas","Serviço","◇"]
  ];
  const normalize = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  let leaving = false;

  /* A. Navegação entre páginas internas: não interceptar âncoras locais nem links externos. */
  function useRouteAnimation(link,event) {
    if(leaving || reduce.matches || root.classList.contains("amv-intro-pending") || root.classList.contains("amv-intro-leaving"))return false;
    if(!link || link.hasAttribute("download") || link.target && link.target !== "_self" || event.defaultPrevented)return false;
    if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return false;
    if(link.closest("[contenteditable]"))return false;
    let url;
    try {url=new URL(link.href,location.href);}catch(_){return false;}
    if(url.origin!==location.origin || !url.pathname.startsWith(baseDir))return false;
    if(!(/\.html?$/i.test(url.pathname)||url.pathname.endsWith("/")))return false;
    if(url.pathname===location.pathname && url.search===location.search){
      // Âncoras da própria página devem rolar normalmente.
      if(url.hash || !url.hash && !location.hash)return false;
    }
    leaving=true;
    event.preventDefault();
    try {sessionStorage.setItem("amv-route-next","1");}catch(_){}
    root.classList.add("amv-route-exiting");
    window.setTimeout(() => {location.assign(url.href);},250);
    return true;
  }
  document.addEventListener("click",event=>{
    const link=event.target.closest && event.target.closest("a[href]");
    if(link)useRouteAnimation(link,event);
  });
  window.addEventListener("pageshow",()=>{
    leaving=false;
    root.classList.remove("amv-route-exiting");
  });
  if(root.classList.contains("amv-route-entering")){
    window.setTimeout(()=>root.classList.remove("amv-route-entering"),500);
  }

  /* B. Busca local instantânea. Os resultados são páginas reais, sem envio de dados. */
  let previousFocus=null, results=[], selected=0, dialog=null, searchInput=null, resultList=null;
  const backdrop=document.createElement("div");
  backdrop.id="amv-search-backdrop";
  backdrop.className="amv-search-backdrop";
  backdrop.hidden=true;
  backdrop.innerHTML='<section class="amv-search-dialog" role="dialog" aria-modal="true" aria-labelledby="amv-search-title"><div class="amv-search-heading"><h2 id="amv-search-title">Encontre na AMV</h2><button type="button" class="amv-search-close" data-amv-search-close aria-label="Fechar busca">×</button></div><div class="amv-search-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input id="amv-search-input" class="amv-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Buscar páginas, serviços, informações..." aria-label="Digite para buscar no site"/></div><p class="amv-search-caption" id="amv-search-count">Sugestões de navegação</p><div class="amv-search-results" id="amv-search-results" aria-label="Resultados da busca"></div><div class="amv-search-help"><span><kbd>↑</kbd> <kbd>↓</kbd> selecionar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div></section>';
  document.body.appendChild(backdrop);
  dialog=backdrop.querySelector(".amv-search-dialog");
  searchInput=backdrop.querySelector("#amv-search-input");
  resultList=backdrop.querySelector("#amv-search-results");

  function renderResults() {
    const query=normalize(searchInput.value.trim());
    const words=query.split(/\s+/).filter(Boolean);
    results=pageItems.filter(item=>{
      const hay=normalize(item[0]+" "+item[2]+" "+item[3]);
      return words.every(word=>hay.includes(word));
    }).slice(0,9);
    selected=0;
    const caption=backdrop.querySelector("#amv-search-count");
    caption.textContent=query ? results.length+" resultado(s) encontrado(s)" : "Sugestões de navegação";
    resultList.replaceChildren();
    if(results.length===0){
      const empty=document.createElement("p");
      empty.className="amv-search-empty";
      empty.textContent="Nenhum resultado encontrado. Experimente outra palavra.";
      resultList.append(empty);
      return;
    }
    results.forEach((item,i)=>{
      const link=document.createElement("a");
      link.className="amv-search-result";
      link.href=item[1];
      link.dataset.resultIndex=String(i);
      link.setAttribute("aria-selected",i===0?"true":"false");
      const glyph=document.createElement("span");
      glyph.className="amv-search-result-icon";
      glyph.setAttribute("aria-hidden","true");
      glyph.textContent=item[4];
      const copy=document.createElement("span");
      copy.className="amv-search-result-copy";
      const name=document.createElement("strong"); name.textContent=item[0];
      const desc=document.createElement("small");desc.textContent=item[2];
      copy.append(name,desc);
      const arrow=document.createElement("span");
      arrow.className="amv-search-result-arrow";
      arrow.setAttribute("aria-hidden","true");
      arrow.textContent="↗";
      link.append(glyph,copy,arrow);
      link.addEventListener("mousemove",()=>{
        if(selected!==i){selected=i;syncSelected();}
      });
      resultList.append(link);
    });
  }
  function syncSelected(){
    resultList.querySelectorAll("a[data-result-index]").forEach((a,i)=>{
      a.setAttribute("aria-selected",i===selected?"true":"false");
    });
  }
  function openSearch(){
    if(root.classList.contains("amv-intro-pending"))return;
    previousFocus=document.activeElement;
    backdrop.hidden=false;
    root.classList.add("amv-search-open");
    searchInput.value="";
    renderResults();
    window.requestAnimationFrame(()=>searchInput.focus({preventScroll:true}));
  }
  function closeSearch(){
    if(backdrop.hidden)return;
    backdrop.hidden=true;
    root.classList.remove("amv-search-open");
    if(previousFocus && previousFocus.isConnected && typeof previousFocus.focus==="function"){
      previousFocus.focus({preventScroll:true});
    }
  }
  const header=document.querySelector(".amv-smart-header");
  if(header){
    const controls=header.querySelector('nav[aria-label="Navegação principal"] + div');
    if(controls){
      const button=document.createElement("button");
      button.type="button";button.className="amv-search-launch";
      button.setAttribute("aria-label","Buscar no site (Ctrl + K)");
      button.setAttribute("aria-keyshortcuts","Control+K Meta+K");
      button.title="Buscar no site · Ctrl + K";
      button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.8"/><path d="m15.8 15.8 5.1 5.1"/></svg>';
      controls.prepend(button);
      button.addEventListener("click",openSearch);
    }
  }
  // Em páginas com cabeçalho simplificado a busca ainda funciona pelo teclado.
  document.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==="k"){
      event.preventDefault();
      if(backdrop.hidden)openSearch();else closeSearch();
      return;
    }
    if(backdrop.hidden)return;
    if(event.key==="Escape"){event.preventDefault();closeSearch();return;}
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      event.preventDefault();
      if(results.length){selected=(selected+(event.key==="ArrowDown"?1:-1)+results.length)%results.length;syncSelected();const current=resultList.querySelector('[data-result-index="'+selected+'"]');if(current)current.scrollIntoView({block:"nearest"});}
      return;
    }
    if(event.key==="Enter"&&document.activeElement===searchInput){
      event.preventDefault();
      const link=resultList.querySelector('[data-result-index="'+selected+'"]');
      if(link)link.click();
      return;
    }
    if(event.key==="Tab"){
      const focusables=Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]'));
      if(focusables.length){
        const current=focusables.indexOf(document.activeElement);
        if(event.shiftKey && current===0){event.preventDefault();focusables[focusables.length-1].focus();}
        else if(!event.shiftKey && current===focusables.length-1){event.preventDefault();focusables[0].focus();}
      }
    }
  },true);
  backdrop.querySelector("[data-amv-search-close]").addEventListener("click",closeSearch);
  backdrop.addEventListener("click",event=>{if(event.target===backdrop)closeSearch();});
  searchInput.addEventListener("input",renderResults);
  resultList.addEventListener("click",event=>{
    if(event.target.closest && event.target.closest("a[href]"))closeSearch();
  });

  /* C. Progresso da página e botão que não compete com o assistente. */
  const progress=document.createElement("div");
  progress.className="amv-reading-track";
  progress.setAttribute("role","progressbar");
  progress.setAttribute("aria-label","Progresso de leitura da página");
  progress.setAttribute("aria-valuemin","0");
  progress.setAttribute("aria-valuemax","100");
  const fill=document.createElement("div");
  fill.className="amv-reading-fill";
  fill.style.transform="scaleX(0)";
  progress.append(fill);
  document.body.append(progress);
  const backTop=document.createElement("button");
  backTop.type="button";
  backTop.className="amv-back-top";
  backTop.dataset.visible="false";
  backTop.setAttribute("aria-label","Voltar ao início da página");
  backTop.title="Voltar ao topo";
  backTop.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 14 7-7 7 7"/><path d="M12 7v12"/></svg>';
  document.body.append(backTop);
  backTop.addEventListener("click",()=>window.scrollTo({top:0,behavior:reduce.matches?"instant":"smooth"}));
  let scheduled=false;
  function updateScroll(){
    scheduled=false;
    const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    const ratio=max>0?Math.max(0,Math.min(1,window.scrollY/max)):0;
    fill.style.transform="scaleX("+ratio.toFixed(4)+")";
    progress.setAttribute("aria-valuenow",String(Math.round(ratio*100)));
    backTop.dataset.visible=window.scrollY>420?"true":"false";
  }
  function scrollEvent(){
    if(scheduled)return;
    scheduled=true;
    window.requestAnimationFrame(updateScroll);
  }
  window.addEventListener("scroll",scrollEvent,{passive:true});
  window.addEventListener("resize",scrollEvent,{passive:true});
  window.addEventListener("load",scrollEvent,{once:true});
  updateScroll();

  /* D. Rede digital discreta: canvas só no hero/contato, cursor preciso e movimento permitido. */
  if(!reduce.matches && finePointer.matches && document.querySelector(".v2-home")){
    const targets=[document.querySelector("#inicio"),document.querySelector("#contato")].filter(Boolean);
    for(const section of targets){
      const canvas=document.createElement("canvas");
      canvas.className="amv-cursor-field";
      canvas.setAttribute("aria-hidden","true");
      canvas.style.pointerEvents="none";
      section.append(canvas);
      const context=canvas.getContext("2d",{alpha:true});
      if(!context)continue;
      let width=0,height=0,pxRatio=1,active=false,visible=true,frame=0,lastDraw=0,until=0;
      let mouse={x:-10000,y:-10000};
      const points=Array.from({length:20},(_,i)=>({
        nx:((i*47+19)%101)/101,ny:((i*31+7)%93)/93,
        shift:(i*29)%41
      }));
      function resize(){
        width=section.clientWidth;height=section.offsetHeight;
        pxRatio=Math.min(window.devicePixelRatio||1,1.6);
        if(width<=0||height<=0)return;
        canvas.width=Math.round(width*pxRatio);
        canvas.height=Math.round(height*pxRatio);
        context.setTransform(pxRatio,0,0,pxRatio,0,0);
        context.clearRect(0,0,width,height);
      }
      function paint(now){
        frame=0;
        if(!active||!visible||now>until||!width||!height)return;
        if(now-lastDraw<28){frame=requestAnimationFrame(paint);return;}
        lastDraw=now;
        context.clearRect(0,0,width,height);
        const nodes=points.map(p=>({
          x:width*p.nx+Math.sin(now*.00036+p.shift)*8,
          y:height*p.ny+Math.cos(now*.00028+p.shift)*8
        }));
        nodes.forEach((p,i)=>{
          const d=Math.hypot(p.x-mouse.x,p.y-mouse.y);
          if(d<185){
            const strength=(1-d/185);
            context.beginPath();context.moveTo(p.x,p.y);context.lineTo(mouse.x,mouse.y);
            context.lineWidth=.75;context.strokeStyle="rgba(242,153,77,"+(strength*.37).toFixed(3)+")";context.stroke();
          }
          for(let j=i+1;j<nodes.length;j++){
            const other=nodes[j],separation=Math.hypot(p.x-other.x,p.y-other.y);
            if(separation<118){
              context.beginPath();context.moveTo(p.x,p.y);context.lineTo(other.x,other.y);
              context.lineWidth=.65;context.strokeStyle="rgba(88,158,206,"+((1-separation/118)*.15).toFixed(3)+")";context.stroke();
            }
          }
          context.beginPath();context.arc(p.x,p.y,d<150?2:1.3,0,Math.PI*2);
          context.fillStyle=d<150?"rgba(248,161,88,.66)":"rgba(108,182,226,.32)";
          context.fill();
        });
        frame=requestAnimationFrame(paint);
      }
      function awaken(event){
        const rect=section.getBoundingClientRect();
        mouse={x:event.clientX-rect.left,y:event.clientY-rect.top};
        active=true;until=performance.now()+900;
        if(!frame)frame=requestAnimationFrame(paint);
      }
      function stop(){active=false;mouse={x:-10000,y:-10000};if(frame){cancelAnimationFrame(frame);frame=0;}context.clearRect(0,0,width,height);}
      resize();
      if("ResizeObserver" in window) new ResizeObserver(resize).observe(section);
      else window.addEventListener("resize",resize,{passive:true});
      section.addEventListener("pointermove",awaken,{passive:true});
      section.addEventListener("pointerleave",stop,{passive:true});
      document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});
      if("IntersectionObserver" in window){
        new IntersectionObserver(entries=>{
          visible=entries[0].isIntersecting;
          if(!visible)stop();
        },{threshold:0}).observe(section);
      }
    }
  }
})();
