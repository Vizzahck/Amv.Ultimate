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
  let token="",pages={version:1,pages:{}},portfolio={version:1,projects:[]};
  let activePage="index.html",selected=null,projectId=null,dirtyPages=false,dirtyProjects=false,busy=false;
  const CMS=window.AMVCMS;
  if(!CMS){setStatus("Editor indisponível: recarregue esta página.","error");return;}

  function setStatus(message,type="info"){
    status.textContent=message;status.dataset.type=type;
  }
  function hasChanges(){return dirtyPages||dirtyProjects||imagesPending.size>0;}
  function updatePublish(){
    const button=$("publish");
    button.disabled=busy||!hasChanges();
    button.textContent=busy?"Publicando...":hasChanges()?"Publicar alterações ↗":"Sem alterações";
  }
  function changed(type){
    if(type==="projects")dirtyProjects=true;
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
    const [pageFile,portfolioFile]=await Promise.all([
      readFile("assets/content-overrides.json"),
      readFile("assets/portfolio-items.json")
    ]);
    const p=JSON.parse(decodeUTF8(pageFile.content));
    const q=JSON.parse(decodeUTF8(portfolioFile.content));
    pages={version:1,pages:p&&p.pages&&typeof p.pages==="object"?p.pages:{}};
    portfolio={version:1,projects:Array.isArray(q.projects)?q.projects:[]};
    dirtyPages=false;dirtyProjects=false;
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
    imagesPending.clear();dirtyPages=false;dirtyProjects=false;
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
    $("project-published").checked=!!p.published;
    $("project-image").value="";
    const pending=imagesPending.get("project|"+p.id);
    const image=pending?pending.preview:p.image?"../"+p.image:"";
    $("project-image-preview").hidden=!image;
    if(image)$("project-image-preview").src=image;
    renderProjectList();
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
  }
  function syncProject(){
    const project=getProject();
    if(!project)return;
    project.title=$("project-title").value.slice(0,130);
    project.category=$("project-category").value.slice(0,60);
    project.description=$("project-description").value.slice(0,700);
    project.details=$("project-details").value.slice(0,6000);
    project.alt=$("project-alt").value.slice(0,180);
    project.published=$("project-published").checked;
    changed("projects");renderProjectList();renderProjectPreview();
  }
  $("new-project").addEventListener("click",()=>{
    const project={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),title:"Novo projeto",category:"",description:"",details:"",image:"",alt:"",published:false};
    portfolio.projects.unshift(project);
    showProject(project);
    changed("projects");renderProjectPreview();
  });
  $("project-editor").addEventListener("submit",event=>{
    event.preventDefault();syncProject();setStatus("Rascunho salvo nesta aba. Clique em Publicar alterações para enviar ao site.");
  });
  ["project-title","project-category","project-description","project-details","project-alt","project-published"].forEach(id=>{
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
    const key="project|"+projectId;
    const pending=imagesPending.get(key);
    if(pending){URL.revokeObjectURL(pending.preview);imagesPending.delete(key);}
    portfolio.projects=portfolio.projects.filter(p=>p.id!==projectId);
    projectId=null;$("project-editor").hidden=true;
    changed("projects");renderProjectList();renderProjectPreview();
  });

  function switchMode(mode){
    const isPages=mode==="pages";
    $("pages-mode").hidden=!isPages;$("projects-mode").hidden=isPages;
    $("preview-shell").hidden=!isPages;$("projects-dashboard").hidden=isPages;
    $("tab-pages").classList.toggle("is-active",isPages);
    $("tab-projects").classList.toggle("is-active",!isPages);
    $("tab-pages").setAttribute("aria-selected",String(isPages));
    $("tab-projects").setAttribute("aria-selected",String(!isPages));
  }
  $("tab-pages").addEventListener("click",()=>switchMode("pages"));
  $("tab-projects").addEventListener("click",()=>switchMode("projects"));

  $("publish").addEventListener("click",async()=>{
    if(!token||!hasChanges()||busy)return;
    const invalid=portfolio.projects.find(p=>p.published&&!String(p.title||"").trim());
    if(invalid){setStatus("Preencha o título de todos os projetos marcados para publicação.","error");return;}
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
        }else{
          const p=portfolio.projects.find(item=>item.id===pending.id);
          if(p){p.image=path;dirtyProjects=true;}
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
      setStatus("Alterações gravadas no GitHub! Aguarde a publicação do GitHub Pages.","success");
      renderProjectList();renderProjectPreview();
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
