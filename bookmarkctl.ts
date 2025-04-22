// Argon's channel ID: "UCp6pmlkI1WbrZFOWlXtOwCQ";

function exitWithUsage() {
    console.log(
        "Usage: bookmarkctl new <server URL> <channel ID> <username>\nor:    bookmarkctl recount <server URL>",
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
} else {
    exitWithUsage();
}
