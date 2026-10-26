(function(){
'use strict';
const menu=document.getElementById('amv-mobile-menu');
const menuButton=document.querySelector('[data-action="menu"]');
const panel=document.getElementById('amv-assistant');
const toggle=document.querySelector('[data-action="assistant-toggle"]');
const messages=document.getElementById('assistant-messages');
const questions=document.getElementById('assistant-questions');
const welcome=messages.firstElementChild.cloneNode(true);
const moon='<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>';
const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>';
function syncTheme(){const dark=document.documentElement.classList.contains('dark');document.querySelectorAll('[data-action="theme"]').forEach(b=>{const label=dark?'Ativar modo claro':'Ativar modo escuro';b.setAttribute('aria-pressed',String(dark));b.setAttribute('aria-label',label);b.title=label;const svg=b.querySelector('svg');if(svg)svg.innerHTML=dark?sun:moon; if(b.closest('#amv-mobile-menu')){Array.from(b.childNodes).filter(n=>n.nodeType===3).forEach(n=>n.remove());b.prepend(document.createTextNode(label));}});}
function setMenu(open){if(!menu||!menuButton)return;menu.hidden=!open;menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');menuButton.querySelector('svg').innerHTML=open?'<path d="m18 6-12 12M6 6l12 12"/>':'<path d="M4 6h16M4 12h16M4 18h16"/>';}
function setAssistant(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){panel.focus({preventScroll:true});messages.scrollTop=messages.scrollHeight;}}
function reset(){Array.from(messages.children).forEach(n=>{if(n!==questions)n.remove();});messages.prepend(welcome.cloneNode(true));const resetButton=questions.querySelector('[data-action="reset"]');if(resetButton)resetButton.remove();messages.scrollTop=0;}
function addMessage(text,user){const el=document.createElement('div');el.className=user?'ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground':'max-w-[90%] text-sm leading-6 text-foreground';el.textContent=text;messages.insertBefore(el,questions);return el;}
function ask(index){const faq=window.AMV_FAQS[index];if(!faq)return;addMessage(faq.q,true);const answer=addMessage(faq.a,false);if(faq.whatsapp){const a=document.createElement('a');a.href='https://wa.me/5598984833670';a.target='_blank';a.rel='noopener noreferrer';a.className='mt-2 inline-flex items-center gap-2 rounded-md bg-brand-orange px-3 py-2 text-sm font-bold text-on-panel';a.textContent='Falar pelo WhatsApp';answer.append(a);}if(!questions.querySelector('[data-action="reset"]')){const b=document.createElement('button');b.type='button';b.dataset.action='reset';b.className='inline-flex items-center gap-2 self-start px-1 py-2 text-sm font-bold text-brand-orange';b.textContent='Voltar ao início';questions.append(b);}answer.scrollIntoView({behavior:'smooth',block:'nearest'});}

let themeMotionTimeout;
function setThemeWithMotion(){
 const root=document.documentElement;
 function applyTheme(){
  const dark=root.classList.toggle('dark');
  try{
   if(localStorage.getItem('amv-cookie-choice')==='accepted'){
    localStorage.setItem('amv-theme',dark?'dark':'light');
   }else{localStorage.removeItem('amv-theme');}
  }catch(e){}
  syncTheme();
 }
 if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){applyTheme();return;}
 if(typeof document.startViewTransition==='function'){
  try{const vt=document.startViewTransition(applyTheme);vt.finished.catch(()=>{});return;}catch(e){}
 }
 root.classList.add('amv-theme-switching');
 applyTheme();
 if(themeMotionTimeout)window.clearTimeout(themeMotionTimeout);
 themeMotionTimeout=window.setTimeout(()=>root.classList.remove('amv-theme-switching'),500);
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return; if(b.hasAttribute('data-faq')){ask(Number(b.dataset.faq));return;}switch(b.dataset.action){case'theme':{setThemeWithMotion();break;}case'menu':setMenu(menu.hidden);break;case'assistant-toggle':setAssistant(panel.hidden);break;case'assistant-minimizar':setAssistant(false);toggle.focus({preventScroll:true});break;case'assistant-fechar':setAssistant(false);reset();toggle.focus({preventScroll:true});break;case'reset':reset();break;}});
menu.addEventListener('click',e=>{if(e.target.closest('a'))setMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);if(!panel.hidden){setAssistant(false);toggle.focus({preventScroll:true});}}});
// Envia o formulario ao Formspree. Sem JS, o action/method do HTML continuam funcionando.
const form=document.getElementById('contact-form');
if(form)form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!form.checkValidity()){form.reportValidity();return;}
  const status=document.getElementById('contact-status');
  const submit=form.querySelector('button[type="submit"]');
  const originalLabel=submit.innerHTML;
  submit.disabled=true;
  submit.setAttribute('aria-busy','true');
  status.hidden=false;
  status.textContent='Enviando sua mensagem...';
  try{
    const response=await fetch(form.action,{
      method:'POST',
      body:new FormData(form),
      headers:{'Accept':'application/json'}
    });
    if(!response.ok){
      let errorMessage='Não foi possível enviar sua mensagem. Tente novamente em instantes.';
      if(response.status===429)errorMessage='Muitas tentativas de envio. Aguarde um pouco e tente novamente.';
      throw new Error(errorMessage);
    }
    status.textContent='Mensagem enviada com sucesso! Agradecemos seu contato.';
    form.reset();
  }catch(error){
    status.textContent=(error.message && (error.message.startsWith('Não foi possível') || error.message.startsWith('Muitas tentativas')))?error.message:'Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.';
  }finally{
    submit.disabled=false;
    submit.removeAttribute('aria-busy');
    submit.innerHTML=originalLabel;
  }
});
syncTheme();
})();
