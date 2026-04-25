(function () {
  const config = window.launcherConfig;

  const statusBox = document.getElementById("statusBox");
  const btnInternal = document.getElementById("btnInternal");
  const btnExternal = document.getElementById("btnExternal");
  const hint = document.getElementById("hint");

  function openUrl(url) {
    window.open(url, config.openMode || "_self");
  }

  function setStatus(cssClass, html) {
    statusBox.className = "status " + cssClass;
    statusBox.innerHTML = html;
  }

  function showSpinner(message) {
    setStatus("launching", `<span class="spinner"></span>${message}`);
  }

  function markRecommended(mode) {
    btnInternal.classList.remove("recommended");
    btnExternal.classList.remove("recommended");

    if (mode === "internal") {
      btnInternal.classList.add("recommended");
      hint.textContent = "Recomendado: acceso interno.";
    }

    if (mode === "external") {
      btnExternal.classList.add("recommended");
      hint.textContent = "Recomendado: acceso externo.";
    }
  }

  function setStatusChecking() {
    btnInternal.disabled = true;
    setStatus("checking", `<span class="spinner"></span>Comprobando red interna...`);
    hint.textContent = "Comprobando disponibilidad del entorno corporativo.";
  }

  function setStatusOnline() {
    btnInternal.disabled = false;
    setStatus("online", "Red interna disponible");
    markRecommended("internal");
  }

  function setStatusOffline() {
    btnInternal.disabled = true;
    setStatus("offline", "Red interna no disponible");
    markRecommended("external");
  }

  async function checkInternalNetwork() {
    if (!config.healthCheckEnabled) {
      btnInternal.disabled = false;
      setStatus("checking", "Comprobación automática desactivada");
      hint.textContent = "Puedes elegir manualmente cualquier acceso.";
      return;
    }

    setStatusChecking();

    const controller = new AbortController();
    const timeout = setTimeout(function () {
      controller.abort();
    }, config.timeoutMs || 2500);

    try {
      const response = await fetch(config.hubHealthUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        setStatusOffline();
        return;
      }

      const data = await response.json();

      if (data && data.ok === true) {
        setStatusOnline();
      } else {
        setStatusOffline();
      }

    } catch (error) {
      clearTimeout(timeout);
      setStatusOffline();
    }
  }

  btnInternal.addEventListener("click", function () {
    if (btnInternal.disabled) {
      return;
    }

    showSpinner("Conectando a entorno corporativo...");

    setTimeout(function () {
      openUrl(config.internalAppUrl);
    }, 600);
  });

  btnExternal.addEventListener("click", function () {
    showSpinner("Conectando a entorno público...");

    setTimeout(function () {
      openUrl(config.externalAppUrl);
    }, 600);
  });

  checkInternalNetwork();
})();