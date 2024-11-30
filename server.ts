import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createBookmark } from "./bookmark.ts";
import { BookmarkList, Homepage } from "./ui.ts";

export function createApp() {
    const app = new Hono()
        .onError((error, ctx) => {
            if (error instanceof HTTPException) {
                throw error;
            } else if (error instanceof Error) {
                return ctx.text(`Error: ${error.message}`, 500);
            } else {
                return ctx.text(
                    "An unknown error has occured! :(",
                    500,
                );
            }
        })
        .get("/create-bookmark", async (ctx) => {
            ctx.res.headers.set("Cache-Control", "no-store");

            const responseUrl = ctx.req.header("Nightbot-Response-Url");
            const userString = ctx.req.header("Nightbot-User");
            const channelString = ctx.req.header("Nightbot-Channel");
            if (!responseUrl || !userString || !channelString) {
                return ctx.text("Error: You must be Nightbot", 400);
            }

            await createBookmark(channelString, userString);
            return ctx.text("Bookmark created!");
        })
        .get(
            "/:videoId",
            (ctx) => ctx.html(BookmarkList(ctx.req.param("videoId"))),
        )
        .get("/", (ctx) => ctx.html(Homepage()));

    return app;
}
