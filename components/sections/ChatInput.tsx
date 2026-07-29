interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function ChatInput({
  value,
  onChange,
  onSend,
}: ChatInputProps) {
  return (
    <div className="flex gap-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask IAURA anything..."
        className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3"
      />

      <button
        onClick={onSend}
        className="rounded-xl bg-purple-600 px-5 py-3 font-semibold"
      >
        Send
      </button>
    </div>
  );
}