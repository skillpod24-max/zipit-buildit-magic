import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, IndianRupee, FileText } from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DetailViewDialog, DetailField } from "@/components/DetailViewDialog";

interface Deal {
  id: string;
  title: string;
  stage: string;
  value: number | null;
  probability: number | null;
  expected_close_date: string | null;
  notes: string | null;
  customer_id: string | null;
}

interface DraggableDealProps {
  deal: Deal;
  onClick: () => void;
}

const DraggableDeal = ({ deal, onClick }: DraggableDealProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="p-3 border rounded-lg hover:bg-accent cursor-move transition-colors"
    >
      <div className="font-medium text-sm">{deal.title}</div>
      {deal.value && (
        <div className="text-sm text-muted-foreground">
          ₹{Number(deal.value).toLocaleString()}
        </div>
      )}
      {deal.probability !== null && (
        <div className="text-xs text-muted-foreground">
          {deal.probability}% probability
        </div>
      )}
    </div>
  );
};

const stages = [
  { value: "enquiry", label: "Enquiry", color: "bg-blue-100 text-blue-800" },
  { value: "proposal", label: "Proposal", color: "bg-yellow-100 text-yellow-800" },
  { value: "negotiation", label: "Negotiation", color: "bg-orange-100 text-orange-800" },
  { value: "closed_won", label: "Closed Won", color: "bg-green-100 text-green-800" },
  { value: "closed_lost", label: "Closed Lost", color: "bg-red-100 text-red-800" },
];

