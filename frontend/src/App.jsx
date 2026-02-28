import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const onLogin = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const onRegister = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const onLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return showRegister ? (
      <Register onRegister={onRegister} onSwitch={() => setShowRegister(false)} />
    ) : (
      <Login onLogin={onLogin} onSwitch={() => setShowRegister(true)} />
    );
  }

  return <Chat user={user} onLogout={onLogout} />;
}
