import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export const hashPassword = async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
};

export const verifyPassword = async (password: string, storedHash: string) => {
    const [salt, key] = storedHash.split(":");

    if (!salt || !key) {
        return false;
    }

    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    const keyBuffer = Buffer.from(key, "hex");
    return timingSafeEqual(keyBuffer, derivedKey);
};
