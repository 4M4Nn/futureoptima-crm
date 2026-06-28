import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, RefreshCw, Bot, Phone, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../utils/api";
import { COURSES, LEAD_STATUSES, LEAD_SOURCES, fmtDate } from "../../utils/constants";
import { GradeBadge, StatusBadge, LoadingState, EmptyState, Pagination, Modal, ConfirmDialog } from "../../components/ui/index";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";

const COURSE_OPTS = Object.entries(COURSES).map(([value, label]) => ({ value, label }));
const STATUS_OPTS = LEAD_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, " ") }));
const SOURCE_OPTS = LEAD_SOURCES.map(s => ({ value: s, label: s.replace(/_/g, " ") }));
const GRADE_OPTS = [{ value: "HOT", label: "Hot" }, { value: "WARM", label: "Warm" }, { value: "COLD", label: "Cold" }, { value: "UNQUALIFIED", label: "Unqualified" }];

function AddLeadModal({ open, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [source, setSource] = useState("WALK_IN");
  const [interestedCourse, setInterestedCourse] = useState("");
  const [budget, setBudget] = useState("");
  const [expectedJoinDate, setExpectedJoinDate] = useState("");

  const mutation = useMutation({
    mutationFn: (data) => api.post("/leads", data).then(r => r.data),
    onSuccess: () => {
      toast.success("Lead added! AI scoring in progress...");
      qc.invalidateQueries(["leads"]);
      onClose();
      setName(""); setPhone(""); setEmail(""); setCity(""); setSource("WALK_IN"); setInterestedCourse(""); setBudget(""); setExpectedJoinDate("");
    },
    onError: (e) => {
      console.log("Error:", e);
      toast.error(e?.error || e?.message || "Failed to add lead");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!phone.trim()) return toast.error("Phone is required");
    mutation.mutate({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, city: city.trim() || undefined, source: source || "OTHER", interestedCourse: interestedCourse || undefined, status: "NEW", budget: budget ? Number(budget) : undefined, expectedJoinDate: expectedJoinDate ? new Date(expectedJoinDate).toISOString() : undefined });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Lead" size="lg">
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Full Name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Arjun Menon" />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="arjun@email.com" type="email" />
        </div>
        <div>
          <label className="label">City</label>
          <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Kochi" />
        </div>
        <div>
          <label className="label">Lead Source</label>
          <select className="input" value={source} onChange={e => setSource(e.target.value)}>
            {SOURCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Interested Course</label>
          <select className="input" value={interestedCourse} onChange={e => setInterestedCourse(e.target.value)}>
            <option value="">Select course...</option>
            {COURSE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Budget (₹)</label>
          <input className="input" type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="50000" min="0" />
        </div>
        <div>
          <label className="label">Expected Join Date</label>
          <input className="input" type="date" value={expectedJoinDate} onChange={e => setExpectedJoinDate(e.target.value)} />
        </div>
        <div className="col-span-2 flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Adding..." : "+ Add Lead"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function LeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: "", course: "", grade: "", source: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [deleteLead, setDeleteLead] = useState(null);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  const params = new URLSearchParams({ page, limit: 25, ...(search ? { search } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
  const { data, isLoading } = useQuery({ queryKey: ["leads", page, search, filters], queryFn: () => api.get("/leads?" + params).then(r => r.data), keepPreviousData: true });

  const batchScore = async () => {
    await api.post("/ai/batch-score");
    toast.success("AI scoring started!");
    setTimeout(() => qc.invalidateQueries(["leads"]), 3000);
  };

  const deleteLeadMutation = useMutation({
    mutationFn: (id) => api.delete(`/leads/${id}`),
    onSuccess: () => { toast.success("Lead deleted"); qc.invalidateQueries(["leads"]); setDeleteLead(null); },
    onError: (e) => toast.error(e?.response?.data?.error || "Delete failed"),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Lead Management</h1>
          <p className="text-gray-500 text-sm">{data?.pagination?.total?.toLocaleString("en-IN") || 0} total leads</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={batchScore} className="btn-secondary text-sm"><Bot className="w-4 h-4" />Score All</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" />Add Lead</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search name, phone, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-auto" value={filters.status} onChange={e => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}>
            <option value="">All Status</option>
            {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input w-auto" value={filters.course} onChange={e => { setFilters(p => ({ ...p, course: e.target.value })); setPage(1); }}>
            <option value="">All Courses</option>
            {COURSE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input w-auto" value={filters.grade} onChange={e => { setFilters(p => ({ ...p, grade: e.target.value })); setPage(1); }}>
            <option value="">All Grades</option>
            {GRADE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => { setSearch(""); setFilters({ status: "", course: "", grade: "", source: "" }); setPage(1); }} className="btn-secondary text-sm">
            <RefreshCw className="w-4 h-4" />Reset
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name & Contact", "Course Interest", "Source", "Status", "AI Grade", "Follow-up", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}><LoadingState /></td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={7}><EmptyState title="No leads found" description="Add your first lead" action={<button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">Add Lead</button>} /></td></tr>
              ) : data.data.map((lead, i) => (
                <motion.tr key={lead.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="table-row">
                  <td className="px-4 py-3">
                    <Link to={"/leads/" + lead.id} className="font-semibold text-gray-900 hover:text-primary-600 text-sm">{lead.name}</Link>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><Phone className="w-3 h-3" />{lead.phone}</div>
                    {lead.city && <div className="text-xs text-gray-400">{lead.city}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{lead.interestedCourse ? COURSES[lead.interestedCourse] || lead.interestedCourse.replace(/_/g, " ") : <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{lead.source?.replace(/_/g, " ") || "-"}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3"><GradeBadge grade={lead.aiGrade} score={lead.aiScore} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{lead.nextFollowUpAt ? fmtDate(lead.nextFollowUpAt) : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={"/leads/" + lead.id} className="text-xs text-primary-600 hover:underline font-medium">View</Link>
                      {isAdmin && (
                        <button onClick={() => setDeleteLead(lead)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete lead">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && (
          <div className="px-4 pb-4"><Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onPage={setPage} /></div>
        )}
      </div>

      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} />
      <ConfirmDialog
        open={!!deleteLead}
        onClose={() => setDeleteLead(null)}
        onConfirm={() => deleteLeadMutation.mutate(deleteLead?.id)}
        loading={deleteLeadMutation.isPending}
        danger
        title={`Delete lead — ${deleteLead?.name}?`}
        message={`Phone: ${deleteLead?.phone}\n\nThis will permanently delete the lead and all associated notes, tasks, and call logs. This cannot be undone.`}
        confirmLabel="Delete Lead"
      />
    </div>
  );
}