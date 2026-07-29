import type { ChatMessage } from "@/types/chat";

interface ConversationProps {
  messages: ChatMessage[];
}

export function Conversation({
  messages,
}: ConversationProps) {
  return (
    <section className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className="rounded-xl bg-zinc-900 p-4"
        >
          <strong>
            {message.role === "user"
              ? "You"
              : "IAURA"}
          </strong>

          <p className="mt-2 whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      ))}
    </section>
  );
}