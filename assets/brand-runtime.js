/* AMV V2 — Identidade visual editável, compartilhada entre páginas e temas.
 * A posição é aplicada ao invólucro das duas versões: modo claro e escuro
 * usam as MESMAS coordenadas e a mesma escala. A malha existe só no Studio.
 */
(() => {
  "use strict";
  const SLOTS={
    header:{
      label:"Isologo do cabeçalho",
      mode:"pair",
      wrapper:"header.amv-smart-header .amv-theme-logo--header",
      light:"header.amv-smart-header .amv-theme-logo--header img.amv-brand-image--light",
      dark:"header.amv-smart-header .amv-theme-logo--header img.amv-brand-image--dark"
    },
    hero:{
      label:"Logo principal da capa",
      mode:"pair",
      wrapper:"main#conteudo #inicio .amv-theme-logo--hero",
      light:"main#conteudo #inicio .amv-theme-logo--hero img.amv-brand-image--light",
      dark:"main#conteudo #inicio .amv-theme-logo--hero img.amv-brand-image--dark"
    },
    footer:{
      label:"Logo AMV no rodapé",
      mode:"pair",
      wrapper:"footer.bg-brand-panel .amv-theme-logo--footer",
      light:"footer.bg-brand-panel .amv-theme-logo--footer img.amv-brand-image--light",
      dark:"footer.bg-brand-panel .amv-theme-logo--footer img.amv-brand-image--dark"
    },
    senac:{
      label:"Sublogo SENAC",
      mode:"single",
      wrapper:"footer.bg-brand-panel .amv-footer-partner-link",
      single:"footer.bg-brand-panel .amv-footer-partner img"
    },
    developer:{
      label:"Assinatura VZ Sites Dev",
      mode:"single",
      wrapper:"footer.bg-brand-panel .amv-footer-developer",
      single:"footer.bg-brand-panel .amv-footer-developer img"
    },
    intro:{
      label:"Logo da abertura",
      mode:"single",
      wrapper:"#amv-intro .amv-intro-logo img",
      single:"#amv-intro .amv-intro-logo img"
    }
  };
  const variants=slot=>SLOTS[slot]&&SLOTS[slot].mode==="pair"?["light","dark"]:["single"];
  const safeImage=src=>typeof src==="string"&&
    /^assets\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|avif|gif)$/i.test(src)&&
    !src.includes("..")&&!src.includes("//");
  const bounded=(value,min,max,defaultValue)=>{
    const n=Number(value);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):defaultValue;
  };
  const normalizeLayout=value=>({
    x:bounded(value&&value.x,-180,180,0),
    y:bounded(value&&value.y,-180,180,0),
    scale:bounded(value&&value.scale,60,150,100)
  });
  function image(doc,slot,variant) {
    const def=SLOTS[slot];
    if(!def||!def[variant])return null;
    return doc.querySelector(def[variant]);
  }
  function wrapper(doc,slot) {
    const def=SLOTS[slot];
    return def&&doc.querySelector(def.wrapper);
  }
  function applyToDocument(doc,data){
    const slots=data&&data.slots&&typeof data.slots==="object"?data.slots:{};
    let changes=0;
    for(const [slot,settings] of Object.entries(slots)){
      if(!Object.hasOwn(SLOTS,slot)||!settings||typeof settings!=="object")continue;
      const target=wrapper(doc,slot);
      if(!target)continue;
      const layout=normalizeLayout(settings.layout);
      target.style.setProperty("transform",
        "translate("+layout.x+"px, "+layout.y+"px) scale("+(layout.scale/100)+")",
        "important");
      target.style.setProperty("transform-origin","center center","important");
      target.dataset.amvBrandSlot=slot;
      changes++;
      for(const variant of variants(slot)){
        const node=image(doc,slot,variant);
        const option=settings.images&&settings.images[variant];
        if(!node||!option||typeof option!=="object")continue;
        if(safeImage(option.src)){node.setAttribute("src",option.src);changes++;}
        if(typeof option.alt==="string"){
          node.alt=option.alt.slice(0,180);changes++;
        }
      }
    }
    return changes;
  }
  function locate(doc,node){
    if(!node || !(node instanceof doc.defaultView.Element))return null;
    for(const [slot]of Object.entries(SLOTS)){
      const container=wrapper(doc,slot);
      if(container && (container===node||container.contains(node))){
        const names=variants(slot);
        const selected=names.find(v=>image(doc,slot,v)===node);
        return {slot,variant:selected||names[0]};
      }
    }
    return null;
  }
  window.AMVBrand={SLOTS,variants,safeImage,normalizeLayout,image,wrapper,applyToDocument,locate};
  if(document.documentElement.hasAttribute("data-amv-cms-admin"))return;
  if(new URLSearchParams(location.search).has("cmsPreview"))return;
  fetch("assets/brand-overrides.json",{cache:"no-store"})
    .then(r=>r.ok?r.json():null)
    .then(data=>data&&applyToDocument(document,data))
    .catch(()=>{ /* Sem conexao: manter as imagens originais do HTML. */});
})();
