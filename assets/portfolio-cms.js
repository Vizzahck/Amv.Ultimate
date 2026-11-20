/* AMV CMS — portfólio publicado a partir de dados aprovados no painel. */
(() => {
  "use strict";
  const home=document.querySelector("main#conteudo #projetos");
  const page=document.querySelector("main#conteudo .v2-page-hero");
  if(!home&&!page)return;
  const host=home||page.parentElement;
  const grid=host.querySelector(".v2-cards");
  if(!grid)return;

  const dialog=document.createElement("dialog");
  dialog.className="amv-cms-project-dialog";
  dialog.setAttribute("aria-label","Detalhes do projeto");
  document.body.append(dialog);
  let focusReturn=null;
  dialog.addEventListener("close",()=>{if(focusReturn && focusReturn.isConnected)focusReturn.focus({preventScroll:true});});

  function element(tag,className,text){
    const e=document.createElement(tag);
    if(className)e.className=className;
    if(text!==undefined)e.textContent=text;
    return e;
  }
  const allowedImage=src=>typeof src==="string"&&/^assets\/[\w./-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(src);
  function showDetails(project,button){
    focusReturn=button;
    dialog.replaceChildren();
    const close=element("button","amv-cms-project-dialog-close","×");
    close.type="button";close.setAttribute("aria-label","Fechar detalhes");
    close.addEventListener("click",()=>dialog.close());
    dialog.append(close);
    if(allowedImage(project.image)){
      const image=element("img","amv-cms-project-dialog-cover");image.src=project.image;image.alt=project.alt||project.title||"Imagem do projeto";
      image.loading="lazy";dialog.append(image);
    }
    const content=element("div","amv-cms-project-dialog-body");
    content.append(element("span","amv-cms-project-dialog-tag",project.category||"Projeto"));
    content.append(element("h2","",project.title));
    content.append(element("p","",project.description||""));
    if(project.details)content.append(element("p","",project.details));
    dialog.append(content);
    if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
    close.focus({preventScroll:true});
  }
  function card(project){
    const article=element("article","v2-case amv-cms-project-card");
    const cover=element("div","v2-case-cover v2-portfolio-cover");
    if(allowedImage(project.image)){
      const img=element("img");img.src=project.image;img.alt=project.alt||project.title||"Imagem do projeto";
      img.width=680;img.height=240;img.loading="lazy";img.decoding="async";cover.append(img);
    }else{
      const placeholder=element("span","", "AMV · PROJETO");
      placeholder.style.cssText="display:grid;place-items:center;width:100%;height:100%;min-height:165px;font-weight:900;color:#e7f2ff;background:linear-gradient(120deg,#0a2948,#17618b)";
      cover.append(placeholder);
    }
    const body=element("div","v2-case-body");
    body.append(element("div","v2-case-label",project.category||"Projeto AMV"));
    body.append(element("h3","",project.title));
    body.append(element("p","",project.description||""));
    const button=element("button","amv-cms-project-button","Conhecer projeto ↗");
    button.type="button";button.addEventListener("click",()=>showDetails(project,button));
    body.append(button);
    article.append(cover,body);
    return article;
  }
  fetch("assets/portfolio-items.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{
    const published=Array.isArray(data&&data.projects)?data.projects.filter(p=>p&&p.published===true && typeof p.title==="string"&&p.title.trim()):[];
    if(!published.length)return; // Nenhum projeto aprovado: preservar demonstrações honestas.
    const visible=home?published.slice(0,3):published;
    grid.replaceChildren(...visible.map(card));
    if(home){
      const description=home.querySelector(".v2-heading p");
      if(description)description.textContent="Conheça os projetos realizados e autorizados para publicação pela equipe AMV.";
    }else{
      const note=host.querySelector(".v2-note");
      if(note)note.remove();
      const intro=page.querySelector("p");
      if(intro)intro.textContent="Projetos e trabalhos cadastrados e publicados pela equipe AMV Conectar.";
    }
  }).catch(()=>{ /* Site permanece funcional sem o arquivo JSON. */ });
})();
