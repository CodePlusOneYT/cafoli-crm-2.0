import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CampaignBlock } from "@/types/campaign";
import { BlockType } from "./BlockPalette";

interface BlockListProps {
  blocks: CampaignBlock[];
  blockTypes: BlockType[];
  selectedBlock: string | null;
  onSelectBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
}

export function BlockList({
  blocks,
  blockTypes,
  selectedBlock,
  onSelectBlock,
  onRemoveBlock,
}: BlockListProps) {
  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => {
        const blockType = blockTypes.find((bt) => bt.type === block.type);
        return (
          <Card
            key={block.id}
            className={`cursor-pointer ${selectedBlock === block.id ? 'border-primary' : ''}`}
            onClick={() => onSelectBlock(block.id)}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {blockType && <blockType.icon className="h-4 w-4" />}
                <span className="text-sm">{blockType?.label} {idx + 1}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBlock(block.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