const Pipeline = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    stage: "enquiry",
    value: "",
    probability: "50",
    expected_close_date: "",
    notes: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error: any) {
      toast.error("Error fetching deals");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("deals").insert([{
        title: formData.title,
        stage: formData.stage,
        value: formData.value ? parseFloat(formData.value) : null,
        probability: parseInt(formData.probability),
        expected_close_date: formData.expected_close_date || null,
        notes: formData.notes,
        user_id: user.id,
      }] as any);

      if (error) throw error;

      toast.success("Deal created successfully!");
      setOpen(false);
      setFormData({
        title: "",
        stage: "enquiry",
        value: "",
        probability: "50",
        expected_close_date: "",
        notes: "",
      });
      fetchDeals();
    } catch (error: any) {
      toast.error("Error creating deal");
    }
  };

  const handleDragStart = (event: DragEndEvent) => {
    setActiveDealId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDealId(null);

    if (!over) return;

    const dealId = active.id as string;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    
    // Extract stage from the over element
    let newStage: string | null = null;
    
    // Check if dropped directly on a stage column
    const stageElement = document.querySelector(`[data-stage-id="${over.id}"]`);
    if (stageElement) {
      newStage = over.id as string;
    } else {
      // If dropped on a deal, find its parent stage
      const overDeal = deals.find(d => d.id === over.id);
      if (overDeal) {
        newStage = overDeal.stage;
      }
    }

    if (!newStage || deal.stage === newStage) return;

    // Validate stage value
    const validStages = ["enquiry", "proposal", "negotiation", "closed_won", "closed_lost"];
    if (!validStages.includes(newStage)) return;

    try {
      const { error } = await supabase
        .from("deals")
        .update({ stage: newStage as any })
        .eq("id", dealId);

      if (error) throw error;

      setDeals(prevDeals =>
        prevDeals.map(d => d.id === dealId ? { ...d, stage: newStage as string } : d)
      );

      toast.success(`Deal moved to ${stages.find(s => s.value === newStage)?.label}!`);
    } catch (error: any) {
      toast.error("Error moving deal");
    }
  };

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setDetailOpen(true);
  };

  const handleCreateQuotation = async (dealId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const deal = deals.find(d => d.id === dealId);
      if (!deal) return;

      const quotationNumber = `QUO-${Date.now()}`;
      
      const { error } = await supabase.from("quotations").insert({
        quotation_number: quotationNumber,
        deal_id: dealId,
        customer_id: deal.customer_id,
        status: "draft",
        total_amount: deal.value || 0,
        user_id: user.id,
      });

      if (error) throw error;

      toast.success("Quotation created successfully!");
      setDetailOpen(false);
    } catch (error: any) {
      toast.error("Error creating quotation");
    }
  };

  const handleDetailEdit = async (data: Record<string, any>) => {
    if (!selectedDeal) return;

    try {
      const { error } = await supabase
        .from("deals")
        .update({
          title: data.title,
          stage: data.stage,
          value: data.value ? parseFloat(data.value) : null,
          probability: data.probability ? parseInt(data.probability) : null,
          expected_close_date: data.expected_close_date || null,
          notes: data.notes,
        })
        .eq("id", selectedDeal.id);

      if (error) throw error;

      toast.success("Deal updated successfully!");
      fetchDeals();
      setDetailOpen(false);
    } catch (error: any) {
      toast.error("Error updating deal");
    }
  };

  const dealsByStage = stages.map((stage) => ({
    ...stage,
    deals: deals.filter((deal) => deal.stage === stage.value),
    totalValue: deals
      .filter((deal) => deal.stage === stage.value)
      .reduce((sum, deal) => sum + (Number(deal.value) || 0), 0),
  }));

  const activeDeal = activeDealId ? deals.find(d => d.id === activeDealId) : null;

  const detailFields: DetailField[] = selectedDeal ? [
    { label: "Title", value: selectedDeal.title, type: "text" },
    { 
      label: "Stage", 
      value: selectedDeal.stage, 
      type: "select",
      selectOptions: stages.map(s => ({ value: s.value, label: s.label }))
    },
    { label: "Value (₹)", value: selectedDeal.value?.toString() || "", type: "number" },
    { label: "Probability (%)", value: selectedDeal.probability?.toString() || "", type: "number" },
    { label: "Expected Close Date", value: selectedDeal.expected_close_date || "", type: "date" },
    { label: "Notes", value: selectedDeal.notes || "", type: "textarea" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Pipeline</h1>
          <p className="text-muted-foreground">Track your deals through each stage</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Deal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Deal Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stage">Stage</Label>
                  <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Deal Value (₹)</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="probability">Probability (%)</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected_close_date">Expected Close Date</Label>
                  <Input
                    id="expected_close_date"
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Deal</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {dealsByStage.map((stage) => (
            <SortableContext key={stage.value} items={[stage.value, ...stage.deals.map(d => d.id)]} strategy={verticalListSortingStrategy}>
              <div data-stage-id={stage.value}>
                <Card className="flex flex-col" id={stage.value}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <Badge className={stage.color} variant="outline">
                      {stage.label}
                    </Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      {stage.deals.length}
                    </span>
                  </CardTitle>
                  <div className="text-sm font-semibold flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" />
                    {stage.totalValue.toLocaleString()}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 min-h-[200px]">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : stage.deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deals</p>
                  ) : (
                    stage.deals.map((deal) => (
                      <DraggableDeal
                        key={deal.id}
                        deal={deal}
                        onClick={() => handleDealClick(deal)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
              </div>
            </SortableContext>
          ))}
        </div>
        <DragOverlay>
          {activeDeal && (
            <div className="p-3 border rounded-lg bg-card shadow-lg">
              <div className="font-medium text-sm">{activeDeal.title}</div>
              {activeDeal.value && (
                <div className="text-sm text-muted-foreground">
                  ₹{Number(activeDeal.value).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <DetailViewDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Deal Details"
        fields={detailFields}
        onEdit={handleDetailEdit}
        actions={
          selectedDeal && (
            <Button onClick={() => handleCreateQuotation(selectedDeal.id)}>
              <FileText className="h-4 w-4 mr-2" />
              Create Quotation
            </Button>
          )
        }
      />
    </div>
  );
};

export default Pipeline;