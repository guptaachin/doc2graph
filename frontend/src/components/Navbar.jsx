
import React from "react";
import { Link, useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav style={styles.navbar}>
      <div style={styles.container}>
        <div style={styles.brand}>
          <Link to="/home" style={styles.brandLink}>
            <span style={styles.brandIcon}>🧠</span>
            Universal KG Builder
          </Link>
        </div>

        <div style={styles.navLinks}>
          <Link 
            to="/home" 
            style={{
              ...styles.navLink,
              ...(isActive('/home') ? styles.activeLink : {})
            }}
          >
            Home
          </Link>
          
          <Link 
            to="/ingest" 
            style={{
              ...styles.navLink,
              ...(isActive('/ingest') ? styles.activeLink : {})
            }}
          >
            Ingest
          </Link>
          
          <Link 
            to="/graph" 
            style={{
              ...styles.navLink,
              ...(isActive('/graph') ? styles.activeLink : {})
            }}
          >
            Graph
          </Link>

          <Link 
            to="/qa" 
            style={{
              ...styles.navLink,
              ...(isActive('/qa') ? styles.activeLink : {})
            }}
          >
            Q&A
          </Link>
        </div>


      </div>
    </nav>
  );
}

const styles = {
  navbar: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 5%',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
  },
  brandLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    color: '#1a202c',
    fontSize: '1.5rem',
    fontWeight: '700',
    transition: 'color 0.2s ease',
  },
  brandIcon: {
    fontSize: '1.75rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  navLink: {
    color: '#4a5568',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '0.95rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  activeLink: {
    color: '#667eea',
    background: 'rgba(102, 126, 234, 0.1)',
  },
};

// Add hover effects
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    nav a:hover {
      color: #667eea !important;
      background: rgba(102, 126, 234, 0.05) !important;
    }
    
    nav button:hover {
      background: #f7fafc !important;
      border-color: #cbd5e0 !important;
    }
    
    .login-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
    }
  `;
  document.head.appendChild(styleSheet);
}

export default Navbar;
