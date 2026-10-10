CREATE TABLE IF NOT EXISTS bookmarks (
    video_id TEXT NOT NULL,
    username TEXT NOT NULL,
    time INTEGER NOT NULL,
    CONSTRAINT pk PRIMARY KEY (video_id, username)
) STRICT;

CREATE TABLE IF NOT EXISTS stream_titles (
    video_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL
) STRICT;
