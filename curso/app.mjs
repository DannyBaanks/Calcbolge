import { lessons } from "./lecciones.mjs";
import {
  askTutor,
  normalizeTutorEndpoint,
  TUTOR_ENDPOINT_KEY,
} from "./tutor-client.mjs";
import {
  checkAnswer,
  readProgress,
  verifyProgramLesson,
  verifyQuine,
  writeProgress,
} from "./curso-core.mjs";

const $ = (selector) => document.querySelector(selector);
const artifactUrls = {
  cat: "https://malbolge.org/cat.mal",
  digitalRoot: "https://malbolge.org/digital_root.mal",
  adder: "https://malbolge.org/adder.mal",
  quine: "https://malbolge.org/quine.mal",
  infiniteCat: "https://malbolge.org/cat.html",
};
const elements = {
  list: $("#lesson-list"),
  kicker: $("#lesson-kicker"),
  title: $("#lesson-title"),
  difficulty: $("#difficulty"),
  concept: $("#lesson-concept"),
  body: $("#lesson-body"),
  feedback: $("#lesson-feedback"),
  check: $("#check-answer"),
  previous: $("#previous-lesson"),
  next: $("#next-lesson"),
  progressLabel: $("#progress-label"),
  progressBar: $("#progress-bar"),
  progressFill: $("#progress-fill"),
  saveStatus: $("#save-status"),
  reset: $("#reset-progress"),
  intro: $("#intro-dialog"),
  introButton: $("#open-intro"),
  tutor: $("#tutor-dialog"),
  tutorButton: $("#open-tutor"),
  tutorEndpointForm: $("#tutor-endpoint-form"),
  tutorEndpoint: $("#tutor-endpoint"),
  tutorEndpointStatus: $("#tutor-endpoint-status"),
  disconnectTutor: $("#disconnect-tutor"),
  tutorQuestionForm: $("#tutor-question-form"),
  tutorQuestion: $("#tutor-question"),
  tutorMessages: $("#tutor-messages"),
  askTutorButton: $("#ask-tutor"),
  roadmap: $("#intro-roadmap"),
  source: $("#program-source"),
  file: $("#program-file"),
  fileName: $("#file-name"),
  stdin: $("#program-input"),
  run: $("#run-program"),
  runBadge: $("#run-badge"),
  output: $("#program-output"),
  trace: $("#program-trace"),
};

let progress;
try {
  progress = readProgress();
} catch {
  progress = { completed: [] };
  elements.saveStatus.textContent = "Almacenamiento local no disponible; el progreso durará solo esta sesión.";
}
let activeId = 1;
let selectedChoice = null;
let worker = null;
let busy = false;
let runId = 0;
let tutorEndpoint = "";
let tutorBusy = false;

function renderRoadmap() {
  const units = new Map();
  for (const lesson of lessons) {
    if (!units.has(lesson.unit)) units.set(lesson.unit, lesson.unitTitle);
  }
  const entries = [...units.entries()];
  elements.roadmap.textContent = [
    "Malbolge Classic",
    ...entries.map(([unit, title]) => {
      const first = String((unit - 1) * 10 + 1).padStart(3, "0");
      const last = String(unit * 10).padStart(3, "0");
      return `|-- ${String(unit).padStart(2, "0")} ${title} [${first}-${last}]`;
    }),
    "    `-- Examen final: la quine de Lutter",
  ].join("\n");
}

function showIntro() {
  if (!elements.intro.open) elements.intro.showModal();
}

function updateTutorConnection(message = "") {
  const connected = Boolean(tutorEndpoint);
  elements.tutorEndpoint.value = tutorEndpoint;
  elements.tutorEndpointStatus.textContent = message || (connected
    ? "URL configurada. El proxy se verifica al enviar la primera pregunta."
    : "Sin conectar. Despliega tu Worker y pega aquí su URL.");
  elements.askTutorButton.disabled = !connected || tutorBusy;
}

