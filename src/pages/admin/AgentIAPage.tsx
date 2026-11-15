import React, { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, ArrowLeft, RotateCcw, Copy, Check } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import axiosClient from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    text: string;
}

const WELCOME_MESSAGE: ChatMessage = {
    id: "welcome",
    role: "assistant",
    text: "Bonjour ! Je suis l'Agent IA VoyageE connecté en direct à la base de données. Posez-moi vos questions sur les étudiants (matricule, parcours, contact), les voitures, les chefs de voiture ou le programme des 7 jours.",
};

const SUGGESTIONS = [
    "Dans quelle voiture est l'étudiant de matricule 2401-ENI ?",
    "Quels étudiants ne sont pas encore affectés à une voiture ?",
    "Qui sont les chefs de voiture et combien de places restent libres ?",
    "Quel est le programme du jour 2 ?",
];

function cleanPlainText(raw: string): string {
    return raw
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*/g, "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/`{1,3}/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

const AgentChatPanel: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const sendMessage = async (textToSend: string) => {
        const trimmed = textToSend.trim();
        if (!trimmed || loading) return;

        setError("");
        const userMsg: ChatMessage = {
            id: `${Date.now()}_u`,
            role: "user",
            text: trimmed,
        };

        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);
        setInput("");
        setLoading(true);

        try {
            const { data } = await axiosClient.post<{ reply: string }>("/agent-ia/ask/", {
                message: trimmed,
                history: nextMessages.map((m) => ({ role: m.role, text: m.text })),
            });
            setMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}_a`,
                    role: "assistant",
                    text: cleanPlainText(data.reply || ""),
                },
            ]);
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Impossible de contacter l'Agent IA pour le moment.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const handleReset = () => {
        setMessages([WELCOME_MESSAGE]);
        setError("");
        setInput("");
    };

    const handleCopy = async (id: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
        } catch {
            // Clipboard indisponible
        }
    };

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => sendMessage(s)}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-eni-600 hover:text-eni-800 transition-colors cursor-pointer disabled:opacity-50 text-left"
                    >
                        {s}
                    </button>
                ))}
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <Card padding="none" className="flex flex-col h-[64vh] min-h-[440px] overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-eni-700 text-white flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-display text-sm font-semibold text-slate-900 truncate">
                                Assistant Base de Données — VoyageE ENI
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                Réponses en direct sur les étudiants, voitures et programme
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={loading || messages.length <= 1}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Nouvelle discussion</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user"
                                        ? "bg-eni-700 text-white"
                                        : "bg-slate-50 text-slate-800 border border-slate-200"
                                    }`}
                            >
                                <p>{m.role === "assistant" ? cleanPlainText(m.text) : m.text}</p>
                                {m.role === "assistant" && m.id !== "welcome" && (
                                    <div className="mt-2 pt-2 border-t border-slate-200/70 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(m.id, cleanPlainText(m.text))}
                                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-eni-700 transition-colors cursor-pointer"
                                        >
                                            {copiedId === m.id ? (
                                                <>
                                                    <Check className="w-3 h-3 text-eni-700" />
                                                    <span className="text-eni-700">Copié</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    <span>Copier</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl px-4 py-3 text-sm bg-slate-50 text-slate-500 border border-slate-200">
                                Recherche dans la base de données...
                            </div>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-slate-50/70 flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Posez une question (ex: À quelle voiture est l'étudiant matricule 2401-ENI ?)"
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600 min-h-[42px]"
                    />
                    <Button type="submit" loading={loading} disabled={!input.trim()}>
                        <Send className="w-4 h-4" />
                        <span>Envoyer</span>
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export const AgentIAPage: React.FC = () => {
    const { isAuthenticated } = useAuth();

    if (isAuthenticated) {
        return (
            <Layout title="Agent IA — Assistant VoyageE">
                <AgentChatPanel />
            </Layout>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-eni-800 whitespace-nowrap"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Accueil</span>
                    </Link>
                    <span className="text-xs font-medium text-eni-700">Agent IA · Admin &amp; Chefs de voiture</span>
                </div>
                <AgentChatPanel />
            </div>
        </div>
    );
};

export default AgentIAPage;