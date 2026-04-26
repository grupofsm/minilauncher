(function () {
  const config = window.launcherConfig;

  const statusBox = document.getElementById("statusBox");
  const targetBox = document.getElementById("targetBox");
  const btnLaunch = document.getElementById("btnLaunch");
  const btnLaunchSub = document.getElementById("btnLaunchSub");
  const hint = document.getElementById("hint");
  const profileSelect = document.getElementById("profileSelect");
  const deviceSelect = document.getElementById("deviceSelect");

  let internalNetworkAvailable = false;
  let lastLatencyMs = null;

  function getProfile() {
    return profileSelect.value;
  }

  function getDevice() {
    return deviceSelect.value;
  }

  function getDeviceLabel() {
    return getDevice() === "mobile" ? "Smartphone" : "Desktop";
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

  function getLaunchTarget() {
    const profile = getProfile();
    const device = getDevice();

    if (profile === "standard") {
      return {
        mode: "standard",
        title: "Estándar vía SharePoint",
        description: "Sin conectores premium",
        url: device === "mobile" ? config.standardMobileAppUrl : config.standardDesktopAppUrl
      };
    }

    if (profile === "premium" && internalNetworkAvailable) {
      return {
        mode: "premium-direct",
        title: "Premium directo al HUB",
        description: "Red corporativa detectada",
        url: device === "mobile" ? config.premiumDirectMobileAppUrl : config.premiumDirectDesktopAppUrl
      };
    }

    return {
      mode: "premium-gateway",
      title: "Premium vía Gateway",
      description: "Sin red directa al HUB",
      url: device === "mobile" ? config.premiumGatewayMobileAppUrl : config.premiumGatewayDesktopAppUrl
    };
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

  function updateTargetUi() {
    const target = getLaunchTarget();

    targetBox.innerHTML =
      `Destino seleccionado: <strong>${target.title}</strong><br>` +
      `${target.description} · ${getDeviceLabel()}`;

    btnLaunchSub.textContent = target.title + " · " + getDeviceLabel();

    if (target.mode === "standard") {
      hint.textContent = "Perfil Estándar: se usará la versión basada en SharePoint, sin conectores premium.";
    } else if (target.mode === "premium-direct") {
      hint.textContent = "Perfil Premium: se usará la versión con conexión directa al HUB corporativo.";
    } else {
      hint.textContent = "Perfil Premium: se usará la versión con conectores premium a través del Gateway.";
    }
  }

  function setStatusChecking(attempt, total) {
    internalNetworkAvailable = false;
    lastLatencyMs = null;

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

    updateTargetUi();
  }

  function setStatusOnline(latencyMs) {
    internalNetworkAvailable = true;
    lastLatencyMs = latencyMs;

    let message = "✅ Red corporativa disponible";

    if (config.showLatency && typeof latencyMs === "number") {
      message += ` · ${latencyMs} ms`;
    }

    setStatus("online", `<span>${message}</span>`);
    updateTargetUi();
  }

  function setStatusOffline() {
    internalNetworkAvailable = false;
    lastLatencyMs = null;

    setStatus("offline", "<span>⚠️ Red corporativa no disponible</span>");
    updateTargetUi();
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
      internalNetworkAvailable = false;
      setStatus("checking", "<span>Comprobación automática desactivada</span>");
      updateTargetUi();
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
    updateTargetUi();
  });

  deviceSelect.addEventListener("change", function () {
    savePreferences();
    updateTargetUi();
  });

  btnLaunch.addEventListener("click", function () {
    const target = getLaunchTarget();

    showSpinner(`Conectando a ${target.title.toLowerCase()} (${getDeviceLabel().toLowerCase()})...`);

    setTimeout(function () {
      openUrl(target.url);
    }, 600);
  });

  loadPreferences();
  updateTargetUi();
  checkInternalNetwork();
})();