import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

export function createApp() {
    const app = new Hono()
        .get("/create-bookmark", async (ctx) => {
            // channel ID regex: UC([-_a-zA-Z0-9]{22})
            // video ID regex: [-_a-zA-Z0-9]{11}
            // TODO: get stuff from Nightbot headers
            const responseUrl = ctx.req.header("Nightbot-Response-Url");
            const userString = ctx.req.header("Nightbot-User");
            const channelString = ctx.req.header("Nightbot-Channel");
            if (!responseUrl || !userString || !channelString) {
                return ctx.text("Error: You must be Nightbot", 400);
            }
            try {
            } catch (e) {
                if (e instanceof HTTPException) {
                    throw e;
                } else if (e instanceof Error) {
                    return ctx.text(`Error: ${e.message}`, 500);
                } else {
                    return ctx.text(
                        "An unknown error has occured! :(",
                        500,
                    );
                }
            }
        })
        .get(
            "/:videoId",
            (ctx) => ctx.text(`Bookmark list for ${ctx.req.param("videoId")}`),
        );

    return app;
}
