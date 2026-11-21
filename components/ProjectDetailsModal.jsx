
import { useEffect, useState } from "react";

const API_BASE = "https://hrmbackend.stackenzo.com/api";

const formatDate = (date) => {
    if (!date) return "Not specified";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const getDaysRemaining = (deadline) => {
    if (!deadline) return null;

    const today = new Date();
    const end = new Date(deadline);

    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
};

const getInitials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0])
        .join("")
        .toUpperCase();

export default function ProjectDetailsModal({
    project,
    onClose,
    onMore
}) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleEscape);

        return () =>
            window.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchProject = async () => {
            try {
                setLoading(true);
                setError("");

                const token = localStorage.getItem("hrmToken");

                const response = await fetch(
                    `${API_BASE}/projects/${project.id}/overview`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        signal: controller.signal
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Unable to load project"
                    );
                }

                setDetails(data.project);

            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(err.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchProject();

        return () => controller.abort();
    }, [project.id]);

    const p = details || project;

    const progress = Math.min(
        100,
        Math.max(0, Number(p.progress_percentage || 0))
    );

    const remaining = getDaysRemaining(p.end_date);

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-slate-950 text-white p-6 relative">

                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 text-slate-400 hover:text-white text-2xl"
                    >
                        ×
                    </button>

                    <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">
                        Project Overview
                    </div>

                    <h2 className="text-2xl font-bold pr-8">
                        {p.name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 mt-3">
                        <span className="text-sm text-slate-400">
                            {p.project_code || "No project code"}
                        </span>

                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            p.is_active
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-slate-700 text-slate-300"
                        }`}>
                            {p.is_active ? "Active" : "Inactive"}
                        </span>
                    </div>
                </div>

                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

                    {loading && (
                        <div className="text-center py-2 text-sm text-slate-500">
                            Loading latest project information...
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-2">
                            About Project
                        </h3>

                        <p className="text-sm text-slate-500 leading-6">
                            {p.description || "No project description available."}
                        </p>
                    </div>

                    {/* Project Head */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-3">
                            Project Head
                        </h3>

                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">

                            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                {getInitials(p.project_head_name || "PH")}
                            </div>

                            <div className="min-w-0">
                                <p className="font-semibold text-slate-800">
                                    {p.project_head_name || "Not assigned"}
                                </p>

                                <p className="text-xs text-slate-500">
                                    {p.project_head_job_title || "Project Head"}
                                </p>

                                <p className="text-xs text-slate-400 mt-1">
                                    {p.project_head_email || ""}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="border border-slate-100 rounded-xl p-4">

                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-800">
                                Overall Progress
                            </h3>

                            <span className="text-xl font-bold text-indigo-600">
                                {progress}%
                            </span>
                        </div>

                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="flex justify-between mt-3 text-xs text-slate-500">
                            <span>
                                {p.completed_tasks || 0} completed
                            </span>

                            <span>
                                {p.total_tasks || 0} total tasks
                            </span>
                        </div>
                    </div>

                    {/* Project information */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

                        <InfoCard
                            label="Start Date"
                            value={formatDate(p.start_date)}
                        />

                        <InfoCard
                            label="Deadline"
                            value={formatDate(p.end_date)}
                        />

                        <InfoCard
                            label="Team Members"
                            value={p.total_members ?? 0}
                        />

                        <InfoCard
                            label="Total Tasks"
                            value={p.total_tasks ?? 0}
                        />

                        <InfoCard
                            label="Completed Tasks"
                            value={p.completed_tasks ?? 0}
                        />

                        <InfoCard
                            label="Remaining Time"
                            value={
                                remaining === null
                                    ? "Not specified"
                                    : remaining < 0
                                        ? `${Math.abs(remaining)} days overdue`
                                        : remaining === 0
                                            ? "Due today"
                                            : `${remaining} days`
                            }
                        />

                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">

                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                            Close
                        </button>

                        <button
                            onClick={() => onMore?.(p)}
                            className="px-6 py-2.5 bg-slate-950 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                        >
                            More Details →
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoCard({ label, value }) {
    return (
        <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">
                {label}
            </p>

            <p className="text-sm font-bold text-slate-800">
                {value}
            </p>
        </div>
    );
}
