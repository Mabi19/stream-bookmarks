import * as v from "@valibot/valibot";
import { kv } from "./kv.ts";

const apiKey = Deno.env.get("YOUTUBE_API_KEY");
if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY env var needs to be set");
}

// These two API wrapper functions are specialized for what we want.

async function youtubeSearch(channelId: string) {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${
            encodeURIComponent(apiKey!)
        }&part=snippet&channelId=${
            encodeURIComponent(channelId)
        }&eventType=live&type=video`,
    );
    if (!response.ok) {
        console.error("YT API Error:", await response.json());
        throw new Error("The YouTube API returned an error");
    }
    return await response.json();
}

async function youtubeVideosList(videoId: string) {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?key=${
            encodeURIComponent(apiKey!)
        }&part=snippet,liveStreamingDetails&id=${encodeURIComponent(videoId)}`,
    );
    if (!response.ok) {
        console.error("YT API Error:", await response.json());
        throw new Error("The YouTube API returned an error");
    }
    return await response.json();
}

const YoutubeStreamSchema = v.object({
    videoId: v.string(),
    startTime: v.date(),
});
type YoutubeStream = v.InferOutput<typeof YoutubeStreamSchema>;

async function searchForLivestream(
    channelId: string,
): Promise<YoutubeStream | null> {
    const searchResult = await youtubeSearch(channelId);

    const item = searchResult.items?.[0];
    if (item) {
        // found the livestream! get its start time
        const videoId = item.id?.videoId;
        if (!videoId) {
            throw new Error("Couldn't get video ID");
        }

        const listResult = await youtubeVideosList(videoId);

        const startTimeString = listResult.items?.[0]?.liveStreamingDetails
            ?.actualStartTime;
        if (!startTimeString) {
            // stream not started yet (or other error)
            return null;
        }

        // get from list result because search returns it escaped for some reason
        const title = listResult.items?.[0]?.snippet?.title;
        if (!title) {
            throw new Error("Couldn't get stream title");
        }
        console.debug(`title: ${title}`);

        const stream: YoutubeStream = {
            videoId,
            startTime: new Date(startTimeString),
        };

        kv.set(["channelCurrentLivestream", channelId], stream, {
            expireIn: 6 * 60 * 60 * 1000,
        });
        kv.set(["streamTitle", videoId], title);

        console.debug("put", stream, "in cache");

        return stream;
    } else {
        // no livestream
        return null;
    }
}

async function verifyLivestream(stream: YoutubeStream): Promise<boolean> {
    const result = await youtubeVideosList(stream.videoId);

    return result.items?.[0]?.snippet?.liveBroadcastContent == "live";
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
