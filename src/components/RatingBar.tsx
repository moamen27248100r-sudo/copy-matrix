function ratingColorClass(score: number) {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-danger";
}

export function RatingBar({ score, label = "التقييم" }: { score: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${ratingColorClass(score)}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
