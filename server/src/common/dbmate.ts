import util from "util";
import child_process from "child_process";
import { sleep } from "./sleep";
import { PG_URL } from "./constants";
import { logger } from "./logger";

const exec = util.promisify(child_process.exec);

const RETRY_TIMEOUT_MS = 1000;

export const dbmate_up = async () => {
    const { stdout, stderr } = await exec(`DATABASE_URL=${PG_URL} dbmate up`);
    if (stderr) {
        throw new Error(stderr);
    }
};

export const dbmate_drop = async () => {
    const { stdout, stderr } = await exec(`DATABASE_URL=${PG_URL} dbmate drop`);
    if (stderr) {
        throw new Error(stderr);
    }
};

export const dbmate_wait = async () => {
    const { stdout, stderr } = await exec(`DATABASE_URL=${PG_URL} dbmate wait`);
    if (stderr) {
        throw new Error(stderr);
    }
};

export const dbmate_rebuild = async () => {
    try {
        await dbmate_drop();
        await dbmate_up();
        await dbmate_wait();
    } catch (e) {
        logger.error(e);
        await sleep(RETRY_TIMEOUT_MS);
        await dbmate_rebuild();
    }
};
