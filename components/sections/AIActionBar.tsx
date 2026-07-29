interface AIActionBarProps {
  onAnalyze: () => void;
}

export function AIActionBar({
  onAnalyze,
}: AIActionBarProps) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onAnalyze}
        className="rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white transition hover:bg-purple-500"
      >
        Analyze My Progress
      </button>
    </div>
  );
}