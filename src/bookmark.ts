import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import config from "../config.json";
import * as db from "./db";
import { getChannelLivestream } from "./youtube";

const CHANNEL_ID_REGEX = /^UC([-_a-zA-Z0-9]{22})$/;

export const BookmarkSchema = v.object({
    username: v.string(),
    time: v.number(),
});

export type Bookmark = v.InferOutput<typeof BookmarkSchema>;

export function formatTime(duration: number) {
    // trim off fractional seconds just to be safe
    duration = Math.floor(duration);
    const seconds = duration % 60;
    const minutes = ((duration - seconds) / 60) % 60;
    const hours = (duration - seconds - minutes * 60) / 3600;
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function parseTime(duration: string): number | undefined {
    const parts = duration.split(":");
    if (parts.length == 2) {
        const [minutes, seconds] = parts;
        if (!/^[0-5][0-9]$/.test(seconds)) {
            return undefined;
        }
        if (minutes != "0" && !/^[1-9][0-9]*$/.test(minutes)) {
            return undefined;
        }
        return parseInt(minutes) * 60 + parseInt(seconds);
    } else if (parts.length == 3) {
        const [hours, minutes, seconds] = parts;
        if (!/^[0-5][0-9]$/.test(seconds)) {
            return undefined;
        }
        if (!/^[0-5][0-9]$/.test(minutes)) {
            return undefined;
        }
        if (hours != "0" && !/^[1-9][0-9]*$/.test(hours)) {
            return undefined;
        }
        return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
    }

    return undefined;
}

export async function createBookmark(
    channelString: string,
    userString: string,
    timeString?: string,
): Promise<string> {
    const channelData = new URLSearchParams(channelString);
    const userData = new URLSearchParams(userString);

    const provider = channelData.get("provider");
    if (provider != "youtube") {
        return "Error: Only YouTube is supported";
    }

    const username = userData.get("displayName");
    const channelId = channelData.get("providerId");

    if (!username || !channelId || !CHANNEL_ID_REGEX.test(channelId)) {
        throw new HTTPException(400, { message: "Invalid request data" });
    }

    if (!config.allowedChannels.includes(channelId)) {
        return "Error: This channel isn't whitelisted";
    }

    const stream = await getChannelLivestream(channelId);
    if (!stream) {
        return "Error: Couldn't find livestream! Note that due to YouTube API limitations, bookmarks don't work on members-only content.";
    }

    const parsedTime = timeString ? parseTime(timeString) : undefined;
    // round off fractional seconds
    const time = parsedTime ?? Math.floor((Date.now() - stream.startTime.getTime()) / 1000);

    const wasInserted = await db.setBookmark(stream.videoId, username, time);
    const actionMessage = wasInserted ? "creates a bookmark" : "moves their bookmark";

    const link = `https://bookmarks.mabi.land/${stream.videoId}?h=${encodeURIComponent(username)}`;

    return `${username} ${actionMessage} ${formatTime(time)} into the stream: ${link}`;
}
