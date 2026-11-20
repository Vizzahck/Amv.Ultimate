/* AMV V2 — equipe real cadastrada pelo Studio. Sem HTML remoto. */
(() => {
  "use strict";
  const container=document.querySelector("main#conteudo .v2-areas");
  if(!container)return;
  const allowedImage=src=>typeof src==="string"&&/^assets\/[a-z\d_./-]+\.(?:png|jpe?g|webp|avif|gif)$/i.test(src)&&!src.includes("..");
  const element=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const photo=(member)=>{
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
      const letter=element("span","amv-team-initials",String(member.name||"?").trim().slice(0,1).toUpperCase());
      wrap.append(letter);
    }
    return wrap;
  };
  const card=(member)=>{
    const article=element("article","v2-member");
    const detail=element("div","v2-member-name");
    detail.append(element("h3","",String(member.name||"").slice(0,100)));
    if(typeof member.role==="string"&&member.role.trim()){
      detail.append(element("p","v2-member-role",member.role.slice(0,120)));
    }
    article.append(photo(member),detail);
    return article;
  };
  fetch("assets/team-items.json",{cache:"no-store"})
    .then(response=>response.ok?response.json():null)
    .then(data=>{
      const areas=Array.isArray(data&&data.areas)?data.areas:[];
      let count=0;
      areas.forEach(area=>{
        if(!area || typeof area.id!=="string" || !/^[\w-]+$/.test(area.id))return;
        const section=container.querySelector(".v2-area[aria-labelledby='"+area.id+"']");
        if(!section)return;
        const members=Array.isArray(area.members)?area.members.filter(m=>
          m&&m.published===true&&typeof m.name==="string"&&m.name.trim()):[];
        if(!members.length)return;
        const grid=section.querySelector(".v2-members");
        if(!grid)return;
        grid.replaceChildren(...members.slice(0,80).map(card));
        const state=section.querySelector(".v2-area-state");
        if(state)state.textContent="Equipe cadastrada";
        count+=members.length;
      });
      if(count){
        const disclaimer=document.querySelector("main#conteudo .v2-note");
        if(disclaimer){
          disclaimer.textContent="Os integrantes identificados nesta página foram cadastrados pela equipe AMV. Áreas ainda sem integrantes publicados permanecem como exemplos de organização.";
        }
      }
    }).catch(()=>{ /* Na ausência de dados, manter o layout demonstrativo. */ });
})();
