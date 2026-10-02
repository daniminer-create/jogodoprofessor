const etapas = [
  {
    id: "motherboard",
    titulo: "Instale a placa-mãe",
    texto: "Encaixe a placa-mãe nos pontos de fixação do gabinete. Depois disso, o socket da CPU, os slots de RAM, o PCIe e as portas SATA ficarão visíveis.",
    status: "Instale a placa-mãe"
  },
  {
    id: "cpu",
    titulo: "Instale o processador",
    texto: "Coloque o processador no socket. Alinhe a marcação do processador com a do socket e não force o encaixe.",
    status: "Instale a CPU"
  },
  {
    id: "cooler",
    titulo: "Instale o cooler",
    texto: "O cooler fica sobre o processador. Ele ajuda a transferir o calor da CPU para longe do chip.",
    status: "Instale o cooler"
  },
  {
    id: "ram",
    titulo: "Instale a memória RAM",
    texto: "Encaixe os módulos de memória nos slots DIMM. Neste computador, vamos instalar dois módulos de 8 GB.",
    status: "Instale a RAM"
  },
  {
    id: "gpu",
    titulo: "Instale a placa de vídeo",
    texto: "Encaixe a placa de vídeo no slot PCI Express x16. É por esse conector que ela se comunica com a placa-mãe.",
    status: "Instale a GPU"
  },
  {
    id: "psu",
    titulo: "Instale a fonte de alimentação",
    texto: "Coloque a fonte no compartimento dedicado do gabinete para fornecer energia aos componentes.",
    status: "Instale a fonte"
  },
  {
    id: "hdd",
    titulo: "Instale o HD",
    texto: "Encaixe o HD de 1 TB na baia de armazenamento do gabinete.",
    status: "Instale o HD"
  },
  {
    id: "sata",
    titulo: "Conecte o cabo SATA",
    texto: "Conecte o cabo SATA entre o HD e a porta SATA da placa-mãe.",
    status: "Conecte o cabo SATA"
  }
];

const estado = {
  etapa: 0,
  instalados: new Set(),
  dinheiro: 2500,
  xp: 0,
  finalizado: false,
  montagemConcluida: false
};

const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => document.querySelectorAll(seletor);

const motherboard = $("#motherboard");
const emptyBoard = $("#emptyBoard");
const installMotherboard = $("#installMotherboard");

const tutorialTitle = $("#tutorialTitle");
const tutorialText = $("#tutorialText");
const stepCounter = $("#stepCounter");
const status = $("#status");

const dinheiro = $("#dinheiro");
const xp = $("#xp");
const progressBar = $("#progressBar");
const progressText = $("#progressText");

const toast = $("#toast");

const botoesPecas = {
  motherboard: $("#motherboardButton"),
  cpu: $('[data-install="cpu"]'),
  cooler: $('[data-install="cooler"]'),
  ram: $('[data-install="ram"]'),
  gpu: $('[data-install="gpu"]'),
  psu: $('[data-install="psu"]'),
  hdd: $('[data-install="hdd"]'),
  sata: $('[data-install="sata"]')
};

const pontosInstalacao = {
  psu: $("#psuBay"),
  hdd: $("#driveBay"),
  sata: $("#sataPort")
};

const nomes = {
  motherboard: "Placa-mãe",
  cpu: "Processador",
  cooler: "Cooler",
  ram: "Memória RAM",
  gpu: "Placa de vídeo",
  psu: "Fonte de alimentação",
  hdd: "HD",
  sata: "Cabo SATA"
};

