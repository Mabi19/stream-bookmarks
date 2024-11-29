import { createApp } from "./server.ts";

const app = createApp();

Deno.serve(app.fetch);
