(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const panel = $("#maintenancePanel");
  const completion = $("#maintenanceCompletion");
  const workspace = $("#maintenanceWorkspace");
  const feedback = $("#maintenanceFeedback");
  const actionButton = $("#maintenanceAction");
  const toolPicker = $("#toolPicker");
  const stageNames = [
    "Preparar o computador",
    "Limpar os contatos do módulo de RAM",
    "Remover o cooler com cuidado",
    "Limpar a superfície do processador",
    "Limpar a base do cooler",
    "Aguardar a secagem",
    "Remover a poeira da placa-mãe",
    "Limpar todas as faces do cooler",
    "Aplicar a pasta térmica nova",
    "Reinstalar o cooler e conectar o cabo",
    "Inspeção final"
  ];
  const thermalProfiles = {
    standard: { label: "Processador padrão", coverage: 0.7 },
    compact: { label: "Processador compacto", coverage: 0.65 },
    large: { label: "Processador amplo", coverage: 0.8 }
  };
  const state = {
    available: false,
    active: false,
    complete: false,
    step: 0,
    selectedTool: null,
    safety: 0,
    errors: [],
    errorCount: 0,
    cleaning: {},
    coolerFace: 0,
    maxCoolerFace: 0,
    drying: false,
    dryRemaining: 0,
    dryTimer: null,
    clothPrepared: false,
    contactCleanerPrepared: false,
    connectorClean: false,
    coolerRemoved: false,
    coolerReinstalled: false,
    fanConnected: false,
    paste: [],
    pasteOverflow: 0,
    pasteProfile: "standard",
    inspected: false
  };
  const coolerViews = ["Cima", "Baixo", "Frente", "Trás", "Esquerda", "Direita"];
  function showFeedback(message, kind = "info") {
    feedback.textContent = message;
    feedback.className = `maintenance-alert ${kind}`;
    feedback.hidden = false;
    feedback.style.visibility = message ? "visible" : "hidden";
  }

  function recordError(message) {
    state.errorCount += 1;
    if (!state.errors.includes(message)) state.errors.push(message);
    showFeedback(message, "warning");
  }

  function setTool(tool) {
    state.selectedTool = tool;
    $$(".tool-button", toolPicker).forEach((button) => {
      button.classList.toggle("selected", button.dataset.tool === tool);
      button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
    });
  }

  function updateProgress() {
    const percent = state.complete ? 100 : Math.round((state.step / 11) * 100);
    $("#maintenanceProgressText").textContent = `${percent}%`;
    $("#maintenanceProgressBar").style.width = `${percent}%`;
    $("#maintenanceStep").textContent = state.complete
      ? "CONCLUÍDO"
      : `ETAPA ${state.step + 1} DE 11`;
  }

  function updateStage(title, instructions) {
    $("#maintenanceTitle").textContent = title;
    $("#maintenanceInstructions").textContent = instructions;
    updateProgress();
  }

  function advanceStage() {
    state.step += 1;
    state.selectedTool = null;
    state.clothPrepared = false;
    state.contactCleanerPrepared = false;
    actionButton.hidden = true;
    showFeedback("");
    renderStage();
  }

  function stageAction(label, callback) {
    actionButton.onpointerdown = null;
    actionButton.onpointerup = null;
    actionButton.textContent = label;
    actionButton.hidden = false;
    actionButton.onclick = callback;
  }

  function toolHint(tool, action) {
    const labels = {
      eraser: "a borracha branca macia",
      brush: "o pincel antiestático",
      alcohol: "o álcool isopropílico",
      cloth: "o pano sem fiapos",
      contact: "o limpa-contato próprio para eletrônicos",
      paste: "a pasta térmica"
    };
    showFeedback(`Selecione ${labels[tool]}${action ? ` e ${action}` : ""}.`);
  }

  function getCleaning(key, cols, rows, dirtRate = 0.72, layers = 2) {
    const existing = state.cleaning[key];
    if (existing) return existing;
    const values = Array.from({ length: cols * rows }, (_, index) => {
      const seed = (index * 37 + key.length * 19 + rows * 13) % 100;
      return seed < dirtRate * 100 ? 1 + ((seed + index) % layers) : 0;
    });
    const surface = { cols, rows, values, layers };
    state.cleaning[key] = surface;
    return surface;
  }

  function getCleanPercent(surface) {
    const clean = surface.values.filter((amount) => amount === 0).length;
    return Math.round((clean / surface.values.length) * 100);
  }

  function surfaceMarkup(key, cols, rows, options = {}) {
    const surface = getCleaning(key, cols, rows, options.dirtRate, options.layers);
    const cells = surface.values.map((amount, index) =>
      `<i class="dirt-cell ${amount ? "dirty" : ""}" data-cell="${index}" style="--dirt:${amount}"></i>`
    ).join("");
    return `<div class="clean-surface ${options.className || ""}"
                 data-surface="${key}" data-cols="${cols}" data-rows="${rows}"
                 style="--cols:${cols};--rows:${rows}" aria-label="${options.label || "Superfície de limpeza"}">
              ${options.art || ""}
              <div class="dirt-grid">${cells}</div>
            </div>`;
  }

  function progressMarkup(id, label, value = 0) {
    return `<div class="clean-meter">
      <div><span>${label}</span><strong id="${id}">${value}%</strong></div>
      <div class="progress"><div class="progress-bar" id="${id}Bar" style="width:${value}%"></div></div>
    </div>`;
  }

  function updateMeter(id, percent) {
    const text = $(`#${id}`);
    const bar = $(`#${id}Bar`);
    if (!text || !bar) return;
    text.textContent = `${percent}%`;
    bar.style.width = `${percent}%`;
  }

  function updateCleaningMeter(key, meterId) {
    const surface = state.cleaning[key];
    const percent = getCleanPercent(surface);
    updateMeter(meterId, percent);
    const remaining = surface.values.filter((amount) => amount > 0).length;
    const regionText = $("#remainingRegions");
    if (regionText) {
      regionText.textContent = remaining
        ? `${remaining} pontos ainda apresentam resíduos.`
        : "Nenhum resíduo visível. A superfície está limpa.";
    }
    return percent;
  }

  function renderSafety() {
    const tasks = [
      ["Desligar completamente o computador", "Desligue o computador antes de abrir o gabinete."],
      ["Desconectar o cabo de alimentação", "Retire o cabo da tomada e da fonte."],
      ["Confirmar que está desenergizado", "Aguarde e confirme que não há energia conectada."]
    ];
    workspace.innerHTML = `<div class="safety-sequence">
      <div class="safety-visual"><span class="power-symbol">⏻</span><strong>COMPUTADOR</strong><small id="safetyStatus">Ligado e conectado</small></div>
      <div class="safety-controls">${tasks.map((task, index) =>
        `<button type="button" class="safety-button" data-safety="${index}" ${index > 0 ? "disabled" : ""}>
          <span>${index + 1}</span><span><strong>${task[0]}</strong><small>${task[1]}</small></span>
        </button>`
      ).join("")}</div>
    </div>`;
    $$(".safety-button", workspace).forEach((button) => {
      button.addEventListener("click", () => {
        const task = Number(button.dataset.safety);
        if (task !== state.safety) {
          recordError("Siga a preparação na ordem: desligar, desconectar e confirmar.");
          return;
        }
        button.classList.add("done");
        button.disabled = true;
        state.safety += 1;
        const next = $(`[data-safety="${state.safety}"]`, workspace);
        if (next) next.disabled = false;
        $("#safetyStatus").textContent = [
          "Computador desligado",
          "Alimentação desconectada",
          "Sistema desenergizado"
        ][task];
        showFeedback(task === 0
          ? "Agora desconecte a alimentação antes de tocar nos componentes."
          : task === 1
            ? "Aguarde e confirme que o computador está desenergizado."
            : "Ótimo. O computador está seguro para a manutenção.");
        if (state.safety === 3) {
          stageAction("Começar a limpeza", advanceStage);
        }
      });
    });
  }

  function renderRam() {
    const key = "ram-contacts";
    const surface = getCleaning(key, 12, 5, 0.48, 2);
    workspace.innerHTML = `<div class="ram-lesson">
      <div class="lesson-note"><strong>Exercício didático</strong><span>A borracha é usada aqui apenas para demonstrar a limpeza de contatos. Não é um método universal nem preferencial para contatos eletrônicos; siga sempre as orientações do fabricante.</span></div>
      <div class="ram-module">
        <div class="ram-label">MÓDULO DE MEMÓRIA DDR4</div>
        <div class="ram-board">
          <span class="ram-chip">MEMORY</span><span class="ram-chip">8 GB</span>
          <div class="ram-gold-contacts clean-surface" data-surface="${key}" data-cols="${surface.cols}" data-rows="${surface.rows}" style="--cols:${surface.cols};--rows:${surface.rows}">
            <div class="dirt-grid">${surface.values.map((amount, index) => `<i class="dirt-cell ${amount ? "dirty" : ""}" data-cell="${index}" style="--dirt:${amount}"></i>`).join("")}</div>
          </div>
          <div class="direction-arrow"><span>Direção correta</span><b>INÍCIO ━━━━━━━━━━━ ▶ FIM</b></div>
        </div>
      </div>
      ${progressMarkup("ramCleanPercent", "Contatos limpos", getCleanPercent(surface))}
      <p class="remaining-regions" id="remainingRegions"></p>
      <ul class="care-tips">
        <li>Utilize a borracha apenas nos contatos de ouro.</li>
        <li>Não esfregue com força.</li>
        <li>Siga a direção indicada pela seta.</li>
        <li>Remova os resíduos antes de reinstalar a memória.</li>
      </ul>
    </div>`;
    $("#remainingRegions").textContent = `${surface.values.filter(Boolean).length} pontos ainda apresentam resíduos.`;
    bindCleaningSurface(key, "ramCleanPercent", "eraser", {
      direction: "right",
      wrongDirection: "Siga a direção indicada pela seta, da esquerda para a direita."
    });
  }

  function renderWipeSurface(key, title, kind, tool) {
    const surface = getCleaning(key, 10, 7, 0.82, 2);
    const art = kind === "cpu"
      ? '<div class="cpu-illustration"><span>CPU</span><small>SUPERFÍCIE METÁLICA</small></div>'
      : '<div class="cooler-base-art"><span>BASE DO COOLER</span><i></i></div>';
    workspace.innerHTML = `<div class="component-cleaning">
      <div class="surface-caption"><span>${title}</span><small>Arraste o pano sobre toda a superfície; várias passadas removem os resíduos aos poucos.</small></div>
      ${surfaceMarkup(key, 10, 7, { className: kind === "cpu" ? "cpu-surface" : "cooler-base-surface", art, label: title })}
      ${progressMarkup("wipePercent", "Limpeza da superfície", getCleanPercent(surface))}
      <p class="remaining-regions" id="remainingRegions"></p>
      <p class="surface-legend">Manchas escuras indicam pasta térmica antiga. Não avance enquanto houver resíduos.</p>
    </div>`;
    $("#remainingRegions").textContent = `${surface.values.filter(Boolean).length} regiões ainda apresentam pasta antiga.`;
    bindCleaningSurface(key, "wipePercent", tool);
  }

  function renderDrying() {
    workspace.innerHTML = `<div class="drying-card">
      <div class="drying-icon">◌</div><strong>Secagem natural</strong>
      <p>Deixe o processador e a base do cooler secarem completamente antes de aplicar qualquer pasta nova.</p>
      <div class="dry-countdown" id="dryCountdown">Pronto para iniciar</div>
    </div>`;
    stageAction("Iniciar secagem", () => {
      if (state.drying) return;
      state.drying = true;
      state.dryRemaining = 5;
      actionButton.disabled = true;
      $("#dryCountdown").textContent = `Aguarde ${state.dryRemaining} segundos`;
      state.dryTimer = setInterval(() => {
        state.dryRemaining -= 1;
        if (state.dryRemaining > 0) {
          $("#dryCountdown").textContent = `Aguarde ${state.dryRemaining} segundos`;
        } else {
          clearInterval(state.dryTimer);
          state.dryTimer = null;
          state.drying = false;
          $("#dryCountdown").textContent = "Superfícies completamente secas";
          actionButton.disabled = false;
          actionButton.textContent = "Continuar para a placa-mãe";
          actionButton.onclick = advanceStage;
          showFeedback("Secagem concluída. Agora o pincel antiestático pode ser usado na placa-mãe.");
        }
      }, 1000);
    });
  }

  function renderMotherboard() {
    const key = "motherboard-dust";
    const surface = getCleaning(key, 12, 8, 0.68, 2);
    const labels = [
      "Dissipadores", "Socket e área próxima", "Slots de memória",
      "Conectores traseiros", "Slots PCIe", "Portas SATA"
    ];
    workspace.innerHTML = `<div class="board-cleaning">
      <div class="surface-caption"><span>Placa-mãe desenergizada</span><small>Use somente o pincel antiestático. Nunca aplique líquidos diretamente na placa ou nos componentes.</small></div>
      <div class="motherboard-lesson clean-surface" data-surface="${key}" data-cols="12" data-rows="8" style="--cols:12;--rows:8">
        <span class="board-part socket-part">SOCKET</span>
        <span class="board-part ram-part">DIMM 1 · 2 · 3 · 4</span>
        <span class="board-part heatsink-part">DISSIPADOR</span>
        <span class="board-part pcie-part">PCIe x16</span>
        <span class="board-part sata-part">SATA</span>
        <span class="board-part connector-part">CONECTORES</span>
        <div class="dirt-grid">${surface.values.map((amount, index) => `<i class="dirt-cell ${amount ? "dirty" : ""}" data-cell="${index}" style="--dirt:${amount}"></i>`).join("")}</div>
      </div>
      <div class="dust-regions">${labels.map((label) => `<span>• ${label}</span>`).join("")}</div>
      ${progressMarkup("boardCleanPercent", "Poeira removida", getCleanPercent(surface))}
      <p class="remaining-regions" id="remainingRegions"></p>
    </div>`;
    $("#remainingRegions").textContent = `${surface.values.filter(Boolean).length} áreas ainda estão empoeiradas.`;
    bindCleaningSurface(key, "boardCleanPercent", "brush");
  }

  function renderCoolerFaces() {
    const view = coolerViews[state.coolerFace];
    const key = `cooler-face-${state.coolerFace}`;
    const surface = getCleaning(key, 8, 6, 0.72, 2);
    const faceProgress = coolerViews.reduce((total, _, index) => {
      const face = state.cleaning[`cooler-face-${index}`];
      return total + (face ? getCleanPercent(face) : 0);
    }, 0);
    const percent = Math.round(faceProgress / coolerViews.length);
    workspace.innerHTML = `<div class="cooler-explorer">
      <div class="face-controls" aria-label="Orientação do cooler">
        ${coolerViews.map((label, index) =>
          `<button type="button" data-face="${index}" class="${index === state.coolerFace ? "selected" : ""}" ${index > state.maxCoolerFace ? "disabled" : ""}>${label}</button>`
        ).join("")}
      </div>
      <div class="cooler-view-label">VISTA: ${view.toUpperCase()}</div>
      <div class="cooler-model ${state.coolerFace < 2 ? "fan-view" : "fin-view"}">
        <div class="fan-frame"><div class="fan-blades-static">✣</div></div>
        <div class="heatsink-fins"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        ${surfaceMarkup(key, 8, 6, { className: "cooler-face-surface", dirtRate: 0.72, layers: 2, label: `Cooler, vista ${view}` })}
      </div>
      <p class="surface-legend">A ventoinha fica imóvel. Examine e limpe esta face com o pincel antiestático.</p>
      ${progressMarkup("coolerCleanPercent", "Limpeza total das seis orientações", percent)}
      <p class="remaining-regions" id="remainingRegions"></p>
    </div>`;
    const current = $(`[data-surface="${key}"]`, workspace);
    current.style.setProperty("--cols", "8");
    current.style.setProperty("--rows", "6");
    $$(".face-controls button", workspace).forEach((button) => {
      button.addEventListener("click", () => {
        state.coolerFace = Number(button.dataset.face);
        const selectedFace = state.cleaning[`cooler-face-${state.coolerFace}`];
        const faceIsClean = selectedFace && getCleanPercent(selectedFace) === 100;
        showFeedback(faceIsClean
          ? `Vista ${coolerViews[state.coolerFace]} já limpa. Selecione outra orientação disponível para continuar.`
          : `Vista ${coolerViews[state.coolerFace]} selecionada. Limpe todas as regiões antes de avançar.`);
        renderCoolerFaces();
      });
    });
    updateCoolerRemaining();
    bindCleaningSurface(key, "coolerCleanPercent", "brush", { coolerViews: true });
    const allClean = coolerViews.every((_, index) => {
      const face = state.cleaning[`cooler-face-${index}`];
      return face && getCleanPercent(face) === 100;
    });
    if (allClean) {
      stageAction("Concluir limpeza do cooler", advanceStage);
    } else {
      actionButton.hidden = true;
    }
  }

  function updateCoolerRemaining() {
    const remaining = coolerViews.reduce((sum, _, index) => {
      const face = state.cleaning[`cooler-face-${index}`];
      return sum + (face ? face.values.filter(Boolean).length : 0);
    }, 0);
    $("#remainingRegions").textContent = `${remaining} regiões com poeira nas seis orientações.`;
  }

  function getPasteMetrics() {
    const packageCells = state.paste.filter((_, index) => isPackageCell(index));
    const covered = packageCells.filter((amount) => amount > 0).length;
    const target = thermalProfiles[state.pasteProfile].coverage;
    const coverage = covered / packageCells.length;
    const uniformCells = packageCells.filter((amount) => amount >= 1 && amount <= 3).length;
    const uniformity = covered ? uniformCells / covered : 0;
    const excess = packageCells.filter((amount) => amount > 3).length;
    return { coverage, target, uniformity, excess, covered, total: packageCells.length };
  }

  function isPackageCell(index) {
    const cols = 12;
    const row = Math.floor(index / cols);
    const col = index % cols;
    return row >= 1 && row <= 6 && col >= 2 && col <= 9;
  }

  function renderThermal() {
    if (!state.paste.length) state.paste = Array(96).fill(0);
    const metrics = getPasteMetrics();
    workspace.innerHTML = `<div class="thermal-lesson">
      <label class="profile-select">Perfil ilustrativo do processador
        <select id="thermalProfile">
          ${Object.entries(thermalProfiles).map(([key, profile]) =>
            `<option value="${key}" ${state.pasteProfile === key ? "selected" : ""}>${profile.label} · meta ${Math.round(profile.coverage * 100)}%</option>`
          ).join("")}
        </select>
      </label>
      <p class="surface-legend">A forma e a quantidade ideais variam conforme o processador. Considere o modelo e siga as instruções do fabricante; este simulador usa metas configuráveis.</p>
      <div class="cpu-package-label">PROCESSADOR LIMPO</div>
      <div class="cpu-package clean-surface" data-surface="thermal" data-cols="12" data-rows="8" style="--cols:12;--rows:8">
        <div class="paste-grid">${state.paste.map((amount, index) =>
          `<i class="paste-cell ${isPackageCell(index) ? "package-cell" : "edge-cell"} ${amount ? "pasted" : ""} ${amount > 3 ? "overflow" : ""}" data-cell="${index}" style="--paste:${Math.min(amount, 5)}"></i>`
        ).join("")}</div>
      </div>
      <div class="paste-metrics">
        <div>${progressMarkup("pasteCoverage", "Cobertura do processador", Math.round(metrics.coverage * 100))}</div>
        <div>${progressMarkup("pasteUniformity", "Uniformidade", Math.round(metrics.uniformity * 100))}</div>
      </div>
      <p class="remaining-regions" id="pasteStatus"></p>
      <p class="surface-legend">Arraste a pasta para aplicar. Se houver excesso ou transbordamento, selecione o pano sem fiapos e arraste sobre as áreas a corrigir.</p>
    </div>`;
    $("#thermalProfile").addEventListener("change", (event) => {
      state.pasteProfile = event.target.value;
      refreshPasteMetrics();
    });
    bindPasteSurface();
    refreshPasteMetrics();
    stageAction("Avaliar aplicação", validatePaste);
  }

  function refreshPasteMetrics() {
    const metrics = getPasteMetrics();
    updateMeter("pasteCoverage", Math.round(metrics.coverage * 100));
    updateMeter("pasteUniformity", Math.round(metrics.uniformity * 100));
    const status = $("#pasteStatus");
    if (!status) return;
    const needs = Math.max(0, Math.ceil(metrics.target * metrics.total) - metrics.covered);
    status.textContent = metrics.excess || state.pasteOverflow
      ? `${metrics.excess + state.pasteOverflow} pontos com excesso ou transbordamento; corrija com o pano.`
      : needs
        ? `Aplique pasta em pelo menos mais ${needs} regiões, distribuindo-a de modo uniforme.`
        : "Cobertura suficiente. Confira a uniformidade e se não há transbordamento.";
  }

  function bindPasteSurface() {
    const surface = $('[data-surface="thermal"]', workspace);
    let active = false;
    let last = null;
    let strokeCells = new Set();
    surface.addEventListener("pointerdown", (event) => {
      active = true;
      last = getCellPosition(surface, event);
      strokeCells = new Set();
      surface.setPointerCapture(event.pointerId);
      applyPasteAt(surface, last, strokeCells);
    });
    surface.addEventListener("pointermove", (event) => {
      if (!active) return;
      const next = getCellPosition(surface, event);
      for (const point of interpolate(last, next, 12, 8)) {
        applyPasteAt(surface, point, strokeCells);
      }
      last = next;
    });
    const stop = () => { active = false; last = null; };
    surface.addEventListener("pointerup", stop);
    surface.addEventListener("pointercancel", stop);
  }

  function applyPasteAt(surface, pos, strokeCells) {
    const index = pos.row * 12 + pos.col;
    if (strokeCells.has(index)) return;
    strokeCells.add(index);
    if (state.selectedTool === "paste") {
      if (isPackageCell(index)) {
        state.paste[index] = Math.min(5, state.paste[index] + 1);
      } else {
        state.pasteOverflow += 1;
      }
    } else if (state.selectedTool === "cloth") {
      if (isPackageCell(index)) state.paste[index] = Math.max(0, state.paste[index] - 1);
      else state.pasteOverflow = Math.max(0, state.pasteOverflow - 1);
    } else {
      showFeedback("Selecione pasta térmica para aplicar ou pano sem fiapos para corrigir a distribuição.");
      return;
    }
    const cell = $(`.paste-cell[data-cell="${index}"]`, surface);
    if (cell) {
      cell.classList.toggle("pasted", state.paste[index] > 0);
      cell.classList.toggle("overflow", state.paste[index] > 3);
      cell.style.setProperty("--paste", Math.min(state.paste[index], 5));
    }
    refreshPasteMetrics();
  }

  function validatePaste() {
    const metrics = getPasteMetrics();
    const enough = metrics.coverage >= metrics.target;
    const even = metrics.uniformity >= 0.8;
    if (!enough || !even || metrics.excess > 0 || state.pasteOverflow > 0) {
      recordError("Ajuste a cobertura, a uniformidade e o excesso antes de reinstalar o cooler.");
      return;
    }
    state.inspected = true;
    showFeedback("Aplicação adequada para o perfil selecionado. Aplique conforme o modelo e a orientação do fabricante.");
    advanceStage();
  }

  function renderReinstall() {
    const connector = getCleaning("fan-connector", 6, 2, 0.84, 1);
    actionButton.hidden = true;
    workspace.innerHTML = `<div class="reinstall-workflow">
      <div class="connector-card">
        <strong>Conector da ventoinha (desconectado)</strong>
        <small>O limpa-contato deve ser aplicado ao pano, nunca diretamente à placa ou ao conector.</small>
        ${surfaceMarkup("fan-connector", 6, 2, { className: "connector-surface", dirtRate: 0.84, layers: 1, label: "Conector da ventoinha" })}
        ${progressMarkup("connectorPercent", "Conector limpo", getCleanPercent(connector))}
      </div>
      <div class="reinstall-checks">
        <span id="coolerInstallStatus">Cooler ainda não reinstalado</span>
        <span id="fanCableStatus">Cabo da ventoinha desconectado</span>
      </div>
    </div>`;
    if (!state.contactCleanerPrepared) {
      stageAction("Aplicar limpa-contato no pano", () => {
        if (state.selectedTool !== "contact") {
          toolHint("contact", "preparar o pano; nunca aplique spray diretamente");
          return;
        }
        state.contactCleanerPrepared = true;
        actionButton.hidden = true;
        showFeedback("Produto aplicado ao pano. Selecione agora o pano sem fiapos e limpe o conector desconectado.");
      });
    } else if (!state.connectorClean) {
      bindCleaningSurface("fan-connector", "connectorPercent", "cloth");
    }
    if (getCleanPercent(connector) === 100) {
      state.connectorClean = true;
      if (!$("#installCoolerButton", workspace)) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "installCoolerButton";
        button.className = "install-button";
        button.textContent = "Reinstalar cooler";
        workspace.append(button);
        button.addEventListener("click", () => {
          state.coolerReinstalled = true;
          $("#coolerInstallStatus").textContent = "Cooler instalado corretamente ✓";
          showFeedback("Cooler instalado sem forçar. Agora conecte o cabo da ventoinha.");
          if (!$("#connectFanButton", workspace)) {
            const connect = document.createElement("button");
            connect.type = "button";
            connect.id = "connectFanButton";
            connect.className = "install-button";
            connect.textContent = "Conectar cabo da ventoinha";
            workspace.append(connect);
            connect.addEventListener("click", () => {
              if (!state.coolerReinstalled) return;
              state.fanConnected = true;
              $("#fanCableStatus").textContent = "Cabo da ventoinha conectado ✓";
              showFeedback("Cabo conectado. A inspeção final está liberada.");
              stageAction("Continuar para a inspeção final", advanceStage);
            });
          }
        });
      }
    }
  }

  function renderInspection() {
    const metrics = getPasteMetrics();
    const checks = [
      ["RAM limpa", state.cleaning["ram-contacts"] && getCleanPercent(state.cleaning["ram-contacts"]) === 100],
      ["Processador sem pasta antiga", state.cleaning["cpu-old-paste"] && getCleanPercent(state.cleaning["cpu-old-paste"]) === 100],
      ["Base do cooler sem resíduos", state.cleaning["cooler-base"] && getCleanPercent(state.cleaning["cooler-base"]) === 100],
      ["Superfícies completamente secas", !state.drying && state.step >= 6],
      ["Placa-mãe limpa", state.cleaning["motherboard-dust"] && getCleanPercent(state.cleaning["motherboard-dust"]) === 100],
      ["Cooler limpo nas seis orientações", coolerViews.every((_, index) => state.cleaning[`cooler-face-${index}`] && getCleanPercent(state.cleaning[`cooler-face-${index}`]) === 100)],
      ["Pasta térmica adequada", metrics.coverage >= metrics.target && metrics.uniformity >= 0.8 && metrics.excess === 0 && state.pasteOverflow === 0],
      ["Cooler reinstalado corretamente", state.coolerReinstalled],
      ["Cabo da ventoinha conectado", state.fanConnected]
    ];
    workspace.innerHTML = `<div class="final-inspection">
      <div class="safety-visual"><span class="power-symbol">✓</span><strong>INSPEÇÃO FINAL</strong><small>Confirme cada requisito da manutenção preventiva.</small></div>
      <ul class="inspection-list">${checks.map(([label, passed]) =>
        `<li class="${passed ? "passed" : "pending"}"><span>${passed ? "✓" : "○"}</span>${label}</li>`
      ).join("")}</ul>
    </div>`;
    stageAction("Concluir manutenção", () => {
      const incomplete = checks.filter(([, passed]) => !passed);
      if (incomplete.length) {
        recordError(`Inspeção bloqueada. Ainda falta: ${incomplete.map(([label]) => label).join(", ")}.`);
        return;
      }
      finishMaintenance(metrics);
    });
  }

  function finishMaintenance(metrics) {
    state.complete = true;
    state.active = false;
    const cleanliness = calculateCleanliness();
    const coverageQuality = Math.min(1, metrics.coverage / metrics.target);
    const pasteQuality = Math.round((coverageQuality * 50) + (metrics.uniformity * 50));
    const xpReward = Math.max(100, 300 - state.errorCount * 8);
    const moneyReward = Math.max(100, 450 - state.errorCount * 15);
    const cash = $("#dinheiro");
    const xp = $("#xp");
    const moneyValue = Number(cash.textContent.replace(/[^\d]/g, ""));
    const xpValue = Number(xp.textContent.replace(/[^\d]/g, ""));
    cash.textContent = `R$ ${(moneyValue + moneyReward).toLocaleString("pt-BR")}`;
    xp.textContent = `${xpValue + xpReward} XP`;
    $("#maintenanceSummary").textContent =
      `Limpeza geral: ${cleanliness}%. Qualidade da pasta térmica: ${pasteQuality}%. Recompensa: R$ ${moneyReward.toLocaleString("pt-BR")} e ${xpReward} XP.`;
    $("#maintenanceResults").innerHTML = `
      <div><strong>${cleanliness}%</strong><span>Limpeza</span></div>
      <div><strong>${pasteQuality}%</strong><span>Aplicação térmica</span></div>
      <div><strong>${state.errorCount}</strong><span>Erros educativos</span></div>
      <div><strong>R$ ${moneyReward}</strong><span>Recompensa</span></div>
      <p>${state.errorCount
        ? `Pontos para lembrar: ${state.errors.join(" ")}`
        : "Nenhum erro registrado. Excelente manutenção preventiva!"}</p>`;
    panel.hidden = true;
    completion.hidden = false;
    updateProgress();
    window.dispatchEvent(new CustomEvent("maintenance-complete"));
  }

  function calculateCleanliness() {
    const keys = ["ram-contacts", "cpu-old-paste", "cooler-base", "motherboard-dust",
      ...coolerViews.map((_, index) => `cooler-face-${index}`)];
    const values = keys.map((key) => state.cleaning[key]).filter(Boolean);
    if (!values.length) return 0;
    const total = values.reduce((sum, surface) => sum + surface.values.length, 0);
    const clean = values.reduce((sum, surface) =>
      sum + surface.values.filter((amount) => amount === 0).length, 0);
    return Math.round((clean / total) * 100);
  }

  function getCellPosition(surface, event) {
    const rect = surface.getBoundingClientRect();
    const cols = Number(surface.dataset.cols);
    const rows = Number(surface.dataset.rows);
    const x = Math.max(0, Math.min(0.999, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(0.999, (event.clientY - rect.top) / rect.height));
    return { col: Math.floor(x * cols), row: Math.floor(y * rows), x, y };
  }

  function bindCleaningSurface(key, meterId, requiredTool, options = {}) {
    const surface = $(`[data-surface="${key}"]`, workspace);
    if (!surface || surface.dataset.bound === "true") return;
    surface.dataset.bound = "true";
    let dragging = false;
    let lastPosition = null;
    let lastTime = 0;
    let warned = false;
    let strokeCells = new Set();
    surface.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      warned = false;
      strokeCells = new Set();
      lastPosition = getCellPosition(surface, event);
      lastTime = performance.now();
      surface.setPointerCapture(event.pointerId);
      if (options.direction !== "right") {
        cleanAt(surface, key, meterId, requiredTool, lastPosition, options, strokeCells);
      }
    });
    surface.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const position = getCellPosition(surface, event);
      const now = performance.now();
      const delta = lastPosition
        ? Math.hypot(position.x - lastPosition.x, position.y - lastPosition.y) * surface.clientWidth
        : 0;
      const elapsed = now - lastTime;
      if (delta > surface.clientWidth * 0.3 && elapsed < 50 && !warned) {
        warned = true;
        recordError("Movimento de limpeza agressivo; use passadas suaves.");
      }
      if (lastPosition && options.direction === "right" && position.x < lastPosition.x - 0.015) {
        if (!warned) {
          recordError(options.wrongDirection);
          warned = true;
        }
        lastPosition = position;
        lastTime = now;
        return;
      }
      for (const point of interpolate(lastPosition, position, surface.dataset.cols, surface.dataset.rows)) {
        cleanAt(surface, key, meterId, requiredTool, point, options, strokeCells);
      }
      lastPosition = position;
      lastTime = now;
    });
    const stop = () => {
      dragging = false;
      lastPosition = null;
      warned = false;
    };
    surface.addEventListener("pointerup", stop);
    surface.addEventListener("pointercancel", stop);
    surface.addEventListener("lostpointercapture", stop);
  }

  function interpolate(from, to, cols, rows) {
    if (!from || !to) return [to];
    const dx = (to.x - from.x) * cols;
    const dy = (to.y - from.y) * rows;
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 1.5));
    return Array.from({ length: count + 1 }, (_, index) => ({
      x: from.x + (to.x - from.x) * index / count,
      y: from.y + (to.y - from.y) * index / count,
      col: Math.min(cols - 1, Math.floor((from.x + (to.x - from.x) * index / count) * cols)),
      row: Math.min(rows - 1, Math.floor((from.y + (to.y - from.y) * index / count) * rows))
    }));
  }

  function cleanAt(surface, key, meterId, requiredTool, position, options = {}, strokeCells = new Set()) {
    if (!position) return;
    if (["cpu-old-paste", "cooler-base"].includes(key) && !state.clothPrepared) {
      showFeedback("Umedeça o pano sem fiapos com álcool isopropílico antes de limpar. Não despeje líquido no componente.");
      return;
    }
    const validTool = options.toolCheck ? options.toolCheck() : state.selectedTool === requiredTool;
    if (!validTool) {
      if (state.selectedTool === "alcohol" && !options.allowAlcohol) {
        if (!surface.dataset.liquidWarning) {
          surface.dataset.liquidWarning = "true";
          recordError("Não aplique líquidos diretamente nos componentes. Umedeça o pano e limpe com ele.");
        }
      } else if (!surface.dataset.toolWarning) {
        surface.dataset.toolWarning = "true";
        showFeedback(options.toolMessage || `Selecione a ferramenta adequada: ${requiredTool === "eraser" ? "borracha branca macia" : "pincel antiestático"}.`);
      }
      return;
    }
    const data = state.cleaning[key];
    if (!data) return;
    const centerCol = position.col;
    const centerRow = position.row;
    const radius = key === "ram-contacts" ? 0 : 1;
    for (let row = Math.max(0, centerRow - radius); row <= Math.min(data.rows - 1, centerRow + radius); row += 1) {
      for (let col = Math.max(0, centerCol - radius); col <= Math.min(data.cols - 1, centerCol + radius); col += 1) {
        const index = row * data.cols + col;
        if (strokeCells.has(index)) continue;
        strokeCells.add(index);
        if (data.values[index] > 0) data.values[index] -= 1;
        const cell = $(`.dirt-cell[data-cell="${index}"]`, surface);
        if (cell) {
          cell.style.setProperty("--dirt", data.values[index]);
          cell.classList.toggle("dirty", data.values[index] > 0);
        }
      }
    }
    const percent = updateCleaningMeter(key, meterId);
    if (options.coolerViews) {
      const aggregate = coolerViews.reduce((total, _, index) => {
        const face = state.cleaning[`cooler-face-${index}`];
        return total + (face ? getCleanPercent(face) : 0);
      }, 0);
      updateMeter(meterId, Math.round(aggregate / coolerViews.length));
      updateCoolerRemaining();
      const allClean = coolerViews.every((_, index) => {
        const face = state.cleaning[`cooler-face-${index}`];
        return face && getCleanPercent(face) === 100;
      });
      if (allClean) stageAction("Concluir limpeza do cooler", advanceStage);
      else if (percent === 100 && state.coolerFace === state.maxCoolerFace && state.coolerFace < coolerViews.length - 1) {
        const cleanFace = coolerViews[state.coolerFace];
        state.coolerFace += 1;
        state.maxCoolerFace = Math.max(state.maxCoolerFace, state.coolerFace);
        renderCoolerFaces();
        showFeedback(`Face ${cleanFace} limpa. Agora examine a face ${coolerViews[state.coolerFace]}.`);
        return;
      }
      else {
        actionButton.hidden = true;
        if (percent === 100 && !allClean) {
          showFeedback(`Face ${coolerViews[state.coolerFace]} limpa. Selecione outra orientação disponível.`);
        }
      }
    } else if (percent === 100) {
      showFeedback(options.direction === "right"
        ? "Contatos limpos. Confira se não há resíduos antes de continuar."
        : "Superfície limpa. Examine o resultado antes de continuar.");
      if (options.direction === "right") stageAction("Confirmar contatos sem resíduos", advanceStage);
      else if (state.step === 3 || state.step === 4) {
        stageAction("Examinar resultado", () => {
          if (getCleanPercent(data) < 100) {
            recordError("Ainda há resíduos de pasta térmica. Continue limpando a superfície.");
            return;
          }
          if (state.step === 3) advanceStage();
          else advanceStage();
        });
      } else if (state.step === 6) {
        stageAction("Confirmar placa-mãe limpa", advanceStage);
      } else if (state.step === 9 && state.contactCleanerPrepared) {
        state.connectorClean = true;
        renderReinstall();
      }
    }
  }

  function renderStage() {
    if (state.step >= stageNames.length) return;
    updateStage(stageNames[state.step], stageInstructions[state.step]);
    workspace.innerHTML = "";
    actionButton.hidden = true;
    toolPicker.hidden = ![1, 3, 4, 6, 7, 8, 9].includes(state.step);
    if (state.step === 0) renderSafety();
    else if (state.step === 1) {
      renderRam();
      setTool("eraser");
    } else if (state.step === 2) renderRemoveCooler();
    else if (state.step === 3) {
      renderWipeSurface("cpu-old-paste", "Processador — pasta térmica antiga", "cpu", "cloth");
      stageAction("Umedecer pano com álcool isopropílico", prepareWipe);
      setTool("alcohol");
    } else if (state.step === 4) {
      renderWipeSurface("cooler-base", "Base do cooler — resíduos antigos", "cooler", "cloth");
      stageAction("Umedecer pano com álcool isopropílico", prepareWipe);
      setTool("alcohol");
    } else if (state.step === 5) renderDrying();
    else if (state.step === 6) {
      renderMotherboard();
      setTool("brush");
    } else if (state.step === 7) {
      renderCoolerFaces();
      setTool("brush");
    } else if (state.step === 8) {
      renderThermal();
      setTool("paste");
    } else if (state.step === 9) {
      renderReinstall();
      setTool(state.connectorClean ? "cloth" : "contact");
    } else if (state.step === 10) renderInspection();
  }

  const stageInstructions = [
    "Desligue, desconecte a alimentação e confirme que o computador está desenergizado antes de tocar em qualquer componente.",
    "Use a borracha branca macia somente nos contatos dourados, com passadas leves da esquerda para a direita. Exercício didático, não método universal.",
    "Remova o cooler com cuidado. Uma pressão ou torção excessiva pode danificar o processador e o soquete.",
    "Umedeça o pano sem fiapos com álcool isopropílico; nunca despeje o líquido sobre o processador. Faça várias passadas suaves.",
    "Limpe a base do cooler da mesma maneira, removendo completamente os resíduos de pasta antiga.",
    "Aguarde a secagem completa do processador e da base antes de continuar. A próxima etapa ficará bloqueada até o tempo terminar.",
    "Com o pincel antiestático, remova a poeira das regiões da placa-mãe. Não use líquidos diretamente nos componentes.",
    "Explore cima, baixo, frente, trás, esquerda e direita. Limpe cada face; a ventoinha permanece imóvel.",
    "Aplique pasta térmica e ajuste cobertura e uniformidade conforme o processador e as instruções do fabricante.",
    "Aplique limpa-contato no pano, limpe o conector desconectado, reinstale o cooler sem forçar e conecte o cabo da ventoinha.",
    "Confira os requisitos da inspeção. Resíduos, superfícies úmidas, aplicação incorreta ou cabo desconectado impedem a conclusão."
  ];

  function prepareWipe() {
    if (state.selectedTool !== "alcohol") {
      toolHint("alcohol", "umedecer o pano, sem despejar no componente");
      return;
    }
    state.clothPrepared = true;
    setTool("cloth");
    showFeedback("Pano umedecido com álcool isopropílico. Limpe somente a superfície do processador; não aplique líquido diretamente.");
    actionButton.hidden = true;
    bindCleaningSurface(state.step === 3 ? "cpu-old-paste" : "cooler-base", "wipePercent", "cloth");
  }

  function renderRemoveCooler() {
    workspace.innerHTML = `<div class="cooler-removal-card">
      <div class="cooler-model removal-model"><div class="fan-frame"><div class="fan-blades-static">✣</div></div><div class="heatsink-fins"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <p>Segure pelos pontos de fixação e solte sem puxar ou torcer com força.</p>
      <div class="removal-status" id="removalStatus">Cooler instalado sobre o processador</div>
    </div>`;
    stageAction("Soltar e remover o cooler com cuidado", advanceStage);
    let pressedAt = 0;
    let forced = false;
    actionButton.onpointerdown = () => {
      pressedAt = performance.now();
      forced = false;
      delete actionButton.dataset.forceWarning;
    };
    actionButton.onpointerup = () => {
      if (pressedAt && performance.now() - pressedAt > 750) {
        forced = true;
        recordError("Remoção do cooler com força excessiva.");
        actionButton.dataset.forceWarning = "true";
        showFeedback("Não force nem torça o cooler. Solte e tente novamente com movimentos leves.", "warning");
      }
    };
    actionButton.onclick = (event) => {
      if (forced || actionButton.dataset.forceWarning === "true") {
        delete actionButton.dataset.forceWarning;
        forced = false;
        event.stopImmediatePropagation();
        return;
      }
      state.coolerRemoved = true;
      $("#removalStatus").textContent = "Cooler removido sem força ✓";
      advanceStage();
    };
  }

  function renderStageControls() {
    $$(".tool-button", toolPicker).forEach((button) => {
      button.addEventListener("click", () => {
        const tool = button.dataset.tool;
        if (tool === "alcohol" && ![3, 4].includes(state.step)) {
          recordError("Use álcool isopropílico somente no pano e apenas para limpar o processador ou a base do cooler.");
          return;
        }
        if (tool === "contact" && state.step !== 9) {
          recordError("Use o limpa-contato somente no pano, para o conector desconectado da ventoinha.");
          return;
        }
        if (tool === "eraser" && state.step !== 1) {
          showFeedback("A borracha é usada apenas no exercício didático dos contatos dourados da RAM.");
          return;
        }
        if (tool === "paste" && state.step !== 8) {
          showFeedback("A pasta térmica só pode ser aplicada depois da limpeza e da secagem completa.");
          return;
        }
        if (tool === "brush" && ![6, 7].includes(state.step)) {
          showFeedback("O pincel antiestático é reservado à poeira da placa-mãe e do cooler.");
          return;
        }
        if (tool === "cloth" && ![3, 4, 8, 9].includes(state.step)) {
          showFeedback("O pano sem fiapos é usado com álcool no processador/base, ou para corrigir a pasta.");
          return;
        }
        setTool(tool);
        if (state.step === 9 && tool === "cloth" && state.contactCleanerPrepared && !state.connectorClean) {
          bindCleaningSurface("fan-connector", "connectorPercent", "cloth");
          showFeedback("Limpe o conector desconectado com o pano umedecido.");
          return;
        }
        if (tool === "alcohol" || tool === "contact") {
          showFeedback("Use o produto para umedecer o pano; nunca aplique líquido diretamente em componentes.");
        }
      });
    });
  }

  function resetMaintenance() {
    if (state.dryTimer) clearInterval(state.dryTimer);
    state.available = false;
    state.active = false;
    state.complete = false;
    state.step = 0;
    state.selectedTool = null;
    state.safety = 0;
    state.errors = [];
    state.errorCount = 0;
    state.cleaning = {};
    state.coolerFace = 0;
    state.maxCoolerFace = 0;
    state.drying = false;
    state.dryRemaining = 0;
    state.clothPrepared = false;
    state.contactCleanerPrepared = false;
    state.connectorClean = false;
    state.coolerRemoved = false;
    state.coolerReinstalled = false;
    state.fanConnected = false;
    state.paste = [];
    state.pasteOverflow = 0;
    state.pasteProfile = "standard";
    state.inspected = false;
    panel.hidden = false;
    completion.hidden = true;
    panel.hidden = true;
    showFeedback("");
    updateProgress();
  }

  function startMaintenance() {
    if (!state.available || state.active) return;
    state.active = true;
    panel.hidden = false;
    $("#startMaintenance").hidden = true;
    renderStage();
  }

  $("#startMaintenance").addEventListener("click", startMaintenance);
  $("#maintenanceRestart").addEventListener("click", () => {
    resetMaintenance();
    state.available = true;
    startMaintenance();
  });
  window.addEventListener("assembly-complete", () => {
    state.available = true;
    showFeedback("Montagem pronta. Inicie a manutenção preventiva para seguir o tutorial.");
  });
  window.addEventListener("game-reset", resetMaintenance);
  renderStageControls();
  updateProgress();
  resetMaintenance();
})();
