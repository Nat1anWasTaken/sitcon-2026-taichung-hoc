"use client";
import { hashPassword, generateSalt } from "./passwords";
import { ChildAccount } from "./types";

type CreateChildInput = {
    childId: string;
    seatNumber: number;
    password: string;
    name?: string;
};

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Request failed");
    }
    return (await res.json()) as T;
}

export async function createChildAccount({
    childId,
    seatNumber,
    password,
    name,
}: CreateChildInput) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const payload = {
        childId,
        seatNumber,
        passwordSalt: salt,
        passwordHash,
        name: name ?? null,
        status: "active" as const,
    };

    await apiRequest("/api/admin/children", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return {
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

export async function updateChildName(childId: string, name: string) {
    await apiRequest(`/api/admin/children/${encodeURIComponent(childId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
    });
}

export async function resetChildPassword(childId: string, password: string) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    await apiRequest(`/api/admin/children/${encodeURIComponent(childId)}`, {
        method: "PATCH",
        body: JSON.stringify({ passwordSalt: salt, passwordHash }),
    });
}

export async function setChildStatus(
    childId: string,
    status: Exclude<ChildAccount["status"], undefined>
) {
    await apiRequest(`/api/admin/children/${encodeURIComponent(childId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });
}

export async function verifyChildPassword(childId: string, password: string) {
    const data = await apiRequest<{ ok: boolean }>(
        `/api/admin/children/${encodeURIComponent(childId)}/verify`,
        {
            method: "POST",
            body: JSON.stringify({ password }),
        }
    );
    return Boolean(data.ok);
}

export async function childBySeat(seatNumber: number) {
    const data = await apiRequest<{ child: ChildAccount | null }>(
        `/api/admin/children/seat?seatNumber=${encodeURIComponent(seatNumber)}`
    );
    return data.child ?? null;
}
