import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  checkAnswer,
  readProgress,
  verifyProgramLesson,
  verifyQuine,
  writeProgress,
} from "../curso/curso-core.mjs";
import { lessons } from "../curso/lecciones.mjs";
import {
  CLASSIC_ENCRYPTION,
  encryptGraphic,
  normalizeSource,
  runClassic,
} from "../curso/classic-vm.mjs";

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("el curso tiene 100 retos secuenciales en diez niveles", () => {
  assert.equal(lessons.length, 100);
  assert.deepEqual(lessons.map(({ id }) => id), Array.from({ length: 100 }, (_, index) => index + 1));
  assert.deepEqual([...new Set(lessons.map(({ unit }) => unit))], Array.from({ length: 10 }, (_, index) => index + 1));
});

test("las respuestas guardadas validan los retos que no requieren ejecutar programas", () => {
  const quizLessons = lessons.filter(({ kind }) => kind !== "program" && kind !== "quine");
  assert.ok(quizLessons.length >= 90);
  for (const lesson of quizLessons) {
    assert.equal(checkAnswer(lesson, lesson.expected), true, `reto ${lesson.id}: ${lesson.title}`);
  }
});

test("la normalización de fuente solo quita espacios ASCII", () => {
  assert.equal(normalizeSource(" \tubO\r\n"), "ubO");
  assert.throws(() => normalizeSource("u\u00a0bO"), /U\+A0/);
});

test("Classic ejecuta IN, OUT y HALT con stdin y bytes Latin-1", () => {
  const result = runClassic("ubO", "ÿ");
  assert.equal(result.status, "HALTED");
  assert.equal(result.steps, 3);
  assert.deepEqual([...result.output], [255]);
});

test("Classic convierte EOF al valor ternario definido por el estándar", () => {
  const result = runClassic("ubO", "");
  assert.equal(result.status, "HALTED");
  assert.deepEqual([...result.output], [59_048 % 256]);
});

test("Classic rechaza fuente no gráfico o vacío", () => {
  assert.throws(() => normalizeSource("u bO\n☃"), /U\+2603/);
  assert.throws(() => runClassic("u bO\n☃"), /no imprimible/);
  assert.throws(() => runClassic(" "), /vacío/);
});

test("Classic cifra los 94 caracteres gráficos mediante la tabla completa", () => {
  assert.equal(CLASSIC_ENCRYPTION.length, 94);
  assert.equal(new Set(CLASSIC_ENCRYPTION).size, 94);
  assert.equal(encryptGraphic(33), 53);
  assert.equal(encryptGraphic(96), 60);
  assert.equal(encryptGraphic(126), 64);
  assert.throws(() => encryptGraphic(32), RangeError);
});

test("Classic trata opcodes desconocidos como NOP y se atasca en una celda no gráfica", () => {
  assert.equal(runClassic("!P").status, "HALTED");
  const stuck = runClassic("bD");
  assert.equal(stuck.status, "STUCK_INVALID_CELL");
  assert.equal(stuck.c, 100);
  assert.equal(stuck.trace.at(-1).mnemonic, "INVALID");
});

test("el progreso local se deduplica y descarta ids inválidos", () => {
  const entries = new Map([["calcbolge-course-progress-v1", JSON.stringify({ completed: [2, 2, 0, 101, "3", 1] })]]);
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  assert.deepEqual(readProgress(storage), { completed: [1, 2] });
  writeProgress({ completed: [1, 2] }, storage);
  assert.deepEqual(JSON.parse(entries.get("calcbolge-course-progress-v1")), { completed: [1, 2] });
});

test("un reto de programa compara huella, estado y bytes contra el runner", async () => {
  const source = "ubO";
  let calls = 0;
  const lesson = {
    artifact: "test",
    sourceHash: hash(source),
    runCase: {
      stdin: "A",
      expectedOutput: [65],
      expectedStatus: "HALTED",
      maxSteps: 10,
      maxOutput: 10,
    },
  };
  const result = await verifyProgramLesson(lesson, source, null, async (_code, _stdin, options) => {
    calls += 1;
    assert.equal(options.maxSteps, 10);
    return { status: "HALTED", steps: 3, output: Uint8Array.of(65) };
  });
  assert.equal(result.passed, true);
  assert.equal(calls, 1);
});

test("un fuente con huella incorrecta nunca llega al runner", async () => {
  const lesson = {
    artifact: "test",
    sourceHash: "0".repeat(64),
    runCase: { stdin: "", expectedOutput: [], expectedStatus: "HALTED", maxSteps: 10, maxOutput: 10 },
  };
  const result = await verifyProgramLesson(lesson, "ubO", null, async () => {
    assert.fail("el runner no debe ejecutarse");
  });
  assert.equal(result.passed, false);
  assert.match(result.message, /no es el fuente canónico/);
});

test("la quine exige la huella exacta de fuente y de salida", async () => {
  const source = "ubO";
  const output = new TextEncoder().encode("ubO\n");
  const lesson = {
    sourceLength: source.length,
    sourceHash: hash(source),
    outputLength: output.length,
    outputHash: hash(output),
    maxSteps: 100,
  };
  const result = await verifyQuine(lesson, source, null, async () => ({
    status: "HALTED",
    steps: 3,
    output,
  }));
  assert.equal(result.passed, true);
});
