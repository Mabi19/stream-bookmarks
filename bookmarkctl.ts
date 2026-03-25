// Argon's channel ID: "UCp6pmlkI1WbrZFOWlXtOwCQ";
import type { Bookmark } from "./bookmark.ts";

function exitWithUsage() {
    console.log(
        "Usage: bookmarkctl new <server URL> <channel ID> <username>\n\
        or:     bookmarkctl recount <server URL>\n\
        or:     bookmarkctl export <KV URL> <path>",
    );
    Deno.exit(1);
}

if (Deno.args.length < 2) {
    exitWithUsage();
}

const mode = Deno.args[0];
if (mode == "new") {
    if (Deno.args.length != 4) {
        exitWithUsage();
    }
    const [_, serverUrl, channelId, username] = Deno.args;

    console.log(
        await fetch(`${serverUrl}/create-bookmark`, {
            headers: {
                "Nightbot-Response-URL": "http://example.com",
                "Nightbot-User":
                    `name=${username}&displayName=${username}&provider=youtube&providerId=nonexisty&userLevel=idk`,
                "Nightbot-Channel":
                    `name=test&displayName=Placeholder&provider=youtube&providerId=${channelId}`,
            },
        }).then((res) => res.text()),
    );
} else if (mode == "recount") {
    if (Deno.args.length != 2) {
        exitWithUsage();
    }

    const key = Deno.env.get("RECOUNT_KEY");
    if (!key) {
        console.log("RECOUNT_KEY env var needs to be set");
        Deno.exit(1);
    }

    const serverUrl = Deno.args[1];

    console.log(
        await fetch(`${serverUrl}/recount`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${key}`,
            },
        }).then((res) => res.text()),
    );
} else if (mode == "export") {
    if (Deno.args.length != 3) {
        exitWithUsage();
    }
    const [_, kvUrl, path] = Deno.args;

    const kv = await Deno.openKv(kvUrl);
    const bookmarks: Record<string, Bookmark[]> = {};
    for await (const bookmark of kv.list({ prefix: ["bookmarks"] })) {
        const videoId = bookmark.key[1] as string;
        if (!bookmarks[videoId]) {
            bookmarks[videoId] = [];
        }
        bookmarks[videoId].push(bookmark.value as Bookmark);
    }
    const streamTitles: Record<string, string> = {};
    for await (const streamTitle of kv.list({ "prefix": ["streamTitle"] })) {
        const videoId = streamTitle.key[1] as string;
        streamTitles[videoId] = streamTitle.value as string;
    }

    await Deno.writeTextFile(path, JSON.stringify({ bookmarks, streamTitles }));
    kv.close();
} else if (mode == "import") {
    if (Deno.args.length != 3) {
        exitWithUsage();
    }
    const [_, kvUrl, path] = Deno.args;
    const data: {
        bookmarks: Record<string, Bookmark[]>;
        streamTitles: Record<string, string>;
    } = JSON.parse(
        await Deno.readTextFile(path),
    );
    const kv = await Deno.openKv(kvUrl);
    for (const videoId of Object.keys(data.bookmarks)) {
        for (const bookmark of data.bookmarks[videoId]) {
            const key = ["bookmarks", videoId, bookmark.username];
            await kv.set(key, bookmark);
        }
    }
    for (const [videoId, title] of Object.entries(data.streamTitles)) {
        const key = ["streamTitle", videoId];
        await kv.set(key, title);
    }
    kv.close();
} else {
    exitWithUsage();
}
