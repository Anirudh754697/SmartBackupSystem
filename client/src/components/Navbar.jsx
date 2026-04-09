import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Cloud, ShieldCheck } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();

    return (
        <nav className="glass navbar">
            <div className="navbar-brand">
                <Cloud />
                <span className="brand-text">SmartVault</span>
            </div>
            
            {user && (
                <div className="navbar-user">
                    <div className="navbar-email">
                        <ShieldCheck />
                        <span>{user.email}</span>
                    </div>
                    <button onClick={logout} className="btn btn-secondary">
                        <LogOut style={{ width: 16, height: 16 }} />
                        Logout
                    </button>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
