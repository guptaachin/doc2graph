import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from './components/Navbar';
import Home from "./components/Home";
import QA from "./components/QAchatbot/QAChatWindow";
import Ingest from "./components/ingest/Ingest";
import GraphView from "./components/graph/GraphView";
import LoginView from './components/login/LoginView';
import ProfileView from './components/login/ProfileView';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLoginSuccess = (data) => {
    const user = data.user || { name: 'Guest', email: 'guest@example.com', sub: 'guest' };
    const token = data.access_token || 'guest-token';
    setUser(user);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />

      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/home" element={<Home user={user} />} />

        <Route
          path="/login"
          element={!user ? <LoginView onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/home" replace />}
        />

        <Route path="/ingest" element={<Ingest user={user} token={localStorage.getItem("token")} />} />
        <Route path="/graph" element={<GraphView user={user} token={localStorage.getItem("token")} />} />
        <Route path="/qa" element={<QA user={user} token={localStorage.getItem("token")} />} />

        <Route
          path="/profile"
          element={user ? <ProfileView user={user} /> : <Navigate to="/login" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
