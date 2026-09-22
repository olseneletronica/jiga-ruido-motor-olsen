// Áudio/vibração/corrente/tensão/potência vêm direto da planilha publicada
// (mesma URL do scripts/fetch_sheet.py). Só a classificação continua vindo
// de um arquivo do repositório, porque depende de rodar
// scripts/baseline.py + classify.py.
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1FV5aTG7GK9MAZyC-gswZ30Hi8E2WLaYRHLtUZQdsXi36iobdmBuC10pJ4a8Ckf8oUa0mboZn5zcc/pub?gid=335307542&single=true&output=csv";
const CLASS_CSV = "../data/classificacao.csv";

const NUMERIC_COLUMNS = [
  "ensaio", "frequencia_hz", "segundo", "duty_percent",
  "tensao_v", "corrente_a", "potencia_w",
  "accel_x_g", "accel_y_g", "accel_z_g", "accel_resultante_g",
  "gyro_x_dps", "gyro_y_dps", "gyro_z_dps",
  "audio_rms", "audio_peak", "audio_freq_hz",
  "wifi_rssi", "acs_ok", "mpu_ok", "audio_ok",
];

const METRICS = [
  { key: "corrente_a", suffix: "Corrente", label: "Corrente (A)" },
  { key: "tensao_v", suffix: "Tensao", label: "Tensão (V)" },
  { key: "potencia_w", suffix: "Potencia", label: "Potência (W)" },
  { key: "accel_resultante_g", suffix: "Vibracao", label: "Vibração (g)" },
  { key: "audio_peak", suffix: "Audio", label: "Áudio pico" },
];

const PALETTE = ["#60a5fa", "#f472b6", "#facc15", "#4ade80", "#c084fc", "#fb923c", "#38bdf8", "#f87171"];

let rawData = [];
let classData = [];
const charts = {};

// A planilha usa vírgula como separador decimal (locale BR).
function toNumberBR(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return parseFloat(String(value).trim().replace(",", "."));
}

function loadRawFromSheet() {
  return fetch(SHEET_URL)
    .then((r) => r.text())
    .then((text) => {
      const parsed = Papa.parse(text, { header: true, dynamicTyping: false, skipEmptyLines: true }).data;
      return parsed
        .map((row) => {
          const out = { timestamp: row.timestamp, firmware: row.firmware };
          NUMERIC_COLUMNS.forEach((col) => {
            out[col] = toNumberBR(row[col]);
          });
          return out;
        })
        // mesmo filtro de qualidade do fetch_sheet.py: descarta leitura com sensor não pronto
        .filter((row) => row.acs_ok === 1 && row.mpu_ok === 1 && row.audio_ok === 1);
    });
}

function loadCsv(path) {
  return fetch(path)
    .then((r) => r.text())
    .then((text) => Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data);
}

// --- Abas -------------------------------------------------------------

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => (p.style.display = "none"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = "";
    });
  });
}

// --- Classificação ------------------------------------------------------

