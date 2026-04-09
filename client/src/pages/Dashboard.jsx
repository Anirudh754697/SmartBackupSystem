import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Upload, File as FileIcon, History, RotateCcw, 
    Download, AlertTriangle, CheckCircle, Info, 
    Clock, HardDrive, Shield, X, Trash2, 
    FolderPlus, Folder, FolderOpen, ChevronRight,
    Home, MoreVertical, Move, Edit3
} from 'lucide-react';
import api from '../services/api';

const Dashboard = () => {
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [suggestions, setSuggestions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [versions, setVersions] = useState([]);
    const [message, setMessage] = useState(null);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [folderPath, setFolderPath] = useState([{ id: null, name: 'Root' }]);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [moveModal, setMoveModal] = useState(null);
    const [moveFolders, setMoveFolders] = useState([]);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, [currentFolderId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = currentFolderId ? `?folderId=${currentFolderId}` : '';
            const [filesRes, foldersRes, sugRes] = await Promise.all([
                api.get(`/files${params}`),
                api.get(`/folders${params ? `?parentId=${currentFolderId}` : ''}`),
                api.get('/suggestions')
            ]);
            setFiles(filesRes.data);
            setFolders(foldersRes.data);
            setSuggestions(sugRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        if (currentFolderId) formData.append('folderId', currentFolderId);

        try {
            const res = await api.post('/upload', formData);
            showMessage(res.data.warning ? 'warning' : 'success', res.data.message);
            fetchData();
        } catch (err) {
            showMessage('error', err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const viewHistory = async (file) => {
        setSelectedFile(file);
        try {
            const res = await api.get(`/files/${file._id}/versions`);
            setVersions(res.data);
        } catch (err) {
            console.error('Error fetching versions:', err);
        }
    };

    const handleRestore = async (fileId, versionId) => {
        try {
            const res = await api.post(`/files/${fileId}/restore/${versionId}`);
            showMessage('success', res.data.message);
            const versionsRes = await api.get(`/files/${fileId}/versions`);
            setVersions(versionsRes.data);
            fetchData();
        } catch (err) {
            showMessage('error', 'Restore failed');
        }
    };

    const handleDeleteVersion = async (fileId, versionId) => {
        if (!window.confirm('Delete this version? This cannot be undone.')) return;
        try {
            const res = await api.delete(`/files/${fileId}/versions/${versionId}`);
            showMessage('success', res.data.message);
            if (res.data.fileDeleted) {
                setSelectedFile(null);
            } else {
                const versionsRes = await api.get(`/files/${fileId}/versions`);
                setVersions(versionsRes.data);
            }
            fetchData();
        } catch (err) {
            showMessage('error', 'Delete failed');
        }
    };

    const handleDownload = async (fileId, versionId, fileName) => {
        try {
            const response = await api.get(`/files/${fileId}/download/${versionId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    // ─── Folder operations ───
    const createFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await api.post('/folders', { name: newFolderName.trim(), parentId: currentFolderId });
            setNewFolderName('');
            setShowNewFolder(false);
            fetchData();
        } catch (err) {
            showMessage('error', err.response?.data?.error || 'Could not create folder');
        }
    };

    const navigateToFolder = (folderId, folderName) => {
        setCurrentFolderId(folderId);
        if (folderId === null) {
            setFolderPath([{ id: null, name: 'Root' }]);
        } else {
            const existingIndex = folderPath.findIndex(f => f.id === folderId);
            if (existingIndex >= 0) {
                setFolderPath(folderPath.slice(0, existingIndex + 1));
            } else {
                setFolderPath([...folderPath, { id: folderId, name: folderName }]);
            }
        }
    };

    const handleDeleteFolder = async (folderId) => {
        if (!window.confirm('Delete this folder and ALL its contents? This cannot be undone.')) return;
        try {
            await api.delete(`/folders/${folderId}`);
            showMessage('success', 'Folder deleted');
            fetchData();
        } catch (err) {
            showMessage('error', 'Failed to delete folder');
        }
    };

    const handleRenameFolder = async (folderId, newName) => {
        try {
            await api.patch(`/folders/${folderId}`, { name: newName });
            fetchData();
        } catch (err) {
            showMessage('error', err.response?.data?.error || 'Rename failed');
        }
    };

    const openMoveModal = async (file) => {
        setMoveModal(file);
        try {
            const res = await api.get('/folders');
            setMoveFolders(res.data);
        } catch (err) { console.error(err); }
    };

    const handleMoveFile = async (fileId, targetFolderId) => {
        try {
            await api.patch(`/files/${fileId}/move`, { folderId: targetFolderId });
            showMessage('success', 'File moved');
            setMoveModal(null);
            fetchData();
        } catch (err) {
            showMessage('error', 'Move failed');
        }
    };

    const totalVersions = files.reduce((acc, f) => acc + (f.versionCount || 0), 0);
    const avgVersions = files.length > 0 ? (totalVersions / files.length).toFixed(1) : '0';

    return (
        <div className="dashboard-grid">
            {/* Main Content */}
            <div>
                <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h2>My Backups</h2>
                        <p>Manage your files and version history</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setShowNewFolder(true)} className="btn btn-secondary">
                            <FolderPlus style={{ width: 16, height: 16 }} />
                            New Folder
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
                        <button 
                            onClick={() => fileInputRef.current.click()}
                            disabled={uploading}
                            className="btn btn-primary"
                            style={{ padding: '0.8rem 1.8rem' }}
                        >
                            <Upload style={{ width: 18, height: 18 }} className={uploading ? 'animate-bounce' : ''} />
                            {uploading ? 'Uploading...' : 'Secure Backup'}
                        </button>
                    </div>
                </div>

                {/* Breadcrumb */}
                <div className="breadcrumb" style={{ marginBottom: '1.25rem' }}>
                    {folderPath.map((crumb, i) => (
                        <span key={crumb.id || 'root'} className="breadcrumb-item">
                            {i > 0 && <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />}
                            <button 
                                onClick={() => navigateToFolder(crumb.id, crumb.name)}
                                className={`breadcrumb-link ${i === folderPath.length - 1 ? 'active' : ''}`}
                            >
                                {i === 0 ? <Home style={{ width: 14, height: 14 }} /> : null}
                                {crumb.name}
                            </button>
                        </span>
                    ))}
                </div>

                {/* New Folder Input */}
                <AnimatePresence>
                    {showNewFolder && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="glass card"
                            style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                        >
                            <Folder style={{ width: 20, height: 20, color: 'var(--warning)', flexShrink: 0 }} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Folder name..."
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                                autoFocus
                            />
                            <button onClick={createFolder} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Create</button>
                            <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="btn btn-secondary">
                                <X style={{ width: 16, height: 16 }} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {message && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`status-message ${
                            message.type === 'success' ? 'status-success' :
                            message.type === 'warning' ? 'status-warning' : 'status-error'
                        }`}
                        style={{ marginBottom: '1.25rem' }}
                    >
                        {message.type === 'success' ? <CheckCircle style={{ width: 18, height: 18 }} /> : 
                         message.type === 'warning' ? <AlertTriangle style={{ width: 18, height: 18 }} /> : 
                         <Info style={{ width: 18, height: 18 }} />}
                        <span>{message.text}</span>
                    </motion.div>
                )}

                {loading ? (
                    <div className="spinner-container">
                        <div className="spinner"></div>
                        <p className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Scanning vault...</p>
                    </div>
                ) : (folders.length === 0 && files.length === 0) ? (
                    <div className="glass empty-state">
                        <div className="empty-icon"><Shield /></div>
                        <h3>{currentFolderId ? 'This folder is empty' : 'Your vault is empty'}</h3>
                        <p>Upload files or create folders to organize your backups.</p>
                        <button onClick={() => fileInputRef.current.click()} className="btn btn-secondary">
                            Upload First File
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Folders */}
                        {folders.length > 0 && (
                            <div className="files-grid" style={{ marginBottom: '1.5rem' }}>
                                {folders.map((folder) => (
                                    <motion.div 
                                        key={folder._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass card file-card folder-card"
                                        onDoubleClick={() => navigateToFolder(folder._id, folder.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="file-card-header">
                                            <div className="file-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                                                <FolderOpen style={{ color: 'var(--warning)' }} />
                                            </div>
                                        </div>
                                        <div className="file-name">{folder.name}</div>
                                        <div className="file-meta">
                                            <span><Clock />{new Date(folder.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="file-actions">
                                            <button 
                                                onClick={() => navigateToFolder(folder._id, folder.name)}
                                                className="btn btn-secondary"
                                            >
                                                <FolderOpen style={{ width: 14, height: 14 }} /> Open
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newName = prompt('Rename folder:', folder.name);
                                                    if (newName && newName.trim()) handleRenameFolder(folder._id, newName);
                                                }}
                                                className="btn btn-secondary"
                                                title="Rename"
                                            >
                                                <Edit3 style={{ width: 14, height: 14 }} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder._id); }}
                                                className="btn btn-secondary"
                                                title="Delete folder"
                                                style={{ color: 'var(--danger)' }}
                                            >
                                                <Trash2 style={{ width: 14, height: 14 }} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Files */}
                        {files.length > 0 && (
                            <div className="files-grid">
                                {files.map((file) => (
                                    <motion.div 
                                        key={file._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass card file-card"
                                    >
                                        <div className="file-card-header">
                                            <div className="file-icon-box"><FileIcon /></div>
                                            <span className="version-badge">
                                                v{file.latestVersion?.versionNumber || 1}
                                                {file.versionCount > 1 && ` · ${file.versionCount} versions`}
                                            </span>
                                        </div>
                                        <div className="file-name">{file.fileName}</div>
                                        <div className="file-meta">
                                            <span>
                                                <HardDrive />
                                                {file.latestVersion ? (file.latestVersion.fileSize / 1024).toFixed(2) + ' KB' : '—'}
                                            </span>
                                            <span>
                                                <Clock />
                                                {file.latestVersion ? new Date(file.latestVersion.uploadedAt).toLocaleDateString() : '—'}
                                            </span>
                                        </div>
                                        <div className="file-actions">
                                            <button onClick={() => viewHistory(file)} className="btn btn-secondary">
                                                <History style={{ width: 14, height: 14 }} /> History
                                            </button>
                                            <button onClick={() => openMoveModal(file)} className="btn btn-secondary" title="Move">
                                                <Move style={{ width: 14, height: 14 }} />
                                            </button>
                                            {file.latestVersion && (
                                                <button 
                                                    onClick={() => handleDownload(file._id, file.latestVersion._id, file.fileName)}
                                                    className="btn btn-primary"
                                                >
                                                    <Download style={{ width: 14, height: 14 }} />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Sidebar */}
            <aside className="sidebar">
                <div className="glass sidebar-card accent">
                    <div className="sidebar-title" style={{ color: 'var(--accent)' }}>
                        <Shield /> Smart Insights
                    </div>
                    {suggestions ? (
                        <>
                            <p className="suggestion-text">{suggestions.suggestion}</p>
                            <p className="suggestion-reason">{suggestions.reason}</p>
                        </>
                    ) : (
                        <p className="suggestion-reason" style={{ fontStyle: 'italic' }}>Analyzing...</p>
                    )}
                </div>

                <div className="glass sidebar-card primary">
                    <div className="sidebar-title" style={{ color: 'var(--primary)' }}>
                        <Info /> Storage Info
                    </div>
                    <div>
                        <div className="sidebar-stat">
                            <span className="label">Total Files</span>
                            <span className="value">{files.length}</span>
                        </div>
                        <div className="sidebar-stat">
                            <span className="label">Folders Here</span>
                            <span className="value">{folders.length}</span>
                        </div>
                        <div className="sidebar-stat">
                            <span className="label">Avg Versions</span>
                            <span className="value">{avgVersions}</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ─── Version History Modal ─── */}
            <AnimatePresence>
                {selectedFile && (
                    <div className="modal-overlay">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setSelectedFile(null)} className="modal-backdrop"
                        />
                        <motion.div 
                            initial={{ scale: 0.92, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 20 }}
                            className="glass modal-content"
                        >
                            <div className="modal-header">
                                <div>
                                    <h3>Version History</h3>
                                    <p>{selectedFile.fileName}</p>
                                </div>
                                <button onClick={() => setSelectedFile(null)} className="modal-close">
                                    <X style={{ width: 18, height: 18 }} />
                                </button>
                            </div>
                            <div className="modal-body">
                                {versions.map((v, index) => (
                                    <div key={v._id} className={`version-item ${index === 0 ? 'current' : ''}`}>
                                        <div className="version-left">
                                            <div className={`version-number ${index === 0 ? 'current' : 'archive'}`}>
                                                v{v.versionNumber}
                                            </div>
                                            <div className="version-info">
                                                <p>{index === 0 ? 'Current Version' : `Version ${v.versionNumber}`}</p>
                                                <span>
                                                    {new Date(v.uploadedAt).toLocaleString()} · {(v.fileSize / 1024).toFixed(1)} KB
                                                </span>
                                            </div>
                                        </div>
                                        <div className="version-actions">
                                            <button 
                                                onClick={() => handleDownload(selectedFile._id, v._id, selectedFile.fileName)}
                                                className="btn btn-secondary" title="Download"
                                            >
                                                <Download style={{ width: 14, height: 14 }} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteVersion(selectedFile._id, v._id)}
                                                className="btn btn-secondary" title="Delete this version"
                                                style={{ color: 'var(--danger)' }}
                                            >
                                                <Trash2 style={{ width: 14, height: 14 }} />
                                            </button>
                                            {index !== 0 && (
                                                <button 
                                                    onClick={() => handleRestore(selectedFile._id, v._id)}
                                                    className="btn btn-primary"
                                                >
                                                    <RotateCcw style={{ width: 12, height: 12 }} /> Restore
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Move File Modal ─── */}
            <AnimatePresence>
                {moveModal && (
                    <div className="modal-overlay">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setMoveModal(null)} className="modal-backdrop"
                        />
                        <motion.div 
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            className="glass modal-content"
                        >
                            <div className="modal-header">
                                <div>
                                    <h3>Move File</h3>
                                    <p>Select destination for "{moveModal.fileName}"</p>
                                </div>
                                <button onClick={() => setMoveModal(null)} className="modal-close">
                                    <X style={{ width: 18, height: 18 }} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <button 
                                    onClick={() => handleMoveFile(moveModal._id, null)}
                                    className="version-item"
                                    style={{ cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' }}
                                >
                                    <div className="version-left">
                                        <div className="version-number archive"><Home style={{ width: 16, height: 16 }} /></div>
                                        <div className="version-info"><p>Root (No folder)</p></div>
                                    </div>
                                </button>
                                {moveFolders.map((f) => (
                                    <button 
                                        key={f._id}
                                        onClick={() => handleMoveFile(moveModal._id, f._id)}
                                        className="version-item"
                                        style={{ cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' }}
                                    >
                                        <div className="version-left">
                                            <div className="version-number archive" style={{ background: 'rgba(245,158,11,0.15)' }}>
                                                <Folder style={{ width: 16, height: 16, color: 'var(--warning)' }} />
                                            </div>
                                            <div className="version-info"><p>{f.name}</p></div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
