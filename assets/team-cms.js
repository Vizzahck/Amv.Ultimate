/* AMV V2 — áreas e integrantes 100% dinâmicos, com conteúdo aprovado no Studio.
 * Construção segura via textContent, sem inserir HTML fornecido pelo editor.
 */
(() => {
  "use strict";
  const main=document.querySelector("main#conteudo");
  const container=main&&main.querySelector(".v2-areas");
  if(!container)return;
  const allowedImage=src=>typeof src==="string"&&/^assets\/[a-z\d_./-]+\.(?:png|jpe?g|webp|avif|gif)$/i.test(src)&&!src.includes("..");
  const element=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const renderPhoto=(member)=>{
    const wrap=element("div","v2-member-image");
    if(allowedImage(member.image)){
      const img=element("img");
      img.src=member.image;
      img.alt=typeof member.alt==="string"&&member.alt.trim()?member.alt:"Foto de "+member.name;
      img.loading="lazy";img.decoding="async";
      wrap.append(img);
    }else{
      wrap.setAttribute("role","img");
      wrap.setAttribute("aria-label","Participante sem fotografia cadastrada");
      wrap.append(element("span","amv-team-initials",String(member.name||"?").trim().slice(0,1).toUpperCase()));
    }
    return wrap;
  };
  const memberCard=member=>{
    const article=element("article","v2-member");
    article.dataset.teamMemberId=String(member.id||"");
    const details=element("div","v2-member-name");
    details.append(element("h3","",String(member.name||"").slice(0,100)));
    if(typeof member.role==="string"&&member.role.trim()){
      details.append(element("p","v2-member-role",member.role.slice(0,120)));
    }
    article.append(renderPhoto(member),details);
    return article;
  };
  function emptyCard(){
    const article=element("article","v2-member v2-member--empty");
    const photo=element("div","v2-member-image");
    photo.setAttribute("aria-hidden","true");
    photo.append(element("span","amv-team-initials","✦"));
    const detail=element("div","v2-member-name");
    detail.append(element("h3","","Integrantes em breve"));
    article.append(photo,detail);
    return article;
  }
  function buildArea(area,index){
    const id=area.id;
    const section=element("section","v2-area");
    section.setAttribute("aria-labelledby",id);
    const header=element("div","v2-area-head");
    const titleWrap=element("div","v2-area-title");
    const number=element("span","v2-area-number",String(index+1).padStart(2,"0"));
    number.setAttribute("aria-hidden","true");
    const headingWrap=element("div");
    const heading=element("h2","",String(area.title||"Área da equipe").slice(0,100));
    heading.id=id;
    const description=element("p","",String(area.description||"").slice(0,400));
    headingWrap.append(heading);
    if(description.textContent.trim())headingWrap.append(description);
    titleWrap.append(number,headingWrap);
    const members=Array.isArray(area.members)?area.members.filter(m=>
      m&&m.published===true&&typeof m.name==="string"&&m.name.trim()):[];
    const state=element("span","v2-area-state",members.length?"Equipe cadastrada":"Em preparação");
    header.append(titleWrap,state);
    const grid=element("div","v2-members");
    grid.append(...(members.length?members.slice(0,80).map(memberCard):[emptyCard()]));
    section.append(header,grid);
    return {section,count:members.length};
  }
  fetch("assets/team-items.json",{cache:"no-store"})
    .then(response=>response.ok?response.json():null)
    .then(data=>{
      if(!data||!Array.isArray(data.areas))return;
      const areas=data.areas.filter(area=>
        area&&typeof area.id==="string"&&/^[\w-]+$/.test(area.id)&&
        typeof area.title==="string"&&area.title.trim()).slice(0,60);
      const known=new Set();
      const rendered=[];
      let count=0;
      areas.forEach(area=>{
        if(known.has(area.id))return;
        known.add(area.id);
        const result=buildArea(area,rendered.length);
        rendered.push(result.section);
        count+=result.count;
      });
      // Uma área excluída no Studio não pode ressurgir do HTML ilustrativo.
      container.replaceChildren(...rendered);
      if(!rendered.length){
        container.append(element("p","v2-team-empty-note","A equipe está em organização. As áreas serão divulgadas em breve."));
      }
      const disclaimer=main.querySelector(".v2-note");
      if(disclaimer){
        disclaimer.textContent=count
          ?"Conheça os integrantes autorizados para publicação. Áreas sem participantes confirmados permanecem em preparação."
          :"A organização da equipe está em preparação. Os nomes e fotografias serão publicados após confirmação e autorização.";
      }
    }).catch(()=>{/* Em caso de conexão indisponível, preservar conteúdo ilustrativo. */});
})();
