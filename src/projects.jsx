
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = (
  import.meta.env.VITE_PROJECT_API_URL ||
  "https://hrmbackend.stackenzo.com/api/projects"
).replace(/\/$/, "");

const getToken = () => localStorage.getItem("hrmToken");

const formatDate = (date) => {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

function Projects() {
  const navigate = useNavigate();

  // Project list
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    project_code: "",
    description: "",
    start_date: "",
    end_date: "",
    project_head_id: "",
    members: "",
  });

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      const params = new URLSearchParams({
        status,
        search,
      });

      const response = await fetch(`${API_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch projects");
      }

      setProjects(data.projects || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error("Fetch projects error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchProjects();
    }, 300);

    return () => clearTimeout(timeout);
  }, [fetchProjects]);

  // Parse member IDs from textarea.
  // Format: UUID|PROJECT ROLE
  const parseMembers = () => {
    if (!form.members.trim()) return [];

    return form.members
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [user_id, project_role] = line.split("|").map((v) => v.trim());

        return {
          user_id,
          project_role: project_role || "MEMBER",
        };
      });
  };

  // Create project
  const handleCreateProject = async (e) => {
    e.preventDefault();

    try {
      setCreating(true);
      setCreateError("");
      setSuccessMessage("");

      const token = getToken();

      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      if (!form.name.trim()) {
        throw new Error("Project name is required");
      }

      if (!form.project_head_id.trim()) {
        throw new Error("Project head is required");
      }

      if (
        form.start_date &&
        form.end_date &&
        new Date(form.end_date) < new Date(form.start_date)
      ) {
        throw new Error("End date cannot be before start date");
      }

      const members = parseMembers();

      const payload = {
        name: form.name.trim(),
        project_code: form.project_code.trim() || null,
        description: form.description.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        project_head_id: form.project_head_id.trim(),
        members,
      };

      const response = await fetch(`${API_URL}/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to create project");
      }

      setShowCreateModal(false);

      setForm({
        name: "",
        project_code: "",
        description: "",
        start_date: "",
        end_date: "",
        project_head_id: "",
        members: "",
      });

      setSuccessMessage("Project created successfully!");

      await fetchProjects();
    } catch (err) {
      console.error("Create project error:", err);
      setCreateError(err.message || "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const openProject = (project) => {
    navigate(`/projects/${project.id}`);
  };

  const closeModal = () => {
    if (creating) return;

    setShowCreateModal(false);
    setCreateError("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-600">
              <span>Workspace</span>
              <span className="text-slate-400">/</span>
              <span>Projects</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Projects
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage projects, milestones, teams and progress.
            </p>
          </div>

          <button
            onClick={() => {
              setCreateError("");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <span className="text-lg leading-none">+</span>
            Create New Project
          </button>
        </div>

        {/* SUCCESS MESSAGE */}
        {successMessage && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage("")}
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Projects"
            value={summary?.total_projects ?? projects.length}
            icon="▦"
            color="indigo"
          />

          <SummaryCard
            title="Active Projects"
            value={
              summary?.active_projects ??
              projects.filter((p) => p.is_active).length
            }
            icon="◉"
            color="green"
          />

          <SummaryCard
            title="Inactive Projects"
            value={
              summary?.inactive_projects ??
              projects.filter((p) => !p.is_active).length
            }
            icon="○"
            color="orange"
          />

          <SummaryCard
            title="Total Members"
            value={
              summary?.total_members ??
              projects.reduce(
                (total, p) => total + Number(p.total_members || 0),
                0
              )
            }
            icon="♙"
            color="blue"
          />
        </div>

        {/* SEARCH AND FILTER */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div className="relative w-full md:max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                ⌕
              </span>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by project name or code..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {["ALL", "ACTIVE", "INACTIVE"].map((item) => (
                <button
                  key={item}
                  onClick={() => setStatus(item)}
                  className={`rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
                    status === item
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item === "ALL"
                    ? "All Projects"
                    : item === "ACTIVE"
                    ? "Active"
                    : "Inactive"}
                </button>
              ))}

              <button
                onClick={fetchProjects}
                disabled={loading}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                title="Refresh projects"
              >
                ↻
              </button>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              onClick={fetchProjects}
              className="mt-2 text-sm font-semibold text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* PROJECT LIST HEADER */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              All Projects
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {projects.length} project{projects.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="mb-5 h-10 w-10 rounded-xl bg-slate-200" />
                <div className="mb-3 h-5 w-2/3 rounded bg-slate-200" />
                <div className="mb-6 h-3 w-full rounded bg-slate-100" />
                <div className="mb-3 h-3 w-1/2 rounded bg-slate-100" />
                <div className="h-10 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : !error && projects.length === 0 ? (
          /* EMPTY STATE */
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl text-indigo-600">
              ▦
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              No projects found
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              {search
                ? "Try a different search term or change the filters."
                : "There are no projects available in your workspace yet."}
            </p>

            {!search && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create your first project
              </button>
            )}
          </div>
        ) : (
          /* PROJECT CARDS */
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => openProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      {/* CREATE PROJECT MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Create New Project
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Add project details and assign your team.
                </p>
              </div>

              <button
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            {/* MODAL FORM */}
            <form onSubmit={handleCreateProject}>
              <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">

                {createError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {createError}
                  </div>
                )}

                {/* PROJECT NAME */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Project Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    placeholder="Example: Stackenzo HRM Platform"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                {/* PROJECT CODE */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Project Code
                  </label>

                  <input
                    type="text"
                    value={form.project_code}
                    onChange={(e) =>
                      updateForm("project_code", e.target.value)
                    }
                    placeholder="Example: STK-HRM-001"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Description
                  </label>

                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      updateForm("description", e.target.value)
                    }
                    placeholder="Describe the project..."
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                {/* DATES */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Start Date
                    </label>

                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        updateForm("start_date", e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      End Date
                    </label>

                    <input
                      type="date"
                      min={form.start_date || undefined}
                      value={form.end_date}
                      onChange={(e) =>
                        updateForm("end_date", e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* PROJECT HEAD */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Project Head User ID{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    required
                    value={form.project_head_id}
                    onChange={(e) =>
                      updateForm("project_head_id", e.target.value)
                    }
                    placeholder="Enter project head UUID"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />

                  <p className="mt-1 text-xs text-slate-400">
                    The project head is automatically added as a project member.
                  </p>
                </div>

                {/* MEMBERS */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Project Members
                  </label>

                  <textarea
                    rows={4}
                    value={form.members}
                    onChange={(e) =>
                      updateForm("members", e.target.value)
                    }
                    placeholder={`Enter one member per line:\nUSER_UUID|DEVELOPER\nUSER_UUID|DESIGNER\nUSER_UUID|TESTER`}
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 font-mono text-xs outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Format: USER_UUID | PROJECT_ROLE. Leave empty if you only
                    want to assign the project head.
                  </p>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={creating}
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Creating Project..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// SUMMARY CARD
function SummaryCard({ title, value, icon, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${
            colors[color]
          }`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        {value ?? 0}
      </p>
    </div>
  );
}

// PROJECT CARD
function ProjectCard({ project, onClick }) {
  const active = Boolean(project.is_active);

  const progress = Math.min(
    100,
    Math.max(0, Number(project.progress_percentage || 0))
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
    >
      {/* CARD TOP */}
      <div className="mb-5 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-xl font-bold text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
          {getInitials(project.name) || "P"}
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            active
              ? "bg-green-50 text-green-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* NAME */}
      <div className="mb-2">
        <h3 className="line-clamp-1 text-lg font-bold text-slate-900 transition group-hover:text-indigo-600">
          {project.name}
        </h3>

        {project.project_code && (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            {project.project_code}
          </p>
        )}
      </div>

      {/* DESCRIPTION */}
      <p className="mb-5 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-500">
        {project.description || "No project description available."}
      </p>

      {/* PROJECT HEAD */}
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
          {getInitials(project.project_head_name) || "PH"}
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Project Head
          </p>

          <p className="truncate text-sm font-semibold text-slate-700">
            {project.project_head_name || "Not assigned"}
          </p>
        </div>
      </div>

      {/* PROJECT PROGRESS */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Project Progress
          </span>

          <span className="text-xs font-bold text-slate-700">
            {progress}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* PROJECT INFORMATION */}
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs text-slate-400">Team Members</p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            {project.total_members ?? 0}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400">Tasks</p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            {project.total_tasks ?? 0}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400">Start Date</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">
            {formatDate(project.start_date)}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400">End Date</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">
            {formatDate(project.end_date)}
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs font-semibold text-indigo-600">
          View Project Details
        </span>

        <span className="text-lg text-indigo-600 transition group-hover:translate-x-1">
          →
        </span>
      </div>
    </button>
  );
}

export default Projects;
