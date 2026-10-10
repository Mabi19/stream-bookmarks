import { Hono } from "hono";
import { html } from "hono/html";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import { BookmarkSchema, createBookmark } from "./bookmark";
import * as db from "./db";
import { BookmarkList, Homepage, Layout, NotFound } from "./ui";

const app = new Hono<{ Bindings: CloudflareBindings }>()
    .onError(async (error, ctx) => {
        console.error(error);

        // TODO: Nice error pages except on /create-bookmark
        if (error instanceof HTTPException) {
            const message = error.message || (await error.res?.text());
            return ctx.text(`Error: ${message}`, error.status);
        } else if (error instanceof Error) {
            return ctx.text(`Error: ${error.message}`, 500);
        } else {
            return ctx.text("An unknown error has occurred! :(", 500);
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

        return ctx.text(await createBookmark(channelString, userString, ctx.req.query("arg")));
    })
    .get("/:videoId", async (ctx) => {
        const videoId = ctx.req.param("videoId");
        const title = await db.getStreamTitle(videoId);
        if (title == null) {
            return ctx.html(
                Layout({
                    title: `Stream not found`,
                    children: [
                        html`
                            <h1>Bookmarks for &ldquo;???&rdquo;</h1>
                            <p>There aren't any bookmarks here :(</p>
                        `,
                    ],
                }),
                404,
            );
        }
        const highlightedUser = ctx.req.query("h");

        const bookmarkData = await db.getVideoBookmarks(videoId);
        const bookmarks = bookmarkData.results.map((entry) => v.parse(BookmarkSchema, entry));

        return ctx.html(
            BookmarkList({
                videoId,
                title,
                bookmarks,
                highlightedUser,
            }),
        );
    })
    .get("/", async (ctx) => {
        const count = await db.countBookmarks();
        return ctx.html(Homepage({ bookmarkCount: count }));
    });

export default app;