function mostrarMensagem(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add("show");

  clearTimeout(mostrarMensagem.timer);

  mostrarMensagem.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function atualizarTutorial() {
  if (estado.finalizado) {
    stepCounter.textContent = "MONTAGEM CONCLUÍDA";
    tutorialTitle.textContent = "Computador montado!";
    tutorialText.textContent =
      "Parabéns! Você instalou a placa-mãe, o processador, o cooler, a memória RAM, a placa de vídeo, a fonte, o HD e conectou o cabo SATA.";
    status.textContent = "Montagem concluída";
    return;
  }

  if (estado.montagemConcluida) {
    stepCounter.textContent = "MONTAGEM CONCLUÍDA";
    tutorialTitle.textContent = "Computador montado!";
    tutorialText.textContent =
      "A montagem foi concluída. Agora você pode iniciar o tutorial de limpeza e manutenção preventiva.";
    status.textContent = "Manutenção disponível";
    $("#startMaintenance").hidden = false;
    return;
  }

  const etapa = etapas[estado.etapa];

  stepCounter.textContent =
    `ETAPA ${estado.etapa + 1} DE ${etapas.length}`;

  tutorialTitle.textContent = etapa.titulo;
  tutorialText.textContent = etapa.texto;
  status.textContent = etapa.status;
}

function atualizarProgresso() {
  const total = etapas.length;
  const quantidade = estado.instalados.size;
  const porcentagem = Math.round((quantidade / total) * 100);

  progressBar.style.width = `${porcentagem}%`;
  progressText.textContent = `${porcentagem}%`;
}

function atualizarDinheiro() {
  dinheiro.textContent =
    `R$ ${estado.dinheiro.toLocaleString("pt-BR")}`;

  xp.textContent = `${estado.xp} XP`;
}

function liberarPeca(id) {
  const card = $(`#part-${id}`);
  const botao = botoesPecas[id];

  if (card) {
    card.classList.remove("locked");
  }

  if (botao) {
    botao.disabled = false;
  }

  const statusPeca = $(`#${id}Status`);

  if (statusPeca) {
    statusPeca.textContent = "Disponível";
  }
}

function marcarPecaInstalada(id) {
  const card = $(`#part-${id}`);
  const botao = botoesPecas[id];
  const statusPeca = $(`#${id}Status`);

  if (card) {
    card.classList.add("completed");
    card.classList.remove("locked");
  }

  if (botao) {
    botao.disabled = true;
    botao.textContent = "Instalado";
  }

  if (statusPeca) {
    statusPeca.textContent = "Instalado ✓";
  }
}

function atualizarPecasDisponiveis() {
  Object.keys(botoesPecas).forEach((id) => {
    const botao = botoesPecas[id];
    const desabilitado =
      estado.instalados.has(id) ||
      id !== etapas[estado.etapa]?.id;

    if (botao) {
      botao.disabled = desabilitado;
    }

    const ponto = pontosInstalacao[id];
    if (ponto) {
      ponto.disabled = desabilitado;
    }
  });
}

function instalarPlacaMae() {
  if (estado.instalados.has("motherboard")) return;

  estado.instalados.add("motherboard");

  // Esconde a área vazia e revela a placa-mãe.
  emptyBoard.style.display = "none";
  motherboard.classList.add("installed");

  // Mostra os componentes da placa.
  $("#cpuSocket").disabled = false;
  $("#cooler").disabled = true;

  $$(".ram-slot").forEach((slot) => {
    slot.disabled = true;
  });

  $(".pcie-slot").disabled = true;

  marcarPecaInstalada("motherboard");

  estado.dinheiro -= 100;
  estado.xp += 20;

  estado.etapa = 1;

  liberarPeca("cpu");
  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  mostrarMensagem("Placa-mãe instalada! Os componentes estão visíveis.");
}

function instalarCPU() {
  if (!estado.instalados.has("motherboard")) {
    mostrarMensagem("Instale a placa-mãe primeiro!");
    return;
  }

  if (estado.instalados.has("cpu")) return;

  estado.instalados.add("cpu");

  const socket = $("#cpuSocket");
  socket.classList.add("installed");
  socket.innerHTML = "<span>CPU</span>";
  socket.disabled = true;

  marcarPecaInstalada("cpu");

  estado.dinheiro -= 450;
  estado.xp += 30;
  estado.etapa = 2;

  liberarPeca("cooler");
  $("#cooler").disabled = false;

  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  mostrarMensagem("Processador instalado no socket!");
}

function instalarCooler() {
  if (!estado.instalados.has("cpu")) {
    mostrarMensagem("Instale o processador antes do cooler!");
    return;
  }

  if (estado.instalados.has("cooler")) return;

  estado.instalados.add("cooler");

  const cooler = $("#cooler");
  cooler.classList.add("installed");
  cooler.innerHTML =
    '<span class="fan-blades">✣</span><span>INSTALADO</span>';
  cooler.disabled = true;

  // O cooler fica visualmente sobre a região do processador.
  cooler.style.zIndex = "5";

  marcarPecaInstalada("cooler");

  estado.dinheiro -= 150;
  estado.xp += 20;
  estado.etapa = 3;

  liberarPeca("ram");

  $$(".ram-slot").forEach((slot) => {
    slot.disabled = false;
  });

  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  mostrarMensagem("Cooler instalado sobre o processador!");
}

function instalarRAM() {
  if (!estado.instalados.has("cooler")) {
    mostrarMensagem("Instale o cooler antes de continuar!");
    return;
  }

  if (estado.instalados.has("ram")) return;

  estado.instalados.add("ram");

  const slots = $$(".ram-slot");

  // Instala dois módulos nos slots 2 e 4.
  [1, 3].forEach((indice) => {
    slots[indice].classList.add("installed");
    slots[indice].textContent = "8 GB";
    slots[indice].disabled = true;
  });

  slots[0].disabled = true;
  slots[2].disabled = true;

  marcarPecaInstalada("ram");

  estado.dinheiro -= 300;
  estado.xp += 20;
  estado.etapa = 4;

  liberarPeca("gpu");
  $(".pcie-slot").disabled = false;

  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  mostrarMensagem("Memória RAM instalada: 16 GB!");
}

function instalarGPU() {
  if (!estado.instalados.has("ram")) {
    mostrarMensagem("Instale a memória RAM antes da placa de vídeo!");
    return;
  }

  if (estado.instalados.has("gpu")) return;

  estado.instalados.add("gpu");

  const slot = $(".pcie-slot");
  slot.classList.add("installed");
  slot.textContent = "GPU INSTALADA ✓";
  slot.disabled = true;

  marcarPecaInstalada("gpu");

  estado.dinheiro -= 700;
  estado.xp += 50;

  estado.etapa = 5;
  liberarPeca("psu");

  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  mostrarMensagem("Placa de vídeo instalada! Agora instale a fonte.");
}

function instalarFonte() {
  if (estado.instalados.has("psu")) return;

  estado.instalados.add("psu");
  $("#psuBay").classList.add("installed");
  $("#psuLabel").textContent = "FONTE INSTALADA";
  marcarPecaInstalada("psu");

  estado.dinheiro -= 250;
  estado.xp += 25;
  estado.etapa = 6;
  liberarPeca("hdd");

  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  mostrarMensagem("Fonte instalada no compartimento do gabinete!");
}

function instalarHD() {
  if (!estado.instalados.has("psu")) {
    mostrarMensagem("Instale a fonte antes do HD!");
    return;
  }

  if (estado.instalados.has("hdd")) return;

  estado.instalados.add("hdd");
  $("#driveBay").classList.add("installed");
  $("#driveLabel").textContent = "HD INSTALADO";
  marcarPecaInstalada("hdd");

  estado.dinheiro -= 200;
  estado.xp += 20;
  estado.etapa = 7;
  liberarPeca("sata");

  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  mostrarMensagem("HD instalado na baia de armazenamento!");
}

function instalarCaboSATA() {
  if (!estado.instalados.has("hdd")) {
    mostrarMensagem("Instale o HD antes de conectar o cabo SATA!");
    return;
  }

  if (estado.instalados.has("sata")) return;

  estado.instalados.add("sata");
  $("#sataPort").classList.add("installed");
  $("#sataPort").textContent = "CONECTADO";
  $("#sataPort").setAttribute("aria-label", "Cabo SATA conectado");
  $("#sataCable").classList.add("installed");
  marcarPecaInstalada("sata");

  estado.dinheiro -= 30;
  estado.xp += 15;
  estado.montagemConcluida = true;

  estado.dinheiro += 650;
  estado.xp += 100;

  atualizarPecasDisponiveis();
  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  $("#startMaintenance").hidden = false;
  window.dispatchEvent(new CustomEvent("assembly-complete"));
  mostrarMensagem("Montagem concluída! Você ganhou R$ 650 e 100 XP.");
}

function instalarPeca(id) {
  if (estado.finalizado) {
    mostrarMensagem("Você já concluiu este tutorial!");
    return;
  }

  const etapaAtual = etapas[estado.etapa];

  if (!etapaAtual || etapaAtual.id !== id) {
    mostrarMensagem("Siga a ordem de montagem indicada no tutorial.");
    return;
  }

  switch (id) {
    case "motherboard":
      instalarPlacaMae();
      break;
    case "cpu":
      instalarCPU();
      break;
    case "cooler":
      instalarCooler();
      break;
    case "ram":
      instalarRAM();
      break;
    case "gpu":
      instalarGPU();
      break;
    case "psu":
      instalarFonte();
      break;
    case "hdd":
      instalarHD();
      break;
    case "sata":
      instalarCaboSATA();
      break;
  }
}

// Botões da lista de componentes.
Object.entries(botoesPecas).forEach(([id, botao]) => {
  if (!botao) return;

  botao.addEventListener("click", () => instalarPeca(id));
});

// Botão dentro do gabinete.
installMotherboard.addEventListener("click", () => {
  instalarPeca("motherboard");
});

// Componentes clicáveis desenhados na placa-mãe.
$("#cpuSocket").addEventListener("click", () => instalarPeca("cpu"));
$("#cooler").addEventListener("click", () => instalarPeca("cooler"));

$$(".ram-slot").forEach((slot) => {
  slot.addEventListener("click", () => instalarPeca("ram"));
});

$(".pcie-slot").addEventListener("click", () => instalarPeca("gpu"));
$("#psuBay").addEventListener("click", () => instalarPeca("psu"));
$("#driveBay").addEventListener("click", () => instalarPeca("hdd"));
$("#sataPort").addEventListener("click", () => instalarPeca("sata"));

// Reiniciar o tutorial.
$("#resetButton").addEventListener("click", reiniciar);

function reiniciar() {
  estado.etapa = 0;
  estado.instalados = new Set();
  estado.dinheiro = 2500;
  estado.xp = 0;
  estado.finalizado = false;
  estado.montagemConcluida = false;

  // Volta a placa-mãe para o estado inicial.
  motherboard.classList.remove("installed");
  emptyBoard.style.display = "grid";

  // Limpa o socket.
  const socket = $("#cpuSocket");
  socket.classList.remove("installed");
  socket.innerHTML = "<span id='cpuText'>SOCKET</span>";
  socket.disabled = true;

  // Limpa o cooler.
  const cooler = $("#cooler");
  cooler.classList.remove("installed");
  cooler.innerHTML =
    '<span class="fan-blades">✣</span><span id="coolerText">COOLER</span>';
  cooler.disabled = true;
  cooler.style.zIndex = "";

  // Limpa a RAM.
  $$(".ram-slot").forEach((slot, indice) => {
    slot.classList.remove("installed");
    slot.textContent = `DIMM ${indice + 1}`;
    slot.disabled = true;
  });

  // Limpa o PCIe.
  const pcie = $(".pcie-slot");
  pcie.classList.remove("installed");
  pcie.textContent = "PCIe x16 — PLACA DE VÍDEO";
  pcie.disabled = true;

  // Limpa a fonte, o HD e o cabo SATA.
  $("#psuBay").classList.remove("installed");
  $("#psuLabel").textContent = "FONTE";
  $("#psuBay").disabled = true;
  $("#driveBay").classList.remove("installed");
  $("#driveLabel").textContent = "BAIA DO HD";
  $("#driveBay").disabled = true;
  $("#sataPort").classList.remove("installed");
  $("#sataPort").textContent = "SATA 1";
  $("#sataPort").setAttribute("aria-label", "Conectar cabo SATA");
  $("#sataPort").disabled = true;
  $("#sataCable").classList.remove("installed");

  // Limpa o estado dos cartões.
  Object.keys(botoesPecas).forEach((id) => {
    const card = $(`#part-${id}`);
    const botao = botoesPecas[id];
    const statusPeca = $(`#${id}Status`);

    card.classList.remove("completed");
    card.classList.add("locked");

    if (id === "motherboard") {
      card.classList.remove("locked");
      statusPeca.textContent = "Aguardando instalação";
    } else {
      statusPeca.textContent = "Bloqueado";
    }

    botao.textContent = id === "sata" ? "Conectar" : "Instalar";
    botao.disabled = id !== "motherboard";
  });

  atualizarTutorial();
  atualizarProgresso();
  atualizarDinheiro();

  $("#startMaintenance").hidden = true;
  window.dispatchEvent(new CustomEvent("game-reset"));
  mostrarMensagem("Montagem reiniciada.");
}

window.addEventListener("maintenance-complete", () => {
  estado.finalizado = true;
  atualizarTutorial();
});

// Estado inicial.
atualizarTutorial();
atualizarProgresso();
atualizarDinheiro();
atualizarPecasDisponiveis();