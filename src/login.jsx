
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function Login() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });

        if (error) setError("");
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        setError("");

        if (!formData.email.trim() || !formData.password) {
            setError("Please enter both email and password.");
            return;
        }

        try {
            setLoading(true);
//https://hrmbackend.stackenzo.com/api/user/login
            const response = await fetch(`https://hrmbackend.stackenzo.com/api/user/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: formData.email.trim(),
                    password: formData.password
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Login failed. Please try again.");
                return;
            }

            if (!data.token) {
                setError("Authentication token was not received.");
                return;
            }

            // Store JWT and user information
            localStorage.setItem("hrmToken", data.token);
            localStorage.setItem("hrmUser", JSON.stringify(data.user));

            // Redirect
            navigate("/dashboard", { replace: true });

        } catch (err) {
            console.error("Login error:", err);
            setError(
                "Unable to connect to the server. Please check your internet connection."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">

            <div className="w-full max-w-md">

                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white text-xl font-bold shadow-lg mb-4">
                        H
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        HRM Portal
                    </h1>

                    <p className="text-sm text-slate-500 mt-2">
                        Sign in to access your workspace
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7 sm:p-8">

                    <div className="mb-7">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Welcome back
                        </h2>

                        <p className="text-sm text-slate-500 mt-1">
                            Enter your credentials to continue.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="mb-5 flex items-start gap-3 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-700"
                        >
                            <svg
                                className="w-5 h-5 shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>

                            <p className="text-sm leading-5">
                                {error}
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email address
                            </label>

                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@company.com"
                                autoComplete="username"
                                required
                                disabled={loading}
                                className="w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Password
                                </label>
                            </div>

                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                    disabled={loading}
                                    className="w-full h-12 px-4 pr-14 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-900"
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <svg
                                        className="w-5 h-5 animate-spin"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                        />
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </button>

                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400 mt-7">
                    Secure Human Resource Management Portal
                </p>

            </div>
        </div>
    );
}

export default Login;
