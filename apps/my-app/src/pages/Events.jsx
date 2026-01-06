import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isToday, isTomorrow, isPast } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MoreVertical, Pencil, Trash2, FileSpreadsheet, Calendar, Clock, MapPin, User, Briefcase, CheckCircle, XCircle, Grid3x3, CalendarDays } from "lucide-react";
import EventForm from "@/components/events/EventForm";
import ImportExportModal from "@/components/import-export/ImportExportModal";
import EventCalendar from "@/components/events/EventCalendar";
import StatsCard from "@/components/ui/StatsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Events() {
  const [formOpen, setFormOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 500)
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setFormOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setFormOpen(false);
      setEditingEvent(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.bulkCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setImportExportOpen(false);
    }
  });

  const handleSave = (data) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this event?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleStatusChange = (event, newStatus) => {
    updateMutation.mutate({ id: event.id, data: { ...event, status: newStatus } });
  };

  const handleImport = async (data) => {
    await bulkCreateMutation.mutateAsync(data);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Unknown";
  };

  const formatEventDate = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d, yyyy");
  };

  const getStatusBadge = (status) => {
    const styles = {
      upcoming: "bg-emerald-50 text-emerald-700 border-emerald-200",
      completed: "bg-slate-50 text-slate-600 border-slate-200",
      cancelled: "bg-red-50 text-red-600 border-red-200"
    };
    return styles[status] || styles.upcoming;
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = !search || 
      event.title?.toLowerCase().includes(search.toLowerCase()) ||
      event.description?.toLowerCase().includes(search.toLowerCase()) ||
      event.location?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    const matchesType = typeFilter === "all" || 
      (typeFilter === "personal" && event.is_personal !== false) ||
      (typeFilter === "client" && event.is_personal === false);
    return matchesSearch && matchesStatus && matchesType;
  });

  const upcomingCount = events.filter(e => e.status === "upcoming").length;
  const completedCount = events.filter(e => e.status === "completed").length;
  const clientEventsCount = events.filter(e => e.is_personal === false).length;

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
            <h1 className="text-3xl font-bold text-slate-900">Events</h1>
            <p className="text-slate-500 mt-1">Manage your schedule and client meetings</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setImportExportOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import/Export
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard title="Upcoming" value={upcomingCount} icon={Calendar} color="emerald" />
          <StatsCard title="Completed" value={completedCount} icon={CheckCircle} color="blue" />
          <StatsCard title="Client Events" value={clientEventsCount} icon={Briefcase} color="purple" />
        </div>

        {/* View Toggle & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Calendar
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>
        </motion.div>

        {/* Events View */}
        {viewMode === "calendar" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <EventCalendar 
              events={filteredEvents} 
              clients={clients}
              onEventClick={(event) => {
                setEditingEvent(event);
                setFormOpen(true);
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No events found</p>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add your first event
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <AnimatePresence>
                {filteredEvents.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="bg-emerald-50 text-emerald-600 rounded-xl px-3 py-2 text-center min-w-[80px]">
                        <span className="text-sm font-semibold">{formatEventDate(event.date)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">{event.title}</p>
                          <Badge variant="outline" className={getStatusBadge(event.status)}>
                            {event.status}
                          </Badge>
                          {event.is_personal === false && event.client_id && (
                            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                              {getClientName(event.client_id)}
                            </span>
                          )}
                          {event.is_personal !== false && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              Personal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 flex-wrap">
                          {event.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {event.time}
                            </span>
                          )}
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-sm text-slate-400 mt-2 line-clamp-2">{event.description}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(event)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {event.status === "upcoming" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(event, "completed")}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Complete
                            </DropdownMenuItem>
                          )}
                          {event.status === "upcoming" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(event, "cancelled")}>
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDelete(event.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          </motion.div>
        )}
      </div>

      <EventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        onSave={handleSave}
        clients={clients}
      />

      <ImportExportModal
        open={importExportOpen}
        onOpenChange={setImportExportOpen}
        type="events"
        data={events}
        onImport={handleImport}
        clients={clients}
      />
    </div>
  );
}
