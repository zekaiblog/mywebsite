import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_BASE}/api/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        setMessages(
          (data.messages || []).map((m) => ({
            content: m.content,
            isFromBot: !!m.is_from_bot,
            createdAt: m.created_at,
          }))
        );
      })
      .finally(() => setLoadingHistory(false));

    const socketUrl = API_BASE ? new URL(API_BASE).origin : window.location.origin;
    const s = io(socketUrl, { auth: { token } });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('chat:message', (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          content: msg.content,
          isFromBot: msg.isFromBot,
          createdAt: msg.createdAt,
        },
      ]);
    });
    setSocket(s);
    return () => s.close();
  }, [user?.id]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !socket?.connected) return;
    socket.emit('chat:message', text);
    setInput('');
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div>
          <h1>Chat</h1>
          <p className="chat-user">@{user?.username}</p>
        </div>
        <div className="chat-header-right">
          <span className={`status ${connected ? 'online' : 'offline'}`}>
            {connected ? 'Online' : 'Connecting…'}
          </span>
          <button type="button" className="btn-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="chat-messages" ref={listRef}>
        {loadingHistory && (
          <div className="message system">Loading history…</div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div className="message system">
            Say hi! The assistant will reply automatically.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`message ${m.isFromBot ? 'bot' : 'user'}`}
          >
            <span className="message-label">
              {m.isFromBot ? 'Assistant' : 'You'}
            </span>
            <div className="message-bubble">{m.content}</div>
          </div>
        ))}
      </div>

      <div className="chat-input-wrap">
        <input
          type="text"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={!connected}
        />
        <button
          type="button"
          className="btn-send"
          onClick={send}
          disabled={!connected || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
