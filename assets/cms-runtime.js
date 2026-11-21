/* AMV CMS v1 — overrides estáticos e seguros para as páginas públicas. */
(() => {
  "use strict";
  const PAGE = location.pathname.endsWith("/") ? "index.html" : location.pathname.split("/").pop();
  const SAFE_TAGS = new Set(["B","STRONG","EM","I","BR","SPAN","U","MARK","SMALL"]);
  const ALLOWED_ROOT = /^(?:main#conteudo|main\.privacy-main|footer)(?:\s*>|$)/;
  const VALID_IMAGE = /^(?:assets\/[\w./-]+\.(?:png|jpe?g|webp|gif|avif)|https:\/\/[^\s"'<>]+)$/i;
  function sanitizeHTML(html, doc=document) {
    const shell=doc.createElement("div");
    const template=doc.createElement("template");
    template.innerHTML=String(html||"");
    function clean(node, destination){
      if(node.nodeType===3){destination.append(doc.createTextNode(node.nodeValue));return;}
      if(node.nodeType!==1)return;
      if(!SAFE_TAGS.has(node.tagName)){
        for(const child of Array.from(node.childNodes))clean(child,destination);
        return;
      }
      const el=doc.createElement(node.tagName.toLowerCase());
      if(node.tagName==="SPAN" && node.className==="text-brand-orange")el.className="text-brand-orange";
      for(const child of Array.from(node.childNodes))clean(child,el);
      destination.append(el);
    }
    for(const node of Array.from(template.content.childNodes))clean(node,shell);
    return shell.innerHTML.slice(0,6000);
  }
  function safeImage(src) {return typeof src==="string"&&VALID_IMAGE.test(src);}
  function pageKey(doc=document){
    try {const p=new URL(doc.URL).pathname;return p.endsWith("/")?"index.html":p.split("/").pop();}
    catch(_){return PAGE;}
  }
  function pathFor(el){
    const parts=[];let node=el;
    while(node && node.nodeType===1){
      if(node.id==="conteudo"&&node.tagName==="MAIN"){parts.unshift("main#conteudo");break;}
      if(node.tagName==="MAIN"&&node.classList.contains("privacy-main")){parts.unshift("main.privacy-main");break;}
      if(node.tagName==="FOOTER"&&!node.closest("main")){parts.unshift("footer");break;}
      const parent=node.parentElement;
      if(!parent)return null;
      const siblings=Array.from(parent.children).filter(other=>other.tagName===node.tagName);
      parts.unshift(node.tagName.toLowerCase()+":nth-of-type("+(siblings.indexOf(node)+1)+")");
      node=parent;
    }
    const path=parts.join(" > ");
    return ALLOWED_ROOT.test(path)?path:null;
  }
  function applyToDocument(doc,data,key=pageKey(doc)){
    const entries=data&&data.pages&&data.pages[key];
    if(!entries||typeof entries!=="object")return 0;
    let count=0;
    for(const [selector,entry] of Object.entries(entries)){
      if(!ALLOWED_ROOT.test(selector)||selector.length>550||!entry||!["html","image"].includes(entry.type))continue;
      let node;try{node=doc.querySelector(selector);}catch(_){continue;}
      if(!node)continue;
      if(entry.type==="html"&&typeof entry.value==="string"&&!node.matches("script,style,form,button,input,textarea,select")){
        node.innerHTML=sanitizeHTML(entry.value,doc);count++;
      }
      if(entry.type==="image"&&node.tagName==="IMG"&&safeImage(entry.value)){
        node.src=entry.value;
        if(typeof entry.alt==="string")node.alt=entry.alt.slice(0,180);
        count++;
      }
    }
    return count;
  }
  window.AMVCMS={sanitizeHTML,safeImage,pageKey,pathFor,applyToDocument};
  if(document.documentElement.hasAttribute("data-amv-cms-admin")||new URLSearchParams(location.search).has("cmsPreview"))return;
  if(!document.querySelector("main#conteudo,main.privacy-main"))return;
  fetch("assets/content-overrides.json",{cache:"no-store"}).then(r=>r.ok?r.json():null)
    .then(data=>data&&applyToDocument(document,data,PAGE))
    .catch(()=>{});
})();
