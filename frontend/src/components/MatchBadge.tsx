function matchColor(score: number | null | undefined): { dot: string; text: string; bar: string } {
  if (score == null)  return { dot: "bg-white border border-gray-200", text: "text-gray-400", bar: "bg-gray-200" };
  if (score >= 70)    return { dot: "bg-green-500",  text: "text-green-700",  bar: "bg-green-500" };
  if (score >= 50)    return { dot: "bg-yellow-400", text: "text-yellow-700", bar: "bg-yellow-400" };
  return               { dot: "bg-red-400",   text: "text-red-600",   bar: "bg-red-400" };
}

export function MatchBadge({ score }: { score: number | null | undefined }) {
  const c = matchColor(score);
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {score != null ? (
        <>
          <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${score}%` }} />
          </div>
          <span className={`font-medium text-xs ${c.text}`}>{score}%</span>
        </>
      ) : (
        <span className="text-gray-400 text-xs">—</span>
      )}
    </div>
  );
}
