export interface Env {
  CLONE_JOBS: Queue;                 // binding a la cola (arriba en wrangler.toml)
  BOT_PUBLIC_BASE: string;           // ej: https://kits-clone-bot.lucasmallo.workers.dev
  QUEUE_AUTH?: string;               // opcional, si tu bot valida un header
}

export default {
  // solo para hacer ping rápido si querés
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/ping") return new Response("ok");
    return new Response("kits-consumer up");
  },

  // consumidor de la cola
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
    for (const msg of batch.messages) {
      try {
        const payload = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;

        const res = await fetch(`${env.BOT_PUBLIC_BASE}/bot/clone`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.QUEUE_AUTH ? { "X-Queue-Auth": env.QUEUE_AUTH } : {})
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`bot/clone ${res.status} ${t}`);
        }

        msg.ack();      // procesado OK
      } catch (err: any) {
        console.log("[consumer][err]", err?.message || String(err));
        msg.retry();    // que la cola reintente según su política
      }
    }
  }
};
