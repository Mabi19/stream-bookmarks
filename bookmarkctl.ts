import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { Bookmark } from "./src/bookmark";

if (existsSync(".env")) {
    process.loadEnvFile();
}

interface Dump {
    bookmarks: Record<string, Bookmark[]>;
    streamTitles: Record<string, string>;
}

interface QueryResult {
    results: Record<string, unknown>[];
    success: boolean;
}

interface QueryResponse {
    success: boolean;
    errors?: { message: string }[];
    result?: QueryResult[];
}

function exitWithUsage(): never {
    console.log(
        "Usage: bookmarkctl new <server URL> <channel ID> <username> [arg]\n\
        or:     bookmarkctl export <path>\n\
        or:     bookmarkctl import <path>",
    );
    process.exit(1);
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`${name} environment variable needs to be set`);
        process.exit(1);
    }
    return value;
}

function createD1Client() {
    const apiBase = process.env.CF_API_BASE ?? "https://api.cloudflare.com/client/v4";
    const accountId = requireEnv("CF_ACCOUNT_ID");
    const apiToken = requireEnv("CF_API_TOKEN");
    const databaseId = requireEnv("D1_DATABASE_ID");

    return async function query(sql: string, params: string[] = []): Promise<QueryResult[]> {
        const response = await fetch(
            `${apiBase}/accounts/${accountId}/d1/database/${databaseId}/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ sql, params }),
            },
        );
        const body = (await response.json()) as QueryResponse;
        if (!response.ok || !body.success || !body.result) {
            const details =
                body.errors?.map((error) => error.message).join("; ") ?? response.statusText;
            throw new Error(`D1 query failed: ${details}`);
        }
        for (const result of body.result) {
            if (!result.success) {
                throw new Error(`D1 query failed: statement reported success = false`);
            }
        }
        return body.result;
    };
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

const INSERT_CHUNK_SIZE = 100;

async function exportDump(path: string) {
    const query = createD1Client();

    const bookmarkRows = (
        await query("SELECT video_id, username, time FROM bookmarks ORDER BY video_id, time;")
    )[0].results;
    const titleRows = (
        await query("SELECT video_id, title FROM stream_titles ORDER BY video_id;")
    )[0].results;

    const bookmarks: Record<string, Bookmark[]> = {};
    for (const row of bookmarkRows) {
        const videoId = row.video_id as string;
        if (!bookmarks[videoId]) {
            bookmarks[videoId] = [];
        }
        bookmarks[videoId].push({ username: row.username as string, time: row.time as number });
    }
    const streamTitles: Record<string, string> = {};
    for (const row of titleRows) {
        streamTitles[row.video_id as string] = row.title as string;
    }

    await writeFile(path, JSON.stringify({ bookmarks, streamTitles }));
    console.log(`Exported ${bookmarkRows.length} bookmarks and ${titleRows.length} stream titles`);
}

async function importDump(path: string) {
    const query = createD1Client();

    const data = JSON.parse(await readFile(path, "utf8")) as Dump;
    if (typeof data.bookmarks != "object" || typeof data.streamTitles != "object") {
        throw new Error("Invalid dump file: expected { bookmarks, streamTitles }");
    }

    const bookmarkRows: string[][] = [];
    for (const [videoId, bookmarks] of Object.entries(data.bookmarks)) {
        for (const bookmark of bookmarks) {
            bookmarkRows.push([videoId, bookmark.username, String(Math.floor(bookmark.time))]);
        }
    }
    const titleRows: string[][] = Object.entries(data.streamTitles).map(([videoId, title]) => [
        videoId,
        title,
    ]);

    for (const part of chunk(bookmarkRows, INSERT_CHUNK_SIZE)) {
        const values = part.map(() => "(?, ?, ?)").join(", ");
        await query(
            `INSERT INTO bookmarks (video_id, username, time) VALUES ${values}
            ON CONFLICT (video_id, username) DO UPDATE SET time = excluded.time;`,
            part.flat(),
        );
    }
    for (const part of chunk(titleRows, INSERT_CHUNK_SIZE)) {
        const values = part.map(() => "(?, ?)").join(", ");
        await query(
            `INSERT INTO stream_titles (video_id, title) VALUES ${values}
            ON CONFLICT (video_id) DO UPDATE SET title = excluded.title;`,
            part.flat(),
        );
    }

    console.log(`Imported ${bookmarkRows.length} bookmarks and ${titleRows.length} stream titles`);
}

const args = process.argv.slice(2);
if (args.length < 1) {
    exitWithUsage();
}

const mode = args[0];
if (mode == "new") {
    if (args.length != 4 && args.length != 5) {
        exitWithUsage();
    }
    const [_, serverUrl, channelId, username] = args;
    const arg = args.length == 5 ? `?arg=${encodeURIComponent(args[4])}` : "";

    console.log(
        await fetch(`${serverUrl}/create-bookmark${arg}`, {
            headers: {
                "Nightbot-Response-URL": "http://example.com",
                "Nightbot-User": `name=${username}&displayName=${username}&provider=youtube&providerId=nonexisty&userLevel=idk`,
                "Nightbot-Channel": `name=test&displayName=Placeholder&provider=youtube&providerId=${channelId}`,
            },
        }).then((res) => res.text()),
    );
} else if (mode == "export") {
    if (args.length != 2) {
        exitWithUsage();
    }
    const [_, path] = args;

    await exportDump(path);
} else if (mode == "import") {
    if (args.length != 2) {
        exitWithUsage();
    }
    const [_, path] = args;

    await importDump(path);
} else {
    exitWithUsage();
}
