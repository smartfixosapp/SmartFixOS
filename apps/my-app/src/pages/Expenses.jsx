import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Filter, MoreVertical, Pencil, Trash2, FileSpreadsheet, Receipt, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import ImportExportModal from "@/components/import-export/ImportExportModal";
import StatsCard from "@/components/ui/StatsCard";

export default function Expenses() {
  const [formOpen, setFormOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [clientTypeFilter, setClientTypeFilter] = useState("all");
  const [clientNameFilter, setClientNameFilter] = useState("all");

  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => base44.entities.Expense.list("-date", 500)
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setFormOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setFormOpen(false);
      setEditingExpense(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    }
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.bulkCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setImportExportOpen(false);
    }
  });

  const handleSave = (data) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleImport = async (data) => {
    await bulkCreateMutation.mutateAsync(data);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Unknown";
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = !search || 
      expense.title?.toLowerCase().includes(search.toLowerCase()) ||
      expense.notes?.toLowerCase().includes(search.toLowerCase());
    const matchesTransactionType = transactionTypeFilter === "all" || expense.type === transactionTypeFilter;
    const matchesClientType = clientTypeFilter === "all" || 
      (clientTypeFilter === "personal" && expense.is_personal !== false) ||
      (clientTypeFilter === "client" && expense.is_personal === false);
    const matchesClientName = clientNameFilter === "all" || expense.client_id === clientNameFilter;
    return matchesSearch && matchesTransactionType && matchesClientType && matchesClientName;
  });

  const totalIncome = filteredExpenses.filter(e => e.type === "income").reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalOutcome = filteredExpenses.filter(e => e.type === "outcome").reduce((sum, e) => sum + (e.amount || 0), 0);
  const netBalance = totalIncome - totalOutcome;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Expenses</h1>
            <p className="text-slate-500 mt-1">Track personal and client expenses</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setImportExportOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import/Export
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingExpense(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard title="Income" value={`$${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="emerald" />
          <StatsCard title="Outcome" value={`$${totalOutcome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={TrendingDown} color="amber" />
          <StatsCard title="Net Balance" value={`$${netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} subtitle={netBalance >= 0 ? "Positive" : "Negative"} icon={DollarSign} color={netBalance >= 0 ? "blue" : "purple"} />
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="outcome">Outcome</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientNameFilter} onValueChange={setClientNameFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Expenses List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        >
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No expenses found</p>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingExpense(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add your first expense
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <AnimatePresence>
                {filteredExpenses.map((expense) => (
                  <motion.div
                    key={expense.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{expense.title}</p>
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                            expense.type === "income" 
                              ? "bg-emerald-50 text-emerald-700" 
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {expense.type === "income" ? "Income" : "Outcome"}
                          </span>
                          {expense.is_personal === false && expense.client_id && (
                            <span className="shrink-0 text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                              {getClientName(expense.client_id)}
                            </span>
                          )}
                          {expense.is_personal !== false && (
                            <span className="shrink-0 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              Personal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-slate-400">
                            {format(parseISO(expense.date), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-semibold text-lg ${
                          expense.type === "income" ? "text-emerald-600" : "text-slate-900"
                        }`}>
                          {expense.type === "income" ? "+" : ""}{expense.currency || "$"}{expense.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(expense)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(expense.id)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editingExpense}
        onSave={handleSave}
        clients={clients}
      />

      <ImportExportModal
        open={importExportOpen}
        onOpenChange={setImportExportOpen}
        type="expenses"
        data={expenses}
        onImport={handleImport}
        clients={clients}
      />
    </div>
  );
}
