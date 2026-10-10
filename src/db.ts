import { env } from "cloudflare:workers";

let queries: Record<string, D1PreparedStatement | null> = {
    COUNT_BOOKMARKS: null,
    GET_VIDEO_BOOKMARKS: null,
    GET_STREAM_TITLE: null,
    SET_STREAM_TITLE: null,
    UPDATE_BOOKMARK_TIME: null,
    INSERT_BOOKMARK: null,
};
let queriesInit = false;

function ensureQueries() {
    if (queriesInit) {
        return;
    }
    queries.COUNT_BOOKMARKS = env.DB.prepare("SELECT COUNT(1) AS count FROM bookmarks;");
    queries.GET_VIDEO_BOOKMARKS = env.DB.prepare(
        "SELECT username, time FROM bookmarks WHERE video_id = ? ORDER BY time;",
    );
    queries.GET_STREAM_TITLE = env.DB.prepare(
        "SELECT title FROM stream_titles WHERE video_id = ?;",
    );
    queries.SET_STREAM_TITLE = env.DB.prepare(
        `INSERT INTO stream_titles (video_id, title) VALUES (?, ?)
    ON CONFLICT (video_id) DO UPDATE SET title = excluded.title;`,
    );
    queries.UPDATE_BOOKMARK_TIME = env.DB.prepare(
        "UPDATE bookmarks SET time = ? WHERE video_id = ? AND username = ? RETURNING 1 AS updated;",
    );
    queries.INSERT_BOOKMARK = env.DB.prepare(
        `INSERT INTO bookmarks (video_id, username, time) VALUES (?, ?, ?)
    ON CONFLICT (video_id, username) DO NOTHING;`,
    );
    queriesInit = true;
}

const RETRYABLE_ERROR_SNIPPETS = [
    "Network connection lost",
    "storage caused object to be reset",
    "reset because its code was updated",
];

const MAX_WRITE_ATTEMPTS = 5;

async function retryWrite<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const message = String(error);
            const isRetryable = RETRYABLE_ERROR_SNIPPETS.some((snippet) =>
                message.includes(snippet),
            );
            if (attempt >= MAX_WRITE_ATTEMPTS || !isRetryable) {
                throw error;
            }
            await new Promise((resolve) =>
                setTimeout(resolve, Math.random() * Math.min(4000, 100 * 2 ** attempt)),
            );
        }
    }
}

export async function countBookmarks() {
    ensureQueries();
    return queries.COUNT_BOOKMARKS!.first<number>("count");
}

export async function getVideoBookmarks(videoId: string) {
    ensureQueries();
    return queries.GET_VIDEO_BOOKMARKS!.bind(videoId).run();
}

export async function getStreamTitle(videoId: string) {
    ensureQueries();
    return queries.GET_STREAM_TITLE!.bind(videoId).first<string>("title");
}

export async function setStreamTitle(videoId: string, title: string): Promise<void> {
    ensureQueries();
    await retryWrite(() => queries.SET_STREAM_TITLE!.bind(videoId, title).run());
}

export async function setBookmark(
    videoId: string,
    username: string,
    time: number,
): Promise<boolean> {
    ensureQueries();
    return await retryWrite(async () => {
        const [updated] = await env.DB.batch([
            queries.UPDATE_BOOKMARK_TIME!.bind(time, videoId, username),
            queries.INSERT_BOOKMARK!.bind(videoId, username, time),
        ]);
        return updated.results.length === 0;
    });
}
