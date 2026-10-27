/* AMV Ultimate V2 — processos ilustrativos do portfólio. */
(() => {
 "use strict";
 const processes = {
  identidade:{
   title:"Marca com propósito",
   subtitle:"Da pesquisa inicial à construção de uma identidade visual coerente.",
   output:"Briefing, conceito, paleta de cores, tipografia, peças-modelo e orientações de aplicação.",
   steps:[
    ["Briefing e contexto","Compreender o propósito da marca, seus valores, público e mensagem principal antes de decidir o visual."],
    ["Pesquisa e referências","Investigar o segmento e reunir referências de linguagem, tipografia e cores para orientar as escolhas."],
    ["Conceito visual","Explorar composições de símbolo, nome, cores e elementos que traduzam o posicionamento."],
    ["Aplicações e testes","Verificar contraste, legibilidade e consistência em peças digitais, materiais impressos e formatos reduzidos."],
    ["Organização da entrega","Registrar a proposta e criar orientações para manter a identidade consistente em futuras peças."]
   ]
  },
  campanha:{
   title:"Campanha com estratégia",
   subtitle:"Do objetivo inicial a um plano de comunicação capaz de orientar as ações.",
   output:"Objetivos definidos, público prioritário, conceito criativo, propostas de peças e calendário de divulgação.",
   steps:[
    ["Objetivo e diagnóstico","Identificar a necessidade de comunicação e definir que resultado a campanha buscaria alcançar."],
    ["Pesquisa de público","Analisar interesses, necessidades e canais para escolher uma mensagem pertinente."],
    ["Conceito criativo","Construir a ideia central e os elementos de texto e imagem que conectam as peças."],
    ["Planejamento dos canais","Definir formatos, cronograma, responsáveis e recursos adequados para divulgar a campanha."],
    ["Avaliação de resultados","Escolher indicadores que permitiriam acompanhar alcance e resposta do público, caso a campanha fosse executada."]
   ]
  },
  digital:{
   title:"Conexão nas redes",
   subtitle:"Organização editorial para produzir conteúdos relevantes e avaliar seu desempenho.",
   output:"Pilares editoriais, calendário de publicações, propostas de peças e indicadores de acompanhamento.",
   steps:[
    ["Diagnóstico dos canais","Entender os objetivos da comunicação, o perfil do público e os canais onde ele está presente."],
    ["Pilares de conteúdo","Definir temas e tom de voz que orientem publicações úteis, reconhecíveis e consistentes."],
    ["Calendário editorial","Distribuir pautas, datas, formatos e chamadas para ação dentro de uma rotina viável."],
    ["Criação e revisão","Preparar textos, peças e variações para tela pequena, conferindo clareza e acessibilidade."],
    ["Métricas e melhoria","Observar alcance, interações e outros indicadores relevantes para orientar os próximos conteúdos."]
   ]
  }
 };
 function init(){
  const triggers=document.querySelectorAll(".amv-process-trigger[data-amv-process]");
  if(!triggers.length || !HTMLDialogElement) return;
  const dialog=document.createElement("dialog");
  dialog.className="amv-process-dialog";
  dialog.setAttribute("aria-labelledby","amv-process-dialog-title");
  dialog.setAttribute("aria-describedby","amv-process-dialog-subtitle");
  dialog.innerHTML=[
   '<div class="amv-process-head"><div>',
   '<span class="amv-process-overline">AMV CONECTAR · POR DENTRO DO PROCESSO</span>',
   '<h2 id="amv-process-dialog-title"></h2><p id="amv-process-dialog-subtitle"></p></div>',
   '<button class="amv-process-close" type="button" aria-label="Fechar explicação">×</button></div>',
   '<div class="amv-process-main"><p class="amv-process-section-label">Etapas do processo</p>',
   '<ol class="amv-process-steps"></ol>',
   '<div class="amv-process-output"><strong>O que este processo pode entregar</strong><p></p></div>',
   '<p class="amv-process-notice">Este roteiro é um exemplo educativo de fluxo de trabalho. As imagens e os conceitos apresentados não representam uma entrega realizada para um cliente.</p>',
   '<button class="amv-process-back" type="button">Voltar aos projetos</button></div>'
  ].join("");
  document.body.appendChild(dialog);
  const closeButton=dialog.querySelector(".amv-process-close");
  let previousFocus=null;
  const close=()=>dialog.close();
  closeButton.addEventListener("click",close);
  dialog.querySelector(".amv-process-back").addEventListener("click",close);
  dialog.addEventListener("close",()=>{if(previousFocus && previousFocus.isConnected)previousFocus.focus()});
  dialog.addEventListener("click",event=>{
   if(event.target!==dialog)return;
   const rect=dialog.getBoundingClientRect();
   if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)close();
  });
  triggers.forEach(trigger=>{
   trigger.addEventListener("click",()=>{
    const process=processes[trigger.dataset.amvProcess];
    if(!process)return;
    previousFocus=trigger;
    dialog.querySelector("#amv-process-dialog-title").textContent=process.title;
    dialog.querySelector("#amv-process-dialog-subtitle").textContent=process.subtitle;
    dialog.querySelector(".amv-process-output p").textContent=process.output;
    const list=dialog.querySelector(".amv-process-steps");
    list.replaceChildren();
    process.steps.forEach(([title,description],index)=>{
     const li=document.createElement("li");
     const num=document.createElement("span");
     num.className="amv-process-step-num";
     num.textContent=String(index+1).padStart(2,"0");
     const content=document.createElement("div");
     const heading=document.createElement("h3");
     heading.textContent=title;
     const paragraph=document.createElement("p");
     paragraph.textContent=description;
     content.append(heading,paragraph);
     li.append(num,content);
     list.append(li);
    });
    dialog.showModal();
    dialog.scrollTop=0;
    closeButton.focus();
   });
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();
