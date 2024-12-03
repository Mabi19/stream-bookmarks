import * as v from "@valibot/valibot";
import { Hono } from "hono";
import { html } from "hono/html";
import { HTTPException } from "hono/http-exception";
import { BookmarkSchema, createBookmark } from "./bookmark.ts";
import { kv } from "./kv.ts";
import { BookmarkList, Homepage, Layout, NotFound } from "./ui.ts";

export function createApp() {
    const app = new Hono()
        .onError((error, ctx) => {
            console.log(error);

            // TODO: Nice error pages except on /create-bookmark
            if (error instanceof HTTPException) {
                return ctx.text(`Error: ${error.message}`, error.status);
            } else if (error instanceof Error) {
                return ctx.text(`Error: ${error.message}`, 500);
            } else {
                return ctx.text(
                    "An unknown error has occured! :(",
                    500,
                );
            }
        })
        .notFound((ctx) => ctx.html(NotFound(), 404))
        .get("/create-bookmark", async (ctx) => {
            ctx.res.headers.set("Cache-Control", "no-store");

            const responseUrl = ctx.req.header("Nightbot-Response-Url");
            const userString = ctx.req.header("Nightbot-User");
            const channelString = ctx.req.header("Nightbot-Channel");

            console.debug("Received bookmark request!");
            console.debug(`Nightbot-User: ${userString}`);
            console.debug(`Nightbot-Channel: ${channelString}`);

            if (!responseUrl || !userString || !channelString) {
                throw new HTTPException(400, {
                    message: "You must be Nightbot",
                });
            }

            return ctx.text(await createBookmark(channelString, userString));
        })
        .get(
            "/:videoId",
            async (ctx) => {
                // TODO: username highlighting

                const videoId = ctx.req.param("videoId");
                const title = await kv.get(["streamTitle", videoId]);
                if (
                    title.versionstamp == null || typeof title.value != "string"
                ) {
                    return ctx.html(
                        Layout({
                            title: `Stream not found`,
                            children: [html`
                                <h1>Bookmarks for &ldquo;???&rdquo;</h1>
                                <p>
                                    There aren't any bookmarks here :(
                                </p>
                            `],
                        }),
                        404,
                    );
                }

                const bookmarks = (await Array.fromAsync(
                    kv.list({ prefix: ["bookmarks", videoId] }),
                ))
                    .map((entry) => v.parse(BookmarkSchema, entry.value))
                    .toSorted((a, b) =>
                        a.secondsSinceStart - b.secondsSinceStart
                    );

                return ctx.html(
                    BookmarkList({ videoId, title: title.value, bookmarks }),
                );
            },
        )
        .get("/", (ctx) => ctx.html(Homepage()));

    return app;
}
