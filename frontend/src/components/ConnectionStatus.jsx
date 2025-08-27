import React, { useEffect, useState } from 'react';

const ConnectionStatus = () => {
    const [apiStatus, setApiStatus] = useState({ status: 'checking', message: 'Checking...', latency: null });
    const [dbStatus, setDbStatus] = useState({ status: 'checking', message: 'Checking...', latency: null });
    const [lastChecked, setLastChecked] = useState(null);

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    const checkApiStatus = async () => {
        const startTime = Date.now();
        try {
            const response = await fetch(`${API_BASE_URL}/ping`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const latency = Date.now() - startTime;

            if (response.ok) {
                setApiStatus({
                    status: 'connected',
                    message: 'Backend API is running',
                    latency: latency
                });
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            setApiStatus({
                status: 'disconnected',
                message: error.message.includes('Failed to fetch')
                    ? 'Backend API is unreachable'
                    : `API Error: ${error.message}`,
                latency: null
            });
            return false;
        }
    };

    const checkDatabaseStatus = async () => {
        const startTime = Date.now();
        try {
            const response = await fetch(`${API_BASE_URL}/health/db`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const latency = Date.now() - startTime;

                         if (response.ok) {
                 const data = await response.json();
                 if (data.status === 'ok' && data.neo4j === 'up') {
                     setDbStatus({
                         status: 'connected',
                         message: `Neo4j database is running`,
                         latency: data.latency_ms || latency
                     });
                 } else {
                     throw new Error('Database not ready');
                 }
             } else if (response.status === 503) {
                 // Service Unavailable - Neo4j is starting up
                 setDbStatus({
                     status: 'starting',
                     message: 'Neo4j is starting up, please wait...',
                     latency: null
                 });
                 return;
             } else {
                 throw new Error(`HTTP ${response.status}`);
             }
        } catch (error) {
            setDbStatus({
                status: 'disconnected',
                message: error.message.includes('Failed to fetch')
                    ? 'Neo4j database is unreachable'
                    : `Database Error: ${error.message}`,
                latency: null
            });
        }
    };

    const checkAllConnections = async () => {
        setLastChecked(new Date());
        await Promise.all([checkApiStatus(), checkDatabaseStatus()]);
    };

    useEffect(() => {
        // Initial check
        checkAllConnections();

        // Set up periodic checks every 30 seconds
        const interval = setInterval(checkAllConnections, 30000);

        return () => clearInterval(interval);
    }, []);

         const getStatusIcon = (status) => {
         switch (status) {
             case 'connected': return '🟢';
             case 'disconnected': return '🔴';
             case 'starting': return '🟠';
             case 'checking': return '🟡';
             default: return '⚪';
         }
     };

         const getStatusColor = (status) => {
         switch (status) {
             case 'connected': return '#10b981';
             case 'disconnected': return '#ef4444';
             case 'starting': return '#f97316';
             case 'checking': return '#f59e0b';
             default: return '#6b7280';
         }
     };

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            marginTop: '24px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1f2937'
                }}>
                    🔗 System Status
                </h3>

                <button
                    onClick={checkAllConnections}
                    style={{
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: '#374151'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                >
                    🔄 Refresh
                </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {/* API Status */}
                <div style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: `2px solid ${getStatusColor(apiStatus.status)}20`
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '8px'
                    }}>
                        <span style={{ fontSize: '16px', marginRight: '8px' }}>
                            {getStatusIcon(apiStatus.status)}
                        </span>
                        <span style={{
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                        }}>
                            Backend API
                        </span>
                    </div>

                    <p style={{
                        margin: '0 0 8px 0',
                        fontSize: '12px',
                        color: getStatusColor(apiStatus.status),
                        fontWeight: '500'
                    }}>
                        {apiStatus.message}
                    </p>

                    {apiStatus.latency && (
                        <p style={{
                            margin: 0,
                            fontSize: '11px',
                            color: '#6b7280'
                        }}>
                            Response time: {apiStatus.latency}ms
                        </p>
                    )}
                </div>

                {/* Database Status */}
                <div style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: `2px solid ${getStatusColor(dbStatus.status)}20`
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '8px'
                    }}>
                        <span style={{ fontSize: '16px', marginRight: '8px' }}>
                            {getStatusIcon(dbStatus.status)}
                        </span>
                        <span style={{
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                        }}>
                            Neo4j Database
                        </span>
                    </div>

                    <p style={{
                        margin: '0 0 8px 0',
                        fontSize: '12px',
                        color: getStatusColor(dbStatus.status),
                        fontWeight: '500'
                    }}>
                        {dbStatus.message}
                    </p>

                    {dbStatus.latency && (
                        <p style={{
                            margin: 0,
                            fontSize: '11px',
                            color: '#6b7280'
                        }}>
                            Query time: {dbStatus.latency}ms
                        </p>
                    )}
                </div>
            </div>

            {/* Overall Status Summary */}
                         <div style={{
                 marginTop: '16px',
                 padding: '12px',
                 backgroundColor: apiStatus.status === 'connected' && dbStatus.status === 'connected'
                     ? '#ecfdf5' 
                     : (dbStatus.status === 'starting' ? '#fff7ed' : '#fef2f2'),
                 borderRadius: '6px',
                 border: `1px solid ${apiStatus.status === 'connected' && dbStatus.status === 'connected'
                     ? '#d1fae5' 
                     : (dbStatus.status === 'starting' ? '#fed7aa' : '#fecaca')}`
             }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                                         <span style={{
                         fontSize: '12px',
                         fontWeight: '500',
                         color: apiStatus.status === 'connected' && dbStatus.status === 'connected'
                             ? '#065f46' 
                             : (dbStatus.status === 'starting' ? '#ea580c' : '#991b1b')
                     }}>
                         {apiStatus.status === 'connected' && dbStatus.status === 'connected'
                             ? '✅ All systems operational'
                             : dbStatus.status === 'starting'
                             ? '🚀 Neo4j is starting up - services will be available shortly'
                             : '⚠️ Some services may be unavailable'}
                     </span>

                    {lastChecked && (
                        <span style={{
                            fontSize: '10px',
                            color: '#6b7280'
                        }}>
                            Last checked: {lastChecked.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionStatus;
