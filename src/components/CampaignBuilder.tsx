import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { useAuth } from "@/hooks/use-auth";
import { Id } from "@/convex/_generated/dataModel";
import { CampaignBlock, CampaignConnection } from "@/types/campaign";
import { CampaignSettings } from "@/components/campaign-builder/CampaignSettings";
import { LeadSelectionPanel } from "@/components/campaign-builder/LeadSelectionPanel";
import { BlockPalette, blockTypes } from "@/components/campaign-builder/BlockPalette";
import { BlockConfigurationPanel } from "@/components/campaign-builder/BlockConfigurationPanel";
import { BlockList } from "@/components/campaign-builder/BlockList";
import { getDefaultBlockData } from "@/lib/campaign-utils";

const api = getConvexApi() as any;

interface CampaignBuilderProps {
  campaignId?: Id<"campaigns">;
  onSave?: () => void;
}

export default function CampaignBuilder({ campaignId, onSave }: CampaignBuilderProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [blocks, setBlocks] = useState<CampaignBlock[]>([]);
  const [connections, setConnections] = useState<CampaignConnection[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  
  // Lead selection state
  const [leadSelectionType, setLeadSelectionType] = useState<"all" | "filtered">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [autoEnrollNew, setAutoEnrollNew] = useState(true);

  const allTags = useQuery(api.tags.getAllTags) || [];
  const uniqueSources = useQuery(api.leads.queries.getUniqueSources) || [];
  const templates = useQuery(api.whatsappTemplatesQueries.getTemplates) || [];

  const createCampaign = useMutation(api.campaigns.createCampaign);
  const updateCampaign = useMutation(api.campaigns.updateCampaign);

  const availableStatuses = ["Cold", "Hot", "Mature"];

  const addBlock = (type: string) => {
    const newBlock: CampaignBlock = {
      id: `block_${Date.now()}`,
      type,
      data: getDefaultBlockData(type),
      position: { x: 100, y: blocks.length * 150 + 100 },
    };
    setBlocks([...blocks, newBlock]);
    setShowBlockMenu(false);
    setSelectedBlock(newBlock.id);
  };

  const updateBlockData = (blockId: string, data: any) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, data: { ...b.data, ...data } } : b));
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
    setConnections(connections.filter(c => c.from !== blockId && c.to !== blockId));
    if (selectedBlock === blockId) setSelectedBlock(null);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("You must be logged in to create a campaign");
      return;
    }
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (blocks.length === 0) {
      toast.error("Add at least one block to the campaign");
      return;
    }

    try {
      const leadSelection = {
        type: leadSelectionType,
        tagIds: selectedTags.length > 0 ? selectedTags as Id<"tags">[] : undefined,
        statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        autoEnrollNew,
      };

      if (campaignId) {
        await updateCampaign({
          userId: user._id,
          campaignId,
          name,
          description,
          leadSelection,
          blocks,
          connections,
        });
        toast.success("Campaign updated");
      } else {
        await createCampaign({
          userId: user._id,
          name,
          description,
          type: "sequence",
          leadSelection,
          blocks,
          connections,
        });
        toast.success("Campaign created");
      }
      onSave?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save campaign");
    }
  };

  const selectedBlockData = blocks.find(b => b.id === selectedBlock);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="space-y-4">
        <CampaignSettings
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
        />

        {/* Lead Selection */}
        <LeadSelectionPanel
          leadSelectionType={leadSelectionType}
          selectedTags={selectedTags}
          selectedStatuses={selectedStatuses}
          selectedSources={selectedSources}
          autoEnrollNew={autoEnrollNew}
          allTags={allTags}
          uniqueSources={uniqueSources}
          availableStatuses={availableStatuses}
          onLeadSelectionTypeChange={setLeadSelectionType}
          onAddTag={(tagId) => setSelectedTags([...selectedTags, tagId])}
          onRemoveTag={(tagId) => setSelectedTags(selectedTags.filter(t => t !== tagId))}
          onAddStatus={(status) => setSelectedStatuses([...selectedStatuses, status])}
          onRemoveStatus={(status) => setSelectedStatuses(selectedStatuses.filter(s => s !== status))}
          onAddSource={(source) => setSelectedSources([...selectedSources, source])}
          onRemoveSource={(source) => setSelectedSources(selectedSources.filter(s => s !== source))}
          onAutoEnrollChange={setAutoEnrollNew}
        />
      </div>

      {/* Campaign Flow Builder */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        {/* Block List */}
        <div className="w-full lg:w-64 space-y-2">
          <Button onClick={() => setShowBlockMenu(!showBlockMenu)} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Block
          </Button>

          {showBlockMenu && (
            <Card>
              <CardContent className="p-2">
                <BlockPalette onAddBlock={addBlock} />
              </CardContent>
            </Card>
          )}

          <BlockList
            blocks={blocks}
            blockTypes={blockTypes}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            onRemoveBlock={removeBlock}
          />
        </div>

        {/* Block Editor */}
        <div className="flex-1 min-w-0">
          <BlockConfigurationPanel
            selectedBlock={selectedBlockData}
            blockTypes={blockTypes}
            templates={templates}
            allTags={allTags}
            onUpdateBlockData={updateBlockData}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onSave?.()}>Cancel</Button>
        <Button onClick={handleSave}>Save Campaign</Button>
      </div>
    </div>
  );
}