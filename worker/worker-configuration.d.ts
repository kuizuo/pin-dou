export interface Env {
  AI: { run: (model: string, input: { multipart: { body: ReadableStream; contentType: string } }, options?: { gateway: { id: string } }) => Promise<{ image?: string }> };
  ALLOWED_ORIGINS: string;
  PIXEL_RATE_LIMITER: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  TURNSTILE_SECRET_KEY: string;
}

export type ExportedHandler<Bindings> = {
  fetch: (request: Request, env: Bindings) => Promise<Response>;
};
