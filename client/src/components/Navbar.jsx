import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Cloud, ShieldCheck } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();

    return (
        <nav className="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Cloud className="text-primary w-8 h-8" />
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    SmartVault
                </span>
            </div>
            
            {user && (
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-2 text-text-muted">
                        <ShieldCheck className="w-4 h-4 text-accent" />
                        <span className="text-sm">{user.email}</span>
                    </div>
                    <button onClick={logout} className="btn btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
