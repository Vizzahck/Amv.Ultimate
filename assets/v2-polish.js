/* AMV V2: navegação inteligente e pequenos detalhes de interação. */
(() => {
  "use strict";
  const header = document.querySelector(".amv-smart-header");
  if (!header) return;
  let scheduled = false;
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isHome = document.querySelector(".v2-home") !== null;
  const desktopNav = header.querySelector('nav[aria-label="Navegação principal"]');
  const mobileNav = header.querySelector('nav[aria-label="Navegação móvel"]');
  const navigation = [desktopNav, mobileNav].filter(Boolean);
  const sectionMap = {
    inicio: "#inicio", sobre: null, servicos: "#servicos",
    projetos: "projetos.html", diferenciais: null,
    equipe: "equipe.html", "amv-em-acao": null, contato: "#contato"
  };
  const sections = isHome
    ? Array.from(document.querySelectorAll("main#conteudo > section[id]"))
      .filter(el => Object.prototype.hasOwnProperty.call(sectionMap, el.id))
    : [];

  function syncHeader(){
    header.classList.toggle("amv-header-compact", window.scrollY > 70);
    if (sections.length){
      const anchorY = Math.max(95, window.innerHeight * 0.29);
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= anchorY) current = section;
      }
      const target = sectionMap[current.id];
      for (const nav of navigation) {
        nav.querySelectorAll("a").forEach(link => {
          // Nunca substitui aria-current="page" de outra página.
          if (link.getAttribute("aria-current") === "location") {
            link.removeAttribute("aria-current");
          }
          link.classList.remove("amv-nav-active");
        });
        if (!target) continue;
        const link = Array.from(nav.querySelectorAll("a[href]")).find(a => a.getAttribute("href") === target);
        if (link) {
          link.classList.add("amv-nav-active");
          if (target.charAt(0) === "#") link.setAttribute("aria-current", "location");
        }
      }
    }
  }
  function onScroll(){
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      syncHeader();
      scheduled = false;
    });
  }
  syncHeader();
  window.addEventListener("scroll", onScroll, {passive:true});
  window.addEventListener("resize", onScroll, {passive:true});
  if (isHome) window.addEventListener("hashchange", onScroll);

  /* Um aviso de limite simples, sem gravar nenhuma informação do formulário. */
  const form = document.getElementById("contact-form");
  if (form){
    const message = form.querySelector('textarea[name="message"]');
    if (message) {
      const count = document.createElement("span");
      count.className = "amv-form-count";
      count.id = "amv-form-count";
      const oldDesc = message.getAttribute("aria-describedby");
      message.setAttribute("aria-describedby", [oldDesc, count.id].filter(Boolean).join(" "));
      message.after(count);
      function updateCount(){
        const remaining = Math.max(0, Number(message.maxLength) - message.value.length);
        count.textContent = remaining + " caracteres disponíveis";
        count.classList.toggle("amv-form-count--limit", remaining <= 90);
      }
      message.addEventListener("input", updateCount);
      form.addEventListener("reset", () => window.requestAnimationFrame(updateCount));
      updateCount();
    }
  }
  if (!reducedMotion && "IntersectionObserver" in window) {
    // Pequeno detalhe progressivo: somente o realce dos cartões, sem esconder conteúdo.
    const cards = document.querySelectorAll(".v2-home #servicos article, .v2-home #projetos .v2-case");
    const observer = new IntersectionObserver(entries => {
      for(const entry of entries) {
        if(entry.isIntersecting) {
          entry.target.classList.add("amv-in-view");
          observer.unobserve(entry.target);
        }
      }
    }, {threshold:0.1});
    cards.forEach(el=>observer.observe(el));
  }
})();