function renderTable() {
  const porEnsaio = {};
  classData.forEach((r) => {
    if (r.ensaio === undefined || r.ensaio === null || r.ensaio === "") return;
    porEnsaio[r.ensaio] = r;
  });

  const tbody = document.querySelector("#tabelaStatus tbody");
  tbody.innerHTML = "";
  Object.values(porEnsaio)
    .sort((a, b) => a.ensaio - b.ensaio)
    .forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.ensaio}</td>
        <td class="status-${r.status}">${r.status ?? "—"}</td>
        <td>${r.pontos_suspeitos ?? "—"}/${r.pontos_avaliados ?? "—"}</td>
        <td>${r.z_max_geral !== undefined ? Number(r.z_max_geral).toFixed(2) : "—"}</td>`;
      tbody.appendChild(tr);
    });
}

// --- Gráficos genéricos ---------------------------------------------

function mean(values) {
  const clean = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function lineChart(canvasId, labels, datasets, title) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        title: { display: true, text: title, color: "#e6e6e6" },
        legend: { labels: { color: "#e6e6e6" } },
      },
      scales: {
        x: { ticks: { color: "#94a3b8" } },
        y: { ticks: { color: "#94a3b8" } },
      },
    },
  });
}

// Agrupa `data` por (xField, seriesField) e tira a média de `metric` em cada
// combinação. Usado tanto para "uma linha por frequência" quanto "uma linha
// por ensaio", só trocando quem é eixo X e quem é série.
function buildGroupedMeans(data, xField, seriesField, metric, xLabelFn, seriesLabelFn) {
  const xValues = [...new Set(data.map((r) => r[xField]))].sort((a, b) => a - b);
  const seriesValues = [...new Set(data.map((r) => r[seriesField]))].sort((a, b) => a - b);

  const datasets = seriesValues.map((sv, i) => ({
    label: seriesLabelFn(sv),
    data: xValues.map((xv) => mean(data.filter((r) => r[xField] === xv && r[seriesField] === sv).map((r) => r[metric]))),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: PALETTE[i % PALETTE.length],
    tension: 0.2,
    spanGaps: true,
  }));

  return { labels: xValues.map(xLabelFn), datasets };
}

function drawGroupedCharts(prefix, data, xField, seriesField, xLabelFn, seriesLabelFn, titleSuffix) {
  METRICS.forEach(({ key, suffix, label }) => {
    const { labels, datasets } = buildGroupedMeans(data, xField, seriesField, key, xLabelFn, seriesLabelFn);
    lineChart(`${prefix}${suffix}`, labels, datasets, `${label} ${titleSuffix}`);
  });
}

const freqLabel = (f) => `${f / 1000} kHz`;
const ensaioLabel = (e) => `Ensaio ${e}`;
const dutyLabel = (d) => `${d}%`;

// --- Aba "Ensaio individual" --------------------------------------------

function populateSelect() {
  const select = document.getElementById("ensaioSelect");
  const ensaios = [...new Set(rawData.map((r) => r.ensaio))]
    .filter((v) => v !== undefined && v !== null && v !== "")
    .sort((a, b) => a - b);

  select.innerHTML = ensaios.map((e) => `<option value="${e}">Ensaio ${e}</option>`).join("");
  select.addEventListener("change", () => drawEnsaioView(select.value));
  if (ensaios.length) drawEnsaioView(ensaios[0]);
}

function drawEnsaioView(ensaio) {
  const rows = rawData.filter((r) => String(r.ensaio) === String(ensaio));

  // Uma linha por frequência, eixo X = duty cycle testado dentro do ensaio.
  drawGroupedCharts("cmp", rows, "duty_percent", "frequencia_hz", dutyLabel, freqLabel, "— por frequência");

  renderFreqDetail(ensaio, rows);
}

// Um bloco por frequência testada no ensaio, com todas as grandezas lado a lado.
function renderFreqDetail(ensaio, rows) {
  const container = document.getElementById("freqDetailContainer");
  container.innerHTML = "";

  const freqs = [...new Set(rows.map((r) => r.frequencia_hz))].sort((a, b) => a - b);

  freqs.forEach((freq) => {
    const freqRows = rows.filter((r) => r.frequencia_hz === freq).sort((a, b) => a.segundo - b.segundo);
    const labels = freqRows.map((r) => r.segundo);

    const heading = document.createElement("h3");
    heading.style.margin = "20px 0 4px";
    heading.textContent = freqLabel(freq);
    container.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "grid";
    METRICS.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<canvas id="detail_${freq}_${m.key}"></canvas>`;
      grid.appendChild(card);
    });
    container.appendChild(grid);

    METRICS.forEach((m, i) => {
      lineChart(
        `detail_${freq}_${m.key}`,
        labels,
        [{ label: m.label, data: freqRows.map((r) => r[m.key]), borderColor: PALETTE[i % PALETTE.length], tension: 0.2 }],
        `${m.label} — ${freqLabel(freq)}`
      );
    });
  });
}

// --- Aba "Comparar ensaios" ----------------------------------------------

function renderEnsaioCheckboxes() {
  const container = document.getElementById("ensaioCheckboxes");
  const ensaios = [...new Set(rawData.map((r) => r.ensaio))].sort((a, b) => a - b);

  container.innerHTML = ensaios
    .map((e) => `<label><input type="checkbox" value="${e}" checked> Ensaio ${e}</label>`)
    .join("");

  container.querySelectorAll("input").forEach((cb) => cb.addEventListener("change", updateComparador));
}

function updateComparador() {
  const checked = Array.from(document.querySelectorAll("#ensaioCheckboxes input:checked")).map((i) => Number(i.value));
  const filtered = rawData.filter((r) => checked.includes(r.ensaio));
  drawGroupedCharts("cmpEns", filtered, "frequencia_hz", "ensaio", freqLabel, ensaioLabel, "— comparação de ensaios");
}

// --- Inicialização --------------------------------------------------------

setupTabs();

Promise.all([loadRawFromSheet(), loadCsv(CLASS_CSV).catch(() => [])]).then(([raw, cls]) => {
  rawData = raw;
  classData = cls;

  populateSelect();
  renderTable();

  renderEnsaioCheckboxes();
  updateComparador();

  drawGroupedCharts("freq", rawData, "ensaio", "frequencia_hz", ensaioLabel, freqLabel, "— por ensaio e frequência");
});