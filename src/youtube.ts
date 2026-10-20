import { env } from "cloudflare:workers";
import * as v from "valibot";
import config from "./config";
import * as db from "./db";

// These three API wrapper functions are specialized for what we want.

async function youtubePlaylistList(playlistId: string): Promise<any> {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?key=${encodeURIComponent(
            env.YOUTUBE_API_KEY,
        )}&part=contentDetails&playlistId=${encodeURIComponent(playlistId)}`,
    );
    if (!response.ok) {
        console.error("YT API Error:", await response.json());
        throw new Error("The YouTube API returned an error");
    }
    return await response.json();
}

async function youtubeSearch(channelId: string): Promise<any> {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${encodeURIComponent(
            env.YOUTUBE_API_KEY,
        )}&part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video`,
    );
    if (!response.ok) {
        console.error("YT API Error:", await response.json());
        throw new Error("The YouTube API returned an error");
    }
    return await response.json();
}

async function youtubeVideosList(videoId: string): Promise<any> {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?key=${encodeURIComponent(
            env.YOUTUBE_API_KEY,
        )}&part=snippet,liveStreamingDetails&id=${encodeURIComponent(videoId)}`,
    );
    if (!response.ok) {
        console.error("YT API Error:", await response.json());
        throw new Error("The YouTube API returned an error");
    }
    return await response.json();
}

const YoutubeStreamSchema = v.object({
    videoId: v.string(),
    startTime: v.pipe(
        v.string(),
        v.transform((input) => new Date(input)),
        v.check((date) => !isNaN(date.getTime())),
    ),
});
type YoutubeStream = v.InferOutput<typeof YoutubeStreamSchema>;

async function getStreamData(channelId: string, videoId: string): Promise<YoutubeStream | null> {
    const listResult = await youtubeVideosList(videoId);

    const item = listResult.items?.[0];
    if (!item) {
        console.debug(`video ${videoId} does not exist`);
        return null;
    }

    if (item.liveStreamingDetails?.actualEndTime) {
        console.debug(`stream ${videoId} has already ended`);
        return null;
    }

    const startTimeString = item.liveStreamingDetails?.actualStartTime;
    if (!startTimeString) {
        console.debug(`channel ${channelId}'s video ${videoId} is not an active livestream`);
        // stream not started yet (or other error)
        return null;
    }

    const title = item.snippet?.title;
    if (!title) {
        throw new Error("Couldn't get stream title");
    }
    console.debug(`title: ${title}`);

    const stream: YoutubeStream = {
        videoId,
        startTime: new Date(startTimeString),
    };
    await env.KV.put(`channelCurrentLivestream:${channelId}`, JSON.stringify(stream), {
        expirationTtl: 6 * 60 * 60,
    });
    await db.setStreamTitle(videoId, title);

    console.debug("put", stream, "in cache");

    return stream;
}

async function searchForLivestream(channelId: string): Promise<YoutubeStream | null> {
    // First, try looking for the latest video.
    // Usually it'll be the livestream we're looking for.
    // If not, use an expensive search call as a fallback.
    const playlistId = config.allowedChannels[channelId]!.uploads;
    const playlistResult = await youtubePlaylistList(playlistId);
    console.debug("playlist", playlistResult);
    const playlistVideoId = playlistResult.items?.[0]?.contentDetails?.videoId;
    if (playlistVideoId) {
        return await getStreamData(channelId, playlistVideoId);
    }

    const searchResult = await youtubeSearch(channelId);
    console.debug("search", searchResult);
    const searchVideoId = searchResult.items?.[0].id?.videoId;
    if (searchVideoId) {
        return await getStreamData(channelId, searchVideoId);
    }

    console.debug(`finding stream for channel ${channelId} failed`);
    // no livestream
    return null;
}

async function verifyLivestream(stream: YoutubeStream): Promise<boolean> {
    const result = await youtubeVideosList(stream.videoId);

    return result.items?.[0]?.snippet?.liveBroadcastContent == "live";
}

export async function getChannelLivestream(channelId: string): Promise<YoutubeStream | null> {
    const cachedEntry = await env.KV.get(`channelCurrentLivestream:${channelId}`);
    if (cachedEntry != null) {
        // we have a potential candidate!
        const streamData = v.safeParse(YoutubeStreamSchema, JSON.parse(cachedEntry));
        if (!streamData.success) {
            throw new Error("Unexpected value in database");
        }

        if (await verifyLivestream(streamData.output)) {
            return streamData.output;
        } else {
            // delete the key so that the API query isn't repeated unnecessarily
            await env.KV.delete(`channelCurrentLivestream:${channelId}`);
            // there may be a new live stream, fall through
        }
    }
    // search for it :(
    // this automatically puts it in KV
    return await searchForLivestream(channelId);
}
