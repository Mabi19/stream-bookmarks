import { html } from "hono/html";
import { PropsWithChildren } from "hono/jsx";
import { type Bookmark, formatTime } from "./bookmark";

export const Layout = ({ title, children }: PropsWithChildren<{ title: string }>) => html`
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta name="color-scheme" content="light dark" />
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.violet.min.css"
            />
            <link href="https://mabi.land/assets/icon.png" rel="icon" />
        </head>
        <body>
            <main class="container">${children}</main>
        </body>
    </html>
`;

function makeBookmarkEntry(
    videoId: string,
    { username, time }: Bookmark,
    highlightedUser?: string,
) {
    const url = `https://youtube.com/watch?v=${videoId}&t=${time}`;
    const isHighlighted = username == highlightedUser;
    const anchor = html` <a href="${url}">${username}: ${formatTime(time)}</a> `;

    return html` <li>${isHighlighted ? html` <mark>${anchor}</mark> ` : anchor}</li> `;
}

export const BookmarkList = ({
    videoId,
    title,
    bookmarks,
    highlightedUser,
}: {
    videoId: string;
    title: string;
    bookmarks: Bookmark[];
    highlightedUser?: string;
}) => {
    const entries = bookmarks.map((bookmark) =>
        makeBookmarkEntry(videoId, bookmark, highlightedUser),
    );

    return Layout({
        title: `Bookmarks for "${title}"`,
        children: [
            html`
                <h1>Bookmarks for &ldquo;${title}&rdquo;</h1>
                <ol>
                    ${entries}
                </ol>
                <hr />
                <p>
                    <a href="/">What is this?</a>
                </p>
            `,
        ],
    });
};

export const Homepage = ({ bookmarkCount }: { bookmarkCount: number | null }) => {
    return Layout({
        title: "Stream Bookmarks",
        children: [
            html`
                <h1>Stream Bookmarks</h1>
                <p>
                    This is a tiny (&lt; 600 lines of code) utility to bookmark where you left a
                    YouTube stream, by making a Nightbot Custom API. Bookmarks are stored
                    indefinitely, for now at least; there are currently
                    <strong>${bookmarkCount ?? "no"}</strong> bookmarks in the database. It's
                    currently restricted to
                    <a href="https://youtube.com/@ArgonMatrix">ArgonMatrix</a>'s channel only; if
                    you're a YouTube streamer interested this tool please reach out to me on
                    Discord!
                </p>
                <p>
                    This app's source code is
                    <a href="https://github.com/Mabi19/stream-bookmarks">available on GitHub</a>,
                    and you can find more of my stuff at <a href="https://mabi.land/">mabi.land</a>.
                </p>
                <h2>Usage</h2>
                <p>
                    First, make a bookmark using the <code>!bookmark</code> command in chat. Then,
                    when you want to know where you left off, replace
                    <code>youtube.com/watch?v=</code> in the video's URL with
                    <code>bookmarks.mabi.land/</code>. For example,
                    <a href="https://www.youtube.com/watch?v=I89G7VFWCNw"
                        >https://www.youtube.com/watch?v=I89G7VFWCNw</a
                    >
                    becomes
                    <a href="https://bookmarks.mabi.land/I89G7VFWCNw"
                        >https://bookmarks.mabi.land/I89G7VFWCNw</a
                    >.
                </p>
                <p>
                    The !bookmark command by default puts the bookmark at the current point in the
                    live stream, but this can be customized by putting a timestamp after the
                    command, like <code>!bookmark 30:00</code> to put a bookmark 30 minutes in.
                    Additionally, putting a minus sign before the timestamp puts it that amount of
                    time behind live, like <code>!bookmark -15:00</code> which will put the bookmark
                    45 minutes in assuming the stream's been going on for 1 hour.
                </p>
                <p>
                    Invalid timestamps will put the bookmark at the current position, as if one
                    wasn't provided. Only timestamps formatted like <code>minutes:seconds</code> and
                    <code>hours:minutes:seconds</code> are supported.
                </p>
            `,
        ],
    });
};

export const NotFound = () => {
    return Layout({
        title: "Not Found",
        children: [
            html`
                <h1>Not Found</h1>
                <p>There's nothing here...</p>
            `,
        ],
    });
};
