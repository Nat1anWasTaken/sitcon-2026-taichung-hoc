import { Timestamp } from "firebase/firestore";

export type AdminProfile = {
  email: string;
  role: "admin";
  createdAt: Timestamp;
};

export type ChildAccount = {
  seatNumber: number;
  childId: string; // short identifier printed on the badge
  passwordSalt: string;
  passwordHash: string; // SHA-256(salt:password)
  name?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  status?: "active" | "disabled";
};
