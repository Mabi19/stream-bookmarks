CREATE TABLE IF NOT EXISTS bookmarks (
    video_id TEXT,
    username TEXT,
    time INTEGER,
    CONSTRAINT pk PRIMARY KEY (video_id, username)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_bookmarks_video_id ON bookmarks(video_id);

CREATE TABLE IF NOT EXISTS stream_titles (
    video_id TEXT PRIMARY KEY,
    title TEXT
) STRICT;
