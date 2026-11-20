/* AMV Ultimate V2 — estudos de caso completos publicados pelo Studio. */
(() => {
  "use strict";
  const home=document.querySelector("main#conteudo #projetos");
  const hero=!home&&document.querySelector("main#conteudo .v2-page-hero");
  if(!home&&!hero)return;
  const host=home||hero.parentElement;
  const grid=host.querySelector(".v2-cards");
  if(!grid)return;
  const safeImage=value=>typeof value==="string"&&/^assets\/[a-z\d_./-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(value)&&!value.includes("..");
  const el=(tag,cl,text)=>{
    const node=document.createElement(tag);
    if(cl)node.className=cl;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  function photo(data,cls){
    if(!safeImage(data&&data.image))return null;
    const image=el("img",cls);
    image.src=data.image;
    image.alt=typeof data.alt==="string"&&data.alt.trim()?data.alt:(data.caption||data.title||"Imagem de projeto");
    image.loading="lazy";image.decoding="async";
    return image;
  }
  const dialog=el("dialog","amv-cms-project-dialog");
  dialog.setAttribute("aria-label","Detalhes do projeto da AMV");
  document.body.append(dialog);
  let focusReturn=null;
  dialog.addEventListener("close",()=>{
    if(focusReturn&&focusReturn.isConnected)focusReturn.focus({preventScroll:true});
  });
  function section(parent,title,body){
    if(typeof body!=="string"||!body.trim())return;
    const s=el("section","amv-cms-case-section");
    s.append(el("h3","",title),el("p","",body));
    parent.append(s);
  }
  function gallery(items,parent){
    if(!Array.isArray(items)||!items.some(i=>safeImage(i&&i.image)))return;
    const sectionEl=el("section","amv-cms-case-section amv-cms-gallery");
    sectionEl.append(el("h3","","Galeria do projeto"));
    const gridEl=el("div","amv-cms-gallery-grid");
    items.slice(0,35).forEach(item=>{
      const img=photo(item);
      if(!img)return;
      const fig=el("figure");
      fig.append(img);
      if(item.caption)fig.append(el("figcaption","",String(item.caption).slice(0,350)));
      gridEl.append(fig);
    });
    sectionEl.append(gridEl);
    parent.append(sectionEl);
  }
  function stages(items,parent){
    if(!Array.isArray(items)||!items.length)return;
    const sectionEl=el("section","amv-cms-case-section");
    sectionEl.append(el("h3","","Etapas do projeto"));
    const ol=el("ol","amv-cms-case-steps");
    items.slice(0,35).forEach((item,index)=>{
      if(!item||!String(item.title||item.description||"").trim())return;
      const li=el("li");
      const n=el("span","amv-cms-step-number",String(index+1).padStart(2,"0"));
      const body=el("div","amv-cms-step-body");
      body.append(el("h4","",item.title||"Etapa "+(index+1)));
      if(item.description)body.append(el("p","",item.description));
      const img=photo(item);
      if(img){img.className="amv-cms-stage-image";body.append(img);}
      li.append(n,body);
      ol.append(li);
    });
    sectionEl.append(ol);
    parent.append(sectionEl);
  }
  function showDetails(project,trigger){
    focusReturn=trigger;
    dialog.replaceChildren();
    const close=el("button","amv-cms-project-dialog-close","×");
    close.type="button";close.setAttribute("aria-label","Fechar projeto");
    close.addEventListener("click",()=>dialog.close());
    dialog.append(close);
    const cover=photo(project,"amv-cms-project-dialog-cover");
    if(cover)dialog.append(cover);
    const body=el("div","amv-cms-project-dialog-body");
    body.append(el("span","amv-cms-project-dialog-tag",project.category||"Projeto"));
    body.append(el("h2","",project.title));
    const meta=[project.client,project.period].filter(x=>typeof x==="string"&&x.trim());
    if(meta.length){
      const row=el("div","amv-cms-case-meta");
      meta.forEach(item=>row.append(el("span","",String(item).slice(0,120))));
      body.append(row);
    }
    if(project.description)body.append(el("p","amv-cms-case-lead",project.description));
    section(body,"Apresentação",project.details);
    section(body,"O desafio",project.challenge);
    section(body,"A estratégia",project.approach);
    stages(project.steps,body);
    gallery(project.gallery,body);
    section(body,"Resultados e aprendizados",project.results);
    dialog.append(body);
    if(typeof dialog.showModal==="function")dialog.showModal();
    else dialog.setAttribute("open","");
    close.focus({preventScroll:true});
  }
  function makeCard(project){
    const article=el("article","v2-case amv-cms-project-card");
    const cover=el("div","v2-case-cover v2-portfolio-cover");
    const image=photo(project);
    if(image){image.width=680;image.height=240;cover.append(image);}
    else{
      const placeholder=el("span","amv-cms-cover-placeholder","AMV · PROJETO");
      cover.append(placeholder);
    }
    const body=el("div","v2-case-body");
    body.append(el("div","v2-case-label",project.category||"Projeto AMV"));
    body.append(el("h3","",project.title));
    body.append(el("p","",project.description||"Conheça os detalhes deste projeto."));
    const button=el("button","amv-cms-project-button","Conhecer projeto ↗");
    button.type="button";
    button.addEventListener("click",()=>showDetails(project,button));
    body.append(button);
    article.append(cover,body);
    return article;
  }
  fetch("assets/portfolio-items.json",{cache:"no-store"})
    .then(response=>response.ok?response.json():null)
    .then(data=>{
      const published=Array.isArray(data&&data.projects)
        ?data.projects.filter(p=>p&&p.published===true&&typeof p.title==="string"&&p.title.trim())
        :[];
      if(!published.length)return;
      grid.replaceChildren(...(home?published.slice(0,3):published).map(makeCard));
      if(home){
        const desc=home.querySelector(".v2-heading p");
        if(desc)desc.textContent="Conheça os projetos publicados e autorizados pela equipe AMV Conectar.";
      }else{
        const demo=host.querySelector(".v2-note");
        if(demo)demo.remove();
        const intro=hero.querySelector("p");
        if(intro)intro.textContent="Explore nossos trabalhos, processos criativos, imagens e resultados documentados.";
      }
    }).catch(()=>{ /* Sem dados, conservar os cartões demonstrativos existentes. */ });
})();
