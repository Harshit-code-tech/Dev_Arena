export type DayActivityItem = {
  id: string;
  title: string;
  description?: string | null;
  metadata: string[];
  occurredAt: Date;
  points?: number;
  link?: string | null;
};

export type DayActivitySection = {
  key:
    | "dsa"
    | "revision"
    | "learning"
    | "fullstack"
    | "projectWork"
    | "milestones"
    | "projectCompletions"
    | "challenges";
  title: string;
  items: DayActivityItem[];
};

export type DayActivityResponse = {
  date: string;
  totalActivities: number;
  totalPoints: number;
  sections: DayActivitySection[];
};
