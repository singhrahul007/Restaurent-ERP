import { hashPassword, verifyPassword } from "./password.js";

let dummyHashPromise: Promise<string> | undefined;

function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("niva-timing-dummy-do-not-use");
  return dummyHashPromise;
}

/** Always runs Argon2id so unknown emails and wrong passwords take similar time. */
export async function verifyPasswordAgainstKnownOrDummy(
  storedHash: string | undefined,
  password: string,
): Promise<boolean> {
  const hash = storedHash ?? (await dummyPasswordHash());
  return verifyPassword(hash, password);
}
