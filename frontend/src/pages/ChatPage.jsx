import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client, { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ChatPage() {
  const { rideRequestId } = useParams();
  const { user } = useAuth();
  const [ride, setRide] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const wsRef = useRef(null);
  const pollRef = useRef(null);

  const otherParty = useMemo(() => {
    if (!ride || !user) return null;
    return ride.rider_id === user.id ? ride.driver : ride.rider;
  }, [ride, user]);

  const loadThread = useCallback(async () => {
    try {
      const [{ data: rides }, { data: msgs }] = await Promise.all([
        client.get("/rides/my"),
        client.get(`/messages/${rideRequestId}`),
      ]);
      const current = rides.find((r) => String(r.id) === String(rideRequestId));
      setRide(current || null);
      setMessages(msgs);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't load this chat."));
    } finally {
      setLoading(false);
    }
  }, [rideRequestId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time via WebSocket, with polling as a safety net if it can't connect.
  useEffect(() => {
    if (!ride || ride.status !== "confirmed") return undefined;

    const token = localStorage.getItem("cc_token");
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
    const wsUrl = apiBase.startsWith("http")
      ? apiBase.replace(/^http/, "ws") + `/messages/ws/${rideRequestId}?token=${token}`
      : `${protocol}://${window.location.host}${apiBase}/messages/ws/${rideRequestId}?token=${token}`;

    let ws;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      };
      ws.onerror = () => startPolling();
      ws.onclose = () => startPolling();
    } catch {
      startPolling();
    }

    function startPolling() {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        client.get(`/messages/${rideRequestId}`).then(({ data }) => setMessages(data)).catch(() => {});
      }, 3000);
    }

    return () => {
      ws?.close();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [ride, rideRequestId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content }));
    } else {
      try {
        const { data } = await client.post(`/messages/${rideRequestId}`, { content });
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        setError(apiErrorMessage(err, "Couldn't send that message."));
      }
    }
  };

  if (loading) {
    return (
      <div className="row" style={{ justifyContent: "center", padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <p className="error-text">{error || "Ride request not found."}</p>
        <Link to="/rider"><button className="btn btn-ghost" style={{ marginTop: 16 }}>Back</button></Link>
      </div>
    );
  }

  if (ride.status !== "confirmed" && ride.status !== "completed") {
    return (
      <div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>💬</div>
          <h3 style={{ marginBottom: 8 }}>Chat isn't open yet</h3>
          <p className="muted">Chat unlocks once this ride request is confirmed. Current status: {ride.status}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 680 }}>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{otherParty?.first_name} {otherParty?.last_name}</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            {ride.availability ? `${ride.availability.route_from} → ${ride.availability.route_to}` : ride.custom_place}
          </p>
        </div>
        <span className={`badge badge-${ride.status}`}>{ride.status}</span>
      </div>

      <div
        className="card"
        style={{ height: 440, display: "flex", flexDirection: "column", padding: 18, marginBottom: 16 }}
      >
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
          {messages.length === 0 && <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>Say hi 👋</p>}
          {messages.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "75%",
                    background: mine ? "var(--primary)" : "var(--surface-raised)",
                    border: mine ? "none" : "1px solid var(--border)",
                    color: "#fff",
                    padding: "9px 14px",
                    borderRadius: 16,
                    fontSize: 14,
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="row" style={{ gap: 10 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
        <button className="btn btn-primary" style={{ flexShrink: 0 }}>Send</button>
      </form>
    </div>
  );
}
