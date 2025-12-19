export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...init,
    });
    if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
    }
    return (await res.json()) as T;
}

export function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}
