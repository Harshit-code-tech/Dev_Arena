import { prisma } from "../../database/prisma";
import type { ReleaseInput, ReleaseListQuery, ReleaseUpdateInput } from "./release.types";

function buildReleasedAtUpdate(releasedAt: ReleaseInput["releasedAt"]) {
    if (releasedAt === undefined) {
        return {};
    }

    return { releasedAt: releasedAt instanceof Date ? releasedAt : new Date(releasedAt) };
}

export const releaseService = {
    async listReleases({ page, limit }: ReleaseListQuery) {
        const skip = (page - 1) * limit;

        const [releases, total] = await Promise.all([
            prisma.release.findMany({
                orderBy: { releasedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.release.count(),
        ]);

        return {
            releases,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    async createRelease(input: ReleaseInput) {
        return prisma.release.create({
            data: {
                version: input.version,
                title: input.title,
                summary: input.summary,
                releaseTag: input.releaseTag,
                status: input.status || "Released",
                changelogSpecs: input.changelogSpecs || [],
                ...buildReleasedAtUpdate(input.releasedAt),
            },
        });
    },

    async findReleaseById(id: string) {
        return prisma.release.findUnique({ where: { id } });
    },

    async updateRelease(id: string, input: ReleaseUpdateInput) {
        return prisma.release.update({
            where: { id },
            data: {
                ...(input.version !== undefined && { version: input.version }),
                ...(input.title !== undefined && { title: input.title }),
                ...(input.summary !== undefined && { summary: input.summary }),
                ...(input.releaseTag !== undefined && { releaseTag: input.releaseTag }),
                ...(input.status !== undefined && { status: input.status }),
                ...(input.changelogSpecs !== undefined && { changelogSpecs: input.changelogSpecs }),
                ...buildReleasedAtUpdate(input.releasedAt),
            },
        });
    },

    async deleteRelease(id: string) {
        return prisma.release.delete({ where: { id } });
    },
};
