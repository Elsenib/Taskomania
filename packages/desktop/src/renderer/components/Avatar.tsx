function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

interface Props {
  displayName: string;
  avatarUrl?: string | null;
  size?: number;
  fontSize?: number;
}

export default function Avatar({ displayName, avatarUrl, size = 22, fontSize = 10 }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        title={displayName}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      title={displayName}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--accent)",
        color: "white",
        fontSize,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials(displayName)}
    </div>
  );
}
