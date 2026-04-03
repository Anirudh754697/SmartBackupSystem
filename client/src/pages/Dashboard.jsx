import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Upload, File as FileIcon, History, RotateCcw, 
    Download, AlertTriangle, CheckCircle, Info, 
    ChevronRight, Clock, HardDrive, Shield 
} from 'lucide-react';
import api from '../services/api';

const Dashboard = () => {
    const [files, setFiles] = useState([]);
    const [suggestions, setSuggestions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null); // For history modal
    const [versions, setVersions] = useState([]);
    const [message, setMessage] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [filesRes, sugRes] = await Promise.all([
                api.get('/files'),
                api.get('/suggestions')
            ]);
            setFiles(filesRes.data);
            setSuggestions(sugRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/upload', formData);
            setMessage({ 
                type: res.data.warning ? 'warning' : 'success', 
                text: res.data.message 
            });
            fetchData();
            setTimeout(() => setMessage(null), 5000);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Upload failed' });
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
            setMessage({ type: 'success', text: res.data.message });
            fetchData();
            setSelectedFile(null);
        } catch (err) {
            setMessage({ type: 'error', text: 'Restore failed' });
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-8">
                <header className="flex justify-between items-end">
                    <div>
                        <h2 className="text-4xl font-bold mb-2">My Backups</h2>
                        <p className="text-text-muted">Manage your files and version history</p>
                    </div>
                    <div className="relative">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleUpload} 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => fileInputRef.current.click()}
                            disabled={uploading}
                            className={`btn btn-primary flex items-center gap-2 px-8 py-3 rounded-xl shadow-lg shadow-primary/20 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Upload className={`w-5 h-5 ${uploading ? 'animate-bounce' : ''}`} />
                            {uploading ? 'Uploading...' : 'Secure Backup'}
                        </button>
                    </div>
                </header>

                {message && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-4 rounded-xl flex items-center gap-4 ${
                            message.type === 'success' ? 'bg-accent/10 border border-accent/30 text-accent' :
                            message.type === 'warning' ? 'bg-warning/10 border border-warning/30 text-warning' :
                            'bg-danger/10 border border-danger/30 text-danger'
                        }`}
                    >
                        {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
                         message.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : 
                         <Info className="w-5 h-5" />}
                        <span className="font-medium">{message.text}</span>
                    </motion.div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-text-muted animate-pulse">Scanning vault...</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="glass rounded-3xl p-20 text-center border-dashed border-2 border-surface-light">
                        <div className="bg-surface p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                            <Shield className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Your vault is empty</h3>
                        <p className="text-text-muted max-w-sm mx-auto mb-8">Start by uploading your sensitive documents. We'll track versions automatically.</p>
                        <button onClick={() => fileInputRef.current.click()} className="btn btn-secondary">
                            Upload First File
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {files.map((file) => (
                            <motion.div 
                                key={file._id}
                                layoutId={file._id}
                                className="glass card hover:border-primary/50 transition-colors group"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-primary/10 p-3 rounded-lg">
                                        <FileIcon className="text-primary w-6 h-6" />
                                    </div>
                                    <span className="bg-surface-light px-3 py-1 rounded-full text-xs font-bold text-text-muted">
                                        v{file.latestVersion?.versionNumber || 1}
                                    </span>
                                </div>
                                <h4 className="text-lg font-bold truncate mb-1">{file.fileName}</h4>
                                <div className="flex items-center gap-4 text-xs text-text-muted mb-6">
                                    <span className="flex items-center gap-1">
                                        <HardDrive className="w-3 h-3" />
                                        {(file.latestVersion?.fileSize / 1024).toFixed(2)} KB
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(file.latestVersion?.uploadedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => viewHistory(file)}
                                        className="flex-grow btn btn-secondary text-sm py-2"
                                    >
                                        <History className="w-4 h-4" />
                                        History
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(file._id, file.latestVersion._id, file.fileName)}
                                        className="btn btn-primary text-sm py-2 px-3"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
                <div className="glass p-6 rounded-2xl border-l-4 border-accent">
                    <div className="flex items-center gap-2 mb-4 text-accent">
                        <Shield className="w-5 h-5" />
                        <h3 className="font-bold">Smart Insights</h3>
                    </div>
                    {suggestions ? (
                        <>
                            <p className="text-2xl font-bold mb-2">{suggestions.suggestion}</p>
                            <p className="text-sm text-text-muted leading-relaxed">
                                {suggestions.reason}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-text-muted italic">Analyzing your habits...</p>
                    )}
                </div>

                <div className="glass p-6 rounded-2xl border-l-4 border-primary">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Info className="w-5 h-5 text-primary" />
                        Storage Info
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-text-muted">Total Files</span>
                            <span className="font-bold">{files.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-text-muted">Avg Versions</span>
                            <span className="font-bold">2.4</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* History Modal */}
            <AnimatePresence>
                {selectedFile && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedFile(null)}
                            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="glass w-full max-w-2xl rounded-3xl overflow-hidden relative z-10"
                        >
                            <div className="p-8 border-b border-surface-light flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold mb-1">Version History</h3>
                                    <p className="text-text-muted truncate max-w-md">{selectedFile.fileName}</p>
                                </div>
                                <button onClick={() => setSelectedFile(null)} className="btn btn-secondary p-2 rounded-full">
                                    <RotateCcw className="w-5 h-5 rotate-45" />
                                </button>
                            </div>
                            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                                {versions.map((v, index) => (
                                    <div key={v._id} className={`flex items-center justify-between p-4 rounded-2xl ${index === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-surface'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${index === 0 ? 'bg-primary text-white' : 'bg-surface-light text-text-muted'}`}>
                                                v{v.versionNumber}
                                            </div>
                                            <div>
                                                <p className="font-bold">{index === 0 ? 'Current Version' : `Archive v${v.versionNumber}`}</p>
                                                <p className="text-xs text-text-muted">{new Date(v.uploadedAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleDownload(selectedFile._id, v._id, selectedFile.fileName)}
                                                className="btn btn-secondary p-2"
                                                title="Download this version"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            {index !== 0 && (
                                                <button 
                                                    onClick={() => handleRestore(selectedFile._id, v._id)}
                                                    className="btn btn-primary flex items-center gap-2 py-2 px-4 text-xs"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    Restore
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
        </div>
    );
};

export default Dashboard;
