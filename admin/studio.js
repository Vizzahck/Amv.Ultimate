/* Studio AMV: editor visual e publicação autenticada pela API GitHub.
 * O token é mantido apenas em memória, sem cookies, localStorage ou backend público.
 */
(() => {
  "use strict";
  const REPO="Vizzahck/Amv.Ultimate", BRANCH="main";
  const API="https://api.github.com/repos/"+REPO;
  const $=id=>document.getElementById(id);
  const status=$("status");
  const login=$("login"), workspace=$("workspace");
  const frame=$("page-frame"), select=$("page-select");
  const textField=$("text-value"), imageAlt=$("image-alt");
  const projectList=$("project-list");
  const imagesPending=new Map();
  let token="",pages={version:1,pages:{}},portfolio={version:1,projects:[]},team={version:1,areas:[]},brands={version:1,slots:{}},links={version:1,...structuredClone(window.AMVLinks.defaults)};
  let activePage="index.html",selected=null,projectId=null,teamMemberId=null,teamAreaId=null,dirtyPages=false,dirtyProjects=false,dirtyTeam=false,dirtyBrands=false,dirtyLinks=false,busy=false,currentMode="pages";
  let brandSlot="header",brandVariant="light",gridOn=false,snapOn=false,gridSize=20,draggingBrand=null;
  let lastSavedFiles=[];
  const CMS=window.AMVCMS;
  const BRAND=window.AMVBrand;
  const LINKS=window.AMVLinks;
  if(!CMS||!BRAND||!LINKS){setStatus("Editor indisponível: recarregue esta página.","error");return;}

  function setStatus(message,type="info"){
    status.textContent=message;status.dataset.type=type;
  }
  function hasChanges(){return dirtyPages||dirtyProjects||dirtyTeam||dirtyBrands||dirtyLinks||imagesPending.size>0;}
  function updatePublish(){
    const button=$("publish");
    button.disabled=busy||!hasChanges();
    button.textContent=busy?"Publicando...":hasChanges()?"Publicar alterações ↗":"Sem alterações";
  }
  function changed(type){
    if(type==="projects")dirtyProjects=true;
    else if(type==="team")dirtyTeam=true;
    else if(type==="brand")dirtyBrands=true;
    else if(type==="links")dirtyLinks=true;
    else dirtyPages=true;
    updatePublish();
    $("publish-check").hidden=true;
    setStatus("Alterações não publicadas.","info");
  }
  async function api(path,options={}){
    if(!token)throw new Error("Conecte-se ao GitHub primeiro.");
    const response=await fetch(API+path,{
      ...options,
      headers:{
        "Accept":"application/vnd.github+json",
        "Authorization":"Bearer "+token,
        "X-GitHub-Api-Version":"2022-11-28",
        ...(options.body?{"Content-Type":"application/json"}:{}),
        ...(options.headers||{})
      },
      cache:"no-store"
    });
    let result;
    try{result=await response.json();}catch(_){result={};}
    if(!response.ok){
      const reason=result && result.message || "Falha na comunicação com GitHub.";
      if(response.status===401)throw new Error("Token inválido ou expirado.");
      if(response.status===403)throw new Error("Sem autorização para esta operação. Confira a permissão Contents: Read and write.");
      if(response.status===409||response.status===422)throw new Error("O repositório mudou durante a edição. Atualize os dados antes de tentar novamente. ("+reason+")");
      throw new Error("GitHub "+response.status+": "+reason);
    }
    return result;
  }
  const encodedPath=path=>path.split("/").map(encodeURIComponent).join("/");
  async function readFile(path){
    return api("/contents/"+encodedPath(path)+"?ref="+encodeURIComponent(BRANCH));
  }
  function decodeUTF8(content){
    const raw=atob(String(content||"").replace(/\s/g,""));
    const arr=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
    return new TextDecoder().decode(arr);
  }
  function base64Of(bytes){
    let output="";
    for(let i=0;i<bytes.length;i+=8192){
      output+=String.fromCharCode(...bytes.subarray(i,i+8192));
    }
    return btoa(output);
  }
  async function writeFile(path,bytes,message){
    let currentSha;
    try{const info=await readFile(path);currentSha=info.sha;}
    catch(err){if(!String(err.message).startsWith("GitHub 404:"))throw err;}
    const body={
      message,content:base64Of(bytes),branch:BRANCH
    };
    if(currentSha)body.sha=currentSha;
    return api("/contents/"+encodedPath(path),{method:"PUT",body:JSON.stringify(body)});
  }
  async function writeJSON(path,value,description){
    const bytes=new TextEncoder().encode(JSON.stringify(value,null,2)+"\n");
    return writeFile(path,bytes,description);
  }
  async function loadData(){
    const [pageFile,portfolioFile,teamFile,brandFile,linksFile]=await Promise.all([
      readFile("assets/content-overrides.json"),
      readFile("assets/portfolio-items.json"),
      readFile("assets/team-items.json"),
      readFile("assets/brand-overrides.json"),
      readFile("assets/links-overrides.json")
    ]);
    const p=JSON.parse(decodeUTF8(pageFile.content));
    const q=JSON.parse(decodeUTF8(portfolioFile.content));
    pages={version:1,pages:p&&p.pages&&typeof p.pages==="object"?p.pages:{}};
    portfolio={version:1,projects:Array.isArray(q.projects)?q.projects:[],companies:Array.isArray(q.companies)?q.companies:[]}; renderCompanies();
    const t=JSON.parse(decodeUTF8(teamFile.content));
    team={version:1,areas:Array.isArray(t.areas)?t.areas:[]};
    const b=JSON.parse(decodeUTF8(brandFile.content));
    brands={version:1,slots:b&&b.slots&&typeof b.slots==="object"?b.slots:{}};
    const savedLinks=JSON.parse(decodeUTF8(linksFile.content));
    links={
      version:1,
      footerLinks:{...LINKS.defaults.footerLinks,...(savedLinks.footerLinks||{})},
      contacts:{...LINKS.defaults.contacts,...(savedLinks.contacts||{})},
      footerImages:Array.isArray(savedLinks.footerImages)?savedLinks.footerImages:[],
      extraContacts:Array.isArray(savedLinks.extraContacts)?savedLinks.extraContacts:[]
    };
    team.areas.forEach(area=>{if(!Array.isArray(area.members))area.members=[];});
    teamAreaId=team.areas.length?team.areas[0].id:null;
    teamMemberId=null;
    dirtyPages=false;dirtyProjects=false;dirtyTeam=false;dirtyBrands=false;dirtyLinks=false;
    lastSavedFiles=[];
    for(const image of imagesPending.values())URL.revokeObjectURL(image.preview);
    imagesPending.clear();
    updatePublish();
  }
  $("login-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const value=$("github-token").value.trim();
    if(!value)return;
    const connect=$("connect");connect.disabled=true;
    token=value;
    setStatus("Verificando sua autorização no GitHub...");
    try{
      const repo=await api("");
      if(repo.permissions&&repo.permissions.push===false){
        throw new Error("Sua conta não tem permissão de publicar neste repositório.");
      }
      await loadData();
      $("github-token").value="";
      login.hidden=true;workspace.hidden=false;$("disconnect").hidden=false;
      select.value=activePage;
      // Não repetir a abertura cinematográfica dentro do editor visual.
      try{sessionStorage.setItem("amv-intro-seen-v2-01","1");}catch(_){}
      setStatus("Conectado ao repositório AMV Ultimate.","success");
      frame.src="../"+activePage+"?cmsPreview=1";
      renderProjectList();renderProjectPreview();
      renderTeamAreas();renderTeamList();renderTeamPreview();
      renderBrandEditor();renderLinksEditor();updatePublish();
    }catch(err){
      token="";
      setStatus(err.message,"error");
    }finally{connect.disabled=false;}
  });
  $("disconnect").addEventListener("click",()=>{
    if(hasChanges()&&!confirm("Existem alterações não publicadas. Deseja sair mesmo assim?"))return;
    token="";
    $("github-token").value="";
    login.hidden=false;workspace.hidden=true;$("disconnect").hidden=true;
    clearSelection();
    for(const img of imagesPending.values())URL.revokeObjectURL(img.preview);
    imagesPending.clear();dirtyPages=false;dirtyProjects=false;dirtyTeam=false;dirtyBrands=false;dirtyLinks=false;
    $("publish-check").hidden=true;
    setStatus("Desconectado. O token não foi salvo.");
    updatePublish();
  });

  function clearSelection(){
    if(selected&&selected.node&&selected.node.isConnected){
      selected.node.removeAttribute("contenteditable");
      selected.node.classList.remove("amv-admin-selected");
    }
    selected=null;
    $("selected-empty").hidden=false;
    $("selected-text").hidden=true;
    $("selected-image").hidden=true;
  }
  const editableText="h1,h2,h3,h4,p,blockquote,li";
  function selectNode(node){
    if(!node)return;
    const doc=frame.contentDocument;
    const selector=CMS.pathFor(node);
    if(!selector)return;
    if(selected&&selected.node!==node)clearSelection();
    const isImage=node.tagName==="IMG";
    selected={node,selector,type:isImage?"image":"html",page:activePage};
    node.classList.add("amv-admin-selected");
    $("selected-empty").hidden=true;
    $("selected-text").hidden=isImage;
    $("selected-image").hidden=!isImage;
    if(isImage){
      $("image-preview").src=node.src;
      imageAlt.value=node.alt||"";
      $("replace-image").value="";
    }else{
      node.contentEditable="true";
      textField.value=node.innerText||node.textContent||"";
    }
  }
  function markText(){
    if(!selected||selected.type!=="html"||!selected.node.isConnected)return;
    const node=selected.node;
    const key=selected.page;
    if(!pages.pages[key])pages.pages[key]={};
    pages.pages[key][selected.selector]={
      type:"html",
      value:CMS.sanitizeHTML(node.innerHTML,frame.contentDocument)
    };
    textField.value=node.innerText||node.textContent||"";
    changed("pages");
  }
  textField.addEventListener("input",()=>{
    if(!selected||selected.type!=="html")return;
    selected.node.textContent=textField.value;
    markText();
  });
  $("clear-selection").addEventListener("click",clearSelection);

  /* --- Editor de identidade visual, posição global e malha só na prévia --- */
  const brandDefaults={
    header:{light:"assets/isologo-amv-claro.webp",dark:"assets/isologo-amv-escuro.webp"},
    hero:{light:"assets/amv-marca-claro.webp",dark:"assets/amv-marca-escuro.webp"},
    footer:{light:"assets/amv-marca-claro.webp",dark:"assets/amv-marca-escuro.webp"},
    senac:{single:"assets/senac-footer-white-orange.png"},
    developer:{single:"assets/vz-sites-dev-footer.png"},
    intro:{single:"assets/amv-marca-escuro.webp"}
  };
  function slotData(slot=brandSlot,create=false){
    if(!Object.hasOwn(BRAND.SLOTS,slot))return null;
    if(!brands.slots[slot]&&create)brands.slots[slot]={images:{},layout:{x:0,y:0,scale:100}};
    return brands.slots[slot]||null;
  }
  function slotLayout(slot=brandSlot){
    const data=slotData(slot);
    return BRAND.normalizeLayout(data&&data.layout);
  }
  function slotImage(slot=brandSlot,variant=brandVariant,create=false){
    const data=slotData(slot,create);
    if(!data)return null;
    if(!data.images&&create)data.images={};
    if(!data.images)return null;
    if(!data.images[variant]&&create)data.images[variant]={src:"",alt:""};
    return data.images[variant]||null;
  }
  function brandImagePreview(slot=brandSlot,variant=brandVariant){
    const pending=imagesPending.get("brand|"+slot+"|"+variant);
    if(pending)return pending.preview;
    const item=slotImage(slot,variant);
    const value=item&&BRAND.safeImage(item.src)?item.src:brandDefaults[slot]&&brandDefaults[slot][variant];
    return value?"../"+value:"";
  }
  function brandRequiresHome(slot=brandSlot){
    return slot==="hero"||slot==="intro"||
      (activePage==="privacidade.html"&&slot!=="hero");
  }
  function ensureBrandPage(){
    const doc=frame.contentDocument;
    if(!doc||!BRAND.wrapper(doc,brandSlot)){
      if(activePage!=="index.html"){
        activePage="index.html";
        select.value=activePage;
        clearSelection();
        frame.src="../index.html?cmsPreview="+Date.now();
      }
    }
  }
  function updateBrandPreview(){
    const doc=frame.contentDocument;
    if(!doc||!doc.querySelector("body"))return;
    BRAND.applyToDocument(doc,brands);
    for(const pending of imagesPending.values()){
      if(pending.kind!=="brand")continue;
      const image=BRAND.image(doc,pending.slot,pending.variant);
      if(image)image.src=pending.preview;
    }
  }
  function updateBrandGrid(){
    const doc=frame.contentDocument;
    if(!doc||!doc.body)return;
    const overlay=doc.getElementById("amv-studio-grid");
    if(!overlay)return;
    overlay.hidden=!gridOn;
    overlay.style.setProperty("--studio-grid-size",gridSize+"px");
    overlay.classList.toggle("amv-studio-grid-snapping",snapOn);
    $("brand-grid").checked=gridOn;
    $("brand-snap").checked=snapOn;
    $("brand-grid-size").value=String(gridSize);
  }
  function installBrandGrid(doc){
    if(doc.getElementById("amv-studio-grid"))return;
    const style=doc.createElement("style");
    style.textContent=
      "#amv-studio-grid{position:fixed!important;inset:0!important;z-index:2147483000!important;"+
      "pointer-events:none!important;user-select:none!important;overflow:hidden!important;"+
      "background-image:linear-gradient(rgba(246,145,61,.26) 1px,transparent 1px),"+
      "linear-gradient(90deg,rgba(246,145,61,.26) 1px,transparent 1px)!important;"+
      "background-size:var(--studio-grid-size,20px) var(--studio-grid-size,20px)!important}"+
      "#amv-studio-grid[hidden]{display:none!important}"+
      "#amv-studio-grid::before,#amv-studio-grid::after{content:'';position:absolute;pointer-events:none}"+
      "#amv-studio-grid::before{left:50%;top:0;width:1px;height:100%;background:rgba(54,159,220,.55)}"+
      "#amv-studio-grid::after{top:50%;left:0;height:1px;width:100%;background:rgba(54,159,220,.55)}"+
      ".amv-studio-brand-active{outline:2px dashed #ffae60!important;outline-offset:4px!important;"+
      "cursor:grab!important}"+
      ".amv-studio-brand-active:active{cursor:grabbing!important}"+
      "html.amv-studio-footer-light footer.bg-brand-panel .amv-theme-logo--footer .amv-brand-image--light{"+
      "opacity:1!important;visibility:visible!important}"+
      "html.amv-studio-footer-light footer.bg-brand-panel .amv-theme-logo--footer .amv-brand-image--dark{"+
      "opacity:0!important;visibility:hidden!important}";
    doc.head.append(style);
    const overlay=doc.createElement("div");
    overlay.id="amv-studio-grid";
    overlay.setAttribute("aria-hidden","true");
    overlay.hidden=true;
    doc.body.append(overlay);
    updateBrandGrid();
  }
  function syncPreviewTheme(){
    const doc=frame.contentDocument;
    if(!doc||!doc.documentElement)return;
    const isPair=BRAND.SLOTS[brandSlot]&&BRAND.SLOTS[brandSlot].mode==="pair";
    if(isPair)doc.documentElement.classList.toggle("dark",brandVariant==="dark");
    doc.documentElement.classList.toggle("amv-studio-footer-light",brandSlot==="footer"&&brandVariant==="light");
    doc.querySelectorAll(".amv-studio-brand-active").forEach(node=>node.classList.remove("amv-studio-brand-active"));
    const target=BRAND.wrapper(doc,brandSlot);
    if(target)target.classList.add("amv-studio-brand-active");
  }
  function renderBrandEditor(){
    const definition=BRAND.SLOTS[brandSlot];
    if(!definition)return;
    $("brand-slot").value=brandSlot;
    const pair=definition.mode==="pair";
    $("brand-variant-wrap").hidden=!pair;
    if(!pair)brandVariant="single";
    else if(brandVariant!=="light"&&brandVariant!=="dark")brandVariant="light";
    $("brand-variant").value=brandVariant;
    const preview=$("brand-preview-image");
    const src=brandImagePreview();
    preview.hidden=!src;
    if(src)preview.src=src;
    $("brand-preview-caption").textContent=definition.label+(pair?" · "+(brandVariant==="dark"?"modo escuro":"modo claro"):"");
    const item=slotImage();
    $("brand-alt").value=item&&item.alt||"";
    const layout=slotLayout();
    $("brand-x").value=String(layout.x);
    $("brand-y").value=String(layout.y);
    $("brand-scale").value=String(layout.scale);
    $("brand-scale-value").textContent=layout.scale+"%";
    $("brand-upload").value="";
    $("brand-hint").textContent=brandSlot==="intro"
      ?"A logo da abertura só aparece na tela de entrada. Use a miniatura e os controles para ajustá-la. A malha não aparece no site publicado."
      :brandSlot==="footer"?
      "O rodapé do site usa a arte escura nos dois temas para manter contraste. No Studio, você pode pré-visualizar e trocar também a versão clara. A posição é sempre compartilhada."
      :"Arraste a logo na prévia ou ajuste os valores. Posição e escala são compartilhadas entre claro e escuro. A malha é só do editor.";
    updateBrandPreview();
    syncPreviewTheme();
    updateBrandGrid();
  }
  function setBrandSlot(slot,variant){
    if(!Object.hasOwn(BRAND.SLOTS,slot))return;
    brandSlot=slot;
    brandVariant=BRAND.variants(slot).includes(variant)?variant:BRAND.variants(slot)[0];
    $("brand-editor").open=true;
    renderBrandEditor();
    ensureBrandPage();
  }
  function changeBrandLayout(patch){
    const data=slotData(brandSlot,true);
    data.layout=BRAND.normalizeLayout({...slotLayout(),...patch});
    changed("brand");
    updateBrandPreview();
    $("brand-x").value=data.layout.x;
    $("brand-y").value=data.layout.y;
    $("brand-scale").value=data.layout.scale;
    $("brand-scale-value").textContent=data.layout.scale+"%";
  }
  $("brand-slot").addEventListener("change",event=>setBrandSlot(event.target.value,BRAND.variants(event.target.value)[0]));
  $("brand-variant").addEventListener("change",event=>setBrandSlot(brandSlot,event.target.value));
  $("brand-alt").addEventListener("input",event=>{
    const item=slotImage(brandSlot,brandVariant,true);
    item.alt=event.target.value.slice(0,180);
    changed("brand");
    updateBrandPreview();
  });
  $("brand-upload").addEventListener("change",async event=>{
    const file=event.target.files&&event.target.files[0];
    if(!file)return;
    const slot=brandSlot,variant=brandVariant;
    try{
      const blob=await optimizeImage(file);
      addPending("brand|"+slot+"|"+variant,{kind:"brand",slot,variant,blob});
      slotImage(slot,variant,true);
      changed("brand");
      renderBrandEditor();
    }catch(err){setStatus("Imagem não aceita: "+err.message,"error");}
  });
  ["brand-x","brand-y"].forEach(id=>{
    $(id).addEventListener("input",()=>{
      const value=Number($(id).value);
      if(Number.isFinite(value))changeBrandLayout({[id==="brand-x"?"x":"y"]:value});
    });
  });
  $("brand-scale").addEventListener("input",event=>changeBrandLayout({scale:Number(event.target.value)}));
  $("brand-grid").addEventListener("change",event=>{
    gridOn=event.target.checked;
    updateBrandGrid();
  });
  $("brand-snap").addEventListener("change",event=>{
    snapOn=event.target.checked;
    if(snapOn)gridOn=true;
    updateBrandGrid();
  });
  $("brand-grid-size").addEventListener("change",event=>{
    gridSize=[12,20,32].includes(Number(event.target.value))?Number(event.target.value):20;
    updateBrandGrid();
  });
  $("brand-center").addEventListener("click",()=>{
    const doc=frame.contentDocument,target=doc&&BRAND.wrapper(doc,brandSlot);
    if(!target){setStatus("Abra a página com essa logo para centralizar pela prévia.");return;}
    const parent=brandSlot==="developer"?target:target.parentElement;
    if(!parent)return;
    const rect=target.getBoundingClientRect(),pRect=parent.getBoundingClientRect();
    if(!rect.width||!pRect.width)return;
    const x=Math.round((pRect.left+pRect.width/2)-(rect.left+rect.width/2));
    const y=Math.round((pRect.top+pRect.height/2)-(rect.top+rect.height/2));
    const layout=slotLayout();
    changeBrandLayout({x:layout.x+x,y:layout.y+y});
  });
  $("brand-reset").addEventListener("click",()=>changeBrandLayout({x:0,y:0,scale:100}));

  function installBrandDrag(doc){
    doc.addEventListener("pointerdown",event=>{
      if(event.button!==0||!event.isPrimary)return;
      const spot=BRAND.locate(doc,event.target);
      if(!spot)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setBrandSlot(spot.slot,spot.variant);
      const wrapper=BRAND.wrapper(doc,spot.slot);
      if(!wrapper)return;
      const rect=wrapper.getBoundingClientRect();
      const current=slotLayout(spot.slot);
      draggingBrand={
        pointerId:event.pointerId,slot:spot.slot,
        x:current.x,y:current.y,
        clientX:event.clientX,clientY:event.clientY,
        centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2,
        moved:false
      };
      if(event.target.setPointerCapture){
        try{event.target.setPointerCapture(event.pointerId);}catch(_){}
      }
    },true);
    doc.addEventListener("pointermove",event=>{
      const drag=draggingBrand;
      if(!drag||drag.pointerId!==event.pointerId||drag.slot!==brandSlot)return;
      const dx=event.clientX-drag.clientX,dy=event.clientY-drag.clientY;
      if(Math.abs(dx)+Math.abs(dy)<2&&!drag.moved)return;
      drag.moved=true;
      let changeX=dx,changeY=dy;
      if(snapOn&&gridOn){
        changeX=Math.round((drag.centerX+dx)/gridSize)*gridSize-drag.centerX;
        changeY=Math.round((drag.centerY+dy)/gridSize)*gridSize-drag.centerY;
      }
      changeBrandLayout({x:Math.round(drag.x+changeX),y:Math.round(drag.y+changeY)});
      event.preventDefault();event.stopImmediatePropagation();
    },true);
    const stop=event=>{
      if(draggingBrand&&draggingBrand.pointerId===event.pointerId){
        draggingBrand=null;
      }
    };
    doc.addEventListener("pointerup",stop,true);
    doc.addEventListener("pointercancel",stop,true);
  }

  function installFrameEditor(){
    const doc=frame.contentDocument;
    if(!doc||!doc.body)return;
    clearSelection();
    const style=doc.createElement("style");
    style.textContent=".amv-admin-selected{outline:2px solid #f59b46!important;outline-offset:5px!important;border-radius:4px;cursor:text!important}.amv-admin-selected:is(img){cursor:pointer!important}.amv-admin-selected:focus{background:rgba(255,164,83,.065)!important}";
    doc.head.append(style);
    // A prévia mostra os dados do GitHub e todas as mudanças não publicadas.
    CMS.applyToDocument(doc,pages,activePage);
    BRAND.applyToDocument(doc,brands);
    applyLinksPreview();
    installBrandGrid(doc);
    installBrandDrag(doc);
    for(const item of imagesPending.values()){
      if(item.kind==="page"&&item.page===activePage){
        const node=doc.querySelector(item.selector);
        if(node&&node.tagName==="IMG")node.src=item.preview;
      }
    }
    doc.addEventListener("click",event=>{
      if(currentMode==="links"){
        const link=event.target.closest&&event.target.closest("a");
        if(link){
          event.preventDefault();event.stopImmediatePropagation();
          let field=null;
          if(link.closest(".amv-footer-partner-link"))field="link-footer-senac";
          else if(link.closest(".amv-footer-brand-row>a"))field="link-footer-amv";
          else if(link.closest(".amv-footer-developer"))field="link-footer-developer";
          else if(link.dataset.amvContact==="instagram")field="link-contact-instagram";
          else if(link.dataset.amvContact==="whatsapp")field="link-contact-whatsapp";
          else if(link.dataset.amvContact==="email")field="link-contact-email";
          else if(link.dataset.amvContact==="maps")field="link-contact-maps";
          if(field)$(field).focus();
          else setStatus("Edite o link correspondente na coluna à esquerda.");
          return;
        }
      }
      const chosenBrand=BRAND.locate(doc,event.target);
      if(chosenBrand){
        event.preventDefault();
        event.stopImmediatePropagation();
        setBrandSlot(chosenBrand.slot,chosenBrand.variant);
        return;
      }
      if(activePage==="equipe.html"){
        const memberCard=event.target.closest && event.target.closest(".v2-member");
        if(memberCard){
          event.preventDefault();
          event.stopImmediatePropagation();
          const section=memberCard.closest(".v2-area");
          const areaId=section&&section.getAttribute("aria-labelledby");
          const area=team.areas.find(a=>a.id===areaId);
          let member=null;
          if(area){
            const memberId=memberCard.dataset.teamMemberId;
            if(memberId)member=area.members.find(m=>m.id===memberId);
            if(!member){
              const siblings=Array.from(memberCard.parentElement.querySelectorAll(":scope > .v2-member"));
              member=area.members[siblings.indexOf(memberCard)]||null;
            }
          }
          if(area&&member){
            teamAreaId=area.id;
            switchMode("team");
            showTeamMember(member);
            renderTeamPreview();
            setStatus("Participante selecionado. Altere nome, função e fotografia na coluna à esquerda.","success");
          }else{
            setStatus("Este cartão ainda não corresponde a um participante. Use a aba Equipe para adicioná-lo.");
          }
          return;
        }
      }
      if(event.target.closest("#amv-intro,#amv-assistant,.amv-search-backdrop"))return;
      const main=event.target.closest("main#conteudo,main.privacy-main,footer");
      if(!main)return;
      let node=event.target.closest("img");
      if(!node)node=event.target.closest(editableText);
      if(node&&node.tagName!=="IMG"&&node.querySelector("a,button,input,textarea,form,img,svg")){
        event.preventDefault();event.stopImmediatePropagation();
        setStatus("Esse bloco contém elementos interativos; selecione um título ou texto simples para não quebrar os links.");
        return;
      }
      if(!node || !main.contains(node)) {
        // Não permitir navegar ou enviar formulário na prévia.
        if(event.target.closest("a,button,form")){event.preventDefault();event.stopImmediatePropagation();}
        return;
      }
      const already=selected&&selected.node===node;
      if(!already || node.tagName==="IMG")event.preventDefault();
      event.stopImmediatePropagation();
      selectNode(node);
      if(node.tagName!=="IMG"&&!already)node.focus({preventScroll:true});
    },true);
    doc.addEventListener("input",event=>{
      if(selected&&event.target===selected.node&&selected.type==="html")markText();
    },true);
    doc.addEventListener("submit",event=>{event.preventDefault();event.stopImmediatePropagation();},true);
    doc.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&selected){event.preventDefault();clearSelection();}
    },true);
    $("preview-title").textContent="Prévia ao vivo · "+select.selectedOptions[0].textContent;
    updateBrandPreview();
    syncPreviewTheme();
    updateBrandGrid();
  }
  frame.addEventListener("load",()=>{
    if(!token)return;
    try{installFrameEditor();}catch(err){setStatus("Não foi possível preparar a prévia: "+err.message,"error");}
  });
  select.addEventListener("change",()=>{
    activePage=select.value;
    clearSelection();
    draggingBrand=null;
    frame.src="../"+activePage+"?cmsPreview="+Date.now();
  });
  $("reload-preview").addEventListener("click",()=>{clearSelection();frame.src="../"+activePage+"?cmsPreview="+Date.now();});

  async function optimizeImage(file){
    if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use uma imagem JPG, PNG ou WebP.");
    if(file.size>12*1024*1024)throw new Error("Imagem muito grande. Envie arquivos de até 12 MB.");
    const source=URL.createObjectURL(file);
    const image=new Image();
    try{
      await new Promise((resolve,reject)=>{
        image.onload=resolve;image.onerror=()=>reject(new Error("Não consegui abrir esta imagem."));
        image.src=source;
      });
      const limit=1600;
      const factor=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
      canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
      let blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.8));
      if(!blob||blob.type!=="image/webp")throw new Error("Este navegador não conseguiu converter a imagem para WebP.");
      if(blob.size>3*1024*1024)blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.62));
      if(!blob||blob.size>3*1024*1024)throw new Error("A imagem ainda ficou muito grande após otimização.");
      return blob;
    }finally{URL.revokeObjectURL(source);}
  }
  function addPending(key,image){
    const old=imagesPending.get(key);
    if(old)URL.revokeObjectURL(old.preview);
    image.preview=URL.createObjectURL(image.blob);
    imagesPending.set(key,image);
    updatePublish();
  }
  $("replace-image").addEventListener("change",async event=>{
    if(!selected||selected.type!=="image"||!event.target.files.length)return;
    const target=selected;
    try{
      setStatus("Otimizando imagem...");
      const blob=await optimizeImage(event.target.files[0]);
      const key="page|"+target.page+"|"+target.selector;
      addPending(key,{kind:"page",page:target.page,selector:target.selector,blob});
      const preview=imagesPending.get(key).preview;
      target.node.src=preview;
      $("image-preview").src=preview;
      if(!pages.pages[target.page])pages.pages[target.page]={};
      pages.pages[target.page][target.selector]={type:"image",value:preview,alt:target.node.alt||""};
      changed("pages");
    }catch(err){setStatus(err.message,"error");}
  });
  imageAlt.addEventListener("input",()=>{
    if(!selected||selected.type!=="image")return;
    selected.node.alt=imageAlt.value;
    if(!pages.pages[selected.page])pages.pages[selected.page]={};
    const current=pages.pages[selected.page][selected.selector];
    const value=current&&current.type==="image"?current.value:selected.node.getAttribute("src");
    pages.pages[selected.page][selected.selector]={type:"image",value,alt:imageAlt.value};
    changed("pages");
  });

  /* Projetos: dados e fotos editáveis, rascunhos visíveis só ao administrador. */
  function renderCompanies(){
 const host=$("company-editor-area"); host.replaceChildren();
 const title=document.createElement("h2");title.textContent="Empresas do portfólio";host.append(title);
 const tip=document.createElement("p");tip.textContent="Cadastre empresas e trabalhos autorizados. Rascunhos ficam no repositório público.";host.append(tip);
 const button=(parent,label,fn)=>{const el=document.createElement("button");el.type="button";el.className="studio-secondary";el.textContent=label;el.onclick=fn;parent.append(el);};
 const change=()=>changed("projects");
 button(host,"+ Nova empresa",()=>{portfolio.companies.push({id:freshId(),name:"",works:[],published:false});change();renderCompanies();});
 const upload=(parent,c,item,label)=>{const key="company|"+c.id+"|"+(item===c?"logo":item.id);const src=imagesPending.get(key)?.preview||(item.image?"../"+item.image:"");if(src){const img=document.createElement("img");img.src=src;img.alt="Prévia";img.className="studio-selected-image";parent.append(img);}
 const wrap=document.createElement("label");wrap.textContent=label;const input=document.createElement("input");input.type="file";input.accept="image/jpeg,image/png,image/webp";wrap.append(input);parent.append(wrap);
 input.onchange=async()=>{try{if(!input.files[0])return;const blob=await optimizeImage(input.files[0]);if(!portfolio.companies.includes(c)||(item!==c&&!c.works.includes(item)))return;addPending(key,{kind:"company",id:c.id,itemId:item===c?null:item.id,blob});change();renderCompanies();}catch(e){setStatus(e.message,"error");}};
 button(parent,"Remover imagem",()=>{removePending(key);item.image="";change();renderCompanies();});};
 for(const c of portfolio.companies){if(!Array.isArray(c.works))c.works=[];const box=document.createElement("details");box.open=true;const summary=document.createElement("summary");summary.textContent=c.name||"Nova empresa";box.append(summary);host.append(box);
 for(const [key,label] of [["name","Nome"],["category","Segmento"],["description","Sobre a empresa"],["mission","Missão"],["vision","Visão"],["values","Valores"],["contactLabel","Texto do botão de contato"],["contactUrl","Link de contato (HTTPS, mailto: ou tel:)"]])field(box,label,c[key],v=>{c[key]=v;if(key==="name")summary.textContent=v||"Nova empresa";change();},{multiline:["description","mission","vision","values"].includes(key),limit:3000});
 upload(box,c,c,"Logo / imagem da empresa");
 const check=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.checked=!!c.published;cb.onchange=()=>{c.published=cb.checked;change();};check.append(cb," Publicar empresa");box.append(check);
 button(box,"+ Adicionar trabalho",()=>{c.works.push({id:freshId(),title:"",description:""});change();renderCompanies();});
 for(const w of c.works){const part=document.createElement("div");part.className="studio-editor-items";box.append(part);field(part,"Título do trabalho",w.title,v=>{w.title=v;change();});field(part,"Descrição do trabalho",w.description,v=>{w.description=v;change();},{multiline:true,limit:6000});upload(part,c,w,"Imagem do trabalho");button(part,"Excluir trabalho",()=>{removePending("company|"+c.id+"|"+w.id);c.works=c.works.filter(x=>x!==w);change();renderCompanies();});}
 button(box,"Excluir empresa",()=>{if(!confirm("Excluir esta empresa?"))return;for(const key of imagesPending.keys())if(key.startsWith("company|"+c.id+"|"))removePending(key);portfolio.companies=portfolio.companies.filter(x=>x!==c);change();renderCompanies();});}
 }
 function getProject(){return portfolio.projects.find(p=>p.id===projectId)||null;}
  function showProject(p){
    projectId=p.id;
    $("project-editor").hidden=false;
    $("project-title").value=p.title||"";
    $("project-category").value=p.category||"";
    $("project-description").value=p.description||"";
    $("project-details").value=p.details||"";
    $("project-alt").value=p.alt||"";
    $("project-client").value=p.client||"";
    $("project-period").value=p.period||"";
    $("project-challenge").value=p.challenge||"";
    $("project-approach").value=p.approach||"";
    $("project-results").value=p.results||"";
    if(!Array.isArray(p.gallery))p.gallery=[];
    if(!Array.isArray(p.steps))p.steps=[];
    $("project-published").checked=!!p.published;
    $("project-image").value="";
    const pending=imagesPending.get("project|"+p.id);
    const image=pending?pending.preview:p.image?"../"+p.image:"";
    $("project-image-preview").hidden=!image;
    if(image)$("project-image-preview").src=image;
    renderProjectList();renderGallery();renderSteps();renderCasePreview();
  }
  function renderProjectList(){
    projectList.replaceChildren();
    if(!portfolio.projects.length){
      const blank=document.createElement("p");blank.className="studio-tip";
      blank.textContent="Nenhum projeto cadastrado. Clique em Novo projeto.";
      projectList.append(blank);
      return;
    }
    portfolio.projects.forEach(p=>{
      const button=document.createElement("button");button.type="button";
      if(p.id===projectId)button.className="is-active";
      const name=document.createElement("span");name.textContent=p.title||"Projeto sem título";
      const state=document.createElement("small");
      state.textContent=p.published?"Publicado":"Rascunho";
      button.append(name,state);
      button.addEventListener("click",()=>showProject(p));
      projectList.append(button);
    });
  }
  function renderProjectPreview(){
    const host=$("project-preview-cards");host.replaceChildren();
    for(const p of portfolio.projects){
      const item=document.createElement("article");
      if(p.image||imagesPending.has("project|"+p.id)){
        const image=document.createElement("img");
        const pending=imagesPending.get("project|"+p.id);
        image.src=pending?pending.preview:"../"+p.image;
        image.alt=p.alt||p.title||"Capa do projeto";
        item.append(image);
      }
      const body=document.createElement("div");
      const tag=document.createElement("small");tag.textContent=p.category||"Projeto";
      const title=document.createElement("strong");title.textContent=p.title||"Projeto sem título";
      const description=document.createElement("p");description.textContent=p.description||"Sem resumo cadastrado.";
      const status=document.createElement("em");status.textContent=p.published?"✓ Marcado para publicação":"Rascunho oculto";
      body.append(tag,title,description,status);item.append(body);host.append(item);
    }
    renderCasePreview();
  }
  function syncProject(){
    const project=getProject();
    if(!project)return;
    project.title=$("project-title").value.slice(0,130);
    project.category=$("project-category").value.slice(0,60);
    project.description=$("project-description").value.slice(0,700);
    project.details=$("project-details").value.slice(0,6000);
    project.alt=$("project-alt").value.slice(0,180);
    project.client=$("project-client").value.slice(0,110);
    project.period=$("project-period").value.slice(0,70);
    project.challenge=$("project-challenge").value.slice(0,3000);
    project.approach=$("project-approach").value.slice(0,3000);
    project.results=$("project-results").value.slice(0,3000);
    project.published=$("project-published").checked;
    changed("projects");renderProjectList();renderProjectPreview();
  }
  $("new-project").addEventListener("click",()=>{
    const project={id:freshId(),title:"Novo projeto",category:"",description:"",details:"",image:"",alt:"",client:"",period:"",challenge:"",approach:"",results:"",gallery:[],steps:[],published:false};
    portfolio.projects.unshift(project);
    showProject(project);
    changed("projects");renderProjectPreview();
  });
  $("project-editor").addEventListener("submit",event=>{
    event.preventDefault();syncProject();setStatus("Rascunho salvo nesta aba. Clique em Publicar alterações para enviar ao site.");
  });
  ["project-title","project-category","project-description","project-details","project-alt","project-client","project-period","project-challenge","project-approach","project-results","project-published"].forEach(id=>{
    $(id).addEventListener("input",syncProject);
  });
  $("project-image").addEventListener("change",async event=>{
    const project=getProject();
    if(!project||!event.target.files.length)return;
    try{
      const blob=await optimizeImage(event.target.files[0]);
      addPending("project|"+project.id,{kind:"project",id:project.id,blob});
      $("project-image-preview").hidden=false;
      $("project-image-preview").src=imagesPending.get("project|"+project.id).preview;
      changed("projects");renderProjectPreview();
    }catch(err){setStatus(err.message,"error");}
  });
  $("delete-project").addEventListener("click",()=>{
    if(!projectId||!confirm("Excluir este projeto do portfólio? A exclusão só será pública após publicar."))return;
    // Remover também uploads ainda não publicados de etapas e galeria.
    for(const [key,pending] of Array.from(imagesPending.entries())){
      if(key==="project|"+projectId||key.startsWith("gallery|"+projectId+"|")||key.startsWith("step|"+projectId+"|")){
        URL.revokeObjectURL(pending.preview);imagesPending.delete(key);
      }
    }
    portfolio.projects=portfolio.projects.filter(p=>p.id!==projectId);
    projectId=null;$("project-editor").hidden=true;
    changed("projects");renderProjectList();renderProjectPreview();
  });

  /* Portfólio detalhado: galeria de imagens e etapas com mídia individual. */
  function freshId(){
    return window.crypto&&crypto.randomUUID?crypto.randomUUID():
      String(Date.now())+"-"+Math.random().toString(36).slice(2,10);
  }
  function pendingKey(kind,owner,itemId){
    return kind+"|"+owner+"|"+itemId;
  }
  function removePending(key){
    const pending=imagesPending.get(key);
    if(pending){URL.revokeObjectURL(pending.preview);imagesPending.delete(key);}
  }
  function mediaSrc(kind,owner,item){
    const p=imagesPending.get(pendingKey(kind,owner,item.id));
    if(p)return p.preview;
    return item.image?"../"+item.image:"";
  }
  function field(parent,label,value,callback,{multiline=false,limit=400}={}){
    const wrap=document.createElement("label");
    wrap.textContent=label;
    const input=document.createElement(multiline?"textarea":"input");
    input.value=value||"";
    input.maxLength=limit;
    if(multiline)input.rows=3;
    input.addEventListener("input",()=>callback(input.value));
    wrap.append(input);parent.append(wrap);
    return input;
  }
  function mediaControls(box,onUp,onDown,onRemove,first,last){
    const controls=document.createElement("div");controls.className="studio-media-controls";
    function add(text,handler,disabled=false,isDelete=false){
      const button=document.createElement("button");button.type="button";button.textContent=text;
      if(isDelete)button.className="delete";
      button.disabled=disabled;
      button.addEventListener("click",handler);
      controls.append(button);
    }
    add("↑",onUp,first);
    add("↓",onDown,last);
    add("Remover",onRemove,false,true);
    box.append(controls);
  }
  function mediaUpload(parent,kind,projectId,item,description){
    const label=document.createElement("label");
    label.textContent=description;
    const input=document.createElement("input");
    input.type="file";input.accept="image/jpeg,image/png,image/webp";
    input.addEventListener("change",async()=>{
      const file=input.files&&input.files[0];
      if(!file)return;
      try{
        setStatus("Otimizando imagem...");
        const blob=await optimizeImage(file);
        // Evita ressuscitar imagem de um item removido enquanto carregava.
        const project=portfolio.projects.find(p=>p.id===projectId);
        const list=project&&(kind==="gallery"?project.gallery:project.steps);
        if(!Array.isArray(list)||!list.some(part=>part.id===item.id))return;
        addPending(pendingKey(kind,projectId,item.id),{
          kind,id:projectId,itemId:item.id,blob
        });
        changed("projects");
        renderGallery();renderSteps();renderProjectPreview();
      }catch(err){setStatus(err.message,"error");}
    });
    label.append(input);parent.append(label);
  }
  function renderGallery(){
    const host=$("project-gallery-list"),p=getProject();host.replaceChildren();
    if(!p)return;
    if(!Array.isArray(p.gallery))p.gallery=[];
    p.gallery.forEach((item,index)=>{
      const box=document.createElement("article");box.className="studio-media-item";
      const name=document.createElement("h4");name.textContent="Imagem "+(index+1);box.append(name);
      const src=mediaSrc("gallery",p.id,item);
      if(src){
        const preview=document.createElement("img");
        preview.className="studio-selected-image";preview.src=src;preview.alt=item.alt||item.caption||"Imagem";
        box.append(preview);
      }else{const hint=document.createElement("small");hint.textContent="Nenhuma imagem enviada.";box.append(hint);}
      mediaUpload(box,"gallery",p.id,item,"Trocar imagem");
      field(box,"Legenda da imagem",item.caption,val=>{item.caption=val;changed("projects");renderCasePreview();},{limit:350});
      field(box,"Descrição acessível",item.alt,val=>{item.alt=val;changed("projects");},{limit:180});
      function move(to){
        const entry=p.gallery.splice(index,1)[0];
        p.gallery.splice(to,0,entry);changed("projects");renderGallery();renderCasePreview();
      }
      mediaControls(box,()=>move(index-1),()=>move(index+1),()=>{
        if(!confirm("Remover esta imagem da galeria?"))return;
        removePending(pendingKey("gallery",p.id,item.id));
        p.gallery.splice(index,1);changed("projects");renderGallery();renderProjectPreview();
      },index===0,index===p.gallery.length-1);
      host.append(box);
    });
  }
  $("gallery-upload").addEventListener("change",async event=>{
    const project=getProject(),files=Array.from(event.target.files||[]);
    if(!project||!files.length)return;
    if(!Array.isArray(project.gallery))project.gallery=[];
    for(const file of files){
      if(project.gallery.length>=30){setStatus("Limite de 30 imagens por projeto.","error");break;}
      try{
        const blob=await optimizeImage(file);
        const entry={id:freshId(),image:"",caption:"",alt:file.name.replace(/\.[^.]+$/,"").slice(0,180)};
        project.gallery.push(entry);
        addPending(pendingKey("gallery",project.id,entry.id),{
          kind:"gallery",id:project.id,itemId:entry.id,blob
        });
        changed("projects");
      }catch(err){setStatus("Não foi possível adicionar "+file.name+": "+err.message,"error");}
    }
    event.target.value="";
    renderGallery();renderProjectPreview();
  });
  function renderSteps(){
    const host=$("project-steps-list"),p=getProject();host.replaceChildren();
    if(!p)return;
    if(!Array.isArray(p.steps))p.steps=[];
    p.steps.forEach((item,index)=>{
      const box=document.createElement("article");box.className="studio-media-item is-step";
      const heading=document.createElement("h4");heading.textContent="Etapa "+(index+1);box.append(heading);
      field(box,"Nome da etapa",item.title,val=>{item.title=val;changed("projects");renderCasePreview();},{limit:130});
      field(box,"O que foi feito nesta etapa",item.description,val=>{item.description=val;changed("projects");renderCasePreview();},{multiline:true,limit:1700});
      const src=mediaSrc("step",p.id,item);
      if(src){
        const img=document.createElement("img");img.className="studio-selected-image";
        img.src=src;img.alt=item.alt||item.title||"Etapa";
        box.append(img);
      }
      mediaUpload(box,"step",p.id,item,"Imagem correspondente à etapa (opcional)");
      field(box,"Descrição da imagem",item.alt,val=>{item.alt=val;changed("projects");},{limit:180});
      if(src){
        const clear=document.createElement("button");
        clear.type="button";clear.className="studio-quiet";
        clear.textContent="Remover imagem desta etapa";
        clear.addEventListener("click",()=>{
          removePending(pendingKey("step",p.id,item.id));
          item.image="";changed("projects");renderSteps();renderCasePreview();
        });
        box.append(clear);
      }
      function move(to){
        const entry=p.steps.splice(index,1)[0];p.steps.splice(to,0,entry);
        changed("projects");renderSteps();renderCasePreview();
      }
      mediaControls(box,()=>move(index-1),()=>move(index+1),()=>{
        if(!confirm("Remover esta etapa?"))return;
        removePending(pendingKey("step",p.id,item.id));
        p.steps.splice(index,1);changed("projects");renderSteps();renderProjectPreview();
      },index===0,index===p.steps.length-1);
      host.append(box);
    });
  }
  $("add-project-step").addEventListener("click",()=>{
    const p=getProject();if(!p)return;
    if(!Array.isArray(p.steps))p.steps=[];
    if(p.steps.length>=30){setStatus("Limite de 30 etapas por projeto.","error");return;}
    p.steps.push({id:freshId(),title:"Nova etapa",description:"",image:"",alt:""});
    changed("projects");renderSteps();renderCasePreview();
  });
  function renderCasePreview(){
    const host=$("project-case-preview");host.replaceChildren();
    const p=getProject();if(!p)return;
    function add(tag,text){
      if(!String(text||"").trim())return null;
      const elem=document.createElement(tag);elem.textContent=text;host.append(elem);return elem;
    }
    add("h3","Prévia do projeto: "+(p.title||"Sem título"));
    add("p",p.description);
    [["Apresentação",p.details],["O desafio",p.challenge],["A estratégia",p.approach],["Resultados e aprendizados",p.results]]
      .forEach(([title,value])=>{if(value){add("h4",title);add("p",value);}});
    if(Array.isArray(p.steps)&&p.steps.length){
      add("h4","Etapas do projeto");
      const ol=document.createElement("ol");
      p.steps.forEach(step=>{
        const li=document.createElement("li");
        const title=document.createElement("strong");title.textContent=step.title||"Etapa";
        li.append(title);
        if(step.description){const p=document.createElement("p");p.textContent=step.description;li.append(p);}
        const src=mediaSrc("step",p.id,step);
        if(src){const img=document.createElement("img");img.src=src;img.alt=step.alt||step.title||"Etapa";li.append(img);}
        ol.append(li);
      });
      host.append(ol);
    }
    if(Array.isArray(p.gallery)&&p.gallery.length){
      add("h4","Galeria");
      const wrap=document.createElement("div");wrap.className="studio-case-gallery";
      p.gallery.forEach(photo=>{
        const src=mediaSrc("gallery",p.id,photo);if(!src)return;
        const fig=document.createElement("figure");
        const img=document.createElement("img");img.src=src;img.alt=photo.alt||photo.caption||"Imagem";
        fig.append(img);
        if(photo.caption){const caption=document.createElement("figcaption");caption.textContent=photo.caption;fig.append(caption);}
        wrap.append(fig);
      });
      host.append(wrap);
    }
  }

  /* Gestão real de participantes: nomes, funções, fotografias e visibilidade. */
  const getArea=()=>team.areas.find(area=>area.id===teamAreaId)||null;
  const getMember=()=>{const area=getArea();return area&&area.members.find(p=>p.id===teamMemberId)||null;};
  function renderTeamAreas(){
    const select=$("team-area");
    select.replaceChildren();
    team.areas.forEach((area,index)=>{
      const option=document.createElement("option");
      option.value=area.id;
      option.textContent=area.title.trim()||"Área sem nome "+(index+1);
      select.append(option);
    });
    if(!team.areas.some(a=>a.id===teamAreaId)){
      teamAreaId=team.areas.length?team.areas[0].id:null;
      teamMemberId=null;
      $("team-member-editor").hidden=true;
    }
    select.disabled=!team.areas.length;
    if(teamAreaId)select.value=teamAreaId;
    renderTeamAreaEditor();
  }
  function renderTeamAreaEditor(){
    const area=getArea(),visible=!!area;
    $("team-area-editor").hidden=!visible;
    $("add-team-member").disabled=!visible;
    if(!area)return;
    $("team-area-title").value=area.title||"";
    $("team-area-description").value=area.description||"";
    const index=team.areas.indexOf(area);
    $("team-area-up").disabled=index<=0;
    $("team-area-down").disabled=index>=team.areas.length-1;
  }
  function changeAreaOrder(direction){
    const area=getArea();if(!area)return;
    const index=team.areas.indexOf(area),next=index+direction;
    if(next<0||next>=team.areas.length)return;
    [team.areas[index],team.areas[next]]=[team.areas[next],team.areas[index]];
    changed("team");
    renderTeamAreas();
    renderTeamPreview();
  }
  $("add-team-area").addEventListener("click",()=>{
    if(team.areas.length>=60){
      setStatus("Limite de 60 áreas. Exclua uma área desnecessária antes de adicionar.","error");
      return;
    }
    const area={id:"area-"+freshId(),title:"Nova área",description:"",members:[]};
    team.areas.push(area);
    teamAreaId=area.id;teamMemberId=null;
    $("team-member-editor").hidden=true;
    changed("team");
    renderTeamAreas();renderTeamList();renderTeamPreview();
    $("team-area-title").focus();
    $("team-area-title").select();
    setStatus("Área criada! Dê um nome e clique em Publicar alterações quando estiver pronto.");
  });
  $("team-area-title").addEventListener("input",()=>{
    const area=getArea();if(!area)return;
    area.title=$("team-area-title").value.slice(0,100);
    const option=$("team-area").selectedOptions[0];
    if(option)option.textContent=area.title.trim()||"Área sem nome";
    changed("team");renderTeamPreview();
  });
  $("team-area-description").addEventListener("input",()=>{
    const area=getArea();if(!area)return;
    area.description=$("team-area-description").value.slice(0,400);
    changed("team");renderTeamPreview();
  });
  $("team-area-up").addEventListener("click",()=>changeAreaOrder(-1));
  $("team-area-down").addEventListener("click",()=>changeAreaOrder(1));
  $("delete-team-area").addEventListener("click",()=>{
    const area=getArea();if(!area)return;
    const count=area.members.length;
    const warning="Excluir a área “"+area.title+"” e "+count+
      " participante(s) vinculado(s)? Essa exclusão só aparece no site quando você publicar.";
    if(!confirm(warning))return;
    for(const member of area.members)removePending(pendingKey("team",area.id,member.id));
    const index=team.areas.indexOf(area);
    team.areas.splice(index,1);
    const newIndex=Math.min(index,team.areas.length-1);
    teamAreaId=newIndex>=0?team.areas[newIndex].id:null;
    teamMemberId=null;
    $("team-member-editor").hidden=true;
    changed("team");
    renderTeamAreas();renderTeamList();renderTeamPreview();
  });
  function renderTeamList(){
    const host=$("team-member-list");host.replaceChildren();
    const area=getArea();
    if(!area){
      const note=document.createElement("p");
      note.className="studio-team-empty";
      note.textContent="Nenhuma área cadastrada. Crie uma área para adicionar participantes.";
      host.append(note);
      return;
    }
    if(!area.members.length){
      const note=document.createElement("p");
      note.className="studio-team-empty";
      note.textContent="Ainda não há participantes nesta área.";
      host.append(note);
      return;
    }
    area.members.forEach((member,index)=>{
      const button=document.createElement("button");button.type="button";
      if(member.id===teamMemberId)button.className="is-active";
      const name=document.createElement("span");
      name.textContent=member.name||"Posição "+(index+1)+" · preencher";
      const label=document.createElement("small");
      label.textContent=member.published?"Publicado":"Não publicado";
      button.append(name,label);
      button.addEventListener("click",()=>showTeamMember(member));
      host.append(button);
    });
  }
  function showTeamMember(member){
    teamMemberId=member.id;
    $("team-member-editor").hidden=false;
    $("team-member-name").value=member.name||"";
    $("team-member-role").value=member.role||"";
    $("team-member-alt").value=member.alt||"";
    $("team-member-published").checked=!!member.published;
    $("team-member-photo").value="";
    const pending=imagesPending.get(pendingKey("team",teamAreaId,member.id));
    const src=pending?pending.preview:member.image?"../"+member.image:"";
    const preview=$("team-member-photo-preview");
    preview.hidden=!src;if(src)preview.src=src;
    renderTeamList();
  }
  function renderTeamPreview(){
    const host=$("team-preview-cards");host.replaceChildren();
    const area=getArea();
    const title=$("team-dashboard").querySelector("h2");
    if(!area){
      if(title)title.textContent="Nenhuma área cadastrada";
      const note=document.createElement("p");
      note.className="studio-team-empty";
      note.textContent="Crie uma área na coluna à esquerda para começar.";
      host.append(note);
      return;
    }
    if(title)title.textContent=area.title.trim()||"Área sem nome";
    const description=$("team-dashboard").querySelector("p:not(.studio-kicker)");
    if(description)description.textContent=area.description.trim()||"Preencha a descrição da área para apresentá-la no site.";
    if(!area.members.length){
      const note=document.createElement("p");
      note.className="studio-team-empty";
      note.textContent="Esta área ainda não possui participantes. Use o botão Adicionar participante.";
      host.append(note);
      return;
    }
    for(const member of area.members){
      const card=document.createElement("article");
      const pending=imagesPending.get(pendingKey("team",area.id,member.id));
      const src=pending?pending.preview:member.image?"../"+member.image:"";
      if(src){
        const img=document.createElement("img");img.src=src;img.alt=member.alt||member.name||"Retrato";
        card.append(img);
      }else{
        const photo=document.createElement("span");photo.className="no-photo";photo.textContent="Foto em breve";
        card.append(photo);
      }
      const details=document.createElement("div");
      const name=document.createElement("strong");name.textContent=member.name||"Integrante não identificado";
      const role=document.createElement("p");role.textContent=member.role||"Função em preparação";
      const publication=document.createElement("small");publication.textContent=member.published?"✓ Confirmado para exibição":"Rascunho";
      details.append(name,role,publication);card.append(details);host.append(card);
    }
  }
  function syncTeamMember(){
    const person=getMember();if(!person)return;
    person.name=$("team-member-name").value.slice(0,100);
    person.role=$("team-member-role").value.slice(0,120);
    person.alt=$("team-member-alt").value.slice(0,180);
    person.published=$("team-member-published").checked;
    changed("team");renderTeamList();renderTeamPreview();
  }
  $("team-area").addEventListener("change",()=>{
    teamAreaId=$("team-area").value;
    teamMemberId=null;$("team-member-editor").hidden=true;
    renderTeamList();renderTeamPreview();
  });
  $("add-team-member").addEventListener("click",()=>{
    const area=getArea();if(!area)return;
    if(area.members.length>=80){setStatus("Limite de 80 integrantes por área.","error");return;}
    const member={id:freshId(),name:"",role:"",image:"",alt:"",published:false};
    area.members.push(member);
    showTeamMember(member);changed("team");renderTeamPreview();
  });
  ["team-member-name","team-member-role","team-member-alt","team-member-published"].forEach(id=>{
    $(id).addEventListener("input",syncTeamMember);
  });
  $("team-member-editor").addEventListener("submit",event=>{
    event.preventDefault();syncTeamMember();
    setStatus("Participante salvo nesta aba. Publique para enviar ao site.");
  });
  $("team-member-photo").addEventListener("change",async event=>{
    const member=getMember(),file=event.target.files&&event.target.files[0];
    if(!member||!file)return;
    const areaId=teamAreaId;
    try{
      setStatus("Otimizando fotografia...");
      const blob=await optimizeImage(file);
      const area=team.areas.find(a=>a.id===areaId);
      if(!area||!area.members.some(m=>m.id===member.id))return;
      addPending(pendingKey("team",areaId,member.id),{
        kind:"team",areaId,memberId:member.id,blob
      });
      changed("team");
      if(areaId===teamAreaId&&teamMemberId===member.id)showTeamMember(member);
      renderTeamPreview();
    }catch(err){setStatus(err.message,"error");}
  });
  $("delete-team-member").addEventListener("click",()=>{
    const area=getArea(),member=getMember();
    if(!area||!member||!confirm("Excluir este participante? Esta alteração só será pública ao publicar."))return;
    removePending(pendingKey("team",area.id,member.id));
    area.members=area.members.filter(m=>m.id!==member.id);
    teamMemberId=null;$("team-member-editor").hidden=true;
    changed("team");renderTeamList();renderTeamPreview();
  });

  /* Links e rodape: campos existentes, imagens extras e redes configuraveis. */
  function linksPreviewImages(){
    const images=new Map();
    for(const pending of imagesPending.values()){
      if(pending.kind==="footerImage")images.set(pending.id,pending.preview);
    }
    return images;
  }
  function applyLinksPreview(){
    const doc=frame.contentDocument;
    if(!doc||!doc.body)return;
    LINKS.applyToDocument(doc,links,{editing:true,previewImages:linksPreviewImages()});
  }
  function linksChanged(){
    changed("links");
    applyLinksPreview();
  }
  const linkFields={
    "link-footer-amv":["footerLinks","amv"],
    "link-footer-senac":["footerLinks","senac"],
    "link-footer-developer":["footerLinks","developer"],
    "link-contact-whatsapp":["contacts","whatsapp"],
    "link-contact-email":["contacts","email"],
    "link-contact-maps":["contacts","maps"],
    "link-contact-instagram":["contacts","instagram"]
  };
  for(const [id,[category,key]] of Object.entries(linkFields)){
    $(id).addEventListener("input",event=>{
      links[category][key]=event.target.value.trim().slice(0,1000);
      linksChanged();
    });
  }
  $("link-contact-instagram").addEventListener("blur",event=>{
    const normalized=LINKS.normalizeInstagram(event.target.value);
    if(normalized!==event.target.value.trim()){
      links.contacts.instagram=normalized;
      event.target.value=normalized;
      linksChanged();
    }
  });
  function renderLinksEditor(){
    for(const [id,[category,key]] of Object.entries(linkFields)){
      $(id).value=links[category][key]||"";
    }
    renderFooterImages();
    renderExtraLinks();
    applyLinksPreview();
  }
  function linkInput(parent,label,value,callback){
    const wrap=document.createElement("label");
    wrap.textContent=label;
    const field=document.createElement("input");
    field.type="text";
    field.maxLength=1000;
    field.placeholder="https://...";
    field.spellcheck=false;
    field.value=value||"";
    field.addEventListener("input",()=>callback(field.value.trim()));
    wrap.append(field);parent.append(wrap);
    return field;
  }
  function togglePublished(parent,checked,callback){
    const label=document.createElement("label");label.className="studio-check";
    const input=document.createElement("input");input.type="checkbox";input.checked=!!checked;
    const text=document.createElement("span");text.textContent="Exibir no site público";
    input.addEventListener("change",()=>callback(input.checked));
    label.append(input,text);parent.append(label);
  }
  function moveItem(list,index,to){
    if(to<0||to>=list.length)return false;
    const entry=list.splice(index,1)[0];
    list.splice(to,0,entry);
    return true;
  }
  function renderFooterImages(){
    const host=$("footer-image-list");
    host.replaceChildren();
    if(!links.footerImages.length){
      const blank=document.createElement("p");blank.className="studio-team-empty";
      blank.textContent="Ainda não há imagens adicionais. As marcas AMV, SENAC e VZ continuam acima.";
      host.append(blank);
    }
    links.footerImages.forEach((item,index)=>{
      const card=document.createElement("article");card.className="studio-media-item";
      const title=document.createElement("h4");title.textContent="Imagem adicional "+(index+1);
      card.append(title);
      const pending=imagesPending.get("footerImage|"+item.id);
      const src=pending?pending.preview:item.image?"../"+item.image:"";
      if(src){
        const preview=document.createElement("img");
        preview.className="studio-selected-image";
        preview.src=src;preview.alt=item.alt||item.name||"Imagem adicional";
        card.append(preview);
      }
      field(card,"Nome da marca",item.name||"",value=>{
        item.name=value.slice(0,100);linksChanged();
      },{limit:100});
      const input=document.createElement("input");
      input.type="file";input.accept="image/jpeg,image/png,image/webp";
      const label=document.createElement("label");
      label.textContent=src?"Trocar imagem":"Selecionar imagem";
      label.append(input);card.append(label);
      input.addEventListener("change",async()=>{
        const file=input.files&&input.files[0];if(!file)return;
        try{
          const blob=await optimizeImage(file);
          if(!links.footerImages.some(x=>x.id===item.id))return;
          addPending("footerImage|"+item.id,{kind:"footerImage",id:item.id,blob});
          linksChanged();renderFooterImages();
        }catch(error){setStatus("Não foi possível adicionar a imagem: "+error.message,"error");}
      });
      linkInput(card,"Link ao clicar nesta imagem",item.href||"",value=>{
        item.href=value.slice(0,1000);linksChanged();
      });
      field(card,"Descrição acessível",item.alt||"",value=>{
        item.alt=value.slice(0,180);linksChanged();
      },{limit:180});
      togglePublished(card,item.published,value=>{
        item.published=value;linksChanged();
      });
      const controls=document.createElement("div");controls.className="studio-media-controls";
      function button(label,cb,disabled=false,remove=false){
        const b=document.createElement("button");b.type="button";b.textContent=label;b.disabled=disabled;
        if(remove)b.className="delete";
        b.addEventListener("click",cb);controls.append(b);
      }
      button("↑",()=>{moveItem(links.footerImages,index,index-1);linksChanged();renderFooterImages();},index===0);
      button("↓",()=>{moveItem(links.footerImages,index,index+1);linksChanged();renderFooterImages();},index===links.footerImages.length-1);
      button("Remover",()=>{
        if(!confirm("Remover esta imagem do rodapé ao publicar?"))return;
        removePending("footerImage|"+item.id);
        links.footerImages.splice(index,1);
        linksChanged();renderFooterImages();
      },false,true);
      card.append(controls);host.append(card);
    });
  }
  $("add-footer-image").addEventListener("click",()=>{
    if(links.footerImages.length>=35){
      setStatus("Limite de 35 imagens adicionais no rodapé.","error");return;
    }
    links.footerImages.push({
      id:"logo-"+freshId(),name:"Nova marca",image:"",alt:"",href:"",published:false
    });
    linksChanged();renderFooterImages();
    $("footer-image-list").lastElementChild.scrollIntoView({block:"nearest",behavior:"smooth"});
  });
  function renderExtraLinks(){
    const host=$("extra-link-list");host.replaceChildren();
    if(!links.extraContacts.length){
      const p=document.createElement("p");p.className="studio-team-empty";
      p.textContent="Nenhum link adicional cadastrado.";
      host.append(p);
    }
    links.extraContacts.forEach((item,index)=>{
      const card=document.createElement("article");card.className="studio-media-item";
      const title=document.createElement("h4");
      title.textContent="Contato adicional "+(index+1);card.append(title);
      field(card,"Nome exibido",item.label||"",value=>{
        item.label=value.slice(0,65);linksChanged();
      },{limit:65});
      linkInput(card,"Endereço de destino",item.href||"",value=>{
        item.href=value.slice(0,1000);linksChanged();
      });
      field(card,"Descrição curta",item.description||"",value=>{
        item.description=value.slice(0,90);linksChanged();
      },{limit:90});
      togglePublished(card,item.published,value=>{
        item.published=value;linksChanged();
      });
      mediaControls(card,()=>{
        moveItem(links.extraContacts,index,index-1);linksChanged();renderExtraLinks();
      },()=>{
        moveItem(links.extraContacts,index,index+1);linksChanged();renderExtraLinks();
      },()=>{
        if(!confirm("Remover este link extra?"))return;
        links.extraContacts.splice(index,1);linksChanged();renderExtraLinks();
      },index===0,index===links.extraContacts.length-1);
      host.append(card);
    });
  }
  $("add-extra-link").addEventListener("click",()=>{
    if(links.extraContacts.length>=35){
      setStatus("Limite de 35 contatos adicionais.","error");return;
    }
    links.extraContacts.push({id:"contato-"+freshId(),label:"Novo link",href:"",description:"",published:false});
    linksChanged();renderExtraLinks();
  });
  $("links-preview-footer").addEventListener("click",()=>{
    const win=frame.contentWindow;
    if(win&&win.document&&win.document.body){
      win.scrollTo({top:win.document.documentElement.scrollHeight,behavior:"smooth"});
    }
  });

  function switchMode(mode){
    const isPages=mode==="pages",isProjects=mode==="projects",
          isTeam=mode==="team",isLinks=mode==="links";
    currentMode=mode;
    $("pages-mode").hidden=!isPages;
    $("projects-mode").hidden=!isProjects;
    $("team-mode").hidden=!isTeam;
    $("links-mode").hidden=!isLinks;
    $("preview-shell").hidden=!(isPages||isLinks);
    $("projects-dashboard").hidden=!isProjects;
    $("team-dashboard").hidden=!isTeam;
    for(const [id,active]of [
      ["tab-pages",isPages],["tab-projects",isProjects],
      ["tab-team",isTeam],["tab-links",isLinks]
    ]){
      $(id).classList.toggle("is-active",active);
      $(id).setAttribute("aria-selected",String(active));
    }
    if(isTeam){renderTeamAreas();renderTeamList();renderTeamPreview();}
    if(isProjects){renderProjectList();renderProjectPreview();}
    if(isLinks){
      renderLinksEditor();
      if(activePage!=="index.html"){
        activePage="index.html";select.value="index.html";
        frame.src="../index.html?cmsPreview="+Date.now();
      }else{
        applyLinksPreview();
      }
    }
  }
  $("tab-pages").addEventListener("click",()=>switchMode("pages"));
  $("tab-projects").addEventListener("click",()=>switchMode("projects"));
  $("tab-team").addEventListener("click",()=>switchMode("team"));
  $("tab-links").addEventListener("click",()=>switchMode("links"));

  /* Verificação real da persistência: primeiro GitHub, depois GitHub Pages. */
  const publishedData={
    "assets/content-overrides.json":()=>pages,
    "assets/portfolio-items.json":()=>portfolio,
    "assets/team-items.json":()=>team,
    "assets/brand-overrides.json":()=>brands,
    "assets/links-overrides.json":()=>links
  };
  function publicationMessage(message,kind="warning"){
    const label=$("publish-check");
    label.hidden=false;
    label.dataset.status=kind;
    label.textContent=message;
  }
  async function verifyGitHubSave(path,value){
    const stored=JSON.parse(decodeUTF8((await readFile(path)).content));
    if(JSON.stringify(stored)!==JSON.stringify(value)){
      throw new Error("O GitHub não confirmou o conteúdo salvo em "+path+".");
    }
  }
  async function verifyLiveFiles(){
    if(!token)return;
    if(hasChanges()){
      publicationMessage("Há mudanças não publicadas. Clique primeiro em Publicar alterações para conferir a versão mais recente.","warning");
      return;
    }
    const button=$("verify-live");
    button.disabled=true;
    const files=lastSavedFiles.length?lastSavedFiles:Object.keys(publishedData);
    publicationMessage("Consultando arquivos do site público, sem usar cache...");
    try{
      const outcomes=await Promise.all(files.map(async path=>{
        const response=await fetch("../"+path+"?amvVerify="+Date.now(),{cache:"no-store"});
        if(!response.ok)return {path,ok:false,code:response.status};
        const actual=await response.json();
        const expected=publishedData[path]();
        return {path,ok:JSON.stringify(actual)===JSON.stringify(expected)};
      }));
      const remaining=outcomes.filter(item=>!item.ok);
      if(remaining.length){
        publicationMessage("Alterações salvas no GitHub, mas ainda não estão disponíveis no site público ("+
          remaining.map(item=>item.path.split("/").pop()).join(", ")+
          "). Aguarde a conclusão do GitHub Pages e clique em Verificar site novamente.","warning");
        setStatus("GitHub Pages ainda está atualizando. Suas alterações não se perderam.");
      }else{
        publicationMessage("✓ Publicação confirmada: os arquivos novos já estão no site público. Abra o site e recarregue para ver as mudanças.","ok");
        setStatus("Site público atualizado e conferido.","success");
      }
    }catch(err){
      publicationMessage("Não foi possível conferir o site agora: "+err.message,"error");
    }finally{button.disabled=false;}
  }
  $("verify-live").addEventListener("click",verifyLiveFiles);

  $("publish").addEventListener("click",async()=>{
    if(!token||!hasChanges()||busy)return;
    if((portfolio.companies||[]).some(c=>c.published&&(!String(c.name||"").trim()||(c.contactUrl&&!/^(https:\/\/|mailto:|tel:)/i.test(c.contactUrl.trim()))))){setStatus("Preencha o nome e confira o link de contato das empresas publicadas.","error");return;}
    const invalid=portfolio.projects.find(p=>p.published&&!String(p.title||"").trim());
    if(invalid){setStatus("Preencha o título de todos os projetos marcados para publicação.","error");return;}
    const invalidMember=team.areas.some(area=>(area.members||[]).some(member=>
      member.published&&!String(member.name||"").trim()));
    if(invalidMember){setStatus("Para publicar participantes, preencha o nome de cada pessoa marcada para exibição.","error");return;}
    if(team.areas.some(a=>!String(a.title||"").trim())){
      setStatus("Dê um nome a todas as áreas antes de publicar.","error");return;
    }
    links.contacts.instagram=LINKS.normalizeInstagram(links.contacts.instagram);
    for(const [key,value]of Object.entries({...links.footerLinks,...links.contacts})){
      if(value&&!LINKS.normalizeUrl(value)){
        setStatus("Endereço inválido em "+key+". Informe um link HTTPS, e-mail, telefone ou página interna.","error");
        switchMode("links");return;
      }
    }
    for(const item of links.footerImages){
      if(!item.published)continue;
      if(!String(item.name||"").trim()||!LINKS.normalizeUrl(item.href)){
        setStatus("Complete o nome e um link HTTPS válido de cada imagem publicada no rodapé.","error");
        switchMode("links");return;
      }
      if(!LINKS.safeImage(item.image)&&!imagesPending.has("footerImage|"+item.id)){
        setStatus("Envie a imagem antes de publicar a marca "+item.name+".","error");
        switchMode("links");return;
      }
    }
    for(const item of links.extraContacts){
      if(item.published&&(!String(item.label||"").trim()||!LINKS.normalizeUrl(item.href))){
        setStatus("Complete o nome e link válido de cada contato adicional publicado.","error");
        switchMode("links");return;
      }
    }
    busy=true;updatePublish();
    try{
      // Primeiro as fotos, depois os arquivos JSON que fazem referência a elas.
      const currentImages=Array.from(imagesPending.entries());
      for(const [key,pending] of currentImages){
        setStatus("Enviando imagens ao GitHub...");
        const filename=Date.now()+"-"+Math.random().toString(36).slice(2,10)+".webp";
        const path="assets/uploads/"+filename;
        await writeFile(path,new Uint8Array(await pending.blob.arrayBuffer()),"cms: adicionar imagem "+filename);
        if(pending.kind==="page"){
          const current=pages.pages[pending.page]&&pages.pages[pending.page][pending.selector];
          if(current&&current.type==="image")current.value=path;
          dirtyPages=true;
        }else if(pending.kind==="company"){const c=portfolio.companies.find(x=>x.id===pending.id);const item=c&&(pending.itemId?c.works.find(x=>x.id===pending.itemId):c);if(item){item.image=path;dirtyProjects=true;}}else if(pending.kind==="project"){
          const p=portfolio.projects.find(item=>item.id===pending.id);
          if(p){p.image=path;dirtyProjects=true;}
        }else if(pending.kind==="gallery" || pending.kind==="step"){
          const p=portfolio.projects.find(item=>item.id===pending.id);
          const collection=p && (pending.kind==="gallery"?p.gallery:p.steps);
          const item=Array.isArray(collection)&&collection.find(entry=>entry.id===pending.itemId);
          if(item){item.image=path;dirtyProjects=true;}
        }else if(pending.kind==="team"){
          const area=team.areas.find(item=>item.id===pending.areaId);
          const person=area&&area.members.find(item=>item.id===pending.memberId);
          if(person){person.image=path;dirtyTeam=true;}
        }else if(pending.kind==="brand"){
          const item=slotImage(pending.slot,pending.variant,true);
          if(item){item.src=path;dirtyBrands=true;}
        }else if(pending.kind==="footerImage"){
          const item=links.footerImages.find(entry=>entry.id===pending.id);
          if(item){item.image=path;dirtyLinks=true;}
        }
        // Sucesso no arquivo: não repetir a transferência na próxima tentativa.
        URL.revokeObjectURL(pending.preview);
        imagesPending.delete(key);
      }
      const saved=[];
      if(dirtyPages){
        setStatus("Publicando e verificando textos e imagens...");
        await writeJSON("assets/content-overrides.json",pages,"cms: atualizar conteúdos visuais da AMV");
        await verifyGitHubSave("assets/content-overrides.json",pages);
        dirtyPages=false;saved.push("assets/content-overrides.json");
      }
      if(dirtyProjects){
        setStatus("Publicando e verificando portfólio...");
        await writeJSON("assets/portfolio-items.json",portfolio,"cms: atualizar projetos do portfólio AMV");
        await verifyGitHubSave("assets/portfolio-items.json",portfolio);
        dirtyProjects=false;saved.push("assets/portfolio-items.json");renderCompanies();
      }
      if(dirtyTeam){
        setStatus("Publicando e verificando participantes...");
        await writeJSON("assets/team-items.json",team,"cms: atualizar equipe da AMV");
        await verifyGitHubSave("assets/team-items.json",team);
        dirtyTeam=false;saved.push("assets/team-items.json");
      }
      if(dirtyBrands){
        setStatus("Publicando e verificando logos e posições...");
        await writeJSON("assets/brand-overrides.json",brands,"cms: identidade visual e alinhamento de logos");
        await verifyGitHubSave("assets/brand-overrides.json",brands);
        dirtyBrands=false;saved.push("assets/brand-overrides.json");
      }
      if(dirtyLinks){
        setStatus("Publicando e verificando links do rodapé e contatos...");
        await writeJSON("assets/links-overrides.json",links,"cms: atualizar links, contatos e imagens do rodapé");
        await verifyGitHubSave("assets/links-overrides.json",links);
        dirtyLinks=false;saved.push("assets/links-overrides.json");
      }
      lastSavedFiles=saved;
      setStatus("Arquivos gravados e conferidos no GitHub. A publicação pelo Pages pode levar alguns instantes.","success");
      publicationMessage("✓ Salvo no GitHub. O site público pode estar atualizando. Clique em Verificar site ↻ para confirmar a publicação.","warning");
      renderProjectList();renderProjectPreview();renderGallery();renderSteps();
      renderTeamList();renderTeamPreview();renderBrandEditor();renderLinksEditor();
      clearSelection();
      frame.src="../"+activePage+"?cmsPreview="+Date.now();
    }catch(err){
      setStatus("Publicação interrompida: "+err.message,"error");
    }finally{
      busy=false;updatePublish();
    }
  });

  window.addEventListener("beforeunload",event=>{
    if(hasChanges()&&token){event.preventDefault();event.returnValue="";}
  });
  updatePublish();
})();
