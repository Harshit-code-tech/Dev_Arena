import { randomBytes } from "node:crypto";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "../../database/prisma";

export const PENDING_USERNAME_PREFIX = "__pending_";

type CurrentUser = Pick<
    User,
    "id" | "email" | "name" | "username" | "avatarUrl" | "useInitials" | "privacyMode" | "compactWorkspace" | "usernameChosen" | "onboardingRequired" | "role"
>;

export type FirebaseUserUpsertInput = {
    firebaseUid: string;
    email: string;
    emailVerified: boolean;
    displayName?: string;
    photoURL?: string | null;
    provider: "password" | "google" | "github";
    acceptLegal?: boolean;
    migrationUserId?: string;
};

type AuthRepository = {
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    findUserByUsername(username: string): Promise<User | null>;
    findUserByLoginIdentifier(identifier: string): Promise<User | null>;
    createUser(data: Prisma.UserCreateInput): Promise<User>;
    updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User>;
    getCurrentUser(id: string): Promise<CurrentUser | null>;
    upsertFirebaseUser(input: FirebaseUserUpsertInput): Promise<User>;
};

export function createPendingUsername() {
    return `${PENDING_USERNAME_PREFIX}${randomBytes(7).toString("hex")}`;
}

export const authRepository: AuthRepository = {
    findUserByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({ where: { email } });
    },

    findUserById(id: string): Promise<User | null> {
        return prisma.user.findUnique({ where: { id } });
    },

    findUserByUsername(username: string): Promise<User | null> {
        return prisma.user.findUnique({ where: { username } });
    },

    findUserByLoginIdentifier(identifier: string): Promise<User | null> {
        return prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier },
                ],
            },
        });
    },

    createUser(data: Prisma.UserCreateInput): Promise<User> {
        return prisma.user.create({ data });
    },

    updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return prisma.user.update({ where: { id }, data });
    },

    getCurrentUser(id: string): Promise<CurrentUser | null> {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                username: true,
                usernameChosen: true,
                onboardingRequired: true,
                avatarUrl: true,
                useInitials: true,
                privacyMode: true,
                compactWorkspace: true,
                role: true,
            },
        });
    },

    async upsertFirebaseUser(input: FirebaseUserUpsertInput): Promise<User> {
        const normalizedEmail = input.email.trim().toLowerCase();
        const existingByUid = await prisma.user.findUnique({ where: { firebaseUid: input.firebaseUid } });
        const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (existingByUid && existingByEmail && existingByUid.id !== existingByEmail.id) {
            throw new Error("FIREBASE_IDENTITY_CONFLICT");
        }

        const existing = existingByUid || existingByEmail;
        if (existing) {
            if (existing.firebaseUid && existing.firebaseUid !== input.firebaseUid) {
                throw new Error("FIREBASE_IDENTITY_CONFLICT");
            }

            // Password-based Firebase identities may only claim a pre-existing DevArena
            // account through the one-time legacy-password migration proof.
            if (!existing.firebaseUid && input.provider === "password" && input.migrationUserId !== existing.id) {
                throw new Error("FIREBASE_MIGRATION_REQUIRED");
            }


            return prisma.user.update({
                where: { id: existing.id },
                data: {
                    firebaseUid: input.firebaseUid,
                    // Firebase is now the source of truth for password authentication.
                    ...(input.provider === "password" ? { passwordHash: null } : {}),
                    name: existing.name || input.displayName?.trim() || normalizedEmail.split("@")[0],
                    avatarUrl: existing.avatarUrl || input.photoURL || null,
                    isEmailVerified: existing.isEmailVerified || input.emailVerified,
                },
            });
        }

        if (input.acceptLegal !== true) {
            throw new Error("LEGAL_ACCEPTANCE_REQUIRED");
        }

        let pendingUsername = createPendingUsername();
        while (await prisma.user.findUnique({ where: { username: pendingUsername } })) {
            pendingUsername = createPendingUsername();
        }

        return prisma.user.create({
            data: {
                firebaseUid: input.firebaseUid,
                name: input.displayName?.trim() || normalizedEmail.split("@")[0],
                username: pendingUsername,
                usernameChosen: false,
                onboardingRequired: true,
                email: normalizedEmail,
                avatarUrl: input.photoURL || null,
                isEmailVerified: input.emailVerified,
                termsAcceptedAt: new Date(),
                termsVersion: "2026-08-02",
                privacyVersion: "2026-08-02",
            },
        });
    },
};
