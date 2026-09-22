// Caminhos relativos aos CSVs gerados pelo pipeline (scripts/*.py).
// Publique data/ junto com dashboard/ no GitHub Pages para esses fetches funcionarem.
const RAW_CSV = "../data/raw_ensaios.csv";
const CLASS_CSV = "../data/classificacao.csv";

let rawData = [];
let classData = [];
const charts = {};

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

Promise.all([loadCsv(RAW_CSV), loadCsv(CLASS_CSV)]).then(([raw, cls]) => {
  rawData = raw;
  classData = cls;
  populateSelect();
  renderTable();
});
