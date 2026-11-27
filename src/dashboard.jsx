import { jwtDecode } from "jwt-decode";
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import { useNavigate } from "react-router-dom";

import {
    signInWithCustomToken,
    signOut
} from "firebase/auth";

import { chatAuth } from "./config/firebase";

import TaskDetailsModal from "../components/TaskDetailsModal";
import EmployeeDetailsModal from "../components/EmployeeDetailsModal";
import ProjectDetailsModal from "../components/ProjectDetailsModal";
// "http://localhost:4000"
const API_URL = (
    import.meta.env.VITE_API_URL ||"https://hrmbackend.stackenzo.com"
).replace(/\/$/, "");

const STATUS_OPTIONS = [
    "ALL",
    "PENDING",
    "UNACKNOWLEDGED",
    "ACKNOWLEDGED",
    "WORKING",
    "PAUSED",
    "REVIEWING",
    "CHANGES_REQUESTED",
    "COMPLETED",
    "DELAYED"
];

const statusStyles = {
    COMPLETED: "bg-emerald-50 text-emerald-700",
    WORKING: "bg-blue-50 text-blue-700",
    IN_PROGRESS: "bg-blue-50 text-blue-700",
    ACKNOWLEDGED: "bg-indigo-50 text-indigo-700",
    ASSIGNED: "bg-amber-50 text-amber-700",
    WAITING_TO_ACCEPT: "bg-amber-50 text-amber-700",
    PAUSED: "bg-orange-50 text-orange-700",
    REVIEWING: "bg-purple-50 text-purple-700",
    CHANGES_REQUESTED: "bg-red-50 text-red-700",
    CANCELLED: "bg-slate-100 text-slate-600"
};

const priorityStyles = {
    HIGH: "text-red-600 bg-red-50",
    MEDIUM: "text-amber-600 bg-amber-50",
    LOW: "text-emerald-600 bg-emerald-50"
};

const formatDate = (date) => {
    if (!date) return "Not specified";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return "Not specified";
    }

    return parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const formatStatus = (status) => {
    return (status || "PENDING")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase());
};

