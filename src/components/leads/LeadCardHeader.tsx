interface LeadCardHeaderProps {
  name: string;
  creationTime: number;
  hasUnreadMessages: boolean;
  unreadCount?: number;
}

export function LeadCardHeader({ name, creationTime, hasUnreadMessages, unreadCount }: LeadCardHeaderProps) {
  return (
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold truncate">{name}</h3>
        {hasUnreadMessages && (
          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
            {unreadCount} new
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {new Date(creationTime).toLocaleString()}
      </span>
    </div>
  );
}
