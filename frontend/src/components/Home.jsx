
import React from "react";
import "../styles/home.css";
import ConnectionStatus from "./ConnectionStatus";

function Home({ user }) {
  return (
    <div className="home-container">
      <div className="welcome-section">
        <h1 className="welcome-title">
          Welcome to <span className="gradient-text">Universal Knowledge‑Graph Builder</span>
        </h1>
        <p className="welcome-message">
          Convert TXT files and URLs into an interactive knowledge graph.
          Visualize connections and ask natural language questions about your content.
        </p>

        <ConnectionStatus />
      </div>
    </div>
  );
}

export default Home;
