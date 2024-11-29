import { createApp } from "./server.ts";

const app = createApp();

Deno.serve(app.fetch);

// TODO:
// Make a test client
// Test bookmark creation
// Make a bookmark list per video
