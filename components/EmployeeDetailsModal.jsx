
import { useEffect, useState } from "react";

const API_BASE = "https://hrmbackend.stackenzo.com/api/user";

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const formatStatus = (value) => {
    return (value || "PENDING")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase());
};

function OverviewCard({ title, value, subtitle, color, icon }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">
                    {title}
                </p>

                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                    {icon}
                </span>
            </div>

            <p className="text-2xl font-bold text-slate-900 mt-3">
                {value ?? 0}
            </p>

            <p className="text-xs text-slate-400 mt-1">
                {subtitle}
            </p>
        </div>
    );
}

export default function EmployeeDetailsModal({
    employee,
    onClose,
    onMore
}) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!employee?.id) return;

        const controller = new AbortController();

        const fetchEmployeeOverview = async () => {
            try {
                setLoading(true);
                setError("");

                const token = localStorage.getItem("hrmToken");

                if (!token) {
                    throw new Error("Authentication token not found");
                }

                const response = await fetch(
                    `${API_BASE}/employee/${employee.id}/overview`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        signal: controller.signal
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Unable to fetch employee details"
                    );
                }

                setDetails(data);

            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Employee overview error:", err);
                    setError(err.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchEmployeeOverview();

        return () => controller.abort();
    }, [employee?.id]);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    const profile = details?.employee || employee;
    const stats = details?.statistics || {};
    const currentTasks = details?.current_tasks || [];

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="bg-slate-50 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* HEADER */}
                <div className="bg-white px-5 sm:px-7 py-5 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                            Employee Overview
                        </p>

                        <h2 className="text-lg font-bold text-slate-900 mt-1">
                            Profile & Performance
                        </h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 text-xl"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <div className="overflow-y-auto p-5 sm:p-7">

                    {/* LOADING */}
                    {loading && (
                        <div className="py-20 text-center">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />

                            <p className="text-sm text-slate-500 mt-4">
                                Loading employee overview...
                            </p>
                        </div>
                    )}

                    {/* ERROR */}
                    {!loading && error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                            <p className="text-sm font-medium text-red-700">
                                Unable to load employee overview
                            </p>

                            <p className="text-xs text-red-500 mt-2">
                                {error}
                            </p>

                            <button
                                onClick={onClose}
                                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {!loading && !error && details && (
                        <div className="space-y-6">

                            {/* EMPLOYEE PROFILE */}
                            <section className="bg-white border border-slate-200 rounded-xl p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                                    {profile.profile_image ? (
                                        <img
                                            src={profile.profile_image}
                                            alt={profile.full_name}
                                            className="w-20 h-20 rounded-2xl object-cover border border-slate-200"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-3xl font-bold">
                                            {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-xl font-bold text-slate-900">
                                                {profile.full_name}
                                            </h3>

                                            <span className={`px-2.5 py-1 rounded-md text-xs ${
                                                profile.is_active
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-red-50 text-red-600"
                                            }`}>
                                                {profile.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </div>

                                        <p className="text-sm text-slate-500 mt-1">
                                            {profile.job_title || "Designation not specified"}
                                        </p>

                                        <p className="text-xs text-slate-400 mt-2">
                                            {profile.employee_code || "No employee code"}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => onMore(profile)}
                                        className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
                                    >
                                        More →
                                    </button>
                                </div>

                                <div className="border-t border-slate-100 mt-5 pt-5">
                                    <h4 className="text-sm font-semibold text-slate-800 mb-3">
                                        Employee Information
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                                        {[
                                            ["Email", profile.email],
                                            ["Phone", profile.phone],
                                            ["Department", profile.department],
                                            ["Designation", profile.job_title],
                                            ["Role", profile.role],
                                            ["Manager", profile.manager_name],
                                            ["Joined On", formatDate(profile.created_at)],
                                            ["Last Login", formatDate(profile.last_login_at)]
                                        ].map(([label, value]) => (
                                            <div key={label}>
                                                <p className="text-xs text-slate-400">
                                                    {label}
                                                </p>

                                                <p className="text-sm font-medium text-slate-700 mt-1 break-words">
                                                    {value || "Not available"}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-5">
                                        <p className="text-xs text-slate-400">
                                            Bio
                                        </p>

                                        <p className="text-sm text-slate-600 mt-1">
                                            {profile.bio || "No employee bio has been added."}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* TASK STATISTICS */}
                            <section>
                                <div className="mb-3">
                                    <h3 className="font-semibold text-slate-900">
                                        Task Performance
                                    </h3>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Overall assignment statistics
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

                                    <OverviewCard
                                        title="Completed"
                                        value={stats.completed_tasks}
                                        subtitle="Tasks completed"
                                        icon="✓"
                                        color="bg-emerald-50 text-emerald-700"
                                    />

                                    <OverviewCard
                                        title="Delayed Completed"
                                        value={stats.delayed_completed_tasks}
                                        subtitle="Completed after deadline"
                                        icon="◷"
                                        color="bg-orange-50 text-orange-700"
                                    />

                                    <OverviewCard
                                        title="Pending"
                                        value={stats.pending_tasks}
                                        subtitle="Not yet completed"
                                        icon="!"
                                        color="bg-amber-50 text-amber-700"
                                    />

                                    <OverviewCard
                                        title="Overdue Pending"
                                        value={stats.overdue_pending_tasks}
                                        subtitle="Past deadline"
                                        icon="⚠"
                                        color="bg-red-50 text-red-700"
                                    />

                                </div>
                            </section>

                            {/* CURRENT TASKS */}
                            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">

                                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-slate-900">
                                            Current Tasks
                                        </h3>

                                        <p className="text-xs text-slate-500 mt-1">
                                            Active assignments for this employee
                                        </p>
                                    </div>

                                    <span className="text-sm font-semibold text-slate-600">
                                        {currentTasks.length} Tasks
                                    </span>
                                </div>

                                {currentTasks.length > 0 ? (
                                    <div className="divide-y divide-slate-100">
                                        {currentTasks.map(task => (
                                            <div
                                                key={task.id}
                                                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800">
                                                        {task.title}
                                                    </p>

                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {task.project_name || "General project"}
                                                    </p>

                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Deadline: {formatDate(task.deadline_at)}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-500">
                                                        {Number(task.progress_percentage) || 0}%
                                                    </span>

                                                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                                                        {formatStatus(task.assignment_status)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center">
                                        <p className="text-sm text-slate-500">
                                            No current tasks assigned.
                                        </p>
                                    </div>
                                )}

                            </section>

                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="bg-white border-t border-slate-200 px-5 sm:px-7 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}
