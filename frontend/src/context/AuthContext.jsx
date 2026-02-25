import { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';
import ResultCode from '../constants/resultcodes';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const response = await authAPI.getCurrentUser();

            if (response.result.code === ResultCode.SUCCESS) {
                // Backend JWT claims'den role donduruyor, direkt al
                setUser(response.result.data);
                setIsAuthenticated(true);
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.log('Kullanici giris yapmamis');
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            const response = await authAPI.login(username, password);

            if (response.result.code === ResultCode.SUCCESS) {
                await checkAuth();
                return { success: true, data: response.result };
            } else {
                return { success: false, data: response.result };
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                data: { message: 'Baglanti hatasi!' }
            };
        }
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } catch (error) {
            console.error('Logout hatasi:', error);
        } finally {
            setUser(null);
            setIsAuthenticated(false);
        }
    };

    const register = async (username, password, confirmPassword, email) => {
        try {
            const response = await authAPI.register(
                username,
                password,
                confirmPassword,
                email
            );
            return { success: true, data: response.result };
        } catch (error) {
            console.error('Register error:', error);
            return {
                success: false,
                data: { message: 'Kayit hatasi!' }
            };
        }
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        register,
        checkAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