function appendTutorMessage(role, text) {
  const message = document.createElement("p");
  message.className = `tutor-message ${role}`;
  message.textContent = text;
  elements.tutorMessages.querySelector(".tutor-placeholder")?.remove();
  elements.tutorMessages.append(message);
  elements.tutorMessages.scrollTop = elements.tutorMessages.scrollHeight;
}

function initializeTutorEndpoint() {
  try {
    const storedEndpoint = localStorage.getItem(TUTOR_ENDPOINT_KEY);
    if (storedEndpoint) tutorEndpoint = normalizeTutorEndpoint(storedEndpoint);
  } catch {
    tutorEndpoint = "";
  }
  updateTutorConnection();
}

function appendFormatted(parent, text) {
  const pattern = /`([^`]+)`|(https?:\/\/[^\s)]+)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    if (match[1] !== undefined) {
      const code = document.createElement("code");
      code.textContent = match[1];
      parent.append(code);
    } else {
      try {
        const url = new URL(match[2]);
        if (url.hostname === "malbolge.org" || url.hostname === "www.malbolge.org") {
          const link = document.createElement("a");
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = match[2];
          parent.append(link);
        } else {
          parent.append(document.createTextNode(match[2]));
        }
      } catch {
        parent.append(document.createTextNode(match[2]));
      }
    }
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}

function renderLessonList() {
  elements.list.replaceChildren();
  const units = new Map();
  for (const lesson of lessons) {
    if (!units.has(lesson.unit)) units.set(lesson.unit, []);
    units.get(lesson.unit).push(lesson);
  }

  for (const [unit, rows] of units) {
    const group = document.createElement("details");
    group.className = "level-group";
    group.open = unit === lessons[activeId - 1].unit;
    const summary = document.createElement("summary");
    summary.textContent = `Nivel ${String(unit).padStart(2, "0")} · ${rows[0].unitTitle}`;
    group.append(summary);
    const list = document.createElement("div");
    list.className = "level-list";
    for (const lesson of rows) {
      const completed = progress.completed.includes(lesson.id);
      const unlocked = lesson.id === 1 || progress.completed.includes(lesson.id - 1);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `lesson-link${lesson.id === activeId ? " active" : ""}${completed ? " done" : ""}`;
      button.dataset.lessonId = String(lesson.id);
      button.disabled = !unlocked;
      const number = document.createElement("span");
      number.className = "lesson-num";
      number.textContent = String(lesson.id).padStart(3, "0");
      const title = document.createElement("span");
      title.textContent = lesson.title;
      const status = document.createElement("span");
      status.className = "lesson-status";
      status.setAttribute("aria-label", completed ? "completado" : unlocked ? "disponible" : "bloqueado");
      status.textContent = completed ? "✓" : unlocked ? "·" : "🔒";
      button.append(number, title, status);
      list.append(button);
    }
    group.append(list);
    elements.list.append(group);
  }
}

function renderProgress() {
  const count = progress.completed.length;
  elements.progressLabel.textContent = `${count} / ${lessons.length} retos`;
  elements.progressFill.style.width = `${(count / lessons.length) * 100}%`;
  elements.progressBar.setAttribute("aria-valuenow", String(count));
}

function showFeedback(message, kind) {
  elements.feedback.replaceChildren();
  appendFormatted(elements.feedback, message);
  elements.feedback.className = `feedback show ${kind}`;
}

function setBusy(value, status = "") {
  busy = value;
  elements.check.disabled = value;
  elements.run.disabled = value;
  if (status) elements.runBadge.textContent = status;
  if (value) elements.runBadge.className = "badge running";
}

function workerRunner(source, stdin, options, onProgress = options.onProgress ?? null) {
  const id = ++runId;
  const workerOptions = { ...options };
  delete workerOptions.onProgress;
  return new Promise((resolve, reject) => {
    const currentWorker = new Worker(new URL("./vm-worker.mjs", import.meta.url), { type: "module" });
    worker = currentWorker;
    currentWorker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === "progress") {
        onProgress?.(message.steps, message.maxSteps);
      } else if (message.type === "done") {
        currentWorker.terminate();
        if (worker === currentWorker) worker = null;
        resolve(message.result);
      } else if (message.type === "error") {
        currentWorker.terminate();
        if (worker === currentWorker) worker = null;
        reject(new Error(message.message));
      }
    });
    currentWorker.addEventListener("error", (event) => {
      currentWorker.terminate();
      if (worker === currentWorker) worker = null;
      reject(new Error(event.message || "No se pudo iniciar el runner Classic."));
    }, { once: true });
    currentWorker.postMessage({ id, source, stdin, ...workerOptions });
  });
}

function bytesToLatin1(bytes) {
  let text = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    text += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return text;
}

function showRunResult(result) {
  elements.output.value = bytesToLatin1(result.output);
  elements.runBadge.textContent = `${result.status} · ${result.steps.toLocaleString("es")} pasos`;
  elements.runBadge.className = `badge${result.status === "HALTED" ? " pass" : " fail"}`;
  const rows = result.trace.map(({ step, c, d, a, cell, opcode, mnemonic }) =>
    `${String(step).padStart(5)}  c=${String(c).padStart(5)} d=${String(d).padStart(5)} a=${String(a).padStart(5)}  ${JSON.stringify(String.fromCharCode(cell))} → ${String(opcode).padStart(2)} ${mnemonic}`);
  elements.trace.textContent = rows.join("\n") || "Sin instrucciones ejecutadas.";
  if (result.trace.length === 80) elements.trace.textContent += "\n… traza limitada a las primeras 80 instrucciones.";
}

function renderAnswer(lesson) {
  const answerArea = document.createElement("div");
  answerArea.className = "answer-area";
  if (lesson.kind === "program" || lesson.kind === "quine") {
    const note = document.createElement("p");
    note.className = "answer-help";
    note.textContent = lesson.kind === "quine"
      ? "Carga o escribe la quine en la mesa de trabajo; “Comprobar respuesta” verifica fuente y ejecución en un Web Worker."
      : "Carga el archivo de referencia en la mesa de trabajo; “Comprobar respuesta” ejecuta el vector exacto de esta prueba.";
    answerArea.append(note);
  } else if (lesson.kind === "choice") {
    lesson.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-choice";
      button.textContent = option;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        selectedChoice = String(index);
        for (const choice of answerArea.querySelectorAll(".answer-choice")) {
          const selected = choice === button;
          choice.classList.toggle("selected", selected);
          choice.setAttribute("aria-pressed", String(selected));
        }
      });
      answerArea.append(button);
    });
  } else if (lesson.kind === "source") {
    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = "lesson-answer";
    label.textContent = "FUENTE CODIFICADO";
    const textarea = document.createElement("textarea");
    textarea.id = "lesson-answer";
    textarea.maxLength = 1000;
    textarea.spellcheck = false;
    textarea.placeholder = "Escribe las celdas sin comentarios";
    answerArea.append(label, textarea);
  } else {
    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = "lesson-answer";
    label.textContent = "TU RESPUESTA";
    const input = document.createElement("input");
    input.id = "lesson-answer";
    input.className = "answer-input";
    input.autocomplete = "off";
    input.inputMode = lesson.kind === "number" ? "numeric" : "text";
    answerArea.append(label, input);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") elements.check.click();
    });
  }
  elements.body.append(answerArea);
}

function renderLesson() {
  const lesson = lessons[activeId - 1];
  selectedChoice = null;
  elements.kicker.textContent = `NIVEL ${lesson.unit} · RETO ${lesson.id} DE ${lessons.length}`;
  elements.title.textContent = lesson.title;
  elements.difficulty.textContent = `Dificultad ${lesson.difficulty}/10`;
  elements.concept.textContent = lesson.concept;
  elements.body.replaceChildren();
  const prompt = document.createElement("p");
  appendFormatted(prompt, lesson.prompt);
  elements.body.append(prompt);
  if (lesson.artifact && artifactUrls[lesson.artifact]) {
    const link = document.createElement("a");
    link.className = "artifact-link";
    link.href = artifactUrls[lesson.artifact];
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = lesson.artifact === "infiniteCat"
      ? "Abrir la página del cat y copiar el fragmento"
      : `Descargar ${lesson.artifact === "digitalRoot" ? "digital_root" : lesson.artifact}.mal`;
    elements.body.append(link);
  }
  renderAnswer(lesson);
  elements.feedback.className = "feedback";
  elements.feedback.replaceChildren();
  elements.previous.disabled = activeId === 1 || busy;
  elements.next.disabled = activeId === lessons.length || !progress.completed.includes(activeId) || busy;
  elements.check.disabled = busy;
  elements.check.textContent = lesson.kind === "program" || lesson.kind === "quine"
    ? lesson.kind === "quine" ? "Verificar quine · 70 M pasos" : "Ejecutar prueba oficial"
    : "Comprobar respuesta";
  renderLessonList();
}

function persistProgress() {
  try {
    writeProgress(progress);
    elements.saveStatus.textContent = "Progreso guardado localmente en este navegador.";
  } catch {
    elements.saveStatus.textContent = "No se pudo guardar el progreso; seguirá disponible hasta cerrar esta pestaña.";
  }
}

function completeLesson(lesson) {
  if (!progress.completed.includes(lesson.id)) {
    progress.completed.push(lesson.id);
    progress.completed.sort((a, b) => a - b);
    persistProgress();
  }
  renderProgress();
  renderLessonList();
  elements.next.disabled = lesson.id === lessons.length || busy;
}

async function checkCurrentLesson() {
  const lesson = lessons[activeId - 1];
  setBusy(true, lesson.kind === "quine" ? "verificando quine…" : "comprobando…");
  try {
    let result;
    if (lesson.kind === "program") {
      result = await verifyProgramLesson(
        lesson,
        elements.source.value,
        (steps, maximum) => {
          elements.runBadge.textContent = `${steps.toLocaleString("es")} / ${maximum.toLocaleString("es")} pasos`;
        },
        workerRunner,
      );
    } else if (lesson.kind === "quine") {
      result = await verifyQuine(
        lesson,
        elements.source.value,
        (steps, maximum) => {
          elements.runBadge.textContent = `${steps.toLocaleString("es")} / ${maximum.toLocaleString("es")} pasos`;
        },
        workerRunner,
      );
    } else {
      const answer = lesson.kind === "choice"
        ? selectedChoice
        : $("#lesson-answer")?.value ?? "";
      const passed = checkAnswer(lesson, answer);
      result = {
        passed,
        message: passed
          ? `¡Correcto! ${lesson.explanation}`
          : `Aún no. Inténtalo otra vez. ${lesson.explanation}`,
      };
    }

    if (result.passed) {
      completeLesson(lesson);
      showFeedback(result.message, "pass");
      if (result.result) showRunResult(result.result);
      elements.runBadge.textContent = result.result?.status ?? "reto aprobado";
      elements.runBadge.className = "badge pass";
    } else {
      showFeedback(result.message, "fail");
      if (result.result) showRunResult(result.result);
      else {
        elements.runBadge.textContent = "revisa el fuente";
        elements.runBadge.className = "badge fail";
      }
    }
  } catch (error) {
    showFeedback(`Error del laboratorio: ${error.message}`, "fail");
    elements.runBadge.textContent = "error";
    elements.runBadge.className = "badge fail";
  } finally {
    setBusy(false);
    elements.previous.disabled = activeId === 1;
    elements.next.disabled = activeId === lessons.length || !progress.completed.includes(activeId);
  }
}

async function runSandbox() {
  setBusy(true, "ejecutando…");
  elements.output.value = "";
  elements.trace.textContent = "Ejecutando en Worker…";
  try {
    const result = await workerRunner(elements.source.value, elements.stdin.value, {
      maxSteps: 2_000_000,
      maxOutput: 4_096,
      traceLimit: 80,
    }, (steps, maximum) => {
      elements.runBadge.textContent = `${steps.toLocaleString("es")} / ${maximum.toLocaleString("es")} pasos`;
    });
    showRunResult(result);
  } catch (error) {
    elements.runBadge.textContent = "error";
    elements.runBadge.className = "badge fail";
    elements.trace.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-lesson-id]");
  if (!button || button.disabled || busy) return;
  activeId = Number(button.dataset.lessonId);
  renderLesson();
});

elements.check.addEventListener("click", checkCurrentLesson);
elements.previous.addEventListener("click", () => {
  if (activeId > 1 && !busy) {
    activeId -= 1;
    renderLesson();
  }
});
elements.next.addEventListener("click", () => {
  if (activeId < lessons.length && progress.completed.includes(activeId) && !busy) {
    activeId += 1;
    renderLesson();
  }
});
elements.run.addEventListener("click", runSandbox);
elements.file.addEventListener("change", async () => {
  const file = elements.file.files?.[0];
  if (!file) return;
  try {
    elements.source.value = await file.text();
    elements.fileName.textContent = file.name;
    elements.runBadge.textContent = "archivo cargado";
    elements.runBadge.className = "badge";
  } catch (error) {
    elements.fileName.textContent = "error al abrir";
    showFeedback(`No se pudo leer el archivo: ${error.message}`, "fail");
  }
});
elements.reset.addEventListener("click", () => {
  if (busy || !globalThis.confirm("¿Reiniciar los 100 retos y borrar el progreso local?")) return;
  progress = { completed: [] };
  persistProgress();
  renderProgress();
  renderLesson();
});

elements.introButton.addEventListener("click", showIntro);
elements.tutorButton.addEventListener("click", () => elements.tutor.showModal());
elements.tutorEndpointForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const endpoint = normalizeTutorEndpoint(elements.tutorEndpoint.value);
    localStorage.setItem(TUTOR_ENDPOINT_KEY, endpoint);
    tutorEndpoint = endpoint;
    updateTutorConnection("URL guardada en este navegador. Todavía no se ha enviado ninguna pregunta.");
  } catch (error) {
    updateTutorConnection(error.message || "No se pudo guardar la URL del Worker.");
  }
});
elements.disconnectTutor.addEventListener("click", () => {
  tutorEndpoint = "";
  try {
    localStorage.removeItem(TUTOR_ENDPOINT_KEY);
    updateTutorConnection("Worker desconectado; URL eliminada de este navegador.");
  } catch {
    updateTutorConnection("Worker desconectado. El almacenamiento local no está disponible.");
  }
});
elements.tutorQuestionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = elements.tutorQuestion.value.trim();
  if (!tutorEndpoint || !question || tutorBusy) return;

  tutorBusy = true;
  updateTutorConnection("Enviando solo la pregunta y el contexto del reto actual…");
  appendTutorMessage("student", `Tú: ${question}`);
  elements.tutorQuestion.value = "";
  try {
    const answer = await askTutor(tutorEndpoint, activeId, question);
    appendTutorMessage("assistant", `Tutor: ${answer}`);
    updateTutorConnection("El tutor respondió. La pregunta y el contexto del reto se enviaron a NVIDIA.");
  } catch (error) {
    appendTutorMessage("error", `No se pudo obtener una respuesta: ${error.message}`);
    updateTutorConnection(error.message);
  } finally {
    tutorBusy = false;
    elements.askTutorButton.disabled = !tutorEndpoint;
  }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-close-dialog]");
  if (!button) return;
  document.getElementById(button.dataset.closeDialog)?.close();
});

renderRoadmap();
renderProgress();
renderLesson();
initializeTutorEndpoint();

try {
  if (localStorage.getItem("calcbolge-intro-seen-v1") !== "yes") {
    showIntro();
    localStorage.setItem("calcbolge-intro-seen-v1", "yes");
  }
} catch {
  showIntro();
}
