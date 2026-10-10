import { lessons } from "./lecciones.mjs";
import { normalizeSource, runClassic } from "./classic-vm.mjs";

const PROGRESS_KEY = "calcbolge-course-progress-v1";

export function readProgress(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(PROGRESS_KEY) ?? "{}");
    const completed = Array.isArray(saved.completed)
      ? saved.completed.filter((id) => Number.isInteger(id) && id >= 1 && id <= lessons.length)
      : [];
    return { completed: [...new Set(completed)].sort((a, b) => a - b) };
  } catch {
    return { completed: [] };
  }
}

export function writeProgress(progress, storage = globalThis.localStorage) {
  storage?.setItem(PROGRESS_KEY, JSON.stringify({ completed: progress.completed }));
}

export function normalizeAnswer(value) {
  return String(value).normalize("NFC").trim().toLocaleLowerCase("es");
}

export function checkAnswer(lesson, value) {
  if (lesson.kind === "number") {
    const raw = String(value).trim();
    return /^-?\d+$/.test(raw) && Number(raw) === Number(lesson.expected);
  }
  if (lesson.kind === "char") return String(value) === lesson.expected;
  if (lesson.kind === "choice") return String(value) === lesson.expected;
  if (lesson.kind === "source") {
    try {
      return normalizeSource(String(value)) === lesson.expected;
    } catch {
      return false;
    }
  }
  return normalizeAnswer(value) === normalizeAnswer(lesson.expected);
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

function toAsciiBytes(source) {
  const bytes = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i += 1) bytes[i] = source.charCodeAt(i);
  return bytes;
}

function bytesEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function verifyProgramLesson(lesson, source, onProgress = null, runner = runClassic) {
  let normalized;
  try {
    normalized = normalizeSource(source);
  } catch (error) {
    return { passed: false, message: error.message };
  }

  const digest = await sha256(toAsciiBytes(normalized));
  if (digest !== lesson.sourceHash) {
    return {
      passed: false,
      message: `Ese no es el fuente canónico de ${lesson.artifact}. Descarga el archivo enlazado en la consigna y cárgalo sin editar.`,
    };
  }

  try {
    const result = await runner(normalized, lesson.runCase.stdin, {
      maxSteps: lesson.runCase.maxSteps,
      maxOutput: lesson.runCase.maxOutput,
      traceLimit: 20,
      onProgress,
    });
    const expected = Uint8Array.from(lesson.runCase.expectedOutput);
    const passed = result.status === lesson.runCase.expectedStatus && bytesEqual(result.output, expected);
    return {
      passed,
      result,
      message: passed
        ? `PASS: ${result.status}, ${result.steps.toLocaleString("es")} pasos, salida byte a byte correcta.`
        : `Falló: ${result.status}, ${result.steps.toLocaleString("es")} pasos, ${result.output.length} bytes de salida.`,
    };
  } catch (error) {
    return { passed: false, message: error.message };
  }
}

export async function verifyQuine(lesson, source, onProgress = null, runner = runClassic) {
  let normalized;
  try {
    normalized = normalizeSource(source);
  } catch (error) {
    return { passed: false, message: error.message };
  }
  if (normalized.length !== lesson.sourceLength) {
    return {
      passed: false,
      message: `La quine debe tener ${lesson.sourceLength.toLocaleString("es")} celdas; ahora tiene ${normalized.length.toLocaleString("es")}.`,
    };
  }
  const sourceDigest = await sha256(toAsciiBytes(normalized));
  if (sourceDigest !== lesson.sourceHash) {
    return {
      passed: false,
      message: "El fuente no coincide con la quine canónica. Revisa cortes de línea, caracteres omitidos y transcripciones.",
    };
  }
  try {
    const result = await runner(normalized, "", {
      maxSteps: lesson.maxSteps,
      maxOutput: lesson.outputLength + 1,
      traceLimit: 16,
      onProgress,
    });
    const outputDigest = await sha256(result.output);
    const passed =
      result.status === "HALTED" &&
      result.output.length === lesson.outputLength &&
      outputDigest === lesson.outputHash;
    return {
      passed,
      result,
      message: passed
        ? `QUINE VERIFICADA: HALT tras ${result.steps.toLocaleString("es")} pasos; la salida coincide byte a byte con malbolge.org.`
        : `La ejecución no coincide: ${result.status}, ${result.steps.toLocaleString("es")} pasos, ${result.output.length.toLocaleString("es")} bytes.`,
    };
  } catch (error) {
    return { passed: false, message: error.message };
  }
}

export { PROGRESS_KEY };
