export const TUTOR_ENDPOINT_KEY = "calcbolge-tutor-endpoint-v1";

export function normalizeTutorEndpoint(value) {
  const endpoint = new URL(String(value).trim());
  const local = endpoint.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  const cloudflare = endpoint.protocol === "https:" &&
    endpoint.hostname.endsWith(".workers.dev");
  if ((!local && !cloudflare) || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash || endpoint.pathname !== "/api/tutor") {
    throw new Error("Usa la URL HTTPS propia de tu Worker de Cloudflare que termina en /api/tutor.");
  }
  return endpoint.href;
}

export async function askTutor(endpoint, lessonId, question, fetchImpl = fetch) {
  const url = normalizeTutorEndpoint(endpoint);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, question }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("El proxy del tutor devolvió una respuesta inválida.");
  }
  if (!response.ok) throw new Error(result.error || "El tutor no pudo responder.");
  if (typeof result.answer !== "string" || !result.answer.trim()) {
    throw new Error("El proxy no devolvió una respuesta de texto.");
  }
  return result.answer.trim();
}
