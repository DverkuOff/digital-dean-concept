import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { ARGON2_OPTIONS } from "./password-opts";

export function hashPassword(password: string) {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword({ hash: h, password }: { hash: string; password: string }) {
  // параметры читаются из самой строки хеша $argon2id$v=19$m=…,t=…,p=…
  return verify(h, password);
}
