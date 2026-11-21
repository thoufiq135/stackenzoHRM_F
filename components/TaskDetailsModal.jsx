import { useEffect, useState } from "react";


const formatDate = (date) => {
    if (!date) return "Not available";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return "Not available";

    return parsed.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

const formatStatus = (status) =>
    (status || "UNKNOWN")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

const Section = ({ title, children }) => (
    <section className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800">
                {title}
            </h3>
        </div>
        <div className="p-5">
            {children}
        </div>
    </section>
);

const Detail = ({ label, value }) => (
    <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-words">
            {value ?? "Not available"}
        </p>
    </div>
);

const API_ROOT = (
    import.meta.env.VITE_API_URL || "https://hrmbackend.stackenzo.com/api"
).replace(/\/+$/, "");

const TASK_API_BASE = (
    import.meta.env.VITE_TASK_API_URL || `${API_ROOT}`
).replace(/\/+$/, "");

function TaskDetailsModal({ task, onClose, onUpdated, userRole }) {
    const [currentStatus, setCurrentStatus] = useState(
        task?.assignment_status || task?.status || "ASSIGNED"
    );
    const [actionNote, setActionNote] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");
    const [reviewComment, setReviewComment] = useState("");
    const [reviewLoading, setReviewLoading] = useState(false);

    useEffect(() => {
        setCurrentStatus(task?.assignment_status || task?.status || "ASSIGNED");
        setActionNote("");
        setActionError("");
        setActionSuccess("");
    }, [task?.assignment_id, task?.assignment_status, task?.status]);

    if (!task) return null;

    const progress = Math.min(
        100,
        Math.max(0, Number(task.progress_percentage) || 0)
    );

    const reminders = Array.isArray(task.my_reminders)
        ? task.my_reminders
        : [];

    const timeline = [
        {
            title: "Task Created",
            date: task.task_created_at,
            description: "Task was created in the workspace."
        },
        {
            title: "Task Assigned",
            date: task.assigned_at,
            description: `Assigned to ${task.employee_name || "employee"}.`
        },
        {
            title: "Acknowledged",
            date: task.acknowledged_at,
            description: "Task was acknowledged by the assignee."
        },
        {
            title: "Work Started",
            date: task.started_at,
            description: "Employee started working on this task."
        },
        {
            title: "Completed",
            date: task.completed_at,
            description: "Task was marked as completed."
        }
    ].filter(item => item.date);

    const performTaskAction = async (action) => {
        if (!task?.assignment_id || actionLoading) return;

        if (action === "pause" && !actionNote.trim()) {
            setActionError("Please enter a reason before pausing this task.");
            return;
        }

        const token = localStorage.getItem("hrmToken");
        if (!token) {
            setActionError("Your session has expired. Please sign in again.");
            return;
        }

        const requestBody =
            action === "pause"
                ? { reason: actionNote.trim() }
                : action === "submit-review"
                    ? { message: actionNote.trim() }
                    : { note: actionNote.trim() };

        setActionLoading(true);
        setActionError("");
        setActionSuccess("");

        try {
            const response = await fetch(
                `${TASK_API_BASE}/life/assignments/${task.assignment_id}/${action}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to update task status.");
            }

            const nextStatus =
                result.status ||
                result.data?.status ||
                (action === "acknowledge" ? "ACKNOWLEDGED" :
                    action === "start" || action === "resume" ? "WORKING" :
                    action === "pause" ? "PAUSED" :
                    action === "submit-review" ? "REVIEWING" : currentStatus);

            setCurrentStatus(nextStatus);
            setActionNote("");
            setActionSuccess(result.message || "Task status updated successfully.");
            onUpdated?.();
        } catch (error) {
            console.error("Task status update error:", error);
            setActionError(error.message || "Unable to update task status.");
        } finally {
            setActionLoading(false);
        }
    };

    const performTaskReview = async (decision) => {
        if (!task?.assignment_id || reviewLoading || actionLoading) return;

        if (decision === "REQUEST_CHANGES" && !reviewComment.trim()) {
            setActionError("Please enter a comment explaining the changes required.");
            return;
        }

        const token = localStorage.getItem("hrmToken");
        if (!token) {
            setActionError("Your session has expired. Please sign in again.");
            return;
        }

        setReviewLoading(true);
        setActionError("");
        setActionSuccess("");

        try {
            const response = await fetch(
                `${API_ROOT}/life/assignments/${task.assignment_id}/review`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        decision,
                        comment: reviewComment.trim() || undefined
                    })
                }
            );

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to submit the task review.");
            }

            const nextStatus =
                result.data?.assignment_status ||
                (decision === "APPROVE" ? "COMPLETED" : "CHANGES_REQUESTED");

            setCurrentStatus(nextStatus);
            setReviewComment("");
            setActionSuccess(result.message || "Task review completed successfully.");
            onUpdated?.();
        } catch (error) {
            console.error("Task review error:", error);
            setActionError(error.message || "Unable to submit the task review.");
        } finally {
            setReviewLoading(false);
        }
    };

    const normalizedStatus = String(currentStatus || "").toUpperCase();
    const canAcknowledge = ["WAITING_TO_ACCEPT", "ASSIGNED"].includes(normalizedStatus);
    const canStart = normalizedStatus === "ACKNOWLEDGED";
    const canPause = ["WORKING", "IN_PROGRESS"].includes(normalizedStatus);
    const canResume = ["PAUSED", "CHANGES_REQUESTED"].includes(normalizedStatus);
    const canSubmitReview = ["WORKING", "IN_PROGRESS"].includes(normalizedStatus);
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(userRole || "").toUpperCase());
    const canAdminReview = isAdmin && normalizedStatus === "REVIEWING";
console.log("TASK REVIEW DEBUG:", {
    userRole,
    assignmentStatus: task.assignment_status,
    currentStatus,
    normalizedStatus,
    isAdmin,
    canAdminReview
});
    return (
        <div
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* HEADER */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                                TASK DETAILS
                            </span>

                            <span className="text-xs text-slate-400">
                                {task.project_code || "General Task"}
                            </span>
                        </div>

                        <h2 className="text-xl font-bold text-slate-900">
                            {task.title}
                        </h2>

                        <p className="text-sm text-slate-500 mt-1">
                            {task.project_name || "No project assigned"}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 text-xl"
                        aria-label="Close task details"
                    >
                        ×
                    </button>
                </div>

                {/* CONTENT */}
                <div className="overflow-y-auto p-5 sm:p-6 space-y-5">

                    {/* OVERVIEW */}
                    <Section title="Task Overview">
                        <p className="text-sm text-slate-600 leading-6 whitespace-pre-wrap">
                            {task.description || "No description provided."}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-6">

                            <Detail
                                label="Priority"
                                value={task.priority}
                            />

                            <Detail
                                label="Task Status"
                                value={formatStatus(task.task_status)}
                            />

                            <Detail
                                label="Assignment Status"
                                value={formatStatus(task.assignment_status)}
                            />

                            <Detail
                                label="Deadline"
                                value={formatDate(task.deadline_at)}
                            />

                            <Detail
                                label="Start Date"
                                value={formatDate(task.start_at)}
                            />

                            <Detail
                                label="Created At"
                                value={formatDate(task.task_created_at)}
                            />

                            <Detail
                                label="Acknowledgment Deadline"
                                value={formatDate(task.acknowledgment_deadline)}
                            />

                        </div>
                    </Section>

                    {/* EMPLOYEE TASK ACTIONS */}
                    <Section title="My Task Actions">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    Update your assignment
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    These actions are available to the person assigned to this task, regardless of their account role.
                                </p>
                            </div>
                            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 w-fit">
                                {formatStatus(currentStatus)}
                            </span>
                        </div>

                        {(canPause || canSubmitReview || canResume) && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-600 mb-2">
                                    {canPause ? "Pause reason (required)" : "Update note (optional)"}
                                </label>
                                <textarea
                                    value={actionNote}
                                    onChange={(event) => setActionNote(event.target.value)}
                                    rows={3}
                                    placeholder={
                                        canPause
                                            ? "Tell your manager why you are pausing this task..."
                                            : "Add a short update for your manager..."
                                    }
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-y"
                                    disabled={actionLoading}
                                />
                            </div>
                        )}

                        {actionError && (
                            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {actionError}
                            </div>
                        )}
                        {actionSuccess && (
                            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                {actionSuccess}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {canAcknowledge && (
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => performTaskAction("acknowledge")}
                                    className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {actionLoading ? "Please wait..." : "Acknowledge"}
                                </button>
                            )}

                            {canStart && (
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => performTaskAction("start")}
                                    className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {actionLoading ? "Please wait..." : "Start Working"}
                                </button>
                            )}

                            {canPause && (
                                <button
                                    type="button"
                                    disabled={actionLoading || !actionNote.trim()}
                                    onClick={() => performTaskAction("pause")}
                                    className="px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                                >
                                    {actionLoading ? "Please wait..." : "Pause"}
                                </button>
                            )}

                            {canResume && (
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => performTaskAction("resume")}
                                    className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {actionLoading ? "Please wait..." : "Resume"}
                                </button>
                            )}

                            {canSubmitReview && (
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => {
                                        if (window.confirm("Submit this task for review? You will not be able to continue working unless changes are requested.")) {
                                            performTaskAction("submit-review");
                                        }
                                    }}
                                    className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {actionLoading ? "Please wait..." : "Submit for Review"}
                                </button>
                            )}

                            {!canAcknowledge && !canStart && !canPause && !canResume && !canSubmitReview && (
                                <p className="text-sm text-slate-500">
                                    {normalizedStatus === "REVIEWING"
                                        ? "This task has been submitted and is waiting for an admin review."
                                        : normalizedStatus === "COMPLETED"
                                            ? "This assignment has been completed."
                                            : "No status action is available for the current assignment status."}
                                </p>
                            )}
                        </div>
                    </Section>

                    {/* ADMIN TASK REVIEW */}
                    {canAdminReview && (
                        <Section title="Review Submitted Task">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        This task is waiting for your review
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Review the submitted work before approving it or requesting changes.
                                    </p>
                                </div>
                                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 w-fit">
                                    REVIEWING
                                </span>
                            </div>

                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                Review comment {" "}
                                <span className="font-normal text-slate-400">
                                    (required when requesting changes, optional for approval)
                                </span>
                            </label>
                            <textarea
                                value={reviewComment}
                                onChange={(event) => setReviewComment(event.target.value)}
                                rows={3}
                                placeholder="Add feedback for the employee..."
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-y"
                                disabled={reviewLoading || actionLoading}
                            />

                            <div className="flex flex-wrap gap-2 mt-4">
                                <button
                                    type="button"
                                    disabled={reviewLoading || actionLoading}
                                    onClick={() => {
                                        if (window.confirm("Approve this task? This will mark the assignment as completed.")) {
                                            performTaskReview("APPROVE");
                                        }
                                    }}
                                    className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {reviewLoading ? "Please wait..." : "Approve Task"}
                                </button>

                                <button
                                    type="button"
                                    disabled={reviewLoading || actionLoading || !reviewComment.trim()}
                                    onClick={() => {
                                        if (window.confirm("Request changes to this task? The employee will be able to resume working.")) {
                                            performTaskReview("REQUEST_CHANGES");
                                        }
                                    }}
                                    className="px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
                                >
                                    {reviewLoading ? "Please wait..." : "Request Changes"}
                                </button>
                            </div>
                        </Section>
                    )}

                    {/* ASSIGNMENT DETAILS */}
                    <Section title="Assignment Details">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div className="flex gap-3 items-center">
                                <div className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                                    {task.assigned_by_name?.charAt(0)?.toUpperCase() || "A"}
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400">
                                        Assigned By
                                    </p>
                                    <p className="text-sm font-semibold text-slate-900">
                                        {task.assigned_by_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {task.assigned_by_job_title || ""}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 items-center">
                                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                                    {task.employee_name?.charAt(0)?.toUpperCase() || "E"}
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400">
                                        Assigned To
                                    </p>
                                    <p className="text-sm font-semibold text-slate-900">
                                        {task.employee_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {task.employee_code} · {task.employee_job_title || ""}
                                    </p>
                                </div>
                            </div>

                        </div>

                        <div className="grid grid-cols-2 gap-5 mt-6 pt-5 border-t border-slate-100">
                            <Detail
                                label="Assigned At"
                                value={formatDate(task.assigned_at)}
                            />

                            <Detail
                                label="Acknowledged At"
                                value={formatDate(task.acknowledged_at)}
                            />
                        </div>
                    </Section>

                    {/* PROGRESS */}
                    <Section title="Progress Tracking">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-600">
                                Overall progress
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                                {progress}%
                            </span>
                        </div>

                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full bg-blue-600 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-6">
                            <Detail
                                label="Started At"
                                value={formatDate(task.started_at)}
                            />

                            <Detail
                                label="Completed At"
                                value={formatDate(task.completed_at)}
                            />

                            <Detail
                                label="Expected Completion"
                                value={formatDate(task.expected_completion_at)}
                            />
                        </div>
                    </Section>

                    {/* LATEST UPDATE */}
                    <Section title="Latest Employee Update">
                        {task.update_message || task.pending_reason ? (
                            <div className="space-y-4">
                                {task.update_message && (
                                    <div>
                                        <p className="text-xs font-medium text-slate-400 mb-2">
                                            Update Message
                                        </p>
                                        <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg whitespace-pre-wrap">
                                            {task.update_message}
                                        </p>
                                    </div>
                                )}

                                {task.pending_reason && (
                                    <div>
                                        <p className="text-xs font-medium text-slate-400 mb-2">
                                            Pending Reason / Request
                                        </p>
                                        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 p-4 rounded-lg whitespace-pre-wrap">
                                            {task.pending_reason}
                                        </p>
                                    </div>
                                )}

                                <Detail
                                    label="Last Updated"
                                    value={formatDate(task.last_update_at)}
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">
                                No employee updates available.
                            </p>
                        )}
                    </Section>

                    {/* REQUESTS */}
                    <Section title="Requests & Changes">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            {task.pending_reason ? (
                                <>
                                    <p className="text-sm font-semibold text-slate-800">
                                        Reason reported by employee
                                    </p>
                                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                                        {task.pending_reason}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">
                                    No request information is available in this task response.
                                </p>
                            )}

                            <p className="text-xs text-slate-400 mt-3">
                                Complete request history and approval status require the request records from the backend.
                            </p>
                        </div>
                    </Section>

                    {/* REMINDERS */}
                    <Section title="Reminder Configuration">
                        {reminders.length > 0 ? (
                            <div className="space-y-3">
                                {reminders.map((reminder, index) => (
                                    <div
                                        key={reminder.id || index}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-100 rounded-lg p-4"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                {formatStatus(reminder.type)}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {reminder.minutes_before} minutes before
                                            </p>
                                        </div>

                                        <div className="text-xs text-slate-500 space-y-1">
                                            <p>
                                                Repeat interval: {reminder.repeat_interval_minutes ?? "—"} minutes
                                            </p>
                                            <p>
                                                Maximum attempts: {reminder.max_attempts ?? "—"}
                                            </p>
                                        </div>

                                        <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 w-fit">
                                            Enabled
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">
                                No enabled reminders configured for this task.
                            </p>
                        )}
                    </Section>

                    {/* TIMELINE */}
                    <Section title="Task Timeline">
                        {timeline.length > 0 ? (
                            <div className="relative ml-2 border-l-2 border-slate-200 space-y-6 pl-6">
                                {timeline.map((item, index) => (
                                    <div key={item.title} className="relative">
                                        <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />

                                        <p className="text-sm font-semibold text-slate-800">
                                            {item.title}
                                        </p>

                                        <p className="text-xs text-slate-500 mt-1">
                                            {item.description}
                                        </p>

                                        <p className="text-xs text-blue-600 mt-2">
                                            {formatDate(item.date)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">
                                No timeline events available.
                            </p>
                        )}
                    </Section>

                </div>

                {/* FOOTER */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between items-center">
                    <p className="text-xs text-slate-400">
                        Assignment ID: {task.assignment_id}
                    </p>

                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}

export default TaskDetailsModal;
