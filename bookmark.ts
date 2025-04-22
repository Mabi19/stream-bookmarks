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
    const minutes = ((duration - seconds) / 60) % 60;
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

    let res = { ok: false };
    let actionMessage!: string;
    while (!res.ok) {
        const currentValue = await kv.get(key);
        if (currentValue.versionstamp == null) {
            res = await kv.atomic()
                .check(currentValue)
                .set(key, bookmark)
                .sum(["count"], 1n)
                .commit();
            actionMessage = "creates a bookmark";
        } else {
            res = await kv.atomic()
                .check(currentValue)
                .set(key, bookmark)
                .commit();
            actionMessage = "moves their bookmark";
        }
    }

    const link = `https://bookmarks.mabi.land/${stream.videoId}?h=${
        encodeURIComponent(username)
    }`;

    return `${username} ${actionMessage} ${
        formatTime(bookmark.secondsSinceStart)
    } into the stream: ${link}`;
}

export async function countBookmarks() {
    let count = 0;
    for await (const _ of kv.list({ prefix: ["bookmarks"] })) {
        count++;
    }
    return count;
}
