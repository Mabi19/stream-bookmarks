import { google } from "googleapis";
import { kv } from "./kv.ts";

const apiKey = Deno.env.get("YOUTUBE_API_KEY");
if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY env var needs to be set");
}

const youtube = google.youtube({
    version: "v3",
    auth: apiKey
});

async function searchForLivestream(channelId: string): Promise<string | null> {
    console.log("searching");

    const result = await youtube.search.list({
        part: ["snippet"],
        channelId,
        eventType: "live",
        type: ["video"],
    });
    // TODO: check for undefineds here
    const item = result.data.items?.[0];
    if (item) {
        // found the livestream, put its ID in KV
        const videoId = item.id?.videoId
        if (!videoId) {
            throw new Error("Couldn't get video ID");
        }

        kv.set(["channelCurrentLivestream", channelId], videoId, { expireIn: 6 * 60 * 60 * 1000 });
        return videoId;
    } else {
        // no livestream
        return null;
    }
}

async function verifyLivestream(videoId: string): Promise<boolean> {
    console.log("verifying");

    const result = await youtube.videos.list({
        part: ["snippet"],
        id: [videoId],
    });
    // TODO: check for undefineds here
    return result.data.items?.[0]?.snippet?.liveBroadcastContent == "live";
}

export async function getChannelLivestream(channelId: string): Promise<string | null> {
    const cachedEntry = await kv.get(["channelCurrentLivestream", channelId]);
    if (cachedEntry.versionstamp != null) {
        // we have a potential candidate!
        const videoId = cachedEntry.value;
        if (typeof videoId != "string") {
            throw new Error("Unexpected value in database");
        }

        if (await verifyLivestream(videoId)) {
            return videoId;
        }
        // delete the key so that the API query isn't repeated unnecessarily
        await kv.delete(["channelCurrentLivestream", channelId]);
        // there may be a new live stream, fall through
    }
    // search for it :(
    // this automatically puts it in KV
    return await searchForLivestream(channelId);
}
