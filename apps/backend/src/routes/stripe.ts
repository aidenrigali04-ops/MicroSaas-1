import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import type { Env } from "../env.js";
import { getDb } from "../db.js";
import { addCredits } from "../services/credits.js";

export async function registerStripeRoutes(
  app: FastifyInstance,
  env: Env,
): Promise<void> {
  app.get("/api/v1/billing/credits", async (_request, reply) => {
    const db = getDb();
    const { getCredits } = await import("../services/credits.js");
    const balance = await getCredits(db);
    return reply.send({ balance });
  });

  if (!env.STRIPE_SECRET_KEY) {
    app.log.info("Stripe checkout disabled (missing STRIPE_SECRET_KEY)");
    return;
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  if (env.STRIPE_WEBHOOK_SECRET) {
    app.post("/api/v1/webhooks/stripe", async (request, reply) => {
      const sig = request.headers["stripe-signature"];
      if (!sig || typeof sig !== "string") {
        return reply.status(400).send({ error: "missing_signature" });
      }
      const raw = (request as { rawBody?: Buffer }).rawBody;
      if (!Buffer.isBuffer(raw)) {
        return reply.status(500).send({ error: "raw_body_required" });
      }
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          raw,
          sig,
          env.STRIPE_WEBHOOK_SECRET!,
        );
      } catch (err) {
        app.log.warn(err, "stripe signature verify failed");
        return reply.status(400).send({ error: "invalid_signature" });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const qty = Number(
          session.metadata?.credits ?? session.metadata?.quantity ?? 5,
        );
        const creditsToAdd =
          Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 5;
        try {
          const db = getDb();
          await addCredits(db, creditsToAdd);
        } catch (e) {
          app.log.error(e, "add credits failed");
          return reply.status(500).send({ error: "credit_update_failed" });
        }
      }

      return reply.send({ received: true });
    });
  } else {
    app.log.info("Stripe webhook disabled (missing STRIPE_WEBHOOK_SECRET)");
  }

  app.post<{
    Body: { credits?: number; successUrl?: string; cancelUrl?: string };
  }>("/api/v1/billing/checkout-session", async (request, reply) => {
    const credits = Math.min(
      1000,
      Math.max(1, Math.floor(Number(request.body?.credits ?? 10))),
    );
    const price = env.STRIPE_PRICE_EXPORT_CREDITS;
    if (!price) {
      return reply.status(503).send({
        error: "stripe_price_missing",
        message: "Set STRIPE_PRICE_EXPORT_CREDITS to a Price ID.",
      });
    }
    const origin = request.headers.origin ?? "";
    const successUrl =
      request.body?.successUrl ?? `${origin}/?paid=1`;
    const cancelUrl = request.body?.cancelUrl ?? `${origin}/`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { credits: String(credits) },
    });
    return reply.send({ url: session.url });
  });
}
