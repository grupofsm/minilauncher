(function () {
  const config = window.launcherConfig;

  const statusBox = document.getElementById("statusBox");
  const btnInternal = document.getElementById("btnInternal");
  const btnExternal = document.getElementById("btnExternal");
  const hint = document.getElementById("hint");

  function openUrl(url) {
    window.open(url, config.openMode || "_self");
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function setStatus(cssClass, html) {
    statusBox.className = "status " + cssClass;
    statusBox.innerHTML = html;
  }

  function showTruck(message) {
    setStatus(
      "launching",
      `<span class="truck-loader">🚛</span><span>${message}</span>`
    );
  }

  function markRecommended(mode) {
    btnInternal.classList.remove("recommended");
    btnExternal.classList.remove("recommended");

    if (mode === "internal") {
      btnInternal.classList.add("recommended");
      hint.textContent = "Se recomienda trabajar en entorno corporativo para usar la vía rápida interna.";
    }

    if (mode === "external") {
      btnExternal.classList.add("recommended");
      hint.textContent = "Se recomienda trabajar en entorno público porque no se detecta acceso directo al HUB.";
    }
  }

  function setStatusChecking(attempt, total) {
    btnInternal.disabled = true;

    if (total > 1) {
      setStatus(
        "checking",
        `<span class="truck-loader">🚛</span><span>Comprobando red interna... intento ${attempt} de ${total}</span>`
      );
    } else {
      setStatus(
        "checking",
        `<span class="truck-loader">🚛</span><span>Comprobando red interna...</span>`
      );
    }

    hint.textContent = "Comprobando disponibilidad del entorno corporativo.";
  }

  function setStatusOnline(latencyMs) {
    btnInternal.disabled = false;

    let message = "✅ Red corporativa disponible";

    if (config.showLatency && typeof latencyMs === "number") {
      message += ` · ${latencyMs} ms`;
    }

    setStatus("online", `<span>${message}</span>`);
    markRecommended("internal");
  }

  function setStatusOffline() {
    btnInternal.disabled = true;
    setStatus("offline", "<span>⚠️ Red corporativa no disponible</span>");
    markRecommended("external");
  }

  async function checkHubOnce() {
    const controller = new AbortController();

    const timeout = setTimeout(function () {
      controller.abort();
    }, config.timeoutMs || 2000);

    const start = performance.now();

    try {
      const response = await fetch(config.hubHealthUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      clearTimeout(timeout);

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        return {
          ok: false,
          latencyMs: latencyMs
        };
      }

      const data = await response.json();

      return {
        ok: data && data.ok === true,
        latencyMs: latencyMs
      };

    } catch (error) {
      clearTimeout(timeout);

      return {
        ok: false,
        latencyMs: null
      };
    }
  }

  async function checkInternalNetwork() {
    if (!config.healthCheckEnabled) {
      btnInternal.disabled = false;
      setStatus("checking", "<span>Comprobación automática desactivada</span>");
      hint.textContent = "Puedes elegir manualmente cualquier acceso.";
      return;
    }

    const totalAttempts = Math.max(1, config.maxRetries || 1);

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      setStatusChecking(attempt, totalAttempts);

      const result = await checkHubOnce();

      if (result.ok === true) {
        setStatusOnline(result.latencyMs);
        return;
      }

      if (attempt < totalAttempts) {
        await sleep(config.retryDelayMs || 400);
      }
    }

    setStatusOffline();
  }

  btnInternal.addEventListener("click", function () {
    if (btnInternal.disabled) {
      return;
    }

    showTruck("Conectando a entorno corporativo...");

    setTimeout(function () {
      openUrl(config.internalAppUrl);
    }, 600);
  });

  btnExternal.addEventListener("click", function () {
    showTruck("Conectando a entorno público...");

    setTimeout(function () {
      openUrl(config.externalAppUrl);
    }, 600);
  });

  checkInternalNetwork();
})();