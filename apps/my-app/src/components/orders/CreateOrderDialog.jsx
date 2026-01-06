
import React, { useState, useEffect } from "react";
import { Order } from "@/api/entities";
import { Customer } from "@/api/entities";
import { User } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, AlertCircle, Search, User as UserIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LockPatternDrawer from "./LockPatternDrawer";

const COMMON_DEVICES = [
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14",
  "iPhone 13",
  "iPhone 12",
  "Samsung Galaxy S24",
  "Samsung Galaxy S23",
  "iPad Pro",
  "iPad Air",
  "MacBook Pro",
  "MacBook Air"
];

const COMMON_ISSUES = [
  "Cracked Screen",
  "Battery Replacement",
  "Water Damage",
  "Charging Port",
  "Camera Issue",
  "Speaker Problem",
  "Microphone Problem",
  "Button Not Working",
  "Software Issue",
  "Back Glass Replacement"
];

export default function CreateOrderDialog({ open, onClose, onOrderCreated }) {
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [patternImage, setPatternImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // Added for employee tracking
  
  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    device_brand: "",
    device_model: "",
    device_type: "",
    unlock_pattern: "",
    known_issues: [],
    repair_tasks: [],
    labor_cost: 0, // Added for financial reporting
    parts_needed: [], // Added for financial reporting
    priority: "normal",
    cost_estimate: 0,
    estimated_completion: ""
  });

  const [newTask, setNewTask] = useState({ description: "", cost: 0 });
  const [newPart, setNewPart] = useState({ name: "", price: 0 }); // Added for parts tracking

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadCurrentUser(); // Load current user on dialog open
      setStep(1);
      setFormData({
        customer_id: "",
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        device_brand: "",
        device_model: "",
        device_type: "",
        unlock_pattern: "",
        known_issues: [],
        repair_tasks: [],
        labor_cost: 0,
        parts_needed: [],
        priority: "normal",
        cost_estimate: 0,
        estimated_completion: ""
      });
      setPatternImage(null);
      setError(null);
      setNewTask({ description: "", cost: 0 }); // Reset newTask
      setNewPart({ name: "", price: 0 }); // Reset newPart
    }
  }, [open]);

  const loadCustomers = async () => {
    const data = await Customer.list("-created_date");
    setCustomers(data);
  };

  const loadCurrentUser = async () => {
    const user = await User.me();
    setCurrentUser(user);
  };

  const selectCustomer = (customer) => {
    setFormData({
      ...formData,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email || ""
    });
    setSearchQuery("");
  };

  const addTask = () => {
    if (newTask.description.trim()) {
      setFormData({
        ...formData,
        repair_tasks: [
          ...formData.repair_tasks,
          {
            id: Date.now().toString(),
            description: newTask.description,
            status: "pending",
            cost: parseFloat(newTask.cost) || 0
          }
        ]
      });
      setNewTask({ description: "", cost: 0 });
    }
  };

  const removeTask = (taskId) => {
    setFormData({
      ...formData,
      repair_tasks: formData.repair_tasks.filter(t => t.id !== taskId)
    });
  };

  const addPart = () => {
    if (newPart.name.trim()) {
      setFormData({
        ...formData,
        parts_needed: [
          ...formData.parts_needed,
          {
            name: newPart.name,
            price: parseFloat(newPart.price) || 0
          }
        ]
      });
      setNewPart({ name: "", price: 0 });
    }
  };

  const removePart = (index) => {
    setFormData({
      ...formData,
      parts_needed: formData.parts_needed.filter((_, i) => i !== index)
    });
  };

  const addKnownIssue = (issue) => {
    if (!formData.known_issues.includes(issue)) {
      setFormData({
        ...formData,
        known_issues: [...formData.known_issues, issue]
      });
    }
  };

  const removeKnownIssue = (issue) => {
    setFormData({
      ...formData,
      known_issues: formData.known_issues.filter(i => i !== issue)
    });
  };

  const handlePatternSave = (imageDataUrl) => {
    setPatternImage(imageDataUrl);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!formData.customer_name || !formData.customer_phone) {
        throw new Error("Customer name and phone are required");
      }

      if (!formData.device_type) {
        throw new Error("Device type is required");
      }

      let customerId = formData.customer_id;
      
      if (!customerId) {
        const newCustomer = await Customer.create({
          name: formData.customer_name,
          phone: formData.customer_phone,
          email: formData.customer_email,
          total_orders: 1
        });
        customerId = newCustomer.id;
      } else {
        const customer = await Customer.filter({ id: customerId });
        if (customer[0]) {
          await Customer.update(customerId, {
            total_orders: (customer[0].total_orders || 0) + 1
          });
        }
      }

      let patternImageUrl = null;
      if (patternImage) {
        const blob = await fetch(patternImage).then(r => r.blob());
        const file = new File([blob], `pattern-${Date.now()}.png`, { type: 'image/png' });
        const { file_url } = await UploadFile({ file });
        patternImageUrl = file_url;
      }

      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
      const tasksCost = formData.repair_tasks.reduce((sum, task) => sum + (task.cost || 0), 0);
      const partsCost = formData.parts_needed.reduce((sum, part) => sum + (part.price || 0), 0);
      const subtotal = tasksCost + partsCost + formData.labor_cost;
      const taxRate = 0.115; // 11.5% tax
      const totalWithTax = subtotal * (1 + taxRate); // Renamed from finalCostEstimate to clarify

      await Order.create({
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        device_type: formData.device_type,
        device_brand: formData.device_brand,
        device_model: formData.device_model,
        unlock_pattern: formData.unlock_pattern,
        unlock_pattern_image: patternImageUrl,
        known_issues: formData.known_issues,
        repair_tasks: formData.repair_tasks,
        labor_cost: formData.labor_cost, // Added to order data
        parts_needed: formData.parts_needed, // Added to order data
        status: "pending",
        priority: formData.priority,
        progress_percentage: 0,
        cost_estimate: totalWithTax,
        amount_paid: 0, // Added for financial tracking
        balance_due: totalWithTax, // Added for financial tracking
        estimated_completion: formData.estimated_completion,
        comments: [],
        created_by: currentUser?.full_name || currentUser?.email // Track who created the order
      });

      onOrderCreated();
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  // Calculate totals for display
  const tasksSubtotal = formData.repair_tasks.reduce((sum, t) => sum + t.cost, 0);
  const partsSubtotal = formData.parts_needed.reduce((sum, p) => sum + p.price, 0);
  const currentSubtotal = tasksSubtotal + partsSubtotal + formData.labor_cost;
  const taxAmount = currentSubtotal * 0.115;
  const totalEstimate = currentSubtotal + taxAmount;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center justify-between">
            <span>Create New Order</span>
            {currentUser && (
              <Badge variant="outline" className="text-sm font-normal">
                <UserIcon className="w-3 h-3 mr-1" />
                {currentUser.full_name || currentUser.email}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Customer Information</h3>
              
              <div className="space-y-2">
                <Label>Search Existing Customer</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {searchQuery && filteredCustomers.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectCustomer(customer)}
                      >
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-slate-500">{customer.phone}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_phone">Phone Number *</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">Email (Optional)</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>

              <Button 
                onClick={() => setStep(2)} 
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
                disabled={!formData.customer_name || !formData.customer_phone}
              >
                Next: Device Information
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Device Information</h3>

              <div className="space-y-2">
                <Label>Quick Select Device</Label>
                <div className="grid grid-cols-2 gap-2">
                  {COMMON_DEVICES.slice(0, 6).map(device => (
                    <Button
                      key={device}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const [brand, ...model] = device.split(' ');
                        setFormData({
                          ...formData,
                          device_type: device,
                          device_brand: brand,
                          device_model: model.join(' ')
                        });
                      }}
                      className="justify-start"
                    >
                      {device}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="device_type">Device Type *</Label>
                <Input
                  id="device_type"
                  value={formData.device_type}
                  onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                  placeholder="iPhone 15 Pro Max"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="device_brand">Brand</Label>
                  <Input
                    id="device_brand"
                    value={formData.device_brand}
                    onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                    placeholder="Apple"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_model">Model</Label>
                  <Input
                    id="device_model"
                    value={formData.device_model}
                    onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                    placeholder="15 Pro Max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unlock_pattern">Unlock Pattern/PIN/Password</Label>
                <Input
                  id="unlock_pattern"
                  value={formData.unlock_pattern}
                  onChange={(e) => setFormData({ ...formData, unlock_pattern: e.target.value })}
                  placeholder="1234 or pattern description"
                  type="password"
                />
              </div>

              <LockPatternDrawer onSave={handlePatternSave} />
              {patternImage && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-800">
                  ✓ Lock pattern saved
                </div>
              )}

              <div className="space-y-2">
                <Label>Known Issues</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {COMMON_ISSUES.map(issue => (
                    <Button
                      key={issue}
                      variant={formData.known_issues.includes(issue) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (formData.known_issues.includes(issue)) {
                          removeKnownIssue(issue);
                        } else {
                          addKnownIssue(issue);
                        }
                      }}
                      className={formData.known_issues.includes(issue) ? "bg-gradient-to-r from-cyan-500 to-blue-600" : ""}
                    >
                      {issue}
                    </Button>
                  ))}
                </div>
                {formData.known_issues.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg">
                    {formData.known_issues.map(issue => (
                      <Badge key={issue} variant="secondary" className="gap-1">
                        {issue}
                        <X 
                          className="w-3 h-3 cursor-pointer" 
                          onClick={() => removeKnownIssue(issue)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
                  disabled={!formData.device_type}
                >
                  Next: Repair Tasks
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Repair Tasks & Details</h3>

              <div className="space-y-3">
                <Label>Add Repair Tasks</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Task description..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && addTask()}
                  />
                  <Input
                    type="number"
                    placeholder="Cost"
                    value={newTask.cost}
                    onChange={(e) => setNewTask({ ...newTask, cost: e.target.value })}
                    className="w-24"
                  />
                  <Button onClick={addTask} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {formData.repair_tasks.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {formData.repair_tasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{task.description}</p>
                          <p className="text-sm text-slate-500">${task.cost.toFixed(2)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTask(task.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                      <span className="font-semibold">Tasks Subtotal:</span>
                      <span className="text-lg font-bold text-slate-700">
                        ${tasksSubtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="labor_cost">Labor Cost</Label>
                <Input
                  id="labor_cost"
                  type="number"
                  value={formData.labor_cost}
                  onChange={(e) => setFormData({ ...formData, labor_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-3">
                <Label>Parts Needed</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Part name..."
                    value={newPart.name}
                    onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && newPart.name.trim() && addPart()}
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={newPart.price}
                    onChange={(e) => setNewPart({ ...newPart, price: parseFloat(e.target.value) || 0 })}
                    className="w-24"
                  />
                  <Button onClick={addPart} size="icon" disabled={!newPart.name.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {formData.parts_needed.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {formData.parts_needed.map((part, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{part.name}</p>
                          <p className="text-sm text-slate-500">${part.price.toFixed(2)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePart(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                      <span className="font-semibold">Parts Subtotal:</span>
                      <span className="text-lg font-bold text-slate-700">
                        ${partsSubtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>


              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                  <span className="font-semibold">Subtotal (Tasks + Parts + Labor):</span>
                  <span className="text-lg font-bold text-slate-700">
                    ${currentSubtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                  <span className="font-semibold">Tax (11.5%):</span>
                  <span className="text-lg font-bold text-slate-700">
                    ${taxAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-cyan-50 rounded-lg border-2 border-cyan-200">
                  <span className="font-semibold">Total Estimate:</span>
                  <span className="text-lg font-bold text-cyan-700">
                    ${totalEstimate.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority Level</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_completion">Estimated Completion Date</Label>
                <Input
                  id="estimated_completion"
                  type="date"
                  value={formData.estimated_completion}
                  onChange={(e) => setFormData({ ...formData, estimated_completion: e.target.value })}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600"
                  disabled={loading || currentSubtotal <= 0} // Disable if no cost items
                >
                  {loading ? "Creating..." : "Create Order"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
