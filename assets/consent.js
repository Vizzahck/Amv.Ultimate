/* AMV Conectar — preferência opcional de armazenamento de tema.
   Não instala cookies, não ativa analytics, publicidade ou rastreadores.
   Guardar a escolha de privacidade é necessário para lembrar a recusa. */
(function () {
  "use strict";
  const consentKey = "amv-cookie-choice";
  const themeKey = "amv-theme";
  const values = ["accepted", "rejected"];

  function storedChoice() {
    try {
      const value = localStorage.getItem(consentKey);
      return values.includes(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function init() {
    if (document.getElementById("amv-cookie-banner")) return;

    const banner = document.createElement("section");
    banner.id = "amv-cookie-banner";
    banner.className = "amv-cookie-banner";
    banner.hidden = true;
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-labelledby", "amv-cookie-title");
    banner.setAttribute("aria-describedby", "amv-cookie-description");
    banner.innerHTML =
      '<div class="amv-cookie-copy">' +
        '<p class="amv-cookie-title" id="amv-cookie-title">Privacidade e preferências</p>' +
        '<p class="amv-cookie-description" id="amv-cookie-description">' +
          'Podemos salvar sua preferência de tema claro ou escuro neste navegador. ' +
          'Não utilizamos cookies de publicidade. Aceitar permite lembrar o tema; ' +
          'recusar não salva essa preferência. ' +
          '<a href="privacidade.html">Saiba mais</a>.' +
        '</p>' +
      '</div>' +
      '<div class="amv-cookie-buttons">' +
        '<button type="button" class="amv-cookie-button amv-cookie-reject" data-consent="rejected">Recusar</button>' +
        '<button type="button" class="amv-cookie-button amv-cookie-accept" data-consent="accepted">Aceitar</button>' +
      '</div>';
    document.body.appendChild(banner);

    function show() {
      banner.hidden = false;
      document.body.classList.add("amv-cookie-open");
    }
    function hide() {
      banner.hidden = true;
      document.body.classList.remove("amv-cookie-open");
    }
    function decide(choice) {
      try {
        localStorage.setItem(consentKey, choice);
        if (choice === "accepted") {
          localStorage.setItem(themeKey, document.documentElement.classList.contains("dark") ? "dark" : "light");
        } else {
          localStorage.removeItem(themeKey);
        }
      } catch (_) {
        // A escolha continua válida para esta página mesmo quando o navegador bloqueia armazenamento.
      }
      hide();
    }
    banner.querySelectorAll("[data-consent]").forEach(function (button) {
      button.addEventListener("click", function () {
        decide(button.dataset.consent);
      });
    });

    // O visitante pode reabrir o aviso a qualquer momento, em qualquer página.
    const footer = document.querySelector("footer");
    if (footer) {
      const footerContainer = footer.querySelector(".border-t") ||
        footer.querySelector(".privacy-wrap") || footer;
      const wrap = document.createElement("p");
      wrap.className = "amv-cookie-manage-wrap";
      const manage = document.createElement("button");
      manage.type = "button";
      manage.className = "amv-cookie-manage";
      manage.textContent = "Preferências de privacidade";
      manage.setAttribute("aria-controls", banner.id);
      manage.addEventListener("click", show);
      wrap.appendChild(manage);
      footerContainer.appendChild(wrap);
    }

    if (!storedChoice()) show();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();