import { resolveApiUrl } from "./ApiClient";
import { RELEASES_PER_PAGE } from "./ReleaseConstants";

export type BreakingChange = {
  area: string;
  description: string;
};

export type UpdateEntry = {
  id: string;
  releasedAt: string;
  title: string;
  summary: string;
  releaseTag?: string;
  version?: string;
  status?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "gif";
  mediaCaption?: string;
  breakingChanges?: BreakingChange[];
  changelogSpecs?: string[];
};

export type ReleasePageViewModel = {
  entries: UpdateEntry[];
  totalPages: number;
};

type BackendRelease = {
  id: string;
  releasedAt: string;
  title: string;
  summary: string;
  releaseTag?: string;
  version?: string;
  status?: string;
  changelogSpecs?: string[];
};

type BackendReleaseListResponse = {
  success: boolean;
  data?: BackendRelease[];
  message?: string;
  pagination?: {
    totalPages?: number;
  };
};

export async function getReleasePageViewModel(page: number): Promise<ReleasePageViewModel> {
  const url = resolveApiUrl(`/api/releases?page=${page}&limit=${RELEASES_PER_PAGE}`);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  const data = (await response.json().catch(() => null)) as BackendReleaseListResponse | null;

  if (!response.ok || !data) {
    throw new Error(data?.message || `Failed to fetch releases (${response.status})`);
  }

  if (!data.success) {
    throw new Error(data.message || "Failed to fetch releases");
  }

  return buildReleasePageViewModel(data);
}

function buildReleasePageViewModel(response: BackendReleaseListResponse): ReleasePageViewModel {
  return {
    entries: mapReleasesToUpdateEntries(response.data || []),
    totalPages: normalizeTotalPages(response.pagination?.totalPages),
  };
}

function mapReleasesToUpdateEntries(releases: BackendRelease[]) {
  return releases.map(mapReleaseToUpdateEntry);
}

function mapReleaseToUpdateEntry(release: BackendRelease): UpdateEntry {
  return {
    id: release.id,
    releasedAt: release.releasedAt,
    title: release.title,
    summary: release.summary,
    releaseTag: release.releaseTag,
    version: release.version,
    status: release.status,
    changelogSpecs: release.changelogSpecs,
  };
}

function normalizeTotalPages(totalPages: number | undefined) {
  return totalPages || 1;
}
