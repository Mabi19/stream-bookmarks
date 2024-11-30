// Argon's channel ID: "UCp6pmlkI1WbrZFOWlXtOwCQ";

if (Deno.args.length != 2) {
    console.log("Usage: mkbookmark <channel ID> <username>");
    Deno.exit(1);
}

const [channelId, username] = Deno.args;

console.log(
    await fetch("http://127.0.0.1:8000/create-bookmark", {
        headers: {
            "Nightbot-Response-URL": "http://example.com",
            "Nightbot-User":
                `name=${username}&displayName=${username}&provider=youtube&providerId=nonexisty&userLevel=idk`,
            "Nightbot-Channel":
                `name=test&displayName=Placeholder&provider=youtube&providerId=${channelId}`,
        },
    }).then((res) => res.text()),
);
