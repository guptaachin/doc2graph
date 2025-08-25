import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const KNOWLEDGE_GRAPH_BASE = `${API_BASE}/knowledge-graph`;

export default function QADebug() {
  const [status, setStatus] = useState("Starting...");
  const [files, setFiles] = useState([]);
  const [apiResponse, setApiResponse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      setStatus("Testing API connection...");
      
      // Test 1: Basic ping
      console.log("Testing API_BASE:", API_BASE);
      const pingResponse = await fetch(`${API_BASE}/ping`);
      console.log("Ping response:", pingResponse.status);
      
      if (!pingResponse.ok) {
        throw new Error(`Ping failed: ${pingResponse.status}`);
      }
      
      const pingData = await pingResponse.json();
      console.log("Ping data:", pingData);
      
      // Test 2: Files endpoint
      setStatus("Testing files endpoint...");
      const filesResponse = await fetch(`${KNOWLEDGE_GRAPH_BASE}/files`);
      console.log("Files response:", filesResponse.status);
      
      if (!filesResponse.ok) {
        throw new Error(`Files failed: ${filesResponse.status}`);
      }
      
      const filesData = await filesResponse.json();
      console.log("Files data:", filesData);
      setFiles(filesData);
      
      // Test 3: Q&A endpoint
      if (filesData.length > 0) {
        setStatus("Testing Q&A endpoint...");
        const qaResponse = await fetch(`${KNOWLEDGE_GRAPH_BASE}/qa?question=test`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        });
        
        console.log("Q&A response:", qaResponse.status);
        
        if (!qaResponse.ok) {
          const errorText = await qaResponse.text();
          throw new Error(`Q&A failed: ${qaResponse.status} - ${errorText}`);
        }
        
        const qaData = await qaResponse.json();
        console.log("Q&A data:", qaData);
        setApiResponse(qaData);
        setStatus("All tests passed!");
      } else {
        setStatus("API connection working, but no files found for Q&A test");
      }
      
    } catch (err) {
      console.error("API test error:", err);
      setError(err.message);
      setStatus("API test failed");
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace', 
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1>Q&A API Debug</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Configuration:</h3>
        <p><strong>API_BASE:</strong> {API_BASE}</p>
        <p><strong>KNOWLEDGE_GRAPH_BASE:</strong> {KNOWLEDGE_GRAPH_BASE}</p>
        <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Status:</h3>
        <p style={{ 
          color: error ? 'red' : status.includes('passed') ? 'green' : 'blue',
          fontWeight: 'bold' 
        }}>
          {status}
        </p>
      </div>
      
      {error && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Error:</h3>
          <p style={{ color: 'red', backgroundColor: '#ffe6e6', padding: '10px' }}>
            {error}
          </p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Files Found ({files.length}):</h3>
        {files.length === 0 ? (
          <p>No files uploaded yet. Go to /ingest to upload documents.</p>
        ) : (
          <ul>
            {files.map((file, index) => (
              <li key={index}>
                <strong>{file.filename}</strong> - {file.total_chunks} chunk(s)
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {apiResponse && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Sample Q&A Response:</h3>
          <pre style={{ 
            backgroundColor: '#e8f5e8', 
            padding: '10px', 
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      )}
      
      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={testConnection}
          style={{
            backgroundColor: '#4338ca',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Run Tests Again
        </button>
      </div>
    </div>
  );
}
