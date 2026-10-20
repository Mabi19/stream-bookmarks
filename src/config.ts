import data from "../config.json";

interface Channel {
    uploads: string;
}

interface Config {
    allowedChannels: Record<string, Channel>;
}

export default data as Config;
