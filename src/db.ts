import { env } from "cloudflare:workers";

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

// Count all the bookmarks in the database (field "count").
export const COUNT_BOOKMARKS = env.DB.prepare("SELECT COUNT(1) AS count FROM bookmarks;");
// Get all the bookmarks for a video ID, ordered by their timecode ascending.
export const GET_VIDEO_BOOKMARKS = env.DB.prepare(
    "SELECT username, time FROM bookmarks WHERE video_id = ? ORDER BY time;",
);
// Get the title for a stream by video ID.
export const GET_STREAM_TITLE = env.DB.prepare(
    "SELECT title FROM stream_titles WHERE video_id = ?;",
);

const SET_STREAM_TITLE = env.DB.prepare(
    `INSERT INTO stream_titles (video_id, title) VALUES (?, ?)
    ON CONFLICT (video_id) DO UPDATE SET title = excluded.title;`,
);
const UPDATE_BOOKMARK_TIME = env.DB.prepare(
    "UPDATE bookmarks SET time = ? WHERE video_id = ? AND username = ? RETURNING 1 AS updated;",
);
const INSERT_BOOKMARK = env.DB.prepare(
    `INSERT INTO bookmarks (video_id, username, time) VALUES (?, ?, ?)
    ON CONFLICT (video_id, username) DO NOTHING;`,
);

export async function setStreamTitle(videoId: string, title: string): Promise<void> {
    await retryWrite(() => SET_STREAM_TITLE.bind(videoId, title).run());
}

export async function setBookmark(
    videoId: string,
    username: string,
    time: number,
): Promise<boolean> {
    return await retryWrite(async () => {
        const [updated] = await env.DB.batch([
            UPDATE_BOOKMARK_TIME.bind(time, videoId, username),
            INSERT_BOOKMARK.bind(videoId, username, time),
        ]);
        return updated.results.length === 0;
    });
}
