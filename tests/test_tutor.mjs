import assert from "node:assert/strict";
import test from "node:test";
import { askTutor, normalizeTutorEndpoint } from "../curso/tutor-client.mjs";
import { lessons } from "../curso/lecciones.mjs";
import { handleRequest } from "../worker/index.mjs";

const origin = "https://dannybaanks.github.io";
const endpoint = "https://calcbolge.example.workers.dev/api/tutor";

function makeRequest(path = "/api/tutor", { method = "POST", body, requestOrigin = origin, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (requestOrigin) requestHeaders.set("Origin", requestOrigin);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return new Request(`https://worker.example${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeEnv(overrides = {}) {
  return {
    NVIDIA_API_KEY: "test-only-key",
    TUTOR_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

test("el cliente solo acepta endpoints HTTPS workers.dev con la ruta del tutor", () => {
  assert.equal(normalizeTutorEndpoint(endpoint), endpoint);
  assert.throws(() => normalizeTutorEndpoint("http://calcbolge.example.workers.dev/api/tutor"));
  assert.throws(() => normalizeTutorEndpoint("https://example.com/api/tutor"));
  assert.throws(() => normalizeTutorEndpoint("https://user:pass@calcbolge.example.workers.dev/api/tutor"));
  assert.throws(() => normalizeTutorEndpoint(`${endpoint}?key=secret`));
  assert.throws(() => normalizeTutorEndpoint("https://calcbolge.example.workers.dev/"));
});

test("el cliente manda solo lessonId y question y devuelve texto", async () => {
  let requestUrl;
  let requestOptions;
  const answer = await askTutor(endpoint, 3, "¿Qué significa esta instrucción?", async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return Response.json({ answer: "Piensa en el estado de la celda." });
  });
  assert.equal(requestUrl, endpoint);
  assert.deepEqual(JSON.parse(requestOptions.body), {
    lessonId: 3,
    question: "¿Qué significa esta instrucción?",
  });
  assert.equal(answer, "Piensa en el estado de la celda.");
});

test("el cliente comunica errores HTTP y respuestas malformadas", async () => {
  await assert.rejects(
    askTutor(endpoint, 1, "ayuda", async () => Response.json({ error: "Límite alcanzado." }, { status: 429 })),
    /Límite alcanzado/,
  );
  await assert.rejects(
    askTutor(endpoint, 1, "ayuda", async () => new Response("no json")),
    /respuesta inválida/,
  );
});

test("el proxy responde al preflight solo para los orígenes permitidos", async () => {
  const response = await handleRequest(makeRequest("/api/tutor", { method: "OPTIONS" }), makeEnv());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.match(response.headers.get("Access-Control-Allow-Methods"), /POST/);

  const denied = await handleRequest(makeRequest("/api/tutor", {
    method: "OPTIONS",
    requestOrigin: "https://attacker.example",
  }), makeEnv());
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
});

test("el proxy valida solicitudes y aplica el rate limit antes de llamar NVIDIA", async () => {
  let upstreamCalls = 0;
  const upstream = async () => {
    upstreamCalls += 1;
    return Response.json({ choices: [{ message: { content: "Pista." } }] });
  };

  const nullPayload = await handleRequest(makeRequest("/api/tutor", { body: null }), makeEnv(), upstream);
  assert.equal(nullPayload.status, 400);
  const invalidLesson = await handleRequest(makeRequest("/api/tutor", { body: { lessonId: 101, question: "hola" } }), makeEnv(), upstream);
  assert.equal(invalidLesson.status, 400);
  const tooLong = await handleRequest(makeRequest("/api/tutor", { body: { lessonId: 1, question: "x".repeat(1201) } }), makeEnv(), upstream);
  assert.equal(tooLong.status, 400);

  const limited = await handleRequest(
    makeRequest("/api/tutor", { body: { lessonId: 1, question: "hola" } }),
    makeEnv({ TUTOR_LIMITER: { limit: async () => ({ success: false }) } }),
    upstream,
  );
  assert.equal(limited.status, 429);
  assert.equal(upstreamCalls, 0);
});

test("el proxy usa contexto mínimo y no transmite respuestas ni datos del editor", async () => {
  let upstreamUrl;
  let upstreamOptions;
  const response = await handleRequest(
    makeRequest("/api/tutor", { body: { lessonId: 1, question: "¿Me das una pista?" } }),
    makeEnv(),
    async (url, options) => {
      upstreamUrl = url;
      upstreamOptions = options;
      return Response.json({ choices: [{ message: { content: "Observa la posición." } }] });
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.deepEqual(await response.json(), { answer: "Observa la posición." });
  assert.equal(upstreamUrl, "https://integrate.api.nvidia.com/v1/chat/completions");
  assert.equal(upstreamOptions.headers.Authorization, "Bearer test-only-key");
  const payload = JSON.parse(upstreamOptions.body);
  const context = payload.messages[1].content;
  const lesson = lessons[0];
  assert.match(context, new RegExp(lesson.title));
  assert.match(context, new RegExp(lesson.prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(context, /¿Me das una pista\?/);
  assert.doesNotMatch(context, /expected|explanation|source|program-source/i);
  assert.equal(JSON.stringify(payload).includes("test-only-key"), false);
});

test("el proxy informa configuración ausente y fallos del proveedor sin filtrarlos", async () => {
  const notConfigured = await handleRequest(
    makeRequest("/api/tutor", { body: { lessonId: 1, question: "hola" } }),
    makeEnv({ NVIDIA_API_KEY: "" }),
  );
  assert.equal(notConfigured.status, 503);

  const upstreamFailure = await handleRequest(
    makeRequest("/api/tutor", { body: { lessonId: 1, question: "hola" } }),
    makeEnv(),
    async () => new Response("private provider detail", { status: 500 }),
  );
  assert.equal(upstreamFailure.status, 502);
  assert.doesNotMatch(await upstreamFailure.text(), /private provider detail/);
});
