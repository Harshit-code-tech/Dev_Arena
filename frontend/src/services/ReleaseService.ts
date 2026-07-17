import {
  RELEASE_DATE_FORMAT_OPTIONS,
  RELEASES_PER_PAGE,
} from "./ReleaseConstants";

export type BreakingChange = {
  area: string;
  description: string;
};

export type UpdateEntry = {
  id: string;
  date: string;
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
  pagination?: {
    totalPages?: number;
  };
};

export async function getReleasePageViewModel(page: number): Promise<ReleasePageViewModel> {
  const response = await fetch(`/api/releases?page=${page}&limit=${RELEASES_PER_PAGE}`);
  const data = await response.json();

  return buildReleasePageViewModel(data);
}

function buildReleasePageViewModel(response: BackendReleaseListResponse): ReleasePageViewModel {
  if (!response.success) {
    return {
      entries: [],
      totalPages: 1,
    };
  }

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
    date: formatReleaseDate(release.releasedAt),
    title: release.title,
    summary: release.summary,
    releaseTag: release.releaseTag,
    version: release.version,
    status: release.status,
    changelogSpecs: release.changelogSpecs,
  };
}

function formatReleaseDate(releasedAt: string) {
  return new Date(releasedAt).toLocaleDateString("en-US", RELEASE_DATE_FORMAT_OPTIONS);
}

function normalizeTotalPages(totalPages: number | undefined) {
  return totalPages || 1;
}
