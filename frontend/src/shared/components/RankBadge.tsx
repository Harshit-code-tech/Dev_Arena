import developerIcon from "../../assets/ranks/developer.svg";
import diamondIcon from "../../assets/ranks/diamond.svg";
import goldIcon from "../../assets/ranks/gold.svg";
import ironIcon from "../../assets/ranks/iron.svg";
import mudIcon from "../../assets/ranks/mud.svg";
import platinumIcon from "../../assets/ranks/platinum.svg";
import rubyIcon from "../../assets/ranks/ruby.svg";
import silverIcon from "../../assets/ranks/silver.svg";
import stoneIcon from "../../assets/ranks/stone.svg";
import unrankedIcon from "../../assets/ranks/unranked.svg";
import woodIcon from "../../assets/ranks/wood.svg";
import "../styles/RankBadge.css";

const rankIcons: Record<string, string> = {
  developer: developerIcon,
  diamond: diamondIcon,
  gold: goldIcon,
  iron: ironIcon,
  mud: mudIcon,
  platinum: platinumIcon,
  ruby: rubyIcon,
  silver: silverIcon,
  stone: stoneIcon,
  unranked: unrankedIcon,
  wood: woodIcon,
};

type RankBadgeProps = {
  rank?: string | null;
  size?: "small" | "medium" | "large";
  className?: string;
};

export default function RankBadge({
  rank,
  size = "medium",
  className = "",
}: RankBadgeProps) {
  const label = rank?.trim() || "Unranked";
  const normalizedRank = label.toLowerCase();
  const icon = rankIcons[normalizedRank] || unrankedIcon;

  return (
    <span className={`rank-badge rank-badge--${size} ${className}`.trim()}>
      <img className="rank-badge__icon" src={icon} alt="" aria-hidden="true" />
      <span className="rank-badge__label">{label}</span>
    </span>
  );
}
