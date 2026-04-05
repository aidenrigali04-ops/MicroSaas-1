import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const app = await buildApp(env);

const port = env.PORT;
await app.listen({ port, host: "0.0.0.0" });
