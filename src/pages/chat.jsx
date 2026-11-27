
import { useCallback, useEffect, useRef, useState } from "react";

import { signInWithCustomToken } from "firebase/auth";

import {
    ref,
    push,
    set,
    onValue,
    query,
    orderByChild,
    limitToLast,
    serverTimestamp
} from "firebase/database";

import { chatAuth, chatDatabase } from "../config/firebase";
//"http://localhost:4000"
const API_URL = (
    import.meta.env.VITE_API_URL || "https://hrmbackend.stackenzo.com"
).replace(/\/$/, "");

// -----------------------------------------
// HELPERS
// -----------------------------------------

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("hrmUser") || "{}");
    } catch {
        return {};
    }
}

function formatTime(timestamp) {
    if (!timestamp) return "";

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getConversationId(conversation) {
    return conversation?.id || conversation?.conversation_id;
}

function getConversationName(conversation) {
    if (conversation?.name) return conversation.name;

    if (conversation?.full_name) return conversation.full_name;

    if (conversation?.other_user_name) {
        return conversation.other_user_name;
    }

    if (conversation?.conversation_type === "TASK") {
        return conversation?.task_title || "Task Discussion";
    }

    if (conversation?.conversation_type === "GROUP") {
        return "Group Conversation";
    }

    return "Direct Message";
}

// -----------------------------------------
// MAIN COMPONENT
// -----------------------------------------

function Chat() {
    const user = getStoredUser();

    // -----------------------------------------
    // CONVERSATION STATES
    // -----------------------------------------

    const [conversations, setConversations] = useState([]);
    const [visibleConversations, setVisibleConversations] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);

    // -----------------------------------------
    // MESSAGE STATES
    // -----------------------------------------

    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");

    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);

    // -----------------------------------------
    // GENERAL STATES
    // -----------------------------------------

    const [loading, setLoading] = useState(true);
    const [firebaseReady, setFirebaseReady] = useState(false);

    const [authError, setAuthError] = useState("");
    const [chatError, setChatError] = useState("");

    // -----------------------------------------
    // CREATE CONVERSATION STATES
    // -----------------------------------------

    const [showNewConversation, setShowNewConversation] = useState(false);

    const [conversationMode, setConversationMode] = useState("DIRECT");

    const [employeeSearch, setEmployeeSearch] = useState("");
    const [employeeResults, setEmployeeResults] = useState([]);

    const [selectedMembers, setSelectedMembers] = useState([]);

    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");

    const [searchingEmployees, setSearchingEmployees] = useState(false);
    const [creatingConversation, setCreatingConversation] = useState(false);

    // -----------------------------------------
    // REFS
    // -----------------------------------------

    const messagesEndRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    const currentUserId = chatAuth.currentUser?.uid;

    // -----------------------------------------
    // BACKEND REQUEST HELPER
    // -----------------------------------------

    const apiRequest = useCallback(async (endpoint, options = {}) => {
        const token = localStorage.getItem("hrmToken");

        if (!token) {
            throw new Error("HRM session expired. Please login again.");
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        const responseText = await response.text();

        let data;

        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error(
                `Invalid server response. HTTP ${response.status}`
            );
        }

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || `Request failed: HTTP ${response.status}`
            );
        }

        return data;
    }, []);

    // -----------------------------------------
    // FIREBASE AUTHENTICATION
    // -----------------------------------------

    const authenticateFirebase = useCallback(async () => {
        try {
            setAuthError("");

            const data = await apiRequest(
                "/api/chat/firebase-token",
                {
                    method: "POST"
                }
            );

            if (!data.firebase_token) {
                throw new Error("Firebase token missing from backend");
            }

            const credential = await signInWithCustomToken(
                chatAuth,
                data.firebase_token
            );

            console.log(
                "[CHAT] Firebase connected:",
                credential.user.uid
            );

            setFirebaseReady(true);

            return credential.user.uid;

        } catch (error) {
            console.error("[CHAT AUTH ERROR]", error);

            setFirebaseReady(false);
            setAuthError(error.message);

            throw error;
        }
    }, [apiRequest]);

    // -----------------------------------------
    // FETCH CONVERSATIONS
    // -----------------------------------------

    const fetchConversations = useCallback(async () => {
        try {
            setLoading(true);
            setChatError("");

            const data = await apiRequest(
                "/api/chat/conversations",
                {
                    method: "GET"
                }
            );

            const list = Array.isArray(data)
                ? data
                : data.conversations ||
                  data.data?.conversations ||
                  data.data ||
                  [];

            if (!Array.isArray(list)) {
                throw new Error("Invalid conversations response");
            }

            setConversations(list);
            setVisibleConversations(null);

            setSelectedConversation(previous => {
                if (!previous) {
                    return list.length > 0 ? list[0] : null;
                }

                const previousId = getConversationId(previous);

                return (
                    list.find(
                        item => getConversationId(item) === previousId
                    ) || (list.length > 0 ? list[0] : null)
                );
            });

            return list;

        } catch (error) {
            console.error("[CHAT CONVERSATIONS ERROR]", error);
            setChatError(error.message);
            throw error;

        } finally {
            setLoading(false);
        }
    }, [apiRequest]);

    // -----------------------------------------
    // EMPLOYEE SEARCH
    // -----------------------------------------

    const searchEmployees = useCallback(async (value) => {
        setEmployeeSearch(value);
        setChatError("");

        if (value.trim().length < 2) {
            setEmployeeResults([]);
            return;
        }

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(async () => {
            try {
                setSearchingEmployees(true);

                const data = await apiRequest(
                    `/api/chat/employees/search?q=${encodeURIComponent(
                        value.trim()
                    )}`,
                    {
                        method: "GET"
                    }
                );

                setEmployeeResults(
                    Array.isArray(data.employees)
                        ? data.employees
                        : []
                );

            } catch (error) {
                console.error("[EMPLOYEE SEARCH]", error);
                setChatError(error.message);
                setEmployeeResults([]);

            } finally {
                setSearchingEmployees(false);
            }
        }, 300);

    }, [apiRequest]);

    // -----------------------------------------
    // SELECT GROUP MEMBERS
    // -----------------------------------------

    const toggleMember = (employee) => {
        setSelectedMembers(previous => {
            const exists = previous.some(
                member => member.id === employee.id
            );

            if (exists) {
                return previous.filter(
                    member => member.id !== employee.id
                );
            }

            return [...previous, employee];
        });
    };

    // -----------------------------------------
    // RESET NEW CONVERSATION MODAL
    // -----------------------------------------

    const closeNewConversation = () => {
        if (creatingConversation) return;

        setShowNewConversation(false);
        setEmployeeSearch("");
        setEmployeeResults([]);
        setSelectedMembers([]);
        setGroupName("");
        setGroupDescription("");
        setChatError("");
        setSearchingEmployees(false);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
    };

    // -----------------------------------------
    // CREATE DIRECT CONVERSATION
    // -----------------------------------------

    const createDirectConversation = async (employee) => {
        try {
            setCreatingConversation(true);
            setChatError("");

            const data = await apiRequest(
                "/api/chat/conversations/direct",
                {
                    method: "POST",
                    body: JSON.stringify({
                        recipient_id: employee.id
                    })
                }
            );

            console.log("[DIRECT CHAT CREATED]", data);

            const conversationId =
                data.conversation_id ||
                data.conversation?.id ||
                data.conversation?.conversation_id ||
                data.id;

            const refreshed = await fetchConversations();

            let createdConversation = refreshed.find(
                item => getConversationId(item) === conversationId
            );

            if (!createdConversation && conversationId) {
                createdConversation = {
                    id: conversationId,
                    conversation_type: "DIRECT",
                    full_name: employee.full_name
                };
            }

            if (createdConversation) {
                setSelectedConversation(createdConversation);
            }

            closeNewConversation();

        } catch (error) {
            console.error("[CREATE DIRECT CHAT]", error);
            setChatError(error.message);

        } finally {
            setCreatingConversation(false);
        }
    };

    // -----------------------------------------
    // CREATE GROUP CONVERSATION
    // -----------------------------------------

    const createGroupConversation = async () => {
        if (!groupName.trim()) {
            setChatError("Please enter a group name.");
            return;
        }

        if (selectedMembers.length === 0) {
            setChatError("Please select at least one employee.");
            return;
        }

        try {
            setCreatingConversation(true);
            setChatError("");

            const data = await apiRequest(
                "/api/chat/conversations/group",
                {
                    method: "POST",
                    body: JSON.stringify({
                        name: groupName.trim(),
                        description: groupDescription.trim(),
                        member_ids: selectedMembers.map(
                            member => member.id
                        )
                    })
                }
            );

            console.log("[GROUP CHAT CREATED]", data);

            const conversationId =
                data.conversation_id ||
                data.conversation?.id ||
                data.conversation?.conversation_id ||
                data.id;

            const refreshed = await fetchConversations();

            let createdConversation = refreshed.find(
                item => getConversationId(item) === conversationId
            );

            if (!createdConversation && conversationId) {
                createdConversation = {
                    id: conversationId,
                    conversation_type: "GROUP",
                    name: groupName.trim()
                };
            }

            if (createdConversation) {
                setSelectedConversation(createdConversation);
            }

            closeNewConversation();

        } catch (error) {
            console.error("[CREATE GROUP CHAT]", error);
            setChatError(error.message);

        } finally {
            setCreatingConversation(false);
        }
    };

    // -----------------------------------------
    // INITIALIZATION
    // -----------------------------------------

    useEffect(() => {
        let mounted = true;

        async function initializeChat() {
            try {
                await authenticateFirebase();

                if (!mounted) return;

                await fetchConversations();

            } catch (error) {
                console.error("[CHAT INITIALIZATION]", error);
            }
        }

        initializeChat();

        return () => {
            mounted = false;

            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [authenticateFirebase, fetchConversations]);

    // -----------------------------------------
    // LISTEN TO FIREBASE MESSAGES
    // -----------------------------------------

    useEffect(() => {
        const conversationId = getConversationId(
            selectedConversation
        );

        if (!firebaseReady || !conversationId || !currentUserId) {
            setMessages([]);
            setMessagesLoading(false);
            return;
        }

        setMessages([]);
        setMessagesLoading(true);

        const messagesRef = ref(
            chatDatabase,
            `chats/${conversationId}/messages`
        );

        const messagesQuery = query(
            messagesRef,
            orderByChild("createdAt"),
            limitToLast(100)
        );

        const unsubscribe = onValue(
            messagesQuery,
            snapshot => {
                const result = [];

                snapshot.forEach(child => {
                    result.push({
                        id: child.key,
                        ...child.val()
                    });
                });

                result.sort(
                    (a, b) =>
                        (a.createdAt || 0) - (b.createdAt || 0)
                );

                setMessages(result);
                setMessagesLoading(false);
            },
            error => {
                console.error("[FIREBASE MESSAGE ERROR]", error);

                setChatError(
                    "Unable to load messages: " + error.message
                );

                setMessagesLoading(false);
            }
        );

        return () => unsubscribe();

    }, [
        selectedConversation,
        firebaseReady,
        currentUserId
    ]);

    // -----------------------------------------
    // AUTO SCROLL
    // -----------------------------------------

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [messages]);

    // -----------------------------------------
    // SEND MESSAGE
    // -----------------------------------------

    const sendMessage = async (event) => {
        event?.preventDefault();

        const text = messageText.trim();

        const conversationId = getConversationId(
            selectedConversation
        );

        if (!text || !conversationId || sending) return;

        if (!firebaseReady || !chatAuth.currentUser) {
            setChatError("Firebase is not connected.");
            return;
        }

        if (text.length > 5000) {
            setChatError("Message cannot exceed 5000 characters.");
            return;
        }

        try {
            setSending(true);
            setChatError("");

            const messagesRef = ref(
                chatDatabase,
                `chats/${conversationId}/messages`
            );

            const newMessageRef = push(messagesRef);

            const message = {
                senderId: chatAuth.currentUser.uid,
                senderName:
                    user.full_name ||
                    user.name ||
                    "Employee",
                text,
                type: "TEXT",
                createdAt: serverTimestamp()
            };

            await set(newMessageRef, message);

            setMessageText("");

        } catch (error) {
            console.error("[SEND MESSAGE ERROR]", error);

            setChatError(
                "Message could not be sent: " + error.message
            );

        } finally {
            setSending(false);
        }
    };

    // -----------------------------------------
    // ENTER TO SEND
    // -----------------------------------------

    const handleMessageKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    // -----------------------------------------
    // SELECT CONVERSATION
    // -----------------------------------------

    const selectConversation = (conversation) => {
        setChatError("");
        setSelectedConversation(conversation);
    };

    // -----------------------------------------
    // OPEN NEW CONVERSATION
    // -----------------------------------------

    const openNewConversation = () => {
        setConversationMode("DIRECT");
        setEmployeeSearch("");
        setEmployeeResults([]);
        setSelectedMembers([]);
        setGroupName("");
        setGroupDescription("");
        setChatError("");
        setShowNewConversation(true);
    };

    // -----------------------------------------
    // FILTER CONVERSATIONS
    // -----------------------------------------

    const filterConversations = (value) => {
        if (!value.trim()) {
            setVisibleConversations(null);
            return;
        }

        const filtered = conversations.filter(item =>
            getConversationName(item)
                .toLowerCase()
                .includes(value.toLowerCase())
        );

        setVisibleConversations(filtered);
    };

    // -----------------------------------------
    // UI
    // -----------------------------------------

    return (
        <div className="h-screen bg-slate-100 flex flex-col">

            {/* HEADER */}

            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">

                <div>
                    <h1 className="text-lg font-bold text-slate-900">
                        Stackenzo Chat
                    </h1>

                    <p className="text-xs text-slate-500">
                        HRM Workspace Messaging
                    </p>
                </div>

                <div className="flex items-center gap-4">

                    <div className="flex items-center gap-2 text-xs">
                        <span
                            className={`w-2 h-2 rounded-full ${
                                firebaseReady
                                    ? "bg-emerald-500"
                                    : "bg-red-500"
                            }`}
                        />

                        <span className="text-slate-600">
                            {firebaseReady ? "Connected" : "Disconnected"}
                        </span>
                    </div>

                    <button
                        onClick={fetchConversations}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                    >
                        ↻ Refresh
                    </button>

                </div>
            </header>

            {/* MAIN CHAT */}

            <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* SIDEBAR */}

                <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">

                    <div className="p-5 border-b border-slate-100">

                        <div className="flex items-center justify-between">

                            <h2 className="font-semibold text-slate-900">
                                Conversations
                            </h2>

                            <button
                                onClick={openNewConversation}
                                className="w-9 h-9 rounded-lg bg-blue-600 text-white text-xl hover:bg-blue-700 flex items-center justify-center"
                                title="New conversation"
                            >
                                +
                            </button>

                        </div>

                        <input
                            type="text"
                            placeholder="Search conversations..."
                            className="mt-4 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            onChange={(event) =>
                                filterConversations(event.target.value)
                            }
                        />

                    </div>

                    <div className="flex-1 overflow-y-auto">

                        {loading ? (
                            <div className="p-6 text-center text-sm text-slate-400">
                                Loading conversations...
                            </div>

                        ) : conversations.length === 0 ? (
                            <div className="p-6 text-center">

                                <div className="text-3xl mb-3">
                                    💬
                                </div>

                                <p className="text-sm font-medium text-slate-700">
                                    No conversations yet
                                </p>

                                <p className="text-xs text-slate-400 mt-2">
                                    Start a new conversation with your team.
                                </p>

                                <button
                                    onClick={openNewConversation}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                                >
                                    New Conversation
                                </button>

                            </div>

                        ) : (
                            (visibleConversations ?? conversations).map(conversation => {
                                const id = getConversationId(conversation);

                                const selected =
                                    getConversationId(selectedConversation) === id;

                                return (
                                    <button
                                        key={id}
                                        onClick={() =>
                                            selectConversation(conversation)
                                        }
                                        className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition ${
                                            selected
                                                ? "bg-blue-50 border-l-4 border-l-blue-600"
                                                : ""
                                        }`}
                                    >

                                        <div className="flex items-center gap-3">

                                            <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold shrink-0">
                                                {getConversationName(conversation)
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>

                                            <div className="flex-1 min-w-0">

                                                <div className="flex justify-between gap-2">

                                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                                        {getConversationName(conversation)}
                                                    </p>

                                                    <span className="text-[10px] text-slate-400 shrink-0">
                                                        {conversation.conversation_type}
                                                    </span>

                                                </div>

                                                <p className="text-xs text-slate-400 mt-1 truncate">
                                                    {conversation.lastMessage ||
                                                        conversation.last_message ||
                                                        "Open conversation"}
                                                </p>

                                            </div>

                                        </div>

                                    </button>
                                );
                            })
                        )}

                    </div>

                </aside>

                {/* CHAT AREA */}

                <main className="flex-1 min-w-0 flex flex-col bg-slate-50">

                    {selectedConversation ? (
                        <>

                            {/* CHAT HEADER */}

                            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">

                                <div>
                                    <h2 className="font-semibold text-slate-900">
                                        {getConversationName(selectedConversation)}
                                    </h2>

                                    <p className="text-xs text-slate-400 mt-1">
                                        {selectedConversation.conversation_type}
                                    </p>
                                </div>

                                <span className="text-xs text-emerald-600">
                                    ● Live conversation
                                </span>

                            </div>

                            {/* ERROR */}

                            {chatError && (
                                <div className="mx-5 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                                    {chatError}
                                </div>
                            )}

                            {/* MESSAGES */}

                            <div className="flex-1 overflow-y-auto p-5 md:p-8">

                                {messagesLoading ? (
                                    <div className="text-center text-sm text-slate-400 mt-10">
                                        Loading messages...
                                    </div>

                                ) : messages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">

                                        <div className="text-center">

                                            <div className="text-4xl mb-3">
                                                👋
                                            </div>

                                            <h3 className="font-semibold text-slate-700">
                                                Start the conversation
                                            </h3>

                                            <p className="text-sm text-slate-400 mt-2">
                                                Send your first message.
                                            </p>

                                        </div>

                                    </div>

                                ) : (
                                    <div className="space-y-4 max-w-4xl mx-auto">

                                        {messages.map(message => {
                                            const isMine =
                                                message.senderId === currentUserId;

                                            return (
                                                <div
                                                    key={message.id}
                                                    className={`flex ${
                                                        isMine
                                                            ? "justify-end"
                                                            : "justify-start"
                                                    }`}
                                                >

                                                    <div
                                                        className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                                                            isMine
                                                                ? "bg-blue-600 text-white rounded-br-sm"
                                                                : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                                                        }`}
                                                    >

                                                        {!isMine && (
                                                            <p className="text-xs font-semibold text-blue-600 mb-1">
                                                                {message.senderName || "Employee"}
                                                            </p>
                                                        )}

                                                        <p className="text-sm whitespace-pre-wrap break-words">
                                                            {message.text}
                                                        </p>

                                                        <p
                                                            className={`text-[10px] mt-2 text-right ${
                                                                isMine
                                                                    ? "text-blue-100"
                                                                    : "text-slate-400"
                                                            }`}
                                                        >
                                                            {formatTime(message.createdAt)}
                                                        </p>

                                                    </div>

                                                </div>
                                            );
                                        })}

                                        <div ref={messagesEndRef} />

                                    </div>
                                )}

                            </div>

                            {/* MESSAGE INPUT */}

                            <form
                                onSubmit={sendMessage}
                                className="p-4 md:p-5 bg-white border-t border-slate-200 shrink-0"
                            >

                                <div className="max-w-4xl mx-auto flex items-end gap-3">

                                    <textarea
                                        value={messageText}
                                        onChange={(event) =>
                                            setMessageText(event.target.value)
                                        }
                                        onKeyDown={handleMessageKeyDown}
                                        placeholder="Type your message..."
                                        rows={1}
                                        maxLength={5000}
                                        className="flex-1 resize-none min-h-12 max-h-32 px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
                                    />

                                    <button
                                        type="submit"
                                        disabled={!messageText.trim() || sending}
                                        className="h-12 px-6 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {sending ? "Sending..." : "Send ➤"}
                                    </button>

                                </div>

                                <p className="max-w-4xl mx-auto text-[10px] text-slate-400 mt-2">
                                    Press Enter to send · Shift + Enter for a new line
                                </p>

                            </form>

                        </>

                    ) : (

                        <div className="flex-1 flex items-center justify-center">

                            <div className="text-center">

                                <div className="text-5xl mb-4">
                                    💬
                                </div>

                                <h2 className="text-lg font-semibold text-slate-700">
                                    Welcome to Stackenzo Chat
                                </h2>

                                <p className="text-sm text-slate-400 mt-2">
                                    Select a conversation or create a new one.
                                </p>

                            </div>

                        </div>

                    )}

                </main>

            </div>

            {/* ---------------------------------
                NEW CONVERSATION MODAL
            --------------------------------- */}

            {showNewConversation && (

                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">

                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">

                        {/* MODAL HEADER */}

                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">

                            <div>
                                <h2 className="font-bold text-lg text-slate-900">
                                    New Conversation
                                </h2>

                                <p className="text-xs text-slate-400 mt-1">
                                    Start a conversation with your team.
                                </p>
                            </div>

                            <button
                                onClick={closeNewConversation}
                                disabled={creatingConversation}
                                className="text-2xl text-slate-400 hover:text-slate-800 disabled:opacity-40"
                            >
                                ×
                            </button>

                        </div>

                        {/* TABS */}

                        <div className="flex border-b border-slate-100">

                            <button
                                onClick={() => {
                                    setConversationMode("DIRECT");
                                    setSelectedMembers([]);
                                    setChatError("");
                                }}
                                className={`flex-1 py-3 text-sm font-medium ${
                                    conversationMode === "DIRECT"
                                        ? "text-blue-600 border-b-2 border-blue-600"
                                        : "text-slate-500"
                                }`}
                            >
                                Direct Chat
                            </button>

                            <button
                                onClick={() => {
                                    setConversationMode("GROUP");
                                    setSelectedMembers([]);
                                    setChatError("");
                                }}
                                className={`flex-1 py-3 text-sm font-medium ${
                                    conversationMode === "GROUP"
                                        ? "text-blue-600 border-b-2 border-blue-600"
                                        : "text-slate-500"
                                }`}
                            >
                                Group Chat
                            </button>

                        </div>

                        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

                            {/* GROUP DETAILS */}

                            {conversationMode === "GROUP" && (
                                <>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Group Name
                                        </label>

                                        <input
                                            value={groupName}
                                            onChange={(e) =>
                                                setGroupName(e.target.value)
                                            }
                                            placeholder="Enter group name"
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Description (optional)
                                        </label>

                                        <textarea
                                            value={groupDescription}
                                            onChange={(e) =>
                                                setGroupDescription(e.target.value)
                                            }
                                            placeholder="What is this group about?"
                                            rows={2}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none"
                                        />
                                    </div>

                                </>
                            )}

                            {/* EMPLOYEE SEARCH */}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {conversationMode === "DIRECT"
                                        ? "Select Employee"
                                        : "Add Group Members"}
                                </label>

                                <input
                                    value={employeeSearch}
                                    onChange={(e) =>
                                        searchEmployees(e.target.value)
                                    }
                                    placeholder="Search by name, employee code or email..."
                                    className="w-full px-3 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* SELECTED MEMBERS */}

                            {conversationMode === "GROUP" &&
                                selectedMembers.length > 0 && (

                                    <div className="flex flex-wrap gap-2">

                                        {selectedMembers.map(member => (

                                            <button
                                                key={member.id}
                                                onClick={() => toggleMember(member)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs"
                                            >
                                                {member.full_name} ×
                                            </button>

                                        ))}

                                    </div>

                                )}

                            {/* EMPLOYEE RESULTS */}

                            <div className="space-y-2">

                                {searchingEmployees && (
                                    <p className="text-center text-xs text-slate-400 py-4">
                                        Searching employees...
                                    </p>
                                )}

                                {!searchingEmployees &&
                                    employeeSearch.trim().length >= 2 &&
                                    employeeResults.length === 0 && (

                                        <p className="text-center text-xs text-slate-400 py-4">
                                            No employees found.
                                        </p>

                                    )}

                                {employeeSearch.trim().length < 2 &&
                                    !searchingEmployees && (

                                        <p className="text-center text-xs text-slate-400 py-4">
                                            Enter at least 2 characters to search employees.
                                        </p>

                                    )}

                                {employeeResults.map(employee => {

                                    const selected = selectedMembers.some(
                                        member => member.id === employee.id
                                    );

                                    return (

                                        <button
                                            key={employee.id}
                                            disabled={
                                                creatingConversation ||
                                                (conversationMode === "DIRECT" &&
                                                    creatingConversation)
                                            }
                                            onClick={() => {
                                                if (conversationMode === "DIRECT") {
                                                    createDirectConversation(employee);
                                                } else {
                                                    toggleMember(employee);
                                                }
                                            }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                                                selected
                                                    ? "bg-blue-50 border-blue-300"
                                                    : "border-slate-100 hover:bg-slate-50"
                                            }`}
                                        >

                                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold">
                                                {employee.full_name
                                                    ?.charAt(0)
                                                    ?.toUpperCase() || "U"}
                                            </div>

                                            <div className="flex-1 min-w-0">

                                                <p className="text-sm font-semibold text-slate-800">
                                                    {employee.full_name}
                                                </p>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    {employee.employee_code || employee.email}
                                                    {" · "}
                                                    {employee.role || "Employee"}
                                                </p>

                                            </div>

                                            {conversationMode === "GROUP" && (

                                                <span
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                                        selected
                                                            ? "bg-blue-600 text-white"
                                                            : "border border-slate-300"
                                                    }`}
                                                >
                                                    {selected ? "✓" : ""}
                                                </span>

                                            )}

                                        </button>

                                    );
                                })}

                            </div>

                            {/* ERROR */}

                            {chatError && (

                                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg">
                                    {chatError}
                                </div>

                            )}

                        </div>

                        {/* GROUP FOOTER */}

                        {conversationMode === "GROUP" && (

                            <div className="p-5 border-t border-slate-100 flex justify-between items-center">

                                <span className="text-xs text-slate-500">
                                    {selectedMembers.length} members selected
                                </span>

                                <button
                                    disabled={
                                        creatingConversation ||
                                        !groupName.trim() ||
                                        selectedMembers.length === 0
                                    }
                                    onClick={createGroupConversation}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
                                >
                                    {creatingConversation
                                        ? "Creating..."
                                        : "Create Group"}
                                </button>

                            </div>

                        )}

                    </div>

                </div>

            )}

            {/* ---------------------------------
                FIREBASE AUTH ERROR
            --------------------------------- */}

            {authError && (

                <div className="fixed bottom-5 right-5 max-w-md bg-red-600 text-white p-4 rounded-xl shadow-xl text-sm">

                    <p className="font-semibold">
                        Firebase connection failed
                    </p>

                    <p className="mt-1">
                        {authError}
                    </p>

                    <button
                        onClick={authenticateFirebase}
                        className="mt-3 underline"
                    >
                        Retry
                    </button>

                </div>

            )}

        </div>
    );
}

export default Chat;
