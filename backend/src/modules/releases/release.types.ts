export type ReleaseListQuery = {
    page: number;
    limit: number;
};

export type ReleaseInput = {
    version: string;
    title: string;
    summary: string;
    releaseTag: string;
    status?: string;
    changelogSpecs?: string[];
    releasedAt?: string | Date;
};

export type ReleaseUpdateInput = Partial<ReleaseInput>;