function StatCard({ title, value, subtitle, icon, color }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                    {title}
                </p>

                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${color}`}>
                    {icon}
                </div>
            </div>

            <h3 className="text-3xl font-bold text-slate-900 mt-4">
                {value ?? 0}
            </h3>

            <p className="text-xs text-slate-400 mt-1">
                {subtitle}
            </p>
        </div>
    );
}

function Dashboard() {
    const navigate = useNavigate();

    // Dashboard states
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    // Firebase authentication states
    const [chatAuthLoading, setChatAuthLoading] = useState(true);
    const [chatAuthenticated, setChatAuthenticated] = useState(false);
    const [chatAuthError, setChatAuthError] = useState("");

    // Filters
    const [status, setStatus] = useState("ALL");
    const [employeeId, setEmployeeId] = useState("");
    const [page, setPage] = useState(1);

    const chatAuthAttempted = useRef(false);

    const limit = 10;

    // --------------------------------------------------
    // LOGOUT
    // --------------------------------------------------

    const logout = async () => {
        try {
            await signOut(chatAuth);
            console.log("[CHAT AUTH] Firebase signed out");
        } catch (error) {
            console.error("[CHAT AUTH] Firebase signout error:", error);
        }

        localStorage.removeItem("hrmToken");
        localStorage.removeItem("hrmUser");

        setChatAuthenticated(false);

        navigate("/", { replace: true });
    };

    // --------------------------------------------------
    // FETCH DASHBOARD
    // --------------------------------------------------

    const fetchDashboard = useCallback(async (isRefresh = false) => {
        const token = localStorage.getItem("hrmToken");

        if (!token) {
            logout();
            return;
        }

        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const params = new URLSearchParams({
                status,
                page: String(page),
                limit: String(limit)
            });

            if (employeeId) {
                params.append("employee_id", employeeId);
            }

            const response = await fetch(
                `${API_URL}/api/user/dashboard?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                await logout();
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load dashboard"
                );
            }

            setDashboard(data);

        } catch (err) {
            console.error("[DASHBOARD ERROR]", err);
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [status, employeeId, page]);

    // --------------------------------------------------
    // FIREBASE CUSTOM TOKEN AUTHENTICATION
    // --------------------------------------------------

    const authenticateChat = useCallback(async () => {
        const token = localStorage.getItem("hrmToken");

        if (!token) {
            await signOut(chatAuth).catch(() => {});

            setChatAuthenticated(false);
            setChatAuthLoading(false);

            return;
        }

        try {
            setChatAuthLoading(true);
            setChatAuthError("");

            const endpoint = `${API_URL}/api/chat/firebase-token`;

            console.log(
                "[CHAT AUTH] Requesting Firebase token:",
                endpoint
            );

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            const responseText = await response.text();

            let data;

            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(
                    `Backend returned non-JSON response. HTTP ${response.status}: ${responseText.slice(0, 200)}`
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Firebase token request failed: HTTP ${response.status}`
                );
            }

            if (!data.success || !data.firebase_token) {
                throw new Error(
                    data.message || "Firebase token was not returned"
                );
            }

            console.log("[CHAT AUTH] Firebase token received");

            const userCredential = await signInWithCustomToken(
                chatAuth,
                data.firebase_token
            );

            console.log(
                "[CHAT AUTH] Firebase authentication successful"
            );

            console.log(
                "[CHAT AUTH] Firebase UID:",
                userCredential.user.uid
            );

            setChatAuthenticated(true);
            setChatAuthError("");

        } catch (error) {
            console.error(
                "[CHAT AUTH] Authentication failed:",
                error
            );

            setChatAuthenticated(false);

            setChatAuthError(
                error.message || "Firebase authentication failed"
            );

        } finally {
            setChatAuthLoading(false);
        }
    }, []);

    // Authenticate Firebase once when Dashboard mounts
    useEffect(() => {
        if (chatAuthAttempted.current) return;

        chatAuthAttempted.current = true;

        authenticateChat();
    }, [authenticateChat]);

    // --------------------------------------------------
    // DASHBOARD FETCH EFFECT
    // --------------------------------------------------

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    // --------------------------------------------------
    // DASHBOARD DATA
    // --------------------------------------------------

    const summary = dashboard?.summary || {};
    const employees = dashboard?.employees?.list || [];
    const projects = dashboard?.assigned_projects?.list || [];
    const tasks = dashboard?.tasks || [];
    const pagination = dashboard?.pagination || {};
    const user = dashboard?.user;

    const tokenUser = (() => {
        try {
            const token = localStorage.getItem("hrmToken");
            return token ? jwtDecode(token) : {};
        } catch (error) {
            console.error("JWT decode error:", error);
            return {};
        }
    })();

    const userRole = String(
        user?.role || tokenUser?.role || ""
    ).toUpperCase();

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);

    // --------------------------------------------------
    // FILTER HANDLERS
    // --------------------------------------------------

    const handleStatusChange = (value) => {
        setStatus(value);
        setPage(1);
    };

    const handleEmployeeChange = (value) => {
        setEmployeeId(value);
        setPage(1);
    };

    // --------------------------------------------------
    // LOADING SCREEN
    // --------------------------------------------------

    if (loading && !dashboard) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />

                    <p className="text-sm text-slate-500 mt-4">
                        Loading your workspace...
                    </p>
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // DASHBOARD ERROR SCREEN
    // --------------------------------------------------

    if (error && !dashboard) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
                <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center">
                    <div className="text-3xl mb-3">!</div>

                    <h2 className="font-semibold text-slate-900">
                        Unable to load dashboard
                    </h2>

                    <p className="text-sm text-red-600 mt-2">
                        {error}
                    </p>

                    <button
                        onClick={() => fetchDashboard()}
                        className="mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // MAIN DASHBOARD
    // --------------------------------------------------

    return (
        <div className="min-h-screen bg-slate-50 flex">

            {/* SIDEBAR */}
            <aside className="hidden lg:flex w-64 bg-slate-950 text-white flex-col shrink-0">

                <div className="h-20 flex items-center px-7 border-b border-white/10">
                    <div className="w-9 h-9 rounded-lg bg-white text-slate-950 flex items-center justify-center font-bold mr-3">
                        H
                    </div>

                    <div>
                        <h1 className="font-bold text-lg tracking-tight">
                            HRM Portal
                        </h1>

                        <p className="text-[10px] text-slate-400 tracking-widest uppercase">
                            Workspace
                        </p>
                    </div>
                </div>

                <div className="p-5 flex-1">

                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">
                        Workspace
                    </p>

                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/10 text-white">
                        <span>▦</span>
                        <span className="text-sm font-medium">
                            Dashboard
                        </span>
                    </div>

                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mt-8 mb-3">
                        Overview
                    </p>

                    <div className="space-y-2 text-sm text-slate-400">

                        <button
                            onClick={() => handleStatusChange("ALL")}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 hover:text-white text-left"
                        >
                            <span>◷</span> My Tasks
                        </button>

                        <button
                            onClick={() =>
                                document.getElementById("projects")?.scrollIntoView({
                                    behavior: "smooth"
                                })
                            }
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 hover:text-white text-left"
                        >
                            <span>▣</span> Projects
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() =>
                                    document.getElementById("employees")?.scrollIntoView({
                                        behavior: "smooth"
                                    })
                                }
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 hover:text-white text-left"
                            >
                                <span>♙</span> Employees
                            </button>
                        )}

                        <button
                            onClick={() => navigate("/chat")}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 hover:text-white text-left"
                        >
                            <span>✉</span>
                            <span>Messages</span>
                        </button>

                    </div>
                </div>

                <div className="p-5 border-t border-white/10">

                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-semibold">
                            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                                {user?.full_name}
                            </p>

                            <p className="text-xs text-slate-400">
                                {user?.role}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="w-full text-left text-sm text-slate-400 hover:text-white px-2 py-2"
                    >
                        ↪ Sign out
                    </button>

                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 min-w-0">

                {/* TOPBAR */}
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-5 md:px-8">

                    <div>
                        <h2 className="font-semibold text-slate-900">
                            Dashboard
                        </h2>

                        <p className="text-xs text-slate-500 mt-1">
                            {dashboard?.date || ""}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">

                        {/* CHAT AUTH STATUS */}
                        <div className="hidden md:flex items-center gap-2 text-xs">
                            {chatAuthLoading ? (
                                <span className="text-amber-600">
                                    Connecting chat...
                                </span>
                            ) : chatAuthenticated ? (
                                <span className="text-emerald-600">
                                    ● Chat connected
                                </span>
                            ) : (
                                <span
                                    className="text-red-600 cursor-help"
                                    title={chatAuthError}
                                >
                                    ● Chat disconnected
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => fetchDashboard(true)}
                            disabled={refreshing}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {refreshing ? "Refreshing..." : "↻ Refresh"}
                        </button>

                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-slate-800">
                                {user?.full_name}
                            </p>

                            <p className="text-xs text-slate-500">
                                {user?.department || user?.role}
                            </p>
                        </div>

                        <button
                            onClick={logout}
                            className="lg:hidden text-sm text-red-600"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                <div className="p-5 md:p-8 max-w-[1600px] mx-auto">

                    {/* ERROR BANNER */}
                    {error && (
                        <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex justify-between gap-3">
                            {error}

                            <button
                                onClick={() => setError("")}
                                className="font-bold"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* FIREBASE ERROR BANNER */}
                    {!chatAuthLoading && !chatAuthenticated && chatAuthError && (
                        <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
                            <div className="font-semibold">
                                Chat connection failed
                            </div>

                            <p className="mt-1 break-words">
                                {chatAuthError}
                            </p>

                            <button
                                onClick={authenticateChat}
                                className="mt-3 px-3 py-1.5 bg-amber-700 text-white rounded-md text-xs"
                            >
                                Retry chat connection
                            </button>
                        </div>
                    )}

                    {/* WELCOME */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">

                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Good to see you, {user?.full_name?.split(" ")[0]}!
                            </h1>

                            <p className="text-sm text-slate-500 mt-2">
                                Here's what's happening in your workspace today.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-2.5 w-fit">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                            {user?.role?.replaceAll("_", " ")}
                        </div>
                    </div>

                    {/* TASK SUMMARY */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-slate-900">
                            Task Overview
                        </h2>

                        <span className="text-xs text-slate-400">
                            Based on selected filter
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">

                        <StatCard
                            title="Total Tasks"
                            value={summary.total}
                            subtitle={`${summary.total_assignments || 0} assignments`}
                            icon="▦"
                            color="bg-blue-50 text-blue-700"
                        />

                        <StatCard
                            title="Completed"
                            value={summary.completed}
                            subtitle="Successfully completed"
                            icon="✓"
                            color="bg-emerald-50 text-emerald-700"
                        />

                        <StatCard
                            title="In Progress"
                            value={summary.in_progress}
                            subtitle="Currently being worked on"
                            icon="◷"
                            color="bg-indigo-50 text-indigo-700"
                        />

                        <StatCard
                            title="Pending"
                            value={summary.pending}
                            subtitle="Awaiting acceptance"
                            icon="!"
                            color="bg-amber-50 text-amber-700"
                        />

                    </div>

                    {/* SECONDARY SUMMARY */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

                        {[
                            ["High Priority", summary.high_priority, "text-red-600"],
                            ["Acknowledged", summary.acknowledged, "text-indigo-600"],
                            ["Paused", summary.paused, "text-orange-600"],
                            ["Delayed", summary.delayed, "text-red-600"]
                        ].map(([title, value, color]) => (
                            <div
                                key={title}
                                className="bg-white border border-slate-200 rounded-xl p-4"
                            >
                                <p className="text-xs text-slate-500">
                                    {title}
                                </p>

                                <p className={`text-2xl font-bold mt-2 ${color}`}>
                                    {value ?? 0}
                                </p>
                            </div>
                        ))}

                    </div>

                    {/* TASKS */}
                    <section className="bg-white border border-slate-200 rounded-xl mb-8">

                        <div className="p-5 md:p-6 border-b border-slate-100">

                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">

                                <div>
                                    <h2 className="font-semibold text-slate-900">
                                        Tasks
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Monitor and manage task assignments.
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3">

                                    <select
                                        value={status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-500"
                                    >
                                        {STATUS_OPTIONS.map(item => (
                                            <option key={item} value={item}>
                                                {item.replaceAll("_", " ")}
                                            </option>
                                        ))}
                                    </select>

                                    {isAdmin && (
                                        <select
                                            value={employeeId}
                                            onChange={(e) => handleEmployeeChange(e.target.value)}
                                            className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-500"
                                        >
                                            <option value="">
                                                All permitted employees
                                            </option>

                                            {employees.map(employee => (
                                                <option
                                                    key={employee.id}
                                                    value={employee.id}
                                                >
                                                    {employee.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">

                            <table className="w-full text-left min-w-[850px]">

                                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Task</th>
                                        <th className="px-6 py-4 font-medium">Project</th>
                                        <th className="px-6 py-4 font-medium">Assigned By</th>
                                        <th className="px-6 py-4 font-medium">Assigned To</th>
                                        <th className="px-6 py-4 font-medium">Priority</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium">Progress</th>
                                        <th className="px-6 py-4 font-medium">Deadline</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">

                                    {tasks.length > 0 ? (
                                        tasks.map(task => (
                                            <tr
                                                key={task.assignment_id}
                                                onClick={() => setSelectedTask(task)}
                                                className="hover:bg-blue-50/50 transition cursor-pointer group"
                                                title="Click to view task details"
                                            >

                                                {/* TASK */}
                                                <td className="px-6 py-4 max-w-xs">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900">
                                                            {task.title}
                                                        </p>

                                                        <p className="text-xs text-blue-600 mt-1 opacity-0 group-hover:opacity-100 transition">
                                                            View task details →
                                                        </p>
                                                    </div>

                                                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                        {task.description || "No description"}
                                                    </p>
                                                </td>

                                                {/* PROJECT */}
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-slate-700">
                                                        {task.project_name || "General"}
                                                    </p>

                                                    <p className="text-xs text-slate-400">
                                                        {task.project_code || ""}
                                                    </p>
                                                </td>

                                                {/* ASSIGNED BY */}
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {task.assigned_by_name || "—"}
                                                    </p>

                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {task.assigned_by_job_title || ""}
                                                    </p>
                                                </td>

                                                {/* ASSIGNED TO */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">

                                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
                                                            {task.employee_name?.charAt(0)?.toUpperCase() || "U"}
                                                        </div>

                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-slate-800">
                                                                {task.employee_name || "—"}
                                                            </p>

                                                            <p className="text-xs text-slate-400">
                                                                {task.employee_code || ""}
                                                            </p>

                                                            <p className="text-xs text-slate-400">
                                                                {task.employee_job_title || ""}
                                                            </p>
                                                        </div>

                                                    </div>
                                                </td>

                                                {/* PRIORITY */}
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                                                        priorityStyles[task.priority] || "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {task.priority || "NORMAL"}
                                                    </span>
                                                </td>

                                                {/* STATUS */}
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                                                        statusStyles[task.assignment_status] || "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {formatStatus(task.assignment_status)}
                                                    </span>
                                                </td>

                                                {/* PROGRESS */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">

                                                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-600 rounded-full"
                                                                style={{
                                                                    width: `${Math.min(
                                                                        100,
                                                                        Math.max(
                                                                            0,
                                                                            Number(task.progress_percentage) || 0
                                                                        )
                                                                    )}%`
                                                                }}
                                                            />
                                                        </div>

                                                        <span className="text-xs text-slate-500">
                                                            {Number(task.progress_percentage) || 0}%
                                                        </span>

                                                    </div>
                                                </td>

                                                {/* DEADLINE */}
                                                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                                    {formatDate(task.deadline_at)}
                                                </td>

                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="text-center py-16">
                                                <div className="text-3xl mb-3">▤</div>

                                                <p className="text-sm font-medium text-slate-700">
                                                    No tasks found
                                                </p>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Try changing the status or employee filter.
                                                </p>
                                            </td>
                                        </tr>
                                    )}

                                </tbody>
                            </table>
                        </div>

                        {/* PAGINATION */}
                        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">

                            <p className="text-xs text-slate-500">
                                Page {pagination.page || 1} of {pagination.total_pages || 0}
                                {" "} · {" "}
                                {pagination.total_records || 0} assignments
                            </p>

                            <div className="flex flex-wrap gap-2">

                                <button
                                    disabled={!pagination.has_previous_page}
                                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                    className="px-4 py-2 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                                >
                                    Previous
                                </button>

                                <button
                                    disabled={!pagination.has_next_page}
                                    onClick={() => setPage(prev => prev + 1)}
                                    className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg disabled:opacity-40 hover:bg-slate-800"
                                >
                                    Next
                                </button>

                                <button
                                    onClick={() => navigate("/tasks")}
                                    className="h-10 px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition whitespace-nowrap"
                                >
                                    View All Tasks →
                                </button>

                            </div>
                        </div>

                    </section>

                    {/* PROJECTS */}
                    <section id="projects" className="mb-8">

                        <div className="flex items-center justify-between mb-4">

                            <div>
                                <h2 className="font-semibold text-slate-900">
                                    Assigned Projects
                                </h2>

                                <p className="text-xs text-slate-500 mt-1">
                                    Projects available in your workspace.
                                </p>

                                <button
                                    onClick={() => navigate("/projects")}
                                    className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
                                >
                                    View All →
                                </button>
                            </div>

                            <span className="text-sm text-slate-500">
                                {dashboard?.assigned_projects?.total || 0} Projects
                            </span>

                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                            {projects.length > 0 ? (
                                projects.map(project => (
                                    <div
                                        key={project.id}
                                        onClick={() => setSelectedProject(project)}
                                        className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-400 transition cursor-pointer"
                                    >

                                        <div className="flex items-start justify-between gap-3">

                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-slate-900 truncate">
                                                    {project.name}
                                                </h3>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    {project.project_code}
                                                </p>
                                            </div>

                                            <span className={`shrink-0 px-2.5 py-1 rounded-md text-xs ${
                                                project.is_active
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-slate-100 text-slate-500"
                                            }`}>
                                                {project.is_active ? "Active" : "Inactive"}
                                            </span>

                                        </div>

                                        <p className="text-sm text-slate-500 mt-4 line-clamp-2 min-h-10">
                                            {project.description || "No project description available."}
                                        </p>

                                        <div className="border-t border-slate-100 mt-4 pt-4 flex items-center justify-between">

                                            <div>
                                                <p className="text-xs text-slate-400">
                                                    Project Head
                                                </p>

                                                <p className="text-sm font-medium text-slate-700 mt-1">
                                                    {project.project_head_name || "Not assigned"}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">
                                                    Members
                                                </p>

                                                <p className="text-sm font-semibold text-slate-800 mt-1">
                                                    {project.total_members || 0}
                                                </p>
                                            </div>

                                        </div>

                                        <div className="mt-4 flex gap-2">

                                            {project.is_project_head && (
                                                <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700">
                                                    Project Head
                                                </span>
                                            )}

                                            {project.is_member && !project.is_project_head && (
                                                <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                                                    Member
                                                </span>
                                            )}

                                        </div>

                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                                    No assigned projects found.
                                </div>
                            )}

                        </div>
                    </section>

                    {/* EMPLOYEES - ADMIN ONLY */}
                    {isAdmin && (
                        <section
                            id="employees"
                            className="bg-white border border-slate-200 rounded-xl mb-8"
                        >

                            <div className="p-5 border-b border-slate-100 flex justify-between items-center">

                                <div>
                                    <h2 className="font-semibold text-slate-900">
                                        Employee Directory
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Employees within your permitted access scope.
                                    </p>
                                </div>

                                <span className="text-sm text-slate-500">
                                    {dashboard?.employees?.total || 0} Employees
                                </span>

                            </div>

                            <div className="overflow-x-auto">

                                <table className="w-full text-left min-w-[850px]">

                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Employee</th>
                                            <th className="px-6 py-4 font-medium">Employee Code</th>
                                            <th className="px-6 py-4 font-medium">Department</th>
                                            <th className="px-6 py-4 font-medium">Role</th>
                                            <th className="px-6 py-4 font-medium">Manager</th>
                                            <th className="px-6 py-4 font-medium">Status</th>
                                            <th className="px-6 py-4 font-medium">Currently Working On</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">

                                        {employees.map(employee => (
                                            <tr
                                                key={employee.id}
                                                onClick={() => setSelectedEmployee(employee)}
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === "Enter" ||
                                                        event.key === " "
                                                    ) {
                                                        event.preventDefault();
                                                        setSelectedEmployee(employee);
                                                    }
                                                }}
                                                tabIndex={0}
                                                role="button"
                                                title={`View ${employee.full_name}'s overview`}
                                                className="hover:bg-blue-50 cursor-pointer transition group focus:outline-none focus:bg-blue-50"
                                            >

                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {employee.full_name}
                                                    </p>

                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {employee.email}
                                                    </p>
                                                </td>

                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {employee.employee_code || "—"}
                                                </td>

                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {employee.department || "—"}
                                                </td>

                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {employee.role}
                                                </td>

                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {employee.manager_name || "—"}
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs ${
                                                        employee.is_active
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-red-50 text-red-600"
                                                    }`}>
                                                        {employee.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 min-w-[220px]">

                                                    {employee.current_projects?.length > 0 ? (
                                                        <div className="space-y-2">

                                                            {employee.current_projects.map(project => (
                                                                <div
                                                                    key={project.project_id}
                                                                    className="flex flex-col gap-1"
                                                                >
                                                                    <span className="text-sm font-medium text-slate-800">
                                                                        {project.project_name}
                                                                    </span>

                                                                    <span className="text-xs text-slate-400">
                                                                        {project.project_code || ""}
                                                                        {" · "}
                                                                        {project.active_tasks} active task(s)
                                                                    </span>
                                                                </div>
                                                            ))}

                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">
                                                            No active project
                                                        </span>
                                                    )}

                                                </td>

                                            </tr>
                                        ))}

                                        {employees.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan="7"
                                                    className="text-center py-10 text-sm text-slate-400"
                                                >
                                                    No employees found.
                                                </td>
                                            </tr>
                                        )}

                                    </tbody>
                                </table>

                                <div className="flex justify-end p-4">
                                    <button
                                        onClick={() => navigate("/staff")}
                                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
                                    >
                                        View All Staff →
                                    </button>
                                </div>

                            </div>
                        </section>
                    )}

                    {/* FOOTER */}
                    <footer className="py-5 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-2 text-xs text-slate-400">
                        <p>HRM Portal · Secure Workspace</p>

                        <p>
                            Logged in as {user?.employee_code || user?.email}
                        </p>
                    </footer>

                </div>
            </main>

            {/* TASK DETAILS MODAL */}
            {selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    userRole={userRole}
                    onClose={() => setSelectedTask(null)}
                    onUpdated={() => fetchDashboard(true)}
                />
            )}

            {/* EMPLOYEE DETAILS MODAL */}
            {selectedEmployee && (
                <EmployeeDetailsModal
                    employee={selectedEmployee}
                    onClose={() => setSelectedEmployee(null)}
                    onMore={(employee) => {
                        setSelectedEmployee(null);
                        navigate(`/employeesw/${employee.id}`);
                    }}
                />
            )}

            {/* PROJECT DETAILS MODAL */}
            {selectedProject && (
                <ProjectDetailsModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    onMore={(project) => {
                        setSelectedProject(null);
                        navigate(`/projects/${project.id}`);
                    }}
                />
            )}

        </div>
    );
}

export default Dashboard;