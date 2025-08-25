import React, { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const KNOWLEDGE_GRAPH_BASE = `${API_BASE}/knowledge-graph`;
const AI_CHAT_URL = `${KNOWLEDGE_GRAPH_BASE}/qa`;

export default function QAChatWindowFixed({ user, token }) {
  const [messages, setMessages] = useState([
    { 
      id: 1,
      sender: "bot", 
      text: "🧠 Hello! I'm your Knowledge Graph assistant. Ask me anything about your uploaded documents and I'll search through them to find answers!",
      timestamp: new Date()
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${KNOWLEDGE_GRAPH_BASE}/files`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data || []);
    } catch (err) {
      console.error("Error fetching files:", err);
      setFiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      text,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('question', text);
      
      if (selectedFiles.length > 0) {
        selectedFiles.forEach(filename => {
          params.append('filenames', filename);
        });
      }

      const response = await fetch(`${AI_CHAT_URL}?${params.toString()}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log("API Response:", data);
      
      let botText = data.answer || data.reply || "I couldn't generate a response.";
      
      if (data.sources && data.sources.length > 0) {
        botText += "\n\n📚 Sources:";
        data.sources.forEach((source, index) => {
          botText += `\n${index + 1}. ${source.filename}`;
          if (source.section && source.section !== "Unknown") {
            botText += ` (${source.section})`;
          }
        });
      }
      
      const botMessage = {
        id: Date.now() + 1,
        sender: "bot",
        text: botText,
        timestamp: new Date()
      };
      
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      
      const errorBotMessage = {
        id: Date.now() + 1,
        sender: "bot",
        text: "I'm having trouble connecting to the server. Please try again.",
        timestamp: new Date(),
        isError: true
      };
      
      setMessages((prev) => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#4338ca', color: 'white', padding: '1rem 2rem', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Q&A Assistant</h1>
        <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>Ask questions about your documents</p>
      </div>

      <div style={{ display: 'flex', maxWidth: '1200px', margin: '0 auto', minHeight: 'calc(100vh - 80px)' }}>
        {/* Main Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', margin: '1rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
          {/* Messages */}
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', maxHeight: '500px' }}>
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                style={{ 
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: msg.sender === 'user' ? '#4338ca' : '#f3f4f6',
                    color: msg.sender === 'user' ? 'white' : '#374151',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  <div>{msg.text}</div>
                  {msg.timestamp && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f3f4f6', borderRadius: '0.75rem', color: '#6b7280' }}>
                  <div>🤔 Thinking...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                style={{
                  backgroundColor: (!input.trim() || isLoading) ? '#9ca3af' : '#4338ca',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Files */}
        <div style={{ width: '300px', backgroundColor: 'white', margin: '1rem 1rem 1rem 0', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
              📁 Files ({files.length})
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              {loading 
                ? "Loading files..." 
                : files.length === 0 
                ? "No files uploaded yet. Go to Ingest to upload documents." 
                : "Select files to search through:"}
            </p>
          </div>
          
          <div style={{ padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                Loading...
              </div>
            ) : files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                <div style={{ fontSize: '0.875rem' }}>No documents available</div>
              </div>
            ) : (
              <div>
                {files.map((file, index) => (
                  <label 
                    key={index}
                    style={{ 
                      display: 'block', 
                      marginBottom: '0.75rem', 
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      backgroundColor: selectedFiles.includes(file.filename) ? '#eff6ff' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.filename)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFiles(prev => [...prev, file.filename]);
                          } else {
                            setSelectedFiles(prev => prev.filter(f => f !== file.filename));
                          }
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', wordBreak: 'break-word' }}>
                          {file.filename}
                        </div>
                        {file.total_chunks && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            {file.total_chunks} chunk{file.total_chunks !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
                
                {files.length > 1 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => setSelectedFiles(files.map(f => f.filename))}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid #d1d5db',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        marginRight: '0.5rem'
                      }}
                    >
                      Select All
                    </button>
                    {selectedFiles.length > 0 && (
                      <button
                        onClick={() => setSelectedFiles([])}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid #d1d5db',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
                
                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.375rem', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: '500' }}>
                      {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '0.125rem' }}>
                      Only selected files will be searched
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
