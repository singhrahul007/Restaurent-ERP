import { hash, verify, argon2id } from "argon2";
import { ARGON2ID_OPTIONS, PASSWORD_MAX_LENGTH } from "./password-options.js";

export { ARGON2ID_OPTIONS, PASSWORD_MAX_LENGTH };

export async function hashPassword(password: string): Promise<string> {
  if (password.length === 0 || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error("PASSWORD_INVALID_LENGTH");
  }
  return hash(password, {
    type: argon2id,
    memoryCost: ARGON2ID_OPTIONS.memoryCost,
    timeCost: ARGON2ID_OPTIONS.timeCost,
    parallelism: ARGON2ID_OPTIONS.parallelism,
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  if (password.length === 0 || password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
