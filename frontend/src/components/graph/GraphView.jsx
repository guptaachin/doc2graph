import React, { useEffect, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE;
const KG_BASE = `${API_BASE}/knowledge-graph`;

export default function GraphView() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${KG_BASE}/graph`);
        const data = await res.json();
        setGraph({ nodes: data.nodes || [], edges: data.edges || [] });
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const width = 900;
  const height = 500;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 180;

  // Place file nodes in a circle, chunk nodes around their file
  const fileNodes = graph.nodes.filter(n => n.type === 'file');
  const chunkNodes = graph.nodes.filter(n => n.type === 'chunk');

  const positions = {};
  fileNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(fileNodes.length, 1);
    positions[n.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
  chunkNodes.forEach((n, i) => {
    // find its file parent from edges
    const parentEdge = graph.edges.find(e => e.type === 'HAS_CHUNK' && e.target === n.id);
    const parent = parentEdge ? positions[parentEdge.source] : { x: centerX, y: centerY };
    const angle = (2 * Math.PI * i) / Math.max(chunkNodes.length, 1);
    positions[n.id] = {
      x: parent.x + 80 * Math.cos(angle),
      y: parent.y + 80 * Math.sin(angle),
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Knowledge Graph</h1>
        <svg width={width} height={height} className="bg-white rounded border">
          {/* edges */}
          {graph.edges.map((e, idx) => (
            <line
              key={idx}
              x1={positions[e.source]?.x}
              y1={positions[e.source]?.y}
              x2={positions[e.target]?.x}
              y2={positions[e.target]?.y}
              stroke={e.type === 'NEXT' ? '#94a3b8' : '#60a5fa'}
              strokeWidth={e.type === 'NEXT' ? 1 : 2}
              opacity="0.8"
            />
          ))}
          {/* nodes */}
          {graph.nodes.map((n) => (
            <g key={n.id}>
              <circle
                cx={positions[n.id]?.x}
                cy={positions[n.id]?.y}
                r={n.type === 'file' ? 18 : 8}
                fill={n.type === 'file' ? '#1d4ed8' : '#10b981'}
                opacity="0.9"
              />
              <text
                x={positions[n.id]?.x + (n.type === 'file' ? 22 : 12)}
                y={positions[n.id]?.y + 4}
                fontSize={n.type === 'file' ? 12 : 10}
                fill="#334155"
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
        <p className="text-sm text-gray-500 mt-2">Blue nodes are files, green nodes are chunks. Light blue edges are HAS_CHUNK, gray edges are NEXT.</p>
      </div>
    </div>
  );
}


