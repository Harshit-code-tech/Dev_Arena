export const RANKS = [
  { name: "Unranked", points: 0 },

  { name: "Mud", points: 75 },

  { name: "Wood", points: 125 },

  { name: "Stone", points: 175 },

  { name: "Iron", points: 250 },

  { name: "Silver", points: 350 },

  { name: "Gold", points: 475 },

  { name: "Platinum", points: 625 },

  { name: "Ruby", points: 800 },

  { name: "Diamond", points: 1000 },

  { name: "Developer", points: 1250 },
];

export const getRankFromPoints = (points: number) => {
  let currentRank = RANKS[0];

  for (const rank of RANKS) {
    if (points >= rank.points) {
      currentRank = rank;
    }
  }

  return currentRank;
};

export const getNextRank = (points: number) => {
  for (const rank of RANKS) {
    if (points < rank.points) {
      return rank;
    }
  }

  return null;
};

export const getRankProgress = (points: number) => {
  const currentRank = getRankFromPoints(points);

  const currentIndex = RANKS.findIndex(
    (rank) => rank.name === currentRank.name,
  );

  if (currentIndex === RANKS.length - 1) {
    return 100;
  }

  const nextRank = RANKS[currentIndex + 1];

  const progress =
    ((points - currentRank.points) /
      (nextRank.points - currentRank.points)) *
    100;

  return Math.max(0, Math.min(progress, 100));
};