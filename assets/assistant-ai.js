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
  stylesheet.href = "assets/assistant-ai.css?v=20261028-5perguntas";
  document.head.appendChild(stylesheet);

  const subtitle = panel.querySelector("header p.text-xs");
  if (subtitle) subtitle.textContent = "Pergunte sobre a AMV Conectar";
  const welcomeText = "Olá! Sou o Assistente AMV. As perguntas prontas têm respostas rápidas; para dúvidas digitadas, você tem até 5 perguntas à IA por dia.";
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
    '<p class="amv-ai-quota" role="status" aria-live="polite"></p>' +
    '<div class="amv-ai-footer"><span>Não envie senhas ou informações sensíveis.</span>' +
    '<button type="button" class="amv-ai-reset">Nova conversa</button></div>';
  panel.appendChild(form);

  const input = form.querySelector("#amv-ai-input");
  const submitButton = form.querySelector(".amv-ai-submit");
  const quotaDisplay = form.querySelector(".amv-ai-quota");
  const history = [];
  // Limite por dia e navegador (apenas número de envios, nunca o texto).
  // O reset do chat NÃO apaga a cota. Uma trava incontornável requer controle no Worker.
  const QUOTA_KEY = "amv-ai-cota-diaria-v1";
  const QUOTA_LIMIT = 5;
  let quotaFallback = {day:"",count:0};
  function currentDay() {
    const now = new Date();
    const pad = n => String(n).padStart(2,"0");
    return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  }
  function readUsage() {
    const day = currentDay();
    let stored = 0;
    try {
      const data = JSON.parse(localStorage.getItem(QUOTA_KEY) || "null");
      if (data && data.day === day && Number.isInteger(data.count)) {
        stored = Math.max(0,Math.min(QUOTA_LIMIT,data.count));
      }
    } catch (_) { /* Navegação privada pode restringir o armazenamento. */ }
    const fallback = quotaFallback.day === day ? quotaFallback.count : 0;
    return Math.max(stored,fallback);
  }
  function remaining() {
    return Math.max(0,QUOTA_LIMIT - readUsage());
  }
  function updateQuota() {
    const left = remaining();
    quotaDisplay.textContent = left === 0
      ? "Limite diário atingido (5/5). As perguntas prontas continuam disponíveis."
      : left === 1
        ? "Resta 1 pergunta à IA hoje. Perguntas prontas são ilimitadas."
        : "Restam " + left + " perguntas à IA hoje. Perguntas prontas são ilimitadas.";
    quotaDisplay.classList.toggle("amv-ai-quota--exhausted", left === 0);
    input.placeholder = left === 0 ? "Limite diário atingido" : "Digite sua pergunta...";
    input.disabled = busy || left === 0;
    submitButton.disabled = busy || left === 0;
    submitButton.textContent = busy ? "Enviando..." : left === 0 ? "Limite atingido" : "Enviar";
  }
  function consumeQuestion() {
    const count = readUsage();
    if (count >= QUOTA_LIMIT) return false;
    const next = {day:currentDay(),count:count + 1};
    quotaFallback = next;
    try { localStorage.setItem(QUOTA_KEY,JSON.stringify(next)); }
    catch (_) { /* Guarda pelo menos nesta página se storage estiver indisponível. */ }
    updateQuota();
    return true;
  }
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
    // Perguntas prontas não precisam da IA e seguem disponíveis mesmo durante o envio.
    updateQuota();
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
    // Limpa tanto mensagens da IA quanto respostas locais do FAQ, sem alterar o limite.
    const welcomeNode = messages.firstElementChild;
    Array.from(messages.children).forEach(function(node) {
      if (node !== questions && node !== welcomeNode) node.remove();
    });
    const nativeReset = questions.querySelector('[data-action="reset"]');
    if (nativeReset) nativeReset.remove();
    input.value = "";
    setBusy(false);
    restoreWelcome();
    messages.scrollTop = 0;
  }
  async function send(message) {
    const question = String(message || "").trim().slice(0, 600);
    if (!question || busy) return;
    // Só mensagens digitadas usam a IA. Cada envio conta uma vez, até 5 por dia.
    if (!consumeQuestion()) { updateQuota(); return; }
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
      answer.textContent = problem + " Você pode usar as perguntas prontas ou tentar novamente quando tiver perguntas à IA disponíveis.";
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
    send(input.value);
  });
  form.querySelector(".amv-ai-reset").addEventListener("click", resetConversation);

  // O FAQ é atendido exclusivamente pelo site.js, sem chamar o Worker/Groq.
  // Nunca interceptar os botões [data-faq] em fase de captura.

  window.addEventListener("storage", function (event) {
    if (event.key === QUOTA_KEY || event.key === null) updateQuota();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) updateQuota();
  });
  // Atualiza a interface ao iniciar, inclusive após atualizar ou recarregar a página.
  updateQuota();

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