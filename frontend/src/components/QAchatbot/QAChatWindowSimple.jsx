// Simple Q&A component without Tailwind CSS
import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const KNOWLEDGE_GRAPH_BASE = `${API_BASE}/knowledge-graph`;
const AI_CHAT_URL = `${KNOWLEDGE_GRAPH_BASE}/qa`;

export default function QAChatWindowSimple({ user, token }) {
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

  const containerStyle = {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  };

  const chatBoxStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden'
  };

  const headerStyle = {
    backgroundColor: '#4f46e5',
    color: 'white',
    padding: '20px',
    textAlign: 'center'
  };

  const messagesStyle = {
    height: '400px',
    overflowY: 'auto',
    padding: '20px',
    borderBottom: '1px solid #e5e5e5'
  };

  const messageStyle = {
    marginBottom: '15px',
    padding: '10px',
    borderRadius: '8px'
  };

  const userMessageStyle = {
    ...messageStyle,
    backgroundColor: '#4f46e5',
    color: 'white',
    marginLeft: '20%',
    textAlign: 'right'
  };

  const botMessageStyle = {
    ...messageStyle,
    backgroundColor: '#f3f4f6',
    color: '#333',
    marginRight: '20%'
  };

  const inputContainerStyle = {
    padding: '20px',
    display: 'flex',
    gap: '10px'
  };

  const inputStyle = {
    flex: 1,
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '16px'
  };

  const buttonStyle = {
    backgroundColor: '#4f46e5',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px'
  };

  const sidebarStyle = {
    width: '250px',
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderLeft: '1px solid #e5e5e5'
  };

  const mainLayoutStyle = {
    display: 'flex',
    height: '600px'
  };

  const chatAreaStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={containerStyle}>
      <div style={chatBoxStyle}>
        <div style={headerStyle}>
          <h1 style={{margin: 0, fontSize: '24px'}}>Q&A Assistant</h1>
          <p style={{margin: '5px 0 0 0', opacity: 0.9}}>Ask questions about your documents</p>
        </div>
        
        <div style={mainLayoutStyle}>
          <div style={chatAreaStyle}>
            <div style={messagesStyle}>
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  style={msg.sender === 'user' ? userMessageStyle : botMessageStyle}
                >
                  <div style={{whiteSpace: 'pre-wrap'}}>{msg.text}</div>
                  <small style={{opacity: 0.7, fontSize: '12px'}}>
                    {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString()}
                  </small>
                </div>
              ))}
              {isLoading && (
                <div style={botMessageStyle}>
                  <div>🤔 Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={inputContainerStyle}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents..."
                style={inputStyle}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                style={{
                  ...buttonStyle,
                  opacity: (!input.trim() || isLoading) ? 0.5 : 1,
                  cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </div>

          <div style={sidebarStyle}>
            <h3 style={{marginTop: 0, fontSize: '16px'}}>Files ({files.length})</h3>
            {loading ? (
              <div>Loading files...</div>
            ) : files.length === 0 ? (
              <div style={{color: '#666', fontSize: '14px'}}>
                No files uploaded yet. Go to the Ingest page to upload documents.
              </div>
            ) : (
              <div>
                {files.map((file, index) => (
                  <label key={index} style={{display: 'block', marginBottom: '8px', fontSize: '14px'}}>
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
                      style={{marginRight: '8px'}}
                    />
                    {file.filename}
                  </label>
                ))}
                {selectedFiles.length > 0 && (
                  <div style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
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
