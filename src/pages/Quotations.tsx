import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { DetailViewDialog, DetailField } from "@/components/DetailViewDialog";

interface Quotation {
  id: string;
  quotation_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  valid_until: string | null;
  customer_id: string | null;
  tax_amount: number;
  discount_amount: number;
  notes: string | null;
}

const Quotations = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    quotation_number: `QUO-${Date.now()}`,
    customer_id: "",
    deal_id: "",
    status: "draft",
    valid_until: "",
    tax_amount: "0",
    discount_amount: "0",
    notes: "",
  });
  const [lineItems, setLineItems] = useState([
    { description: "", quantity: 1, unit_price: 0 }
  ]);

  useEffect(() => {
    fetchQuotations();
    fetchCustomers();
    fetchDeals();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("user_id", user.id);

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchDeals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("deals")
        .select("id, title")
        .eq("user_id", user.id);

      if (error) throw error;
      setDeals(data || []);
    } catch (error: any) {
      console.error("Error fetching deals:", error);
    }
  };

  const fetchQuotations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("quotations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotations(data || []);
    } catch (error: any) {
      toast.error("Error fetching quotations");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      accepted: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate total
      const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const taxAmount = parseFloat(formData.tax_amount) || 0;
      const discountAmount = parseFloat(formData.discount_amount) || 0;
      const totalAmount = subtotal + taxAmount - discountAmount;

      const { data: quotation, error } = await supabase.from("quotations").insert({
        quotation_number: formData.quotation_number,
        customer_id: formData.customer_id || null,
        deal_id: formData.deal_id || null,
        status: formData.status as any,
        valid_until: formData.valid_until || null,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        notes: formData.notes,
        user_id: user.id,
      } as any).select().single();

      if (error) throw error;

      // Insert line items
      if (quotation && lineItems.length > 0) {
        const items = lineItems.map(item => ({
          quotation_id: quotation.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
        }));
        
        const { error: itemsError } = await supabase.from("quotation_items").insert(items);
        if (itemsError) throw itemsError;
      }

      toast.success("Quotation created successfully!");
      setCreateOpen(false);
      setFormData({
        quotation_number: `QUO-${Date.now()}`,
        customer_id: "",
        deal_id: "",
        status: "draft",
        valid_until: "",
        tax_amount: "0",
        discount_amount: "0",
        notes: "",
      });
      setLineItems([{ description: "", quantity: 1, unit_price: 0 }]);
      fetchQuotations();
    } catch (error: any) {
      toast.error("Error creating quotation");
    }
  };

  const handleQuotationClick = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setDetailOpen(true);
  };

  const handleViewInvoice = async (quotation: Quotation) => {
    try {
      const { data: items, error: itemsError } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotation.id);

      if (itemsError) throw itemsError;

      let customerData = null;
      if (quotation.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("*")
          .eq("id", quotation.customer_id)
          .single();
        customerData = customer;
      }

      const invoiceData = {
        invoice_number: quotation.quotation_number,
        date: quotation.created_at,
        due_date: quotation.valid_until,
        customer_name: customerData?.name || "Customer Name",
        customer_email: customerData?.email,
        customer_phone: customerData?.phone,
        customer_address: customerData?.address,
        items: items?.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          amount: Number(item.line_total),
        })) || [],
        subtotal: Number(quotation.total_amount) - Number(quotation.tax_amount) + Number(quotation.discount_amount),
        tax_amount: Number(quotation.tax_amount),
        discount_amount: Number(quotation.discount_amount),
        total_amount: Number(quotation.total_amount),
        notes: quotation.notes,
      };

      setInvoiceDialogOpen(true);
      // Store invoice data separately
      (window as any).__invoiceData = invoiceData;
    } catch (error) {
      toast.error("Error loading quotation details");
    }
  };

  const handleDetailEdit = async (data: Record<string, any>) => {
    if (!selectedQuotation) return;

    try {
      const { error } = await supabase
        .from("quotations")
        .update({
          status: data.status,
          valid_until: data.valid_until || null,
          tax_amount: parseFloat(data.tax_amount) || 0,
          discount_amount: parseFloat(data.discount_amount) || 0,
          notes: data.notes,
        })
        .eq("id", selectedQuotation.id);

      if (error) throw error;

      toast.success("Quotation updated successfully!");
      fetchQuotations();
      setDetailOpen(false);
    } catch (error: any) {
      toast.error("Error updating quotation");
    }
  };

  const detailFields: DetailField[] = selectedQuotation ? [
    { label: "Quotation Number", value: selectedQuotation.quotation_number, type: "text" },
    { 
      label: "Status", 
      value: selectedQuotation.status, 
      type: "select", 
      fieldName: "status",
      selectOptions: [
        { value: "draft", label: "Draft" },
        { value: "sent", label: "Sent" },
        { value: "accepted", label: "Accepted" },
        { value: "rejected", label: "Rejected" },
      ]
    },
    { label: "Total Amount", value: `₹${Number(selectedQuotation.total_amount).toLocaleString()}`, type: "text" },
    { label: "Tax Amount (₹)", value: selectedQuotation.tax_amount, type: "number", fieldName: "tax_amount" },
    { label: "Discount Amount (₹)", value: selectedQuotation.discount_amount, type: "number", fieldName: "discount_amount" },
    { label: "Valid Until", value: selectedQuotation.valid_until || "", type: "date", fieldName: "valid_until" },
    { label: "Notes", value: selectedQuotation.notes || "", type: "textarea", fieldName: "notes" },
    { label: "Created", value: selectedQuotation.created_at, type: "date" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quotations & Billing</h1>
          <p className="text-muted-foreground">Manage your quotes and invoices</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Quotation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Quotation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quotation_number">Quotation Number *</Label>
                <Input
                  id="quotation_number"
                  value={formData.quotation_number}
                  onChange={(e) => setFormData({ ...formData, quotation_number: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer</Label>
                  <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal_id">Deal</Label>
                  <Select value={formData.deal_id} onValueChange={(value) => setFormData({ ...formData, deal_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select deal" />
                    </SelectTrigger>
                    <SelectContent>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_amount">Tax Amount (₹)</Label>
                  <Input
                    id="tax_amount"
                    type="number"
                    step="0.01"
                    value={formData.tax_amount}
                    onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_amount">Discount Amount (₹)</Label>
                  <Input
                    id="discount_amount"
                    type="number"
                    step="0.01"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Line Items</Label>
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Input
                        placeholder="Product/Service"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...lineItems];
                          newItems[index].description = e.target.value;
                          setLineItems(newItems);
                        }}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...lineItems];
                          newItems[index].quantity = parseFloat(e.target.value) || 1;
                          setLineItems(newItems);
                        }}
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price (₹)"
                        value={item.unit_price}
                        onChange={(e) => {
                          const newItems = [...lineItems];
                          newItems[index].unit_price = parseFloat(e.target.value) || 0;
                          setLineItems(newItems);
                        }}
                        required
                      />
                    </div>
                    <div className="col-span-2 flex gap-1">
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLineItems(lineItems.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0 }])}
                >
                  Add Item
                </Button>
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
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Quotation</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : quotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                    <p>No quotations yet</p>
                    <p className="text-sm">Quotation creation will be available in the next update</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              quotations.map((quotation) => (
                <TableRow 
                  key={quotation.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleQuotationClick(quotation)}
                >
                  <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(quotation.status)} variant="outline">
                      {quotation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>₹{Number(quotation.total_amount).toLocaleString()}</TableCell>
                  <TableCell>{new Date(quotation.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {quotation.valid_until
                      ? new Date(quotation.valid_until).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewInvoice(quotation)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Invoice
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InvoiceTemplate
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        invoiceData={(window as any).__invoiceData}
        type="quotation"
      />

      <DetailViewDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Quotation Details"
        fields={detailFields}
        onEdit={handleDetailEdit}
        actions={
          selectedQuotation && (
            <Button onClick={() => handleViewInvoice(selectedQuotation)}>
              <FileText className="h-4 w-4 mr-2" />
              View Invoice
            </Button>
          )
        }
      />
    </div>
  );
};

export default Quotations;