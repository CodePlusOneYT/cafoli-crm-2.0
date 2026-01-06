import { Doc } from "@/convex/_generated/dataModel";

interface LeadCardTagsProps {
  tags: Doc<"tags">[];
}

export function LeadCardTags({ tags }: LeadCardTagsProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {tags.map(tag => (
        <span 
          key={tag._id} 
          className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}
