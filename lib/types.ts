export type AdminProfile = {
    email: string;
    role: "admin";
    createdAt: Date | string;
};

export type ChildAccount = {
    seatNumber: number;
    childId: string; // short identifier printed on the badge
    passwordSalt: string;
    passwordHash: string; // SHA-256(salt:password)
    name?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    lastLoginAt?: Date | string;
    status?: "active" | "disabled";
};

export type ChildRosterEntry = {
    seatNumber: number;
    childId: string;
    name?: string | null;
    status?: "active" | "disabled";
    hasPassword: boolean;
};
