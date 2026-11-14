import React, { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, ArrowLeft } from "lucide-react";
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

const SUGGESTIONS = [
    "Dans quelle voiture est l'étudiant de matricule 2401-ENI ?",
    "Quels étudiants ne sont pas encore affectés à une voiture ?",
    "Qui sont les chefs de voiture et combien de places restent libres ?",
    "Quel est le programme du jour 2 ?",
];

const AgentChatPanel: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome",
            role: "assistant",
            text: "Bonjour ! Je suis l'Agent IA VoyageE connecté en direct à la base de données. Posez-moi vos questions sur les étudiants (matricule, parcours, contact), les voitures, les chefs de voiture ou le programme des 7 jours.",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
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
                    text: data.reply,
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

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => sendMessage(s)}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-eni-600 hover:text-eni-800 transition-colors cursor-pointer disabled:opacity-50"
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

            <Card padding="none" className="flex flex-col h-[62vh] min-h-[420px] overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
                    <MessageSquare className="w-4 h-4 text-eni-700" />
                    <span className="font-display text-sm font-semibold text-slate-900">
                        Assistant Base de Données — VoyageE ENI
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user"
                                    ? "bg-eni-700 text-white"
                                    : "bg-slate-100 text-slate-800 border border-slate-200"
                                    }`}
                            >
                                {m.text}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl px-4 py-3 text-sm bg-slate-100 text-slate-500 border border-slate-200">
                                Recherche dans la base de données...
                            </div>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-white flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Posez une question (ex: À quelle voiture est l'étudiant matricule 2401-ENI ?)"
                        className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600 min-h-[42px]"
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
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-eni-800"
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