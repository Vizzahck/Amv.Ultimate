/* AMV Ultimate V2 — rastro delicado e brilhos curtos ao clicar.
 * Canvas de baixo custo, sem bibliotecas, sem coleta de dados e sem eventos bloqueados.
 */
(() => {
  "use strict";
  if (!window.matchMedia || !window.requestAnimationFrame || !window.PointerEvent) return;

  const mouse = window.matchMedia("(pointer: fine) and (hover: hover)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!mouse.matches || reduced.matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "amv-pointer-effects";
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  const ctx = canvas.getContext("2d", {alpha: true});
  if (!ctx) return;
  document.body.appendChild(canvas);

  const trail = [];
  const glints = [];
  const TRAIL_AGE = 235;
  const GLINT_AGE = 480;
  const MAX_POINTS = 10;
  const MAX_GLINTS = 26;
  let width = 0, height = 0, dpr = 1;
  let frame = 0;
  let enabled = true;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear() {
    trail.length = 0;
    glints.length = 0;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    ctx.clearRect(0, 0, width, height);
  }

  function isEnabled() {
    return mouse.matches && !reduced.matches && !document.hidden;
  }

  function syncPreference() {
    enabled = isEnabled();
    canvas.hidden = !enabled;
    if (!enabled) clear();
    else resize();
  }

  function isBlockedTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest(
      "#amv-intro, .amv-search-backdrop, #amv-assistant, " +
      ".amv-snake-board-wrap, input, textarea, select, [contenteditable]"
    );
  }

  function effectsAllowed(event) {
    if (!enabled || event.pointerType !== "mouse" || isBlockedTarget(event.target)) return false;
    return !document.documentElement.matches(
      ".amv-intro-pending, .amv-intro-leaving, .amv-route-entering, .amv-route-exiting"
    );
  }

  function animate() {
    frame = 0;
    const now = performance.now();
    ctx.clearRect(0, 0, width, height);

    while (trail.length && now - trail[0].t >= TRAIL_AGE) trail.shift();
    while (glints.length && now - glints[0].t >= GLINT_AGE) glints.shift();

    // Traços azulados bem finos, mais transparentes conforme envelhecem.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < trail.length; i++) {
      const older = trail[i - 1];
      const newer = trail[i];
      const life = Math.max(0, 1 - (now - older.t) / TRAIL_AGE);
      ctx.beginPath();
      ctx.moveTo(older.x, older.y);
      ctx.lineTo(newer.x, newer.y);
      ctx.lineWidth = 0.45 + life * 0.6;
      ctx.strokeStyle = "rgba(77,157,200," + (life * 0.24).toFixed(3) + ")";
      ctx.stroke();
    }

    // Poucas partículas pequenas: brilho laranja ou azul que desaparece em < 0,5 s.
    for (const spark of glints) {
      const p = Math.min(1, (now - spark.t) / GLINT_AGE);
      const eased = 1 - Math.pow(1 - p, 2.3);
      const x = spark.x + Math.cos(spark.angle) * spark.distance * eased;
      const y = spark.y + Math.sin(spark.angle) * spark.distance * eased;
      const fade = Math.pow(1 - p, 1.6) * 0.65;
      if (fade <= 0) continue;
      const color = spark.warm ? "248,166,104" : "95,184,221";
      ctx.fillStyle = "rgba(" + color + "," + fade.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(x, y, spark.radius * (1 - p * .4), 0, Math.PI * 2);
      ctx.fill();
      if (spark.cross) {
        const half = 3 * (1 - p);
        ctx.strokeStyle = "rgba(" + color + "," + (fade * .8).toFixed(3) + ")";
        ctx.lineWidth = .8;
        ctx.beginPath();
        ctx.moveTo(x - half, y);
        ctx.lineTo(x + half, y);
        ctx.moveTo(x, y - half);
        ctx.lineTo(x, y + half);
        ctx.stroke();
      }
    }

    if (enabled && (trail.length || glints.length)) frame = requestAnimationFrame(animate);
  }

  function schedule() {
    if (!frame && enabled) frame = requestAnimationFrame(animate);
  }

  function onMove(event) {
    if (!effectsAllowed(event)) {
      if (trail.length) trail.length = 0;
      return;
    }
    const now = performance.now();
    const last = trail[trail.length - 1];
    const x = event.clientX, y = event.clientY;
    if (last && (Math.hypot(x - last.x, y - last.y) < 6 || now - last.t < 13)) return;
    trail.push({x, y, t: now});
    if (trail.length > MAX_POINTS) trail.shift();
    schedule();
  }

  function onClick(event) {
    if (event.button !== 0 || !effectsAllowed(event)) return;
    const now = performance.now();
    // Cinco partículas por clique, no máximo; sem explosões ou mudança do cursor.
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      glints.push({
        x: event.clientX, y: event.clientY, t: now,
        angle, distance: 13 + (i % 2) * 8,
        radius: i % 2 ? 1.25 : 1.65,
        warm: i % 2 === 0,
        cross: i === 0
      });
    }
    if (glints.length > MAX_GLINTS) glints.splice(0, glints.length - MAX_GLINTS);
    schedule();
  }

  resize();
  document.addEventListener("pointermove", onMove, {passive: true});
  document.addEventListener("pointerdown", onClick, {passive: true});
  window.addEventListener("resize", resize, {passive: true});
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", syncPreference);
  if (mouse.addEventListener) mouse.addEventListener("change", syncPreference);
  if (reduced.addEventListener) reduced.addEventListener("change", syncPreference);
})();
