import React, { useEffect, useState, useRef, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const KG_BASE = `${API_BASE}/knowledge-graph`;

export default function InteractiveGraphView() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, scale: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  
  const width = 1200;
  const height = 800;

  // Force-directed layout simulation
  const [simulation, setSimulation] = useState({
    nodes: [],
    forces: {
      charge: -300,
      linkDistance: 100,
      centerForce: 0.1
    }
  });

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching graph data from:", `${KG_BASE}/graph`);
      const res = await fetch(`${KG_BASE}/graph`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("Graph data received:", data);
      
      // Initialize node positions with force-directed layout
      const nodesWithPositions = (data.nodes || []).map((node, index) => {
        const angle = (2 * Math.PI * index) / Math.max(data.nodes.length, 1);
        const radius = node.type === 'file' ? 200 : 150;
        
        return {
          ...node,
          x: width/2 + radius * Math.cos(angle) + (Math.random() - 0.5) * 100,
          y: height/2 + radius * Math.sin(angle) + (Math.random() - 0.5) * 100,
          vx: 0,
          vy: 0,
          fx: null, // fixed position x
          fy: null, // fixed position y
        };
      });

      setGraph({ 
        nodes: nodesWithPositions, 
        edges: data.edges || [] 
      });
      
    } catch (err) {
      console.error("Error fetching graph data:", err);
      setError(err.message);
    }
    setLoading(false);
  }, []);

  // Simple force simulation
  useEffect(() => {
    if (graph.nodes.length === 0) return;

    const interval = setInterval(() => {
      setGraph(prevGraph => {
        const nodes = [...prevGraph.nodes];
        const edges = prevGraph.edges;
        
        // Apply forces
        nodes.forEach((node, i) => {
          if (node.fx !== null && node.fy !== null) return; // Skip fixed nodes
          
          let fx = 0, fy = 0;
          
          // Repulsion force between nodes
          nodes.forEach((other, j) => {
            if (i === j) return;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
              const force = 500 / (distance * distance);
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          });
          
          // Attraction force for connected nodes
          edges.forEach(edge => {
            let other = null;
            if (edge.source === node.id) {
              other = nodes.find(n => n.id === edge.target);
            } else if (edge.target === node.id) {
              other = nodes.find(n => n.id === edge.source);
            }
            
            if (other) {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const targetDistance = edge.type === 'HAS_CHUNK' ? 120 : 80;
              const force = (distance - targetDistance) * 0.1;
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          });
          
          // Center force
          const centerX = width / 2;
          const centerY = height / 2;
          fx += (centerX - node.x) * 0.01;
          fy += (centerY - node.y) * 0.01;
          
          // Update velocity
          node.vx = (node.vx + fx) * 0.8; // damping
          node.vy = (node.vy + fy) * 0.8;
          
          // Update position
          node.x += node.vx;
          node.y += node.vy;
          
          // Boundary constraints
          node.x = Math.max(50, Math.min(width - 50, node.x));
          node.y = Math.max(50, Math.min(height - 50, node.y));
        });
        
        return { ...prevGraph, nodes };
      });
    }, 50);

    // Stop simulation after some time
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [graph.nodes.length, width, height]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const handleMouseDown = (event, node) => {
    event.preventDefault();
    setIsDragging(true);
    setDraggedNode(node.id);
    setSelectedNode(node);
    
    // Fix the node position during drag
    setGraph(prevGraph => ({
      ...prevGraph,
      nodes: prevGraph.nodes.map(n => 
        n.id === node.id ? { ...n, fx: n.x, fy: n.y } : n
      )
    }));
  };

  const handleMouseMove = (event) => {
    if (!isDragging || !draggedNode) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / viewBox.scale - viewBox.x;
    const y = (event.clientY - rect.top) / viewBox.scale - viewBox.y;
    
    setGraph(prevGraph => ({
      ...prevGraph,
      nodes: prevGraph.nodes.map(n => 
        n.id === draggedNode ? { ...n, x, y, fx: x, fy: y } : n
      )
    }));
  };

  const handleMouseUp = () => {
    if (draggedNode) {
      // Unfix the node position
      setGraph(prevGraph => ({
        ...prevGraph,
        nodes: prevGraph.nodes.map(n => 
          n.id === draggedNode ? { ...n, fx: null, fy: null } : n
        )
      }));
    }
    
    setIsDragging(false);
    setDraggedNode(null);
  };

  const handleZoom = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, viewBox.scale * delta));
    
    setViewBox(prev => ({
      ...prev,
      scale: newScale
    }));
  };

  const resetView = () => {
    setViewBox({ x: 0, y: 0, scale: 1 });
  };

  const getNodeColor = (node) => {
    if (selectedNode && selectedNode.id === node.id) return '#ef4444'; // red
    if (hoveredNode === node.id) return '#f59e0b'; // amber
    return node.type === 'file' ? '#3b82f6' : '#10b981'; // blue or green
  };

  const getNodeRadius = (node) => {
    const baseRadius = node.type === 'file' ? 20 : 12;
    const hoverMultiplier = hoveredNode === node.id ? 1.3 : 1;
    const selectedMultiplier = selectedNode && selectedNode.id === node.id ? 1.5 : 1;
    return baseRadius * hoverMultiplier * selectedMultiplier;
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#6b7280', fontSize: '18px' }}>Loading Knowledge Graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ 
          textAlign: 'center', 
          backgroundColor: 'white', 
          padding: '40px', 
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ color: '#ef4444', fontSize: '18px', marginBottom: '20px' }}>
            ❌ Error loading graph: {error}
          </p>
          <button
            onClick={fetchGraphData}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc', 
      fontFamily: 'system-ui, sans-serif',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700', color: '#1f2937' }}>
              Interactive Knowledge Graph
            </h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '16px' }}>
              {graph.nodes.length} nodes, {graph.edges.length} edges • Drag nodes to rearrange • Scroll to zoom
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={resetView}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Reset View
            </button>
            <button
              onClick={fetchGraphData}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div style={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
        {/* Main Graph Area */}
        <div 
          ref={containerRef}
          style={{ 
            flex: 1, 
            position: 'relative', 
            overflow: 'hidden',
            backgroundColor: 'white',
            margin: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${viewBox.x} ${viewBox.y} ${width / viewBox.scale} ${height / viewBox.scale}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleZoom}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {/* Background Grid */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Edges */}
            {graph.edges.map((edge, idx) => {
              const sourceNode = graph.nodes.find(n => n.id === edge.source);
              const targetNode = graph.nodes.find(n => n.id === edge.target);
              
              if (!sourceNode || !targetNode) return null;
              
              return (
                <g key={idx}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={edge.type === 'NEXT' ? '#94a3b8' : '#60a5fa'}
                    strokeWidth={edge.type === 'NEXT' ? 2 : 3}
                    opacity="0.7"
                    markerEnd="url(#arrowhead)"
                  />
                  {/* Edge Label */}
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2}
                    fontSize="10"
                    fill="#6b7280"
                    textAnchor="middle"
                    dy="-5"
                    style={{ pointerEvents: 'none' }}
                  >
                    {edge.type}
                  </text>
                </g>
              );
            })}
            
            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#60a5fa"
                />
              </marker>
            </defs>
            
            {/* Nodes */}
            {graph.nodes.map((node) => (
              <g key={node.id}>
                {/* Node Shadow */}
                <circle
                  cx={node.x + 2}
                  cy={node.y + 2}
                  r={getNodeRadius(node)}
                  fill="rgba(0, 0, 0, 0.2)"
                  style={{ pointerEvents: 'none' }}
                />
                
                {/* Main Node */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={getNodeRadius(node)}
                  fill={getNodeColor(node)}
                  stroke="white"
                  strokeWidth="3"
                  style={{ 
                    cursor: 'pointer',
                    filter: hoveredNode === node.id ? 'brightness(1.1)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={(e) => handleMouseDown(e, node)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(node)}
                />
                
                {/* Node Icon */}
                <text
                  x={node.x}
                  y={node.y}
                  fontSize="16"
                  textAnchor="middle"
                  dy="6"
                  fill="white"
                  style={{ pointerEvents: 'none', fontWeight: 'bold' }}
                >
                  {node.type === 'file' ? '📄' : '📝'}
                </text>
                
                {/* Node Label */}
                <text
                  x={node.x}
                  y={node.y + getNodeRadius(node) + 20}
                  fontSize={node.type === 'file' ? '14' : '12'}
                  textAnchor="middle"
                  fill="#374151"
                  fontWeight={node.type === 'file' ? '600' : '400'}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Side Panel */}
        <div style={{ 
          width: '350px', 
          backgroundColor: 'white', 
          margin: '20px 20px 20px 0',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Panel Header */}
          <div style={{ 
            padding: '20px', 
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc',
            borderRadius: '12px 12px 0 0'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
              {selectedNode ? 'Node Details' : 'Graph Statistics'}
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              {selectedNode ? 'Information about the selected node' : 'Overview of your knowledge graph'}
            </p>
          </div>
          
          {/* Panel Content */}
          <div style={{ padding: '20px', flex: 1, overflow: 'auto' }}>
            {selectedNode ? (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd'
                  }}>
                    <span style={{ fontSize: '24px', marginRight: '12px' }}>
                      {selectedNode.type === 'file' ? '📄' : '📝'}
                    </span>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1f2937' }}>
                        {selectedNode.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>
                        {selectedNode.type}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Properties Section */}
                {selectedNode.properties && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Properties
                    </h4>
                    <div style={{ 
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      {Object.entries(selectedNode.properties).map(([key, value], idx) => (
                        <div key={key} style={{ 
                          display: 'flex',
                          borderBottom: idx < Object.entries(selectedNode.properties).length - 1 ? '1px solid #e2e8f0' : 'none'
                        }}>
                          <div style={{ 
                            padding: '8px 12px',
                            backgroundColor: '#f1f5f9',
                            minWidth: '100px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#475569'
                          }}>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                          <div style={{ 
                            padding: '8px 12px',
                            fontSize: '12px',
                            color: '#374151',
                            flex: 1,
                            fontFamily: key.includes('id') || key.includes('date') ? 'monospace' : 'inherit'
                          }}>
                            {value || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Node ID
                  </h4>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '12px', 
                    color: '#6b7280',
                    backgroundColor: '#f3f4f6',
                    padding: '8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }}>
                    {selectedNode.id}
                  </p>
                </div>
                
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Connections ({graph.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length})
                  </h4>
                  {graph.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map((edge, idx) => {
                    const isOutgoing = edge.source === selectedNode.id;
                    const connectedNodeId = isOutgoing ? edge.target : edge.source;
                    const connectedNode = graph.nodes.find(n => n.id === connectedNodeId);
                    
                    return (
                      <div key={idx} style={{ 
                        marginBottom: '8px',
                        padding: '10px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        fontSize: '12px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '4px'
                        }}>
                          <div style={{ fontWeight: '600', color: '#374151' }}>
                            {edge.type}
                          </div>
                          <div style={{ 
                            fontSize: '10px', 
                            color: '#6b7280',
                            backgroundColor: isOutgoing ? '#dbeafe' : '#ecfdf5',
                            padding: '2px 6px',
                            borderRadius: '3px'
                          }}>
                            {isOutgoing ? 'OUTGOING' : 'INCOMING'}
                          </div>
                        </div>
                        <div style={{ color: '#6b7280', marginBottom: '4px' }}>
                          {isOutgoing ? '→' : '←'} {connectedNode ? connectedNode.label : connectedNodeId}
                        </div>
                        {edge.properties && Object.keys(edge.properties).length > 0 && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#9ca3af',
                            fontStyle: 'italic'
                          }}>
                            {Object.entries(edge.properties).map(([key, value]) => (
                              <span key={key}>{key}: {value} </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '12px',
                    padding: '16px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                        {graph.nodes.filter(n => n.type === 'file').length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Files</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                        {graph.nodes.filter(n => n.type === 'chunk').length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Chunks</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#8b5cf6' }}>
                        {graph.edges.length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Edges</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Node Types
                  </h4>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: '#3b82f6', 
                      borderRadius: '50%', 
                      marginRight: '8px' 
                    }}></div>
                    <span style={{ fontSize: '14px', color: '#374151' }}>Files (📄)</span>
                  </div>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: '#10b981', 
                      borderRadius: '50%', 
                      marginRight: '8px' 
                    }}></div>
                    <span style={{ fontSize: '14px', color: '#374151' }}>Chunks (📝)</span>
                  </div>
                </div>
                
                <div style={{ marginTop: '20px', fontSize: '12px', color: '#6b7280' }}>
                  💡 <strong>Tips:</strong>
                  <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                    <li>Click nodes to see details</li>
                    <li>Drag nodes to rearrange</li>
                    <li>Scroll to zoom in/out</li>
                    <li>Nodes will settle into position</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS Animation for loading spinner */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
