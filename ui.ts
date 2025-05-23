import { html } from "hono/html";
import { PropsWithChildren } from "hono/jsx";
import { type Bookmark, formatTime } from "./bookmark.ts";
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
            <meta name="color-scheme" content="light dark" />
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.violet.min.css"
            >
            <link href="https://mabi.land/assets/icon.png" rel="icon">
        </head>
        <body>
            <main class="container">
                ${children}
            </main>
        </body>
    </html>
`;

function makeBookmarkEntry(
    videoId: string,
    { username, secondsSinceStart }: Bookmark,
    highlightedUser?: string,
) {
    const url = `https://youtube.com/watch?v=${videoId}&t=${secondsSinceStart}`;
    const isHighlighted = username == highlightedUser;
    const anchor = html`<a href="${url}">${username}: ${
        formatTime(secondsSinceStart)
    }</a>`;

    return html`<li>
        ${isHighlighted ? html`<mark>${anchor}</mark>` : anchor}
    </li>`;
}

export const BookmarkList = (
    { videoId, title, bookmarks, highlightedUser }: {
        videoId: string;
        title: string;
        bookmarks: Bookmark[];
        highlightedUser?: string;
    },
) => {
    const entries = bookmarks.map((bookmark) =>
        makeBookmarkEntry(videoId, bookmark, highlightedUser)
    );

    return Layout({
        title: `Bookmarks for "${title}"`,
        children: [html`
            <h1>Bookmarks for &ldquo;${title}&rdquo;</h1>
            <ol>${entries}</ol>
            <hr>
            <p>
                <a href="/">What is this?</a>
            </p>
        `],
    });
};

export const Homepage = async () => {
    const bookmarkCount = (await kv.get(["count"])).value;
    if (!(bookmarkCount == null || bookmarkCount instanceof Deno.KvU64)) {
        throw new Error("Invalid count value in database");
    }

    return Layout({
        title: "Stream Bookmarks",
        children: [html`
            <h1>Stream Bookmarks</h1>
            <p>
                This is a tiny (&lt; 500 lines of code) utility to bookmark where you left a YouTube stream, by making a Nightbot Custom API.
                Bookmarks are stored indefinitely, for now at least; there are currently <strong>${bookmarkCount?.value}</strong> bookmarks in the database.
                It's currently restricted to <a href="https://youtube.com/@ArgonMatrix">ArgonMatrix</a>'s channel only;
                if you're a YouTube streamer interested this tool please reach out to me on Discord!
            </p>
            <p>
                This app's source code is <a href="https://github.com/Mabi19/stream-bookmarks">available on GitHub</a>,
                and you can find more of my stuff at <a href="https://mabi.land/">mabi.land</a>.
            </p>
            <h2>Usage</h2>
            <p>
                First, make a bookmark using the <code>!bookmark</code> command in chat. Then, when you want to know where you left off,
                replace <code>youtube.com/watch?v=</code> in the video's URL with <code>bookmarks.mabi.land/</code>.
                For example, <a href="https://www.youtube.com/watch?v=I89G7VFWCNw">https://www.youtube.com/watch?v=I89G7VFWCNw</a>
                becomes <a href="https://bookmarks.mabi.land/I89G7VFWCNw">https://bookmarks.mabi.land/I89G7VFWCNw</a>.
            </p>
        `],
    });
};

export const NotFound = () => {
    return Layout({
        title: "Not Found",
        children: [html`
            <h1>Not Found</h1>
            <p>There's nothing here...</p>
        `],
    });
};
