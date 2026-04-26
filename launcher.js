(function () {
  const config = window.launcherConfig;

  const statusBox = document.getElementById("statusBox");
  const btnInternal = document.getElementById("btnInternal");
  const btnExternal = document.getElementById("btnExternal");
  const hint = document.getElementById("hint");
  const profileSelect = document.getElementById("profileSelect");
  const deviceSelect = document.getElementById("deviceSelect");

  let internalNetworkAvailable = false;

  function getProfile() {
    return profileSelect.value;
  }

  function getDevice() {
    return deviceSelect.value;
  }

  function savePreferences() {
    localStorage.setItem("launcherProfile", getProfile());
    localStorage.setItem("launcherDevice", getDevice());
  }

  function loadPreferences() {
    const savedProfile = localStorage.getItem("launcherProfile") || config.defaultProfile || "standard";
    const savedDevice = localStorage.getItem("launcherDevice") || config.defaultDevice || "desktop";

    profileSelect.value = savedProfile;
    deviceSelect.value = savedDevice;
  }

  function getInternalUrl() {
    return getDevice() === "mobile"
      ? config.internalMobileAppUrl
      : config.internalDesktopAppUrl;
  }

  function getExternalUrl() {
    return getDevice() === "mobile"
      ? config.externalMobileAppUrl
      : config.externalDesktopAppUrl;
  }

  function openUrl(url) {
    window.open(url, config.openMode || "_self");
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function setStatus(cssClass, html) {
    statusBox.className = "status " + cssClass;
    statusBox.innerHTML = html;
  }

  function showSpinner(message) {
    setStatus("launching", `<span class="spinner"></span><span>${message}</span>`);
  }

  function clearRecommended() {
    btnInternal.classList.remove("recommended");
    btnExternal.classList.remove("recommended");
  }

  function recommendInternal() {
    clearRecommended();
    btnInternal.classList.add("recommended");
    hint.textContent = "Se recomienda entorno corporativo: perfil Premium y red interna disponible.";
  }

  function recommendExternal(reason) {
    clearRecommended();
    btnExternal.classList.add("recommended");
    hint.textContent = reason;
  }

  function refreshButtonsAndRecommendation() {
    const profile = getProfile();

    if (profile === "standard") {
      btnInternal.disabled = true;
      recommendExternal("Perfil Estándar seleccionado: se usará entorno público mediante SharePoint y Power Automate.");
      return;
    }

    if (profile === "premium" && internalNetworkAvailable) {
      btnInternal.disabled = false;
      recommendInternal();
      return;
    }

    btnInternal.disabled = true;
    recommendExternal("Perfil Premium seleccionado, pero no se detecta red corporativa. Se recomienda entorno público.");
  }

  function setStatusChecking(attempt, total) {
    internalNetworkAvailable = false;
    btnInternal.disabled = true;

    if (total > 1) {
      setStatus(
        "checking",
        `<span class="spinner"></span><span>Comprobando red interna... intento ${attempt} de ${total}</span>`
      );
    } else {
      setStatus(
        "checking",
        `<span class="spinner"></span><span>Comprobando red interna...</span>`
      );
    }

    hint.textContent = "Comprobando disponibilidad del entorno corporativo.";
  }

  function setStatusOnline(latencyMs) {
    internalNetworkAvailable = true;

    let message = "✅ Red corporativa disponible";

    if (config.showLatency && typeof latencyMs === "number") {
      message += ` · ${latencyMs} ms`;
    }

    setStatus("online", `<span>${message}</span>`);
    refreshButtonsAndRecommendation();
  }

  function setStatusOffline() {
    internalNetworkAvailable = false;
    setStatus("offline", "<span>⚠️ Red corporativa no disponible</span>");
    refreshButtonsAndRecommendation();
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
        return { ok: false, latencyMs };
      }

      const data = await response.json();

      return {
        ok: data && data.ok === true,
        latencyMs
      };

    } catch (error) {
      clearTimeout(timeout);
      return { ok: false, latencyMs: null };
    }
  }

  async function checkInternalNetwork() {
    if (!config.healthCheckEnabled) {
      internalNetworkAvailable = true;
      setStatus("checking", "<span>Comprobación automática desactivada</span>");
      refreshButtonsAndRecommendation();
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

  profileSelect.addEventListener("change", function () {
    savePreferences();
    refreshButtonsAndRecommendation();
  });

  deviceSelect.addEventListener("change", function () {
    savePreferences();
    refreshButtonsAndRecommendation();
  });

  btnInternal.addEventListener("click", function () {
    if (btnInternal.disabled) {
      return;
    }

    const deviceText = getDevice() === "mobile" ? "smartphone" : "desktop";
    showSpinner(`Conectando a entorno corporativo (${deviceText})...`);

    setTimeout(function () {
      openUrl(getInternalUrl());
    }, 600);
  });

  btnExternal.addEventListener("click", function () {
    const deviceText = getDevice() === "mobile" ? "smartphone" : "desktop";
    showSpinner(`Conectando a entorno público (${deviceText})...`);

    setTimeout(function () {
      openUrl(getExternalUrl());
    }, 600);
  });

  loadPreferences();
  checkInternalNetwork();
})();