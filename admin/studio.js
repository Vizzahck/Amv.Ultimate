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
  let token="",pages={version:1,pages:{}},portfolio={version:1,projects:[]},team={version:1,areas:[]};
  let activePage="index.html",selected=null,projectId=null,teamMemberId=null,teamAreaId=null,dirtyPages=false,dirtyProjects=false,dirtyTeam=false,busy=false;
  const CMS=window.AMVCMS;
  if(!CMS){setStatus("Editor indisponível: recarregue esta página.","error");return;}

  function setStatus(message,type="info"){
    status.textContent=message;status.dataset.type=type;
  }
  function hasChanges(){return dirtyPages||dirtyProjects||dirtyTeam||imagesPending.size>0;}
  function updatePublish(){
    const button=$("publish");
    button.disabled=busy||!hasChanges();
    button.textContent=busy?"Publicando...":hasChanges()?"Publicar alterações ↗":"Sem alterações";
  }
  function changed(type){
    if(type==="projects")dirtyProjects=true;
    else if(type==="team")dirtyTeam=true;
    else dirtyPages=true;
    updatePublish();
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
    const [pageFile,portfolioFile,teamFile]=await Promise.all([
      readFile("assets/content-overrides.json"),
      readFile("assets/portfolio-items.json"),
      readFile("assets/team-items.json")
    ]);
    const p=JSON.parse(decodeUTF8(pageFile.content));
    const q=JSON.parse(decodeUTF8(portfolioFile.content));
    pages={version:1,pages:p&&p.pages&&typeof p.pages==="object"?p.pages:{}};
    portfolio={version:1,projects:Array.isArray(q.projects)?q.projects:[]};
    const t=JSON.parse(decodeUTF8(teamFile.content));
    team={version:1,areas:Array.isArray(t.areas)?t.areas:[]};
    team.areas.forEach(area=>{if(!Array.isArray(area.members))area.members=[];});
    if(!team.areas.length)throw new Error("Arquivo da equipe sem áreas cadastradas.");
    teamAreaId=team.areas[0].id;
    teamMemberId=null;
    dirtyPages=false;dirtyProjects=false;dirtyTeam=false;
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
      updatePublish();
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
    imagesPending.clear();dirtyPages=false;dirtyProjects=false;dirtyTeam=false;
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

  function installFrameEditor(){
    const doc=frame.contentDocument;
    if(!doc||!doc.body)return;
    clearSelection();
    const style=doc.createElement("style");
    style.textContent=".amv-admin-selected{outline:2px solid #f59b46!important;outline-offset:5px!important;border-radius:4px;cursor:text!important}.amv-admin-selected:is(img){cursor:pointer!important}.amv-admin-selected:focus{background:rgba(255,164,83,.065)!important}";
    doc.head.append(style);
    // A prévia mostra exatamente as alterações atuais, inclusive não publicadas.
    CMS.applyToDocument(doc,pages,activePage);
    for(const item of imagesPending.values()){
      if(item.kind==="page"&&item.page===activePage){
        const node=doc.querySelector(item.selector);
        if(node&&node.tagName==="IMG")node.src=item.preview;
      }
    }
    doc.addEventListener("click",event=>{
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
  }
  frame.addEventListener("load",()=>{
    if(!token)return;
    try{installFrameEditor();}catch(err){setStatus("Não foi possível preparar a prévia: "+err.message,"error");}
  });
  select.addEventListener("change",()=>{
    activePage=select.value;
    clearSelection();
    frame.src="../"+activePage+"?cmsPreview=1";
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
    const select=$("team-area");select.replaceChildren();
    team.areas.forEach(area=>{
      const option=document.createElement("option");option.value=area.id;option.textContent=area.title;select.append(option);
    });
    if(!teamAreaId||!team.areas.some(a=>a.id===teamAreaId))teamAreaId=team.areas[0].id;
    select.value=teamAreaId;
  }
  function renderTeamList(){
    const host=$("team-member-list");host.replaceChildren();
    const area=getArea();if(!area)return;
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
    const area=getArea();if(!area)return;
    const title=$("team-dashboard").querySelector("h2");
    if(title)title.textContent=area.title;
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

  function switchMode(mode){
    const isPages=mode==="pages",isProjects=mode==="projects",isTeam=mode==="team";
    $("pages-mode").hidden=!isPages;
    $("projects-mode").hidden=!isProjects;
    $("team-mode").hidden=!isTeam;
    $("preview-shell").hidden=!isPages;
    $("projects-dashboard").hidden=!isProjects;
    $("team-dashboard").hidden=!isTeam;
    for(const [id,active]of [["tab-pages",isPages],["tab-projects",isProjects],["tab-team",isTeam]]){
      $(id).classList.toggle("is-active",active);
      $(id).setAttribute("aria-selected",String(active));
    }
    if(isTeam){renderTeamAreas();renderTeamList();renderTeamPreview();}
    if(isProjects){renderProjectList();renderProjectPreview();}
  }
  $("tab-pages").addEventListener("click",()=>switchMode("pages"));
  $("tab-projects").addEventListener("click",()=>switchMode("projects"));
  $("tab-team").addEventListener("click",()=>switchMode("team"));

  $("publish").addEventListener("click",async()=>{
    if(!token||!hasChanges()||busy)return;
    const invalid=portfolio.projects.find(p=>p.published&&!String(p.title||"").trim());
    if(invalid){setStatus("Preencha o título de todos os projetos marcados para publicação.","error");return;}
    const invalidMember=team.areas.some(area=>(area.members||[]).some(member=>
      member.published&&!String(member.name||"").trim()));
    if(invalidMember){setStatus("Para publicar participantes, preencha o nome de cada pessoa marcada para exibição.","error");return;}
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
        }else if(pending.kind==="project"){
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
        }
        // Sucesso no arquivo: não repetir a transferência na próxima tentativa.
        URL.revokeObjectURL(pending.preview);
        imagesPending.delete(key);
      }
      if(dirtyPages){
        setStatus("Publicando alterações de textos e imagens...");
        await writeJSON("assets/content-overrides.json",pages,"cms: atualizar conteúdos visuais da AMV");
        dirtyPages=false;
      }
      if(dirtyProjects){
        setStatus("Publicando portfólio...");
        await writeJSON("assets/portfolio-items.json",portfolio,"cms: atualizar projetos do portfólio AMV");
        dirtyProjects=false;
      }
      if(dirtyTeam){
        setStatus("Publicando participantes e fotografias da Equipe...");
        await writeJSON("assets/team-items.json",team,"cms: atualizar equipe da AMV");
        dirtyTeam=false;
      }
      setStatus("Alterações gravadas no GitHub! Aguarde a publicação do GitHub Pages.","success");
      renderProjectList();renderProjectPreview();renderGallery();renderSteps();
      renderTeamList();renderTeamPreview();
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
