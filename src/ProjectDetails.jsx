import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Clock3,
  Users,
  UserRound,
  FolderKanban,
  ListChecks,
  X,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Target,
  BriefcaseBusiness,
} from "lucide-react";

// Set VITE_PROJECT_API_URL to your API root, e.g. http://localhost:4000/api
// This component uses:
// GET  /projects/:projectId/overview
// GET  /checklist/:projectId/timeline
// POST /checklist/:projectId
// POST /checklist/:projectId/items
const API_ROOT = (
  import.meta.env.VITE_PROJECT_API_URL || "https://hrmbackend.stackenzo.com/api"
).replace(/\/$/, "");

const getToken = () => localStorage.getItem("hrmToken");

const getProgress = (value) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
};

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || data.error || `Request failed (${response.status})`
    );
  }
  return data;
}

function ProgressBar({ value = 0, height = "h-2" }) {
  const progress = getProgress(value);
  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${height}`}>
      <div
        className="h-full rounded-full bg-indigo-600 transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Icon size={20} />
        </div>
        <span className="text-xs font-medium text-slate-400">{description}</span>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function MemberProgress({ member }) {
  const progress = getProgress(member.progress_percentage);
  const name = member.full_name || member.name || "Unknown member";

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
          {getInitials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
          <p className="truncate text-xs text-slate-500">
            {member.job_title || member.employee_code || member.email || "Team member"}
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-indigo-700">
          {progress}%
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar value={progress} height="h-1.5" />
      </div>
      {member.update_message && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {member.update_message}
        </p>
      )}
      {member.pending_reason && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Pending: {member.pending_reason}
        </p>
      )}
    </div>
  );
}

function ChecklistCard({ item }) {
  const progress = getProgress(item.progress_percentage);
  const assignees = Array.isArray(item.assignees) ? item.assignees : [];
  const completed = item.is_completed || progress >= 100;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 rounded-lg p-2 ${
            completed
              ? "bg-emerald-50 text-emerald-600"
              : "bg-indigo-50 text-indigo-600"
          }`}
        >
          {completed ? <CheckCircle2 size={19} /> : <ListChecks size={19} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900">{item.title}</h4>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                completed
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-indigo-50 text-indigo-700"
              }`}
            >
              {completed ? "Completed" : `${progress}% complete`}
            </span>
          </div>
          {item.description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {item.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} />
              Start: {formatDate(item.start_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} />
              Due: {formatDate(item.due_date)}
            </span>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs">
              <span className="font-medium text-slate-500">Checklist progress</span>
              <span className="font-bold text-slate-700">{progress}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users size={16} className="text-slate-400" />
            Assigned members
          </h5>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {assignees.length} {assignees.length === 1 ? "member" : "members"}
          </span>
        </div>
        {assignees.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {assignees.map((member, index) => (
              <MemberProgress
                key={member.id || member.user_id || index}
                member={member}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No members assigned to this checklist item.
          </p>
        )}
      </div>
    </article>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      {label && (
        <label className="mb-2 block text-xs font-semibold text-slate-600">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [expandedMilestoneId, setExpandedMilestoneId] = useState(null);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showChecklistFormFor, setShowChecklistFormFor] = useState(null);
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [creatingChecklist, setCreatingChecklist] = useState(false);
  const [formError, setFormError] = useState("");

  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    description: "",
    weight: "",
    assigned_to: "",
    start_date: "",
    due_date: "",
  });

  const [checklistForm, setChecklistForm] = useState({
    title: "",
    description: "",
    start_date: "",
    due_date: "",
    assignees: "",
  });

  const fetchProjectDetails = useCallback(async ({ silent = false } = {}) => {
    if (!projectId) {
      setError("Project ID is missing from the URL.");
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setError("Your login session is missing. Please sign in again.");
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [overviewResponse, timelineResponse] = await Promise.all([
        fetch(`${API_ROOT}/projects/${projectId}/overview`, { headers }),
        fetch(`${API_ROOT}/checklist/${projectId}/timeline`, { headers }),
      ]);

      const [overviewData, timelineData] = await Promise.all([
        readResponse(overviewResponse),
        readResponse(timelineResponse),
      ]);

      setProject(overviewData.project || null);
      setTimeline(timelineData);
    } catch (err) {
      console.error("Project details fetch error:", err);
      setError(err.message || "Unable to load project details.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  const milestones = useMemo(
    () => (Array.isArray(timeline?.milestones) ? timeline.milestones : []),
    [timeline]
  );

  const summary = timeline?.summary || {};
  const overallProgress = getProgress(
    summary.project_progress_percentage ?? project?.progress_percentage
  );

  // Use member arrays if the API returns them. Otherwise the form accepts UUIDs,
  // because the supplied project/timeline responses do not define a members list.
  const availableMembers = useMemo(() => {
    const candidates = [
      project?.members,
      project?.project_members,
      timeline?.members,
      timeline?.project?.members,
      timeline?.project_members,
    ];
    const found = candidates.find(Array.isArray);
    return found || [];
  }, [project, timeline]);

  const memberOptions = useMemo(
    () =>
      availableMembers
        .map((member) => ({
          id: member.user_id || member.id,
          name: member.full_name || member.name || member.employee_code || "Team member",
          employee_code: member.employee_code,
          email: member.email,
          job_title: member.job_title,
        }))
        .filter((member) => member.id),
    [availableMembers]
  );

  const handleCreateMilestone = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!milestoneForm.assigned_to.trim()) {
      setFormError("Select or enter the milestone owner's user UUID.");
      return;
    }

    try {
      setCreatingMilestone(true);
      const response = await fetch(`${API_ROOT}/milestones/${projectId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: milestoneForm.title.trim(),
          description: milestoneForm.description.trim() || null,
          weight: Number(milestoneForm.weight),
          assigned_to: milestoneForm.assigned_to.trim(),
          start_date: milestoneForm.start_date || null,
          due_date: milestoneForm.due_date || null,
        }),
      });

      await readResponse(response);
      setShowMilestoneForm(false);
      setMilestoneForm({
        title: "",
        description: "",
        weight: "",
        assigned_to: "",
        start_date: "",
        due_date: "",
      });
      setNotice("Milestone created successfully.");
      await fetchProjectDetails({ silent: true });
    } catch (err) {
      setFormError(err.message || "Failed to create milestone.");
    } finally {
      setCreatingMilestone(false);
    }
  };

  const handleCreateChecklist = async (event, milestone) => {
    event.preventDefault();
    setFormError("");

    const assignees = [
      ...new Set(
        checklistForm.assignees
          .split(/[\n,;]+/)
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ];

    if (!assignees.length) {
      setFormError("Assign at least one active project member.");
      return;
    }

    try {
      setCreatingChecklist(true);
      const response = await fetch(`${API_ROOT}/checklist/${projectId}/items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: checklistForm.title.trim(),
          description: checklistForm.description.trim() || null,
          start_date: checklistForm.start_date || null,
          due_date: checklistForm.due_date || null,
          sequence_order: (milestone.items?.length || 0) + 1,
          assignees,
          milestone_id: milestone.id,
        }),
      });

      await readResponse(response);
      setShowChecklistFormFor(null);
      setChecklistForm({
        title: "",
        description: "",
        start_date: "",
        due_date: "",
        assignees: "",
      });
      setNotice("Checklist created and assigned to the selected milestone.");
      setExpandedMilestoneId(milestone.id);
      await fetchProjectDetails({ silent: true });
    } catch (err) {
      setFormError(err.message || "Failed to create checklist.");
    } finally {
      setCreatingChecklist(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            Loading project details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-5 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600"
          >
            <ArrowLeft size={17} />
            Back to Projects
          </button>
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto text-red-500" size={36} />
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              Unable to load project
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
              {error}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => fetchProjectDetails()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <RefreshCw size={16} />
                Try again
              </button>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center">
        <h2 className="text-lg font-bold text-slate-900">Project not found</h2>
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="mt-4 text-sm font-semibold text-indigo-600"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const projectName = project.name || "Untitled project";
  const totalWeight = milestones.reduce(
    (sum, milestone) => sum + Number(milestone.weight || 0),
    0
  );
  const remainingWeight = Math.max(0, 100 - totalWeight);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-indigo-600"
        >
          <ArrowLeft size={17} />
          Back to Projects
        </button>

        {/* Project header */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 bg-indigo-600" />
          <div className="p-5 sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
              <div className="flex min-w-0 gap-4">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 sm:flex">
                  <FolderKanban size={27} />
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {project.project_code && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tracking-wide text-slate-600">
                        {project.project_code}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        project.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {project.is_active ? "Active project" : "Inactive project"}
                    </span>
                  </div>
                  <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {projectName}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                    {project.description || "No project description available."}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-indigo-50 p-4">
                <div className="rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm">
                  <Target size={22} />
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-600">Overall progress</p>
                  <p className="text-2xl font-bold text-indigo-900">
                    {overallProgress}%
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Project completion</span>
                <span className="text-indigo-700">{overallProgress}%</span>
              </div>
              <ProgressBar value={overallProgress} height="h-3" />
            </div>

            <div className="mt-7 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
                  <UserRound size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Project head</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {project.project_head_name || "Not assigned"}
                  </p>
                  {project.project_head_job_title && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {project.project_head_job_title}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
                  <CalendarDays size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Start date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {formatDate(project.start_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">End date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {formatDate(project.end_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Project members</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {project.total_members ?? memberOptions.length ?? 0} members
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Target}
            label="Milestones"
            value={summary.total_milestones ?? milestones.length}
            description="Total"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed milestones"
            value={summary.completed_milestones ?? 0}
            description="Completed"
          />
          <StatCard
            icon={ListChecks}
            label="Checklist items"
            value={summary.total_checklist_items ?? 0}
            description="Total"
          />
          <StatCard
            icon={BriefcaseBusiness}
            label="Completed checklist items"
            value={summary.completed_checklist_items ?? 0}
            description="Completed"
          />
        </div>

        {/* Milestone section */}
        <section className="mt-9">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Project milestones</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add milestones, expand them, and manage their checklists inline.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                {milestones.length} milestones
              </span>
              <button
                type="button"
                onClick={() => {
                  setFormError("");
                  setNotice("");
                  setShowMilestoneForm((value) => !value);
                  setShowChecklistFormFor(null);
                }}
                disabled={!project.is_active}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={17} />
                Add Milestone
              </button>
            </div>
          </div>

          {notice && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={17} />
                {notice}
              </span>
              <button type="button" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Create milestone form */}
          {showMilestoneForm && (
            <div className="mb-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Create milestone</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Total milestone weight cannot exceed 100%.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMilestoneForm(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                  aria-label="Close milestone form"
                >
                  <X size={19} />
                </button>
              </div>

              <form onSubmit={handleCreateMilestone} className="space-y-4">
                <Field label="Milestone title">
                  <input
                    required
                    maxLength={255}
                    className={inputClass}
                    placeholder="e.g. Backend Development"
                    value={milestoneForm.title}
                    onChange={(event) =>
                      setMilestoneForm((old) => ({ ...old, title: event.target.value }))
                    }
                  />
                </Field>

                <Field label="Description">
                  <textarea
                    rows={3}
                    className={inputClass}
                    placeholder="Describe the milestone..."
                    value={milestoneForm.description}
                    onChange={(event) =>
                      setMilestoneForm((old) => ({
                        ...old,
                        description: event.target.value,
                      }))
                    }
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Weight (%)"
                    hint={`Available weight: ${remainingWeight.toFixed(2)}%`}
                  >
                    <input
                      required
                      type="number"
                      min="0.01"
                      max={remainingWeight}
                      step="0.01"
                      className={inputClass}
                      placeholder="e.g. 25"
                      value={milestoneForm.weight}
                      onChange={(event) =>
                        setMilestoneForm((old) => ({ ...old, weight: event.target.value }))
                      }
                    />
                  </Field>

                  <Field
                    label="Responsible member"
                    hint={
                      memberOptions.length
                        ? "Choose an active member of this project."
                        : "Enter the UUID of an active project member."
                    }
                  >
                    {memberOptions.length ? (
                      <select
                        required
                        className={inputClass}
                        value={milestoneForm.assigned_to}
                        onChange={(event) =>
                          setMilestoneForm((old) => ({
                            ...old,
                            assigned_to: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select responsible member</option>
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                            {member.employee_code ? ` (${member.employee_code})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        className={inputClass}
                        placeholder="Project member user UUID"
                        value={milestoneForm.assigned_to}
                        onChange={(event) =>
                          setMilestoneForm((old) => ({
                            ...old,
                            assigned_to: event.target.value,
                          }))
                        }
                      />
                    )}
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Start date">
                    <input
                      type="date"
                      className={inputClass}
                      value={milestoneForm.start_date}
                      onChange={(event) =>
                        setMilestoneForm((old) => ({
                          ...old,
                          start_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Due date">
                    <input
                      type="date"
                      min={milestoneForm.start_date || undefined}
                      className={inputClass}
                      value={milestoneForm.due_date}
                      onChange={(event) =>
                        setMilestoneForm((old) => ({
                          ...old,
                          due_date: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                {formError && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMilestoneForm(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingMilestone || remainingWeight <= 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingMilestone && <Loader2 size={16} className="animate-spin" />}
                    Create milestone
                  </button>
                </div>
              </form>
            </div>
          )}

          {milestones.length ? (
            <div className="space-y-4">
              {milestones.map((milestone, index) => {
                const expanded = expandedMilestoneId === milestone.id;
                const items = Array.isArray(milestone.items) ? milestone.items : [];
                const progress = getProgress(milestone.progress_percentage);
                const isCompleted = milestone.is_completed || progress >= 100;
                const checklistFormOpen = showChecklistFormFor === milestone.id;

                return (
                  <article
                    key={milestone.id || index}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMilestoneId(expanded ? null : milestone.id);
                        setShowChecklistFormFor(null);
                        setFormError("");
                      }}
                      className="w-full p-5 text-left transition hover:bg-slate-50 sm:p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 size={21} /> : String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-bold text-slate-900">{milestone.title}</h3>
                            <div className="flex items-center gap-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  isCompleted
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-indigo-50 text-indigo-700"
                                }`}
                              >
                                {isCompleted ? "Completed" : `${progress}%`}
                              </span>
                              {expanded ? (
                                <ChevronUp size={19} className="text-slate-400" />
                              ) : (
                                <ChevronDown size={19} className="text-slate-400" />
                              )}
                            </div>
                          </div>

                          {milestone.description && (
                            <p className="mt-1 text-sm text-slate-500">
                              {milestone.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays size={14} />
                              {formatDate(milestone.start_date)} – {formatDate(milestone.due_date)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <ListChecks size={14} />
                              {milestone.completed_items ?? 0}/{milestone.total_items ?? items.length} completed
                            </span>
                            <span>Weight: {milestone.weight ?? 0}%</span>
                            {milestone.assigned_to_name && (
                              <span className="inline-flex items-center gap-1.5">
                                <UserRound size={14} />
                                {milestone.assigned_to_name}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 flex items-center gap-3">
                            <div className="flex-1">
                              <ProgressBar value={progress} />
                            </div>
                            <span className="w-11 text-right text-xs font-bold text-slate-700">
                              {progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Inline checklist area */}
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50 p-4 sm:p-6">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-slate-900">Milestone checklist</h4>
                            <p className="mt-1 text-xs text-slate-500">
                              Each checklist item can have multiple assigned members.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={milestone.is_completed || !project.is_active}
                            onClick={() => {
                              setFormError("");
                              setChecklistForm({
                                title: "",
                                description: "",
                                start_date: "",
                                due_date: "",
                                assignees: "",
                              });
                              setShowChecklistFormFor(checklistFormOpen ? null : milestone.id);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus size={16} />
                            Add Checklist
                          </button>
                        </div>

                        {checklistFormOpen && (
                          <form
                            onSubmit={(event) => handleCreateChecklist(event, milestone)}
                            className="mb-5 space-y-4 rounded-2xl border border-indigo-100 bg-white p-5"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="font-bold text-slate-900">New checklist item</h5>
                                <p className="mt-1 text-xs text-slate-500">
                                  This item will be created directly under “{milestone.title}”.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowChecklistFormFor(null)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                                aria-label="Close checklist form"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            <Field label="Checklist title">
                              <input
                                required
                                maxLength={255}
                                className={inputClass}
                                placeholder="e.g. Create authentication APIs"
                                value={checklistForm.title}
                                onChange={(event) =>
                                  setChecklistForm((old) => ({
                                    ...old,
                                    title: event.target.value,
                                  }))
                                }
                              />
                            </Field>

                            <Field label="Description">
                              <textarea
                                rows={2}
                                className={inputClass}
                                placeholder="Describe what needs to be completed..."
                                value={checklistForm.description}
                                onChange={(event) =>
                                  setChecklistForm((old) => ({
                                    ...old,
                                    description: event.target.value,
                                  }))
                                }
                              />
                            </Field>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <Field label="Start date">
                                <input
                                  type="date"
                                  className={inputClass}
                                  value={checklistForm.start_date}
                                  onChange={(event) =>
                                    setChecklistForm((old) => ({
                                      ...old,
                                      start_date: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                              <Field label="Due date">
                                <input
                                  type="date"
                                  min={checklistForm.start_date || undefined}
                                  className={inputClass}
                                  value={checklistForm.due_date}
                                  onChange={(event) =>
                                    setChecklistForm((old) => ({
                                      ...old,
                                      due_date: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                            </div>

                            <Field
                              label="Assign members (user UUIDs)"
                              hint={
                                memberOptions.length
                                  ? "Enter one or more member UUIDs separated by commas or new lines."
                                  : "Paste the UUIDs of active project members, separated by commas or new lines."
                              }
                            >
                              <textarea
                                required
                                rows={3}
                                className={`${inputClass} font-mono text-xs`}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                value={checklistForm.assignees}
                                onChange={(event) =>
                                  setChecklistForm((old) => ({
                                    ...old,
                                    assignees: event.target.value,
                                  }))
                                }
                              />
                            </Field>

                            {formError && (
                              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                                {formError}
                              </p>
                            )}

                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => setShowChecklistFormFor(null)}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={creatingChecklist}
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {creatingChecklist && <Loader2 size={16} className="animate-spin" />}
                                Save checklist
                              </button>
                            </div>
                          </form>
                        )}

                        {items.length ? (
                          <div className="space-y-4">
                            {items.map((item, itemIndex) => (
                              <ChecklistCard key={item.id || itemIndex} item={item} />
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                            <ListChecks size={32} className="mx-auto text-slate-300" />
                            <p className="mt-3 font-semibold text-slate-700">
                              No checklist items yet
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Add the first checklist item for this milestone.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
              <FolderKanban className="mx-auto text-slate-300" size={38} />
              <h3 className="mt-3 font-bold text-slate-800">No milestones found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create your first milestone to start planning this project.
              </p>
            </div>
          )}
        </section>

        {/* Project-level checklist, if the API returns any */}
        {Array.isArray(timeline?.project_level_items) &&
          timeline.project_level_items.length > 0 && (
            <section className="mt-9">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Project-level checklist
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Checklist items that are not assigned to a milestone.
                </p>
              </div>
              <div className="space-y-4">
                {timeline.project_level_items.map((item, index) => (
                  <ChecklistCard key={item.id || index} item={item} />
                ))}
              </div>
            </section>
          )}

        <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
          <Circle size={8} className="fill-emerald-500 text-emerald-500" />
          Project data is loaded from your HRM backend.
        </div>
      </div>
    </div>
  );
}

export default ProjectDetails;
