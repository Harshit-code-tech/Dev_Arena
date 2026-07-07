import type { Prisma, User } from "@prisma/client";
import { prisma } from "../../database/prisma";
import type { SyncFirebaseInput } from "./auth.types";

type CurrentUser = Pick<User, "id" | "email" | "name" | "avatarUrl" | "isTwoFactorEnabled">;

type AuthRepository = {
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    createUser(data: Prisma.UserCreateInput): Promise<User>;
    updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User>;
    getCurrentUser(id: string): Promise<CurrentUser | null>;
    upsertFirebaseUser(input: Required<Pick<SyncFirebaseInput, "email">> & SyncFirebaseInput): Promise<User>;
};

export const authRepository: AuthRepository = {
    findUserByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({ where: { email } });
    },

    findUserById(id: string): Promise<User | null> {
        return prisma.user.findUnique({ where: { id } });
    },

    createUser(data: Prisma.UserCreateInput): Promise<User> {
        return prisma.user.create({ data });
    },

    updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return prisma.user.update({
            where: { id },
            data,
        });
    },

    getCurrentUser(id: string): Promise<CurrentUser | null> {
        return prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, name: true, avatarUrl: true, isTwoFactorEnabled: true },
        });
    },

    upsertFirebaseUser(input: Required<Pick<SyncFirebaseInput, "email">> & SyncFirebaseInput): Promise<User> {
        return prisma.user.upsert({
            where: { email: input.email },
            update: {
                name: input.displayName || input.email.split("@")[0],
                avatarUrl: input.photoURL || null,
            },
            create: {
                name: input.displayName || input.email.split("@")[0],
                email: input.email,
                avatarUrl: input.photoURL || null,
                isEmailVerified: true,
            },
        });
    },
};
