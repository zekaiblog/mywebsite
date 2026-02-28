import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Load chat sessions
    fetch(`${API_BASE}/api/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((data) => {
        const userSessions = data.sessions || [];
        setSessions(userSessions);

        // If no sessions exist, create a new one
        if (userSessions.length === 0) {
          return fetch(`${API_BASE}/api/sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ title: 'New Chat' })
          }).then(r => r.json());
        } else {
          // Use the most recent session
          return { session: userSessions[0] };
        }
      })
      .then((result) => {
        if (result.session) {
          setCurrentSession(result.session);
          loadSessionMessages(result.session.id);
        }
      });

    const socketUrl = API_BASE ? new URL(API_BASE).origin : window.location.origin;
    const s = io(socketUrl, { auth: { token } });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('chat:message', (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          content: msg.content,
          imageUrl: msg.imageUrl,
          isFromBot: msg.isFromBot,
          createdAt: msg.createdAt,
        },
      ]);
    });
    setSocket(s);
    return () => s.close();
  }, [user?.id]);

  const loadSessionMessages = (sessionId) => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/api/messages/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        setMessages(
          (data.messages || []).map((m) => ({
            content: m.content,
            imageUrl: m.image_url,
            isFromBot: !!m.is_from_bot,
            createdAt: m.created_at,
          }))
        );
      })
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (currentSession && socket?.connected) {
      socket.emit('join:session', currentSession.id);
    }
  }, [currentSession, socket?.connected]);

  const createNewChat = () => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: 'New Chat' })
    })
      .then(r => r.json())
      .then((result) => {
        const newSession = result.session;
        setSessions(prev => [newSession, ...prev]);
        setCurrentSession(newSession);
        setMessages([]);
        setLoadingHistory(false);
      });
  };

  const switchSession = (session) => {
    setCurrentSession(session);
    setMessages([]);
    setLoadingHistory(true);
    loadSessionMessages(session.id);
  };

  const clearAllHistory = () => {
    if (!window.confirm('Are you sure you want to delete all chat history? This action cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/api/sessions`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(() => {
        setSessions([]);
        setCurrentSession(null);
        setMessages([]);
        setLoadingHistory(false);
      });
  };

  const clearCurrentSession = () => {
    if (!currentSession) return;

    if (!window.confirm('Are you sure you want to clear all messages in this chat?')) {
      return;
    }

    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/api/messages/${currentSession.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(() => {
        setMessages([]);
      });
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) return null;

    setUploadingImage(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.imageUrl;
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadingImage(false);
    }
    return null;
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !selectedImage) || !socket?.connected || !currentSession) return;

    let imageUrl = null;
    if (selectedImage) {
      imageUrl = await uploadImage();
      if (!imageUrl) return; // Upload failed
    }

    socket.emit('chat:message', { content: text || 'Image', imageUrl });
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="sessions-list">
          <h3>Chat History</h3>
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
              onClick={() => switchSession(session)}
            >
              <span className="session-title">{session.title}</span>
              <span className="session-date">
                {new Date(session.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <header className="chat-header">
          <div>
            <h1>Chat</h1>
            <p className="chat-user">@{user?.username}</p>
          </div>
          <div className="chat-header-right">
            <button type="button" className="btn-new-chat" onClick={createNewChat}>
              New Chat
            </button>
            {currentSession && (
              <button type="button" className="btn-clear-session" onClick={clearCurrentSession}>
                Clear Chat
              </button>
            )}
            <button type="button" className="btn-clear-all" onClick={clearAllHistory}>
              Clear All History
            </button>
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
            <div className="message-bubble">
              {m.imageUrl && (
                <img
                  src={`${API_BASE}${m.imageUrl}`}
                  alt="Uploaded"
                  className="message-image"
                  onLoad={() => listRef.current?.scrollTo(0, listRef.current.scrollHeight)}
                />
              )}
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input-wrap">
        {imagePreview && (
          <div className="image-preview">
            <img src={imagePreview} alt="Preview" />
            <button
              type="button"
              className="btn-remove-image"
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              ×
            </button>
          </div>
        )}
        <div className="input-controls">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || uploadingImage}
            title="Upload image"
          >
            📎
          </button>
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
            disabled={!connected || (!input.trim() && !selectedImage) || uploadingImage}
          >
            {uploadingImage ? 'Uploading…' : 'Send'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
