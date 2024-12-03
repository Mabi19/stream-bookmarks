import * as v from "@valibot/valibot";
import { HTTPException } from "hono/http-exception";
import config from "./config.json" with { type: "json" };
import { kv } from "./kv.ts";
import { getChannelLivestream } from "./youtube.ts";

const CHANNEL_ID_REGEX = /^UC([-_a-zA-Z0-9]{22})$/;

export const BookmarkSchema = v.object({
    username: v.string(),
    secondsSinceStart: v.number(),
});

export type Bookmark = v.InferOutput<typeof BookmarkSchema>;

export function formatTime(duration: number) {
    // trim off fractional seconds just to be safe
    duration = Math.floor(duration);
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
        throw new HTTPException(418, { message: "Only YouTube is supported" });
    }

    const username = userData.get("displayName");
    const channelId = channelData.get("providerId");

    if (!username || !channelId || !CHANNEL_ID_REGEX.test(channelId)) {
        throw new HTTPException(400, { message: "Invalid request data" });
    }

    if (!config.allowedChannels.includes(channelId)) {
        throw new HTTPException(403, {
            message: "This channel isn't whitelisted",
        });
    }

    const stream = await getChannelLivestream(channelId);
    if (!stream) {
        throw new HTTPException(400, {
            message: "This channel isn't currently streaming",
        });
    }

    const bookmark: Bookmark = {
        username,
        // round off fractional seconds
        secondsSinceStart: Math.floor(
            (Date.now() - stream.startTime.getTime()) / 1000,
        ),
    };

    const key = ["bookmarks", stream.videoId, username];
    const alreadyExists = (await kv.get(key)).versionstamp != null;
    // overwrite
    await kv.set(key, bookmark);

    const actionMessage = alreadyExists
        ? "moves their bookmark"
        : "creates their bookmark";

    // TODO: add username highlight when that's done
    return `${username} ${actionMessage} ${
        formatTime(bookmark.secondsSinceStart)
    } into the stream: https://bookmarks.mabi.land/${stream.videoId}`;
}
