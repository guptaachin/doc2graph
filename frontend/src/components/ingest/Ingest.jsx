import React, { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE;
const KG_BASE = `${API_BASE}/knowledge-graph`;

export default function Ingest() {
  const [txtFile, setTxtFile] = useState(null);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');

  const uploadTxt = async (e) => {
    e.preventDefault();
    if (!txtFile) return;
    setStatus('Uploading...');
    const form = new FormData();
    form.append('file', txtFile);
    const res = await fetch(`${KG_BASE}/ingest-text`, { method: 'POST', body: form });
    const data = await res.json();
    setStatus(data.status === 'success' ? 'Uploaded ✔️' : `Error: ${data.message || 'Unknown'}`);
  };

  const submitUrl = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus('Fetching URL...');
    const res = await fetch(`${KG_BASE}/ingest-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    setStatus(data.status === 'success' ? 'Ingested URL ✔️' : `Error: ${data.detail || data.message || 'Unknown'}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Ingest Content</h1>
        <div className="space-y-6">
          <form onSubmit={uploadTxt} className="bg-white p-4 rounded border">
            <h2 className="font-semibold mb-2">Upload .txt file</h2>
            <input type="file" accept=".txt" onChange={(e) => setTxtFile(e.target.files?.[0] || null)} />
            <button type="submit" className="ml-3 px-3 py-1 bg-blue-600 text-white rounded">Upload</button>
          </form>

          <form onSubmit={submitUrl} className="bg-white p-4 rounded border">
            <h2 className="font-semibold mb-2">Fetch from URL</h2>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="border px-2 py-1 w-full max-w-xl" />
            <button type="submit" className="mt-3 px-3 py-1 bg-indigo-600 text-white rounded">Ingest URL</button>
          </form>

          {status && <div className="text-sm text-gray-700">{status}</div>}
        </div>
      </div>
    </div>
  );
}


