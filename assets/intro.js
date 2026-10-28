/* AMV Ultimate V2 — abertura não bloqueante com controle de sessão. */
(() => {
  "use strict";
  const root = document.documentElement;
  const intro = document.getElementById("amv-intro");
  if (!intro || !root.classList.contains("amv-intro-pending")) {
    if (intro) intro.remove();
    return;
  }

  const key = "amv-intro-seen-v2-01";
  const skip = intro.querySelector(".amv-intro-skip");
  const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A abertura é uma apresentação, não um indicador de download.
  // Registramos o início para não repeti-la em cada página visitada.
  try { sessionStorage.setItem(key, "1"); } catch (_) {}

  let finished = false;
  let autoTimer;
  let cleanupTimer;
  const onKeyDown = event => {
    if (finished) return;
    if (event.key === "Escape") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Tab") {
      // O único controle interativo da abertura é "Pular".
      event.preventDefault();
      if (skip) skip.focus({preventScroll:true});
    }
  };
  const onVisibility = () => {
    if (document.hidden) finish(false);
  };
  function cleanup(restoreFocus) {
    root.classList.remove("amv-intro-pending", "amv-intro-leaving");
    if (intro.isConnected) intro.remove();
    document.removeEventListener("keydown",onKeyDown,true);
    document.removeEventListener("visibilitychange",onVisibility);
    if (restoreFocus) {
      const destination = document.querySelector("header a[href]") ||
        document.getElementById("conteudo");
      if (destination && typeof destination.focus === "function") {
        destination.focus({preventScroll:true});
      }
    }
  }
  function finish(wasSkipped) {
    if (finished) return;
    finished = true;
    window.clearTimeout(autoTimer);
    root.classList.remove("amv-intro-pending");
    if (wasSkipped || reduceMotion || document.hidden) {
      cleanup(Boolean(wasSkipped));
      return;
    }
    root.classList.add("amv-intro-leaving");
    cleanupTimer = window.setTimeout(() => cleanup(false),710);
  }

  if (reduceMotion) {
    finish(false);
    return;
  }
  if (skip) {
    skip.addEventListener("click", () => finish(true), {once:true});
    skip.focus({preventScroll:true});
  }
  document.addEventListener("keydown",onKeyDown,true);
  document.addEventListener("visibilitychange",onVisibility);
  autoTimer = window.setTimeout(() => finish(false),4550);
  // Garantia adicional caso a transição de saída seja interrompida.
  window.setTimeout(() => {
    if (intro.isConnected) cleanup(false);
  },7900);
})();
