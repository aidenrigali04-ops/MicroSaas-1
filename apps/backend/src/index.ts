import { buildApp } from "./app.js";
import { initDb } from "./db.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
await initDb(env);
const app = await buildApp(env);

const port = env.PORT;
await app.listen({ port, host: "0.0.0.0" });
