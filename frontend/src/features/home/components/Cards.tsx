import "../styles/Cards.css";

type Feature = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    id: "community",
    icon: "🤝",
    title: "Community First",
    description:
      "Connect with developers, share experiences, and grow together through meaningful collaboration.",
  },
  {
    id: "privacy",
    icon: "🔒",
    title: "Privacy Focused",
    description:
      "Your data belongs to you. We never sell personal information or compromise your privacy.",
  },
  {
    id: "global",
    icon: "🌍",
    title: "Built for Everyone",
    description:
      "Whether you're a student, freelancer, startup founder, or enterprise developer, DevArena adapts to your needs.",
  },
  {
    id: "rapid",
    icon: "🚀",
    title: "Rapid Development",
    description:
      "Features are shipped continuously based on real community feedback and developer needs.",
  },
];

type FeatureCardProps = Feature;

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <article className="about-feature">
      <div className="icon" aria-hidden="true">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>
    </article>
  );
}

function Cards() {
  return (
    <section className="about-grid" aria-label="DevArena Features">
      {features.map((feature) => (
        <FeatureCard key={feature.id} {...feature} />
      ))}
    </section>
  );
}

export default Cards;
