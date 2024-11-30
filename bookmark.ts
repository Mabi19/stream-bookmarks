import * as v from "@valibot/valibot";
import { HTTPException } from "hono/http-exception";
import { kv } from "./kv.ts";
import { getChannelLivestream } from "./youtube.ts";

const CHANNEL_ID_REGEX = /^UC([-_a-zA-Z0-9]{22})$/;

export const BookmarkSchema = v.object({
    username: v.string(),
    secondsSinceStart: v.number(),
});

export type Bookmark = v.InferOutput<typeof BookmarkSchema>;

export function formatTime(duration: number) {
    const seconds = duration % 60;
    const minutes = (duration - seconds) / 60;
    const hours = (duration - seconds - minutes * 60) / 3600;
    return `${hours}:${minutes.toString().padStart(2, "0")}:${
        seconds.toString().padStart(2, "0")
    }`;
}

export async function createBookmark(
    channelString: string,
    userString: string,
): Promise<string> {
    const channelData = new URLSearchParams(channelString);
    const userData = new URLSearchParams(userString);

    const provider = channelData.get("provider");
    if (provider != "youtube") {
        throw new HTTPException(400, { message: "Only YouTube is supported" });
    }

    const username = userData.get("displayName");
    const channelId = channelData.get("providerId");

    if (!username || !channelId || !CHANNEL_ID_REGEX.test(channelId)) {
        throw new HTTPException(400, { message: "Invalid request data" });
    }

    const stream = await getChannelLivestream(channelId);
    if (!stream) {
        throw new HTTPException(400, {
            message: "This channel isn't currently streaming",
        });
    }

    const bookmark: Bookmark = {
        username,
        secondsSinceStart: (Date.now() - stream.startTime.getTime()) / 1000,
    };

    const key = ["bookmarks", stream.videoId, username];
    await kv.set(key, bookmark);

    // TODO: put a link here
    return `${username} creates a bookmark ${
        formatTime(bookmark.secondsSinceStart)
    } into the stream: [LINK]`;
}
