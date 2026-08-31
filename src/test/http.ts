export function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function readJson<T = Record<string, unknown>>(response: Response) {
  return { status: response.status, body: (await response.json()) as T };
}
