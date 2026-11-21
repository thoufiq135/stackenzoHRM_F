
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE =
    import.meta.env.VITE_API_URL ||
    "https://hrmbackend.stackenzo.com/api";

const LIMIT = 20;

const STATUS_OPTIONS = [
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED"
];

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

const formatStatus = (value) =>
    (value || "UNKNOWN")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

const statusStyle = {
    ASSIGNED: "bg-amber-50 text-amber-700",
    IN_PROGRESS: "bg-blue-50 text-blue-700",
    COMPLETED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-600"
};

const priorityStyle = {
    HIGH: "bg-red-50 text-red-700",
    MEDIUM: "bg-amber-50 text-amber-700",
    LOW: "bg-emerald-50 text-emerald-700"
};

function TaskManagement() {
    const navigate = useNavigate();

    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [summary, setSummary] = useState({});
    const [pagination, setPagination] = useState({});

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [priority, setPriority] = useState("");
    const [page, setPage] = useState(1);

    const [selectedTask, setSelectedTask] = useState(null);
    const [showCreate, setShowCreate] = useState(false);

    const [form, setForm] = useState({
        title: "",
        description: "",
        priority: "MEDIUM",
        start_at: "",
        deadline_at: "",
        acknowledgment_deadline: "",
        assignees: []
    });

    const token = localStorage.getItem("hrmToken");

    const authHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT)
            });

            if (search.trim()) params.set("search", search.trim());
            if (status) params.set("status", status);
            if (priority) params.set("priority", priority);

            const response = await fetch(
                `${API_BASE}/task/all?${params.toString()}`,
                { headers: authHeaders }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("hrmToken");
                navigate("/login", { replace: true });
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to fetch tasks");
            }

            setTasks(data.tasks || []);
            setSummary(data.summary || {});
            setPagination(data.pagination || {});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, search, status, priority]);

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await fetch(
                `${API_BASE}/user/dashboard?status=ALL&page=1&limit=100`,
                { headers: authHeaders }
            );

            const data = await response.json();

            if (response.ok && data.success) {
                setEmployees(data.employees?.list || []);
            }
        } catch (err) {
            console.error("Employee fetch error:", err);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const updateForm = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const toggleAssignee = (id) => {
        setForm(prev => ({
            ...prev,
            assignees: prev.assignees.includes(id)
                ? prev.assignees.filter(item => item !== id)
                : [...prev.assignees, id]
        }));
    };

    const createTask = async (event) => {
        event.preventDefault();

        if (!form.title.trim()) {
            setError("Task title is required.");
            return;
        }

        if (!form.deadline_at) {
            setError("Task deadline is required.");
            return;
        }

        if (!form.assignees.length) {
            setError("Select at least one employee.");
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const toISO = value =>
                value ? new Date(value).toISOString() : null;

            const payload = {
                tasks: [{
                    title: form.title.trim(),
                    description: form.description.trim(),
                    priority: form.priority,
                    start_at: toISO(form.start_at),
                    deadline_at: toISO(form.deadline_at),
                    acknowledgment_deadline: toISO(
                        form.acknowledgment_deadline
                    ),
                    assignees: form.assignees
                }]
            };

            const response = await fetch(
                `${API_BASE}/create-bulk`,
                {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Task creation failed");
            }

            setShowCreate(false);

            setForm({
                title: "",
                description: "",
                priority: "MEDIUM",
                start_at: "",
                deadline_at: "",
                acknowledgment_deadline: "",
                assignees: []
            });

            setSuccess("Task created and assigned successfully.");

            setPage(1);
            await fetchTasks();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const statCards = [
        {
            label: "Total Tasks",
            value: summary.total_tasks,
            color: "text-slate-900"
        },
        {
            label: "Assigned",
            value: summary.assigned,
            color: "text-amber-600"
        },
        {
            label: "In Progress",
            value: summary.in_progress,
            color: "text-blue-600"
        },
        {
            label: "Completed",
            value: summary.completed,
            color: "text-emerald-600"
        },
        {
            label: "Overdue",
            value: summary.overdue,
            color: "text-red-600"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50">

            {/* HEADER */}
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-[1600px] mx-auto px-5 md:px-8 py-5
                    flex flex-col md:flex-row md:items-center
                    justify-between gap-4">

                    <div>
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="text-xs text-slate-400 hover:text-slate-800 mb-2"
                        >
                            ← Back to Dashboard
                        </button>

                        <h1 className="text-2xl font-bold text-slate-900">
                            Task Management
                        </h1>

                        <p className="text-sm text-slate-500 mt-1">
                            Manage tasks, assignments and employee progress.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => navigate("/projects")}
                            className="px-4 py-2.5 border border-slate-300
                                rounded-lg text-sm font-medium
                                hover:bg-slate-50"
                        >
                            + Create Project
                        </button>

                        <button
                            onClick={() => {
                                setError("");
                                setShowCreate(true);
                            }}
                            className="px-4 py-2.5 bg-slate-950 text-white
                                rounded-lg text-sm font-medium
                                hover:bg-indigo-700"
                        >
                            + Create Task
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-5 md:p-8">

                {error && (
                    <div className="mb-5 p-4 bg-red-50 border border-red-200
                        text-red-700 rounded-lg text-sm flex justify-between">
                        {error}
                        <button onClick={() => setError("")}>×</button>
                    </div>
                )}

                {success && (
                    <div className="mb-5 p-4 bg-emerald-50 border
                        border-emerald-200 text-emerald-700 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {/* SUMMARY */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-7">
                    {statCards.map(item => (
                        <div
                            key={item.label}
                            className="bg-white border border-slate-200
                                rounded-xl p-5"
                        >
                            <p className="text-xs text-slate-500">
                                {item.label}
                            </p>
                            <h2 className={`text-3xl font-bold mt-3 ${item.color}`}>
                                {item.value ?? 0}
                            </h2>
                        </div>
                    ))}
                </div>

                {/* TASK LIST */}
                <section className="bg-white border border-slate-200 rounded-xl">

                    <div className="p-5 border-b border-slate-100">
                        <div className="flex flex-col lg:flex-row
                            lg:items-center justify-between gap-4">

                            <div>
                                <h2 className="font-semibold text-slate-900">
                                    All Tasks
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    {pagination.total_records || 0} task records
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">

                                <input
                                    value={search}
                                    onChange={e => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search tasks..."
                                    className="h-10 px-3 border border-slate-200
                                        rounded-lg text-sm outline-none
                                        focus:border-slate-500"
                                />

                                <select
                                    value={status}
                                    onChange={e => {
                                        setStatus(e.target.value);
                                        setPage(1);
                                    }}
                                    className="h-10 px-3 border border-slate-200
                                        rounded-lg text-sm bg-white"
                                >
                                    <option value="">All statuses</option>
                                    {STATUS_OPTIONS.map(item => (
                                        <option key={item} value={item}>
                                            {formatStatus(item)}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={priority}
                                    onChange={e => {
                                        setPriority(e.target.value);
                                        setPage(1);
                                    }}
                                    className="h-10 px-3 border border-slate-200
                                        rounded-lg text-sm bg-white"
                                >
                                    <option value="">All priorities</option>
                                    {PRIORITIES.map(item => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1050px] text-left">
                            <thead className="bg-slate-50 text-xs
                                uppercase text-slate-500">
                                <tr>
                                    <th className="px-5 py-4">Task</th>
                                    <th className="px-5 py-4">Assigned Employees</th>
                                    <th className="px-5 py-4">Priority</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4">Progress</th>
                                    <th className="px-5 py-4">Deadline</th>
                                    <th className="px-5 py-4">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="py-16 text-center">
                                            Loading tasks...
                                        </td>
                                    </tr>
                                ) : tasks.length ? (
                                    tasks.map(task => (
                                        <tr
                                            key={task.id}
                                            className="hover:bg-slate-50"
                                        >
                                            <td className="px-5 py-4 max-w-xs">
                                                <p className="font-medium text-sm text-slate-900">
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                                    {task.description || "No description"}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Created by: {task.created_by_name || "—"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    {(task.assignees || []).slice(0, 3).map(person => (
                                                        <div key={person.id} className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full
                                                                bg-blue-50 text-blue-700
                                                                flex items-center justify-center
                                                                text-xs font-semibold">
                                                                {person.full_name?.charAt(0) || "U"}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium text-slate-700">
                                                                    {person.full_name}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {person.employee_code || ""}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {(task.assignees || []).length > 3 && (
                                                        <p className="text-xs text-blue-600">
                                                            +{task.assignees.length - 3} more
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                                                    priorityStyle[task.priority] || ""
                                                }`}>
                                                    {task.priority}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                                                    statusStyle[task.status] || "bg-slate-100 text-slate-600"
                                                }`}>
                                                    {formatStatus(task.status)}
                                                </span>

                                                {task.is_overdue && (
                                                    <p className="text-[10px] text-red-600 mt-1">
                                                        Overdue
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-1.5 bg-slate-100
                                                        rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-600 rounded-full"
                                                            style={{
                                                                width: `${Math.min(100, Number(task.progress_percentage) || 0)}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-500">
                                                        {Number(task.progress_percentage) || 0}%
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {task.completed_assignees || 0}/
                                                    {task.total_assignees || 0} completed
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                                                {formatDate(task.deadline_at)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <button
                                                    onClick={() => setSelectedTask(task)}
                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                >
                                                    View Details →
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="py-16 text-center">
                                            <p className="text-slate-700 font-medium">
                                                No tasks found
                                            </p>
                                            <p className="text-sm text-slate-400 mt-1">
                                                Try changing your filters.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINATION */}
                    <div className="p-5 border-t border-slate-100
                        flex justify-between items-center">

                        <p className="text-xs text-slate-500">
                            Page {pagination.current_page || 1} of {pagination.total_pages || 0}
                        </p>

                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-4 py-2 border rounded-lg text-sm disabled:opacity-40"
                            >
                                Previous
                            </button>

                            <button
                                disabled={page >= (pagination.total_pages || 1)}
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 bg-slate-950 text-white rounded-lg text-sm disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* CREATE TASK MODAL */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-slate-950/50
                    backdrop-blur-sm flex items-center justify-center p-4">

                    <form
                        onSubmit={createTask}
                        className="bg-white w-full max-w-2xl max-h-[92vh]
                            overflow-y-auto rounded-2xl shadow-2xl"
                    >
                        <div className="p-6 border-b flex justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Create New Task
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    Add a task and assign employees.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="text-2xl text-slate-400"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6 space-y-5">

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Task Title *
                                </label>
                                <input
                                    required
                                    maxLength={255}
                                    value={form.title}
                                    onChange={e => updateForm("title", e.target.value)}
                                    className="w-full h-11 px-3 border rounded-lg text-sm"
                                    placeholder="Enter task title"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Description
                                </label>
                                <textarea
                                    rows={4}
                                    value={form.description}
                                    onChange={e => updateForm("description", e.target.value)}
                                    className="w-full p-3 border rounded-lg text-sm"
                                    placeholder="Describe the task..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Priority
                                </label>
                                <select
                                    value={form.priority}
                                    onChange={e => updateForm("priority", e.target.value)}
                                    className="w-full h-11 px-3 border rounded-lg text-sm"
                                >
                                    {PRIORITIES.map(item => (
                                        <option key={item}>{item}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={form.start_at}
                                        onChange={e => updateForm("start_at", e.target.value)}
                                        className="w-full h-11 px-3 border rounded-lg text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Deadline *
                                    </label>
                                    <input
                                        required
                                        type="datetime-local"
                                        value={form.deadline_at}
                                        onChange={e => updateForm("deadline_at", e.target.value)}
                                        className="w-full h-11 px-3 border rounded-lg text-sm"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium mb-2">
                                        Acknowledgment Deadline
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={form.acknowledgment_deadline}
                                        onChange={e => updateForm("acknowledgment_deadline", e.target.value)}
                                        className="w-full h-11 px-3 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium">
                                        Assign Employees *
                                    </label>
                                    <span className="text-xs text-blue-600">
                                        {form.assignees.length} selected
                                    </span>
                                </div>

                                <div className="border rounded-lg max-h-52 overflow-y-auto divide-y">
                                    {employees.map(employee => (
                                        <label
                                            key={employee.id}
                                            className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.assignees.includes(employee.id)}
                                                onChange={() => toggleAssignee(employee.id)}
                                                className="w-4 h-4 accent-slate-900"
                                            />

                                            <div>
                                                <p className="text-sm font-medium text-slate-800">
                                                    {employee.full_name}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {employee.employee_code} · {employee.job_title || employee.role || ""}
                                                </p>
                                            </div>
                                        </label>
                                    ))}

                                    {!employees.length && (
                                        <p className="p-5 text-sm text-slate-400">
                                            No employees available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="px-5 py-2.5 border rounded-lg text-sm"
                            >
                                Cancel
                            </button>

                            <button
                                disabled={saving}
                                className="px-5 py-2.5 bg-slate-950 text-white
                                    rounded-lg text-sm disabled:opacity-50"
                            >
                                {saving ? "Creating..." : "Create & Assign Task"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TASK DETAILS */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 bg-slate-950/50
                    backdrop-blur-sm flex items-center justify-center p-4"
                    onMouseDown={e => {
                        if (e.target === e.currentTarget) setSelectedTask(null);
                    }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl
                        w-full max-w-3xl max-h-[90vh] overflow-y-auto">

                        <div className="p-6 border-b flex justify-between gap-4">
                            <div>
                                <span className="text-xs text-blue-600 font-semibold">
                                    TASK DETAILS
                                </span>
                                <h2 className="text-xl font-bold mt-2">
                                    {selectedTask.title}
                                </h2>
                            </div>

                            <button
                                onClick={() => setSelectedTask(null)}
                                className="text-2xl text-slate-400"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6 space-y-6">

                            <div>
                                <h3 className="font-semibold text-sm mb-2">
                                    Description
                                </h3>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                    {selectedTask.description || "No description provided."}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                <div>
                                    <p className="text-xs text-slate-400">Priority</p>
                                    <p className="text-sm font-semibold mt-1">
                                        {selectedTask.priority}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400">Status</p>
                                    <p className="text-sm font-semibold mt-1">
                                        {formatStatus(selectedTask.status)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400">Created By</p>
                                    <p className="text-sm font-semibold mt-1">
                                        {selectedTask.created_by_name || "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400">Start Date</p>
                                    <p className="text-sm font-semibold mt-1">
                                        {formatDate(selectedTask.start_at)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400">Deadline</p>
                                    <p className="text-sm font-semibold mt-1">
                                        {formatDate(selectedTask.deadline_at)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400">Created At</p>
                                    <p className="text-sm font-semibold mt-1">
                                        {formatDate(selectedTask.created_at)}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <h3 className="font-semibold text-sm">
                                        Overall Progress
                                    </h3>
                                    <span className="text-sm font-bold">
                                        {Number(selectedTask.progress_percentage) || 0}%
                                    </span>
                                </div>

                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 rounded-full"
                                        style={{
                                            width: `${Math.min(100, Number(selectedTask.progress_percentage) || 0)}%`
                                        }}
                                    />
                                </div>

                                <p className="text-xs text-slate-400 mt-2">
                                    {selectedTask.completed_assignees || 0} of{" "}
                                    {selectedTask.total_assignees || 0} employees completed
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-sm mb-3">
                                    Employee Assignments
                                </h3>

                                <div className="border rounded-xl divide-y">
                                    {(selectedTask.assignees || []).map(person => (
                                        <div
                                            key={person.id}
                                            className="p-4 flex flex-col sm:flex-row
                                                sm:items-center justify-between gap-3"
                                        >
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {person.full_name}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {person.employee_code} · {person.job_title || ""}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Assigned: {formatDate(person.assigned_at)}
                                                </p>
                                            </div>

                                            <div className="sm:text-right">
                                                <span className={`text-xs px-2.5 py-1 rounded-md ${
                                                    statusStyle[person.status] || "bg-slate-100 text-slate-600"
                                                }`}>
                                                    {formatStatus(person.status)}
                                                </span>
                                                <p className="text-sm font-semibold mt-2">
                                                    {Number(person.progress_percentage) || 0}% complete
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {!selectedTask.assignees?.length && (
                                        <p className="p-4 text-sm text-slate-400">
                                            No assignment records found.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t flex justify-end">
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="px-5 py-2.5 bg-slate-950 text-white rounded-lg text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TaskManagement;
