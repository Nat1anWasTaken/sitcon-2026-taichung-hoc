const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return toHex(bytes);
  }
  throw new Error("Secure random generation unavailable in this environment.");
}

export async function hashPassword(password: string, salt: string) {
  const payload = `${salt}:${password}`;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return toHex(hashBuffer);
  }

  throw new Error("crypto.subtle not available to hash password.");
}
