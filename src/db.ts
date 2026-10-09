import { env } from "cloudflare:workers";

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
// Set the title for a stream (order: video ID, title)
export const INSERT_STREAM_TITLE = env.DB.prepare("INSERT INTO stream_titles VALUES (?, ?);");
// Set a bookmark (order: video ID, username, time)
export const SET_BOOKMARK = env.DB.prepare(
    `INSERT INTO bookmarks VALUES (?, ?, ?)
    ON CONFLICT (video_id, username) DO UPDATE SET time = excluded.time
    RETURNING (time = excluded.time) AS is_inserted;`,
);
