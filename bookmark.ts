import { HTTPException } from "hono/http-exception";
import { kv } from "./kv.ts";
import { getChannelLivestream } from "./youtube.ts";

const CHANNEL_ID_REGEX = /^UC([-_a-zA-Z0-9]{22})$/;

interface Bookmark {
    username: string;
    secondsSinceStart: number;
}

export async function createBookmark(
    channelString: string,
    userString: string,
) {
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
}
