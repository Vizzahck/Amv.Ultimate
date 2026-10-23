/* Assistente AMV: extensão opcional de IA; não contém chaves privadas.
   Se AMV_AI_ENDPOINT estiver vazio, o FAQ existente permanece inalterado. */
(function () {
  "use strict";
  const endpoint = String(window.AMV_AI_ENDPOINT || "").trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?\/[a-z0-9/_?=&.-]*$/i.test(endpoint)) return;

  const panel = document.getElementById("amv-assistant");
  const messages = document.getElementById("assistant-messages");
  const questions = document.getElementById("assistant-questions");
  if (!panel || !messages || !questions || !Array.isArray(window.AMV_FAQS)) return;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "assets/assistant-ai.css?v=20261022-ordem3";
  document.head.appendChild(stylesheet);

  const subtitle = panel.querySelector("header p.text-xs");
  if (subtitle) subtitle.textContent = "Pergunte sobre a AMV Conectar";
  const welcomeText = "Olá! Sou o Assistente AMV com IA. Escreva sua dúvida ou escolha uma das sugestões.";
  if (messages.firstElementChild) messages.firstElementChild.textContent = welcomeText;

  const form = document.createElement("form");
  form.className = "amv-ai-form";
  form.setAttribute("aria-label", "Perguntas para o Assistente AMV");
  form.innerHTML =
    '<label class="amv-ai-label" for="amv-ai-input">Sua pergunta</label>' +
    '<div class="amv-ai-row"><input id="amv-ai-input" name="message" type="text" ' +
    'autocomplete="off" maxlength="600" required placeholder="Digite sua pergunta..." ' +
    'aria-label="Digite sua pergunta sobre a AMV"/>' +
    '<button class="amv-ai-submit" type="submit">Enviar</button></div>' +
    '<div class="amv-ai-footer"><span>Não envie senhas ou informações sensíveis.</span>' +
    '<button type="button" class="amv-ai-reset">Nova conversa</button></div>';
  panel.appendChild(form);

  const input = form.querySelector("#amv-ai-input");
  const submitButton = form.querySelector(".amv-ai-submit");
  const history = [];
  let controller = null;
  let busy = false;
  let generation = 0;

  function addBubble(value, role) {
    const bubble = document.createElement("div");
    bubble.className = "amv-ai-bubble " + (role === "user" ? "amv-ai-user" : "amv-ai-bot");
    bubble.textContent = value;
    // Os atalhos do FAQ ficam no topo; a conversa segue abaixo, em ordem cronológica.
    messages.appendChild(bubble);
    bubble.scrollIntoView({behavior:"smooth",block:"nearest"});
    return bubble;
  }
  function setBusy(flag) {
    busy = flag;
    submitButton.disabled = flag;
    input.disabled = flag;
    questions.querySelectorAll("button[data-faq]").forEach(function (button) {
      button.disabled = flag;
    });
    submitButton.textContent = flag ? "Enviando..." : "Enviar";
  }
  function restoreWelcome() {
    if (messages.firstElementChild && !messages.firstElementChild.matches(".amv-ai-bubble")) {
      messages.firstElementChild.textContent = welcomeText;
    }
  }
  function resetConversation() {
    generation++;
    if (controller) controller.abort();
    controller = null;
    history.length = 0;
    messages.querySelectorAll(".amv-ai-bubble").forEach(function (node) { node.remove(); });
    input.value = "";
    setBusy(false);
    restoreWelcome();
    messages.scrollTop = 0;
  }
  async function send(message, faq) {
    const question = String(message || "").trim().slice(0, 600);
    if (!question || busy) return;
    const prior = history.slice(-8);
    const currentGeneration = ++generation;
    controller = new AbortController();
    addBubble(question, "user");
    const answer = addBubble("Pensando na sua pergunta...", "bot");
    input.value = "";
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {"Content-Type":"application/json", "Accept":"application/json"},
        body: JSON.stringify({ message: question, history: prior }),
        signal: controller.signal
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || typeof data.answer !== "string" || !data.answer.trim()) {
        const error = new Error("Não foi possível obter a resposta da IA.");
        error.status = response.status;
        throw error;
      }
      if (currentGeneration !== generation) return;
      // Respostas literárias especiais podem ultrapassar 2.000 caracteres.
      // A Groq já limita respostas comuns no backend; 12.000 permite o slam completo.
      answer.textContent = data.answer.trim().slice(0, 12000);
      history.push({role:"user",content:question},{role:"assistant",content:answer.textContent});
      if (history.length > 8) history.splice(0, history.length - 8);
    } catch (error) {
      if (currentGeneration !== generation || error.name === "AbortError") return;
      const problem = error.status === 429
        ? "O assistente atingiu o limite de uso por enquanto."
        : "A IA está indisponível neste momento.";
      if (faq && typeof faq.a === "string") {
        answer.textContent = problem + " Aqui vai a resposta rápida: " + faq.a;
        if (faq.whatsapp) {
          const link = document.createElement("a");
          link.href = "https://wa.me/5598984833670";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = " Falar pelo WhatsApp";
          link.className = "amv-ai-whatsapp";
          answer.appendChild(link);
        }
      } else {
        answer.textContent = problem + " Você pode tentar novamente ou selecionar uma das perguntas rápidas.";
      }
    } finally {
      if (currentGeneration === generation) {
        controller = null;
        setBusy(false);
        answer.scrollIntoView({behavior:"smooth",block:"nearest"});
      }
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    send(input.value, null);
  });
  form.querySelector(".amv-ai-reset").addEventListener("click", resetConversation);

  // O site original trata perguntas rápidas no document (fase bubble).
  // Interceptar apenas esses botões mantém o menu, tema e Formspree intactos.
  questions.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-faq]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const faq = window.AMV_FAQS[Number(button.dataset.faq)];
    if (faq) send(faq.q, faq);
  }, true);

  document.addEventListener("click", function (event) {
    if (event.target.closest('[data-action="assistant-fechar"]')) {
      resetConversation();
      // O script legado repõe a saudação logo depois do fechamento.
      queueMicrotask(restoreWelcome);
    }
    if (event.target.closest('[data-action="assistant-toggle"]')) {
      queueMicrotask(restoreWelcome);
    }
  }, true);
})();