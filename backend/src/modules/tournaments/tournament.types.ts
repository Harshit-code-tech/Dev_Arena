export type TournamentListTab = "Live" | "Upcoming" | "Completed" | "My Tournaments";

export type TournamentRegistrationInput = {
  participationMode?: "Solo" | "Auto Team" | "Existing Team";
  teamCode?: string;
  preferredRole?: string;
  availability?: string;
};

export type DsaTournamentSubmissionInput = {
  questionId?: string;
  language?: string;
  code?: string;
};

export type ProjectTournamentSubmissionInput = {
  repositoryUrl?: string;
  deploymentUrl?: string;
  demoVideoUrl?: string;
  notes?: string;
  finalize?: boolean;
};
