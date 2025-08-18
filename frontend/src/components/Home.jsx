
import React from "react";
import "../styles/home.css";

function Home({ user }) {
  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to <span className="gradient-text">Universal Knowledge‑Graph Builder</span>
          </h1>
          <p className="hero-subtitle">
            Convert TXT files and URLs into an interactive knowledge graph. Ingest content, visualize nodes/edges,
            and ask natural‑language questions over your graph.
          </p>
          <div className="hero-buttons">
            <a href="/ingest" className="btn-primary">Ingest Content</a>
            <a href="/graph" className="btn-secondary">View Graph</a>
            <a href="/qa" className="btn-secondary">Ask Questions</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-icon">📄</div>
            <span>TXT & URLs</span>
          </div>
          <div className="floating-card card-2">
            <div className="card-icon">🗺️</div>
            <span>Graph</span>
          </div>
          <div className="floating-card card-3">
            <div className="card-icon">❓</div>
            <span>Q&A</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          {user && (
            <div className="dashboard-header" style={{ marginBottom: 24 }}>
              <div className="welcome-section">
                <h2 className="welcome-title">Welcome back, {user.name || 'Guest'}!</h2>
                <p className="welcome-subtitle">Pick a task below to continue.</p>
              </div>
            </div>
          )}

          <h2 className="section-title">Project Capabilities</h2>
          <p className="section-subtitle">Everything you need to build and query a knowledge graph</p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📄</div>
              <h3>Ingest TXT & URLs</h3>
              <p>Upload .txt files or provide URLs (≤ 100 MB total). We extract clean text and prepare it for graph building.</p>
              <a href="/ingest" className="card-button">Open Ingest</a>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Visualize the Graph</h3>
              <p>See files as nodes connected to chunk nodes, including sequential NEXT edges, in a simple interactive view.</p>
              <a href="/graph" className="card-button">Open Graph</a>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">❓</div>
              <h3>Ask NL Questions</h3>
              <p>Query your knowledge graph with natural language and receive answers with source context.</p>
              <a href="/qa" className="card-button">Open Q&A</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
