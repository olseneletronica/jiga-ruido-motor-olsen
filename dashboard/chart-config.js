// Áudio/vibração/corrente vêm direto da planilha publicada (mesma URL do
// scripts/fetch_sheet.py). Só a classificação continua vindo de um arquivo
// do repositório, porque depende de rodar scripts/baseline.py + classify.py.
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

function populateSelect() {
  const select = document.getElementById("ensaioSelect");
  const ensaios = [...new Set(rawData.map((r) => r.ensaio))]
    .filter((v) => v !== undefined && v !== null && v !== "")
    .sort((a, b) => a - b);

  select.innerHTML = ensaios.map((e) => `<option value="${e}">Ensaio ${e}</option>`).join("");
  select.addEventListener("change", () => drawCharts(select.value));
  if (ensaios.length) drawCharts(ensaios[0]);
}

function lineChart(canvasId, labels, datasets, title) {
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
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
        x: { ticks: { color: "#94a3b8" }, title: { display: true, text: "segundo", color: "#94a3b8" } },
        y: { ticks: { color: "#94a3b8" } },
      },
    },
  });
}

function drawCharts(ensaio) {
  const rows = rawData
    .filter((r) => String(r.ensaio) === String(ensaio))
    .sort((a, b) => a.segundo - b.segundo);
  const labels = rows.map((r) => r.segundo);

  lineChart(
    "chartCorrente",
    labels,
    [{ label: "Corrente (A)", data: rows.map((r) => r.corrente_a), borderColor: "#60a5fa", tension: 0.2 }],
    "Corrente ao longo do ensaio"
  );

  lineChart(
    "chartVibracao",
    labels,
    [{ label: "Aceleração resultante (g)", data: rows.map((r) => r.accel_resultante_g), borderColor: "#f472b6", tension: 0.2 }],
    "Vibração ao longo do ensaio"
  );

  lineChart(
    "chartAudio",
    labels,
    [{ label: "Áudio RMS", data: rows.map((r) => r.audio_rms), borderColor: "#facc15", tension: 0.2 }],
    "Áudio ao longo do ensaio"
  );
}

Promise.all([loadRawFromSheet(), loadCsv(CLASS_CSV).catch(() => [])]).then(([raw, cls]) => {
  rawData = raw;
  classData = cls;
  populateSelect();
  renderTable();
});