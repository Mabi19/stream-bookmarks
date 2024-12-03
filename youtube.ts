import * as v from "@valibot/valibot";
import { google } from "googleapis";
import { kv } from "./kv.ts";

const apiKey = Deno.env.get("YOUTUBE_API_KEY");
if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY env var needs to be set");
}

const youtube = google.youtube({
    version: "v3",
    auth: apiKey,
});

const YoutubeStreamSchema = v.object({
    videoId: v.string(),
    startTime: v.date(),
});
type YoutubeStream = v.InferOutput<typeof YoutubeStreamSchema>;

async function searchForLivestream(
    channelId: string,
): Promise<YoutubeStream | null> {
    const searchResult = await youtube.search.list({
        part: ["snippet"],
        channelId,
        eventType: "live",
        type: ["video"],
    });

    const item = searchResult.data.items?.[0];
    if (item) {
        // found the livestream! get its start time
        const videoId = item.id?.videoId;
        if (!videoId) {
            throw new Error("Couldn't get video ID");
        }

        const listResult = await youtube.videos.list({
            part: ["snippet", "liveStreamingDetails"],
            id: [videoId],
        });

        const startTimeString = listResult.data.items?.[0]?.liveStreamingDetails
            ?.actualStartTime;
        if (!startTimeString) {
            // stream not started yet (or other error)
            return null;
        }

        // get from list result because search returns it escaped for some reason
        const title = listResult.data.items?.[0]?.snippet?.title;
        if (!title) {
            throw new Error("Couldn't get stream title");
        }
        console.log(`title: ${title}`);

        const stream: YoutubeStream = {
            videoId,
            startTime: new Date(startTimeString),
        };

        kv.set(["channelCurrentLivestream", channelId], stream, {
            expireIn: 6 * 60 * 60 * 1000,
        });
        kv.set(["streamTitle", videoId], title);

        console.log("put", stream, "in cache");

        return stream;
    } else {
        // no livestream
        return null;
    }
}

async function verifyLivestream(stream: YoutubeStream): Promise<boolean> {
    const result = await youtube.videos.list({
        part: ["snippet"],
        id: [stream.videoId],
    });

    return result.data.items?.[0]?.snippet?.liveBroadcastContent == "live";
}

export async function getChannelLivestream(
    channelId: string,
): Promise<YoutubeStream | null> {
    const cachedEntry = await kv.get(["channelCurrentLivestream", channelId]);
    if (cachedEntry.versionstamp != null) {
        // we have a potential candidate!
        const streamData = v.safeParse(YoutubeStreamSchema, cachedEntry.value);
        if (!streamData.success) {
            throw new Error("Unexpected value in database");
        }

        if (await verifyLivestream(streamData.output)) {
            return streamData.output;
        } else {
            // delete the key so that the API query isn't repeated unnecessarily
            await kv.delete(["channelCurrentLivestream", channelId]);
            // there may be a new live stream, fall through
        }
    }
    // search for it :(
    // this automatically puts it in KV
    return await searchForLivestream(channelId);
}
