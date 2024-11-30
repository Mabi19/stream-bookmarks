import * as v from "@valibot/valibot";
import { html } from "hono/html";
import { PropsWithChildren } from "hono/jsx";
import { type Bookmark, BookmarkSchema } from "./bookmark.ts";
import { kv } from "./kv.ts";

export const Layout = (
    { title, children }: PropsWithChildren<{ title: string }>,
) => html`
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
            <main>
                ${children}
            </main>
        </body>
    </html>
`;

function makeBookmarkEntry(
    videoId: string,
    { username, secondsSinceStart }: Bookmark,
) {
    // round off fractional seconds
    secondsSinceStart = Math.floor(secondsSinceStart);

    const link =
        `https://youtube.com/watch?v=${videoId}&t=${secondsSinceStart}`;
    const seconds = secondsSinceStart % 60;
    const minutes = (secondsSinceStart - seconds) / 60;
    const hours = (secondsSinceStart - seconds - minutes * 60) / 3600;
    const formattedTime = `${hours}:${minutes.toString().padStart(2, "0")}:${
        seconds.toString().padStart(2, "0")
    }`;

    return html`<li>
        <a href="${link}">${username}: ${formattedTime}</a>
    </li>`;
}

export const BookmarkList = async (videoId: string) => {
    const title = await kv.get(["streamTitle", videoId]);
    if (title.versionstamp == null || typeof title.value != "string") {
        return Layout({
            title: `Stream not found`,
            children: [html`
                <h1>Bookmarks for &ldquo;???&rdquo;</h1>
                <p>
                    There aren't any bookmarks here :(
                </p>
            `],
        });
    }

    const bookmarks = (await Array.fromAsync(
        kv.list({ prefix: ["bookmarks", videoId] }),
    )).map((entry) => v.parse(BookmarkSchema, entry.value));

    const entries = bookmarks.map((bookmark) =>
        makeBookmarkEntry(videoId, bookmark)
    );

    return Layout({
        title: `Bookmarks for "${title.value}"`,
        children: [html`
            <h1>Bookmarks for &ldquo;${title.value}&rdquo;</h1>
            <ol>${entries}</ol>
        `],
    });
};

export const Homepage = () => {
    return Layout({
        title: "Stream Bookmarks",
        children: [html`<p>// TODO: description</p>`],
    });
};
