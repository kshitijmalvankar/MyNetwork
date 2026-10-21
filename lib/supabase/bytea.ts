/** PostgREST exchanges bytea as `\x`-prefixed hex strings. */
export function toBytea(buf: Uint8Array): string {
  return `\\x${Buffer.from(buf).toString("hex")}`;
}

export function fromBytea(value: string): Buffer {
  if (!value.startsWith("\\x")) throw new Error("Expected bytea hex string");
  return Buffer.from(value.slice(2), "hex");
}
