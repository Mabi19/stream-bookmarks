import * as v from "@valibot/valibot";

export async function createBookmark(
    channelString: string,
    userString: string,
) {
    // channel ID regex: UC([-_a-zA-Z0-9]{22})
    // video ID regex: [-_a-zA-Z0-9]{11}
    // TODO: get stuff from Nightbot headers

    const channelData = new URLSearchParams(channelString);
    const userData = new URLSearchParams(userString);

    return "Created a bookmark!";
}
