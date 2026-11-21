/* AMV V2 — Rodapé e canais editáveis no Studio. Publico: somente dados JSON.
 * Sem HTML arbitrário, sem links com protocolos executáveis.
 */
(() => {
  "use strict";
  const defaults={
    footerLinks:{amv:"index.html",senac:"https://ma.senac.br/",developer:""},
    contacts:{
      whatsapp:"https://wa.me/5598984833670",
      email:"https://mail.google.com/mail/?view=cm&fs=1&to=amvconectar%40gmail.com",
      maps:"https://maps.app.goo.gl/efMrbSESCHAUTsFR6",
      instagram:""
    },
    footerImages:[],extraContacts:[]
  };
  function normalizeUrl(value){
    if(typeof value!=="string")return "";
    const s=value.trim();
    if(!s || s.length>1000 || /[\x00-\x1F\x7F<>"'\\]/.test(s)||s.startsWith("//"))return "";
    if(/^https:\/\/[^\s]+$/i.test(s)){
      try{
        const url=new URL(s);
        if(url.protocol==="https:"&&url.hostname&&!url.username&&!url.password)return url.href;
      }catch(_){}
      return "";
    }
    if(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s))return s;
    if(/^tel:\+?[0-9 ()-]{5,25}$/.test(s))return s;
    if(/^(?:index|quem-somos|missao|visao|valores|projetos|equipe|privacidade|projeto-integrador)\.html(?:#[a-z0-9_-]+)?$/i.test(s))return s;
    if(/^#[a-z0-9_-]+$/i.test(s))return s;
    return "";
  }
  function safeImage(src){
    return typeof src==="string"&&/^assets\/[\w./-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(src)&&
      !src.includes("..")&&!src.includes("//");
  }
  function normalizeInstagram(text){
    if(typeof text!=="string")return "";
    const s=text.trim();
    if(!s)return "";
    const handle=s.startsWith("@")?s.slice(1):s;
    if(/^[a-zA-Z0-9._]{1,30}$/.test(handle)&&!handle.startsWith(".")){
      return "https://www.instagram.com/"+handle+"/";
    }
    if(/^instagram\.com\/[a-zA-Z0-9._]+\/?$/i.test(s))return "https://www."+s.replace(/\/$/,"")+"/";
    return s;
  }
  const el=(doc,tag,cls,txt)=>{
    const item=doc.createElement(tag);
    if(cls)item.className=cls;
    if(txt!==undefined)item.textContent=String(txt);
    return item;
  };
  function assign(anchor,destination,description){
    const url=normalizeUrl(destination);
    if(url){
      anchor.setAttribute("href",url);
      const external=url.startsWith("https:");
      if(external){anchor.setAttribute("target","_blank");anchor.setAttribute("rel","noopener noreferrer");}
      else {anchor.removeAttribute("target");anchor.removeAttribute("rel");}
      anchor.removeAttribute("aria-disabled");
      if(description)anchor.setAttribute("aria-label",description);
    }else{
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      anchor.setAttribute("aria-disabled","true");
    }
    return !!url;
  }
  function socialIcon(doc,kind){
    const svg=el(doc,"svg");
    svg.setAttribute("viewBox","0 0 24 24");
    svg.setAttribute("fill","none");
    svg.setAttribute("stroke","currentColor");
    svg.setAttribute("stroke-width","1.8");
    svg.setAttribute("stroke-linecap","round");
    svg.setAttribute("stroke-linejoin","round");
    svg.setAttribute("width","21");
    svg.setAttribute("height","21");
    svg.setAttribute("aria-hidden","true");
    const instagram=kind==="instagram";
    const pieces=instagram?[
      ["rect",{x:"2",y:"2",width:"20",height:"20",rx:"6"}],
      ["circle",{cx:"12",cy:"12",r:"4"}],
      ["circle",{cx:"18",cy:"6",r:"1",fill:"currentColor",stroke:"none"}]
    ]:[["path",{d:"M7 17 17 7M8 7h9v9"}]];
    for(const [tag,attrs]of pieces){
      const child=doc.createElementNS("http://www.w3.org/2000/svg",tag);
      for(const [k,v]of Object.entries(attrs))child.setAttribute(k,v);
      svg.append(child);
    }
    return svg;
  }
  function applyToDocument(doc,input,options={}){
    if(!doc||!doc.body)return 0;
    const config=input&&typeof input==="object"?input:{};
    const contacts={...defaults.contacts,...config.contacts};
    const links={...defaults.footerLinks,...config.footerLinks};
    let modified=0;
    const footer=doc.querySelector("footer.bg-brand-panel");
    if(footer){
      const fixed={
        amv:footer.querySelector(".amv-footer-brand-row > a"),
        senac:footer.querySelector(".amv-footer-partner-link")
      };
      for(const [key,node]of Object.entries(fixed)){
        if(node){assign(node,links[key],"Visitar "+(key==="senac"?"SENAC":"AMV"));modified++;}
      }
      const developer=footer.querySelector(".amv-footer-developer");
      if(developer){
        const destination=normalizeUrl(links.developer);
        const old=developer.querySelector("a[data-amv-developer-link]");
        const img=developer.querySelector("img");
        if(img&&destination){
          const a=old||el(doc,"a");
          if(!old){a.dataset.amvDeveloperLink="1";img.replaceWith(a);a.append(img);}
          assign(a,destination,"Abrir site da VZ Sites Dev");
          modified++;
        }else if(old && img){
          old.replaceWith(img);
          modified++;
        }
      }
      const row=footer.querySelector(".amv-footer-brand-row");
      if(row){
        row.querySelectorAll("[data-amv-extra-image]").forEach(node=>node.remove());
        const images=Array.isArray(config.footerImages)?config.footerImages:[];
        for(const item of images.slice(0,35)){
          if(!item||typeof item.id!=="string"||!/^[\w-]{1,80}$/.test(item.id))continue;
          if(!item.published && !options.editing)continue;
          const imgUrl=normalizeUrl(item.href);
          const stored=safeImage(item.image)?item.image:"";
          const preview=options.previewImages&&options.previewImages.get(item.id);
          const src=(options.editing&&preview?preview:"")||stored;
          if(!src||(!imgUrl&&!options.editing))continue;
          const box=el(doc,"div","amv-footer-extra-logo");
          box.dataset.amvExtraImage=item.id;
          const a=el(doc,"a","amv-footer-extra-link");
          assign(a,imgUrl,String(item.name||"Logo parceiro").slice(0,100));
          if(src){
            const image=el(doc,"img");
            image.setAttribute("src",src);
            image.setAttribute("loading","lazy");
            image.setAttribute("decoding","async");
            image.setAttribute("alt",String(item.alt||item.name||"Logo parceiro").slice(0,180));
            a.append(image);
          }else{
            a.append(el(doc,"span","","Imagem ainda não enviada"));
          }
          box.append(a);
          row.append(box);
          modified++;
        }
      }
    }
    // Atualizar links de contato originais em todas as paginas (inclusive CTA e mapas).
    const oldDomains={
      whatsapp:[/^(https:\/\/wa\.me\/|https:\/\/api\.whatsapp\.com\/)/i],
      email:[/^https:\/\/mail\.google\.com\/mail\//i,/^mailto:/i],
      maps:[/^https:\/\/maps\.app\.goo\.gl\//i,/^https:\/\/www\.google\.com\/maps\//i]
    };
    for(const anchor of doc.querySelectorAll("a[href],a[data-amv-contact]")){
      if(anchor.closest("[data-amv-extra-image], [data-amv-extra-contact]"))continue;
      let kind=anchor.dataset.amvContact||"";
      const original=anchor.dataset.amvOriginalHref||anchor.getAttribute("href")||"";
      if(!kind)kind=Object.keys(oldDomains).find(k=>oldDomains[k].some(re=>re.test(original)))||"";
      if(!kind||!Object.hasOwn(contacts,kind))continue;
      if(!anchor.dataset.amvOriginalHref)anchor.dataset.amvOriginalHref=original;
      anchor.dataset.amvContact=kind;
      assign(anchor,contacts[kind]);
      modified++;
    }
    function addContact(host,item,kind,fromExtra=false){
      const url=normalizeUrl(item.href);
      if(!url)return;
      const text=String(item.label||"").trim().slice(0,65);
      if(!text)return;
      const anchor=el(doc,"a",host.matches(".amv-contact-options")?"amv-contact-option amv-cms-contact":"amv-cms-footer-contact");
      anchor.dataset.amvExtraContact=fromExtra?item.id:kind;
      assign(anchor,url,"Abrir "+text);
      anchor.append(socialIcon(doc,kind),el(doc,"span","amv-cms-link-label",text));
      if(host.matches(".amv-contact-options")){
        const caption=el(doc,"small","",kind==="instagram"?"Siga nossa página":String(item.description||"Acesse o link").slice(0,90));
        anchor.lastChild.append(caption);
      }
      host.append(anchor);
      modified++;
    }
    const extra=Array.isArray(config.extraContacts)?config.extraContacts.filter(i=>i&&i.published===true):[];
    const instagram=normalizeUrl(contacts.instagram);
    const places=doc.querySelectorAll(".amv-contact-options,footer.bg-brand-panel [aria-label='Canais de contato']");
    for(const place of places){
      place.querySelectorAll("[data-amv-extra-contact]").forEach(node=>node.remove());
      if(instagram)addContact(place,{href:instagram,label:"Instagram",description:"Siga a AMV"},"instagram",false);
      for(const item of extra.slice(0,35)){
        if(!item||!/^[\w-]{1,80}$/.test(String(item.id||"")))continue;
        addContact(place,item,"generic",true);
      }
    }
    return modified;
  }
  window.AMVLinks={defaults,normalizeUrl,normalizeInstagram,safeImage,applyToDocument};
  if(docIsAdmin())return;
  if(new URLSearchParams(location.search).has("cmsPreview"))return;
  // Um único carregamento: atualizar o site e armazenar links para botões criados depois.
  let cached=null;
  fetch("assets/links-overrides.json",{cache:"no-store"})
    .then(response=>response.ok?response.json():null)
    .then(data=>{
      if(!data)return;
      cached=data;
      applyToDocument(document,data);
    })
    .catch(()=>{});
  // Para links criados mais tarde por outros scripts, usar os mesmos destinos no clique.
  document.addEventListener("click",event=>{
    if(!cached||!event.target.closest)return;
    const link=event.target.closest("a[href]");
    if(!link)return;
    const href=link.getAttribute("href")||"";
    if(/^https:\/\/wa\.me\//i.test(href)&&normalizeUrl(cached.contacts&&cached.contacts.whatsapp)){
      assign(link,cached.contacts.whatsapp);
    }
  },true);
  function docIsAdmin(){return document.documentElement.hasAttribute("data-amv-cms-admin");}
})();
