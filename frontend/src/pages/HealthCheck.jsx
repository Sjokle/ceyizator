import Swal from 'sweetalert2';
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthAPI } from '../services/api';
import ResultCode from '../constants/resultcodes';
import '../App.css';

function HealthCheck() {
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Emin misin?',
            text: 'Cikis yapmak istedigine emin misin?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, cikis yap',
            cancelButtonText: 'Iptal'
        });

        if (result.isConfirmed) {
            await logout();
            navigate('/');
            Swal.fire({
                title: 'Cikis Yapildi',
                text: 'Basariyla cikis yaptiniz',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    // Sessiz kontrol (otomatik - swal gostermez)
    const fetchHealthSilent = useCallback(async () => {
        try {
            const response = await healthAPI.checkHealth();
            if (response.result.code === ResultCode.SUCCESS || response.result.code === ResultCode.ERROR) {
                setHealthData(response.result.data);
                setLastCheck(new Date().toLocaleString('tr-TR'));
            }
        } catch (error) {
            console.error('Health check hatasi:', error);
        }
    }, []);

    // Onload + 30sn interval
    useEffect(() => {
        fetchHealthSilent(); // Sayfa acilinca hemen cek

        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchHealthSilent();
        }, 30000); // 30 saniye

        return () => clearInterval(interval); // Sayfa kapaninca temizle
    }, [fetchHealthSilent, autoRefresh]);

    // Manuel kontrol (butona basilince - swal gosterir)
    const handleHealthCheck = async () => {
        setLoading(true);
        try {
            const response = await healthAPI.checkHealth();

            if (response.result.code === ResultCode.SUCCESS) {
                setHealthData(response.result.data);
                setLastCheck(new Date().toLocaleString('tr-TR'));
                Swal.fire({
                    title: 'Sistem Saglikli!',
                    text: 'Tum servisler calisiyor',
                    icon: 'success',
                    confirmButtonText: 'Tamam'
                });
            } else {
                setHealthData(response.result.data);
                setLastCheck(new Date().toLocaleString('tr-TR'));
                Swal.fire({
                    title: 'Sistem Hatasi!',
                    text: 'Bazi servisler calismiyor!',
                    icon: 'error',
                    confirmButtonText: 'Tamam'
                });
            }
        } catch (error) {
            console.error('Health check hatasi:', error);
            Swal.fire({
                title: 'Baglanti Hatasi',
                text: 'Sunucuya erisilemiyor!',
                icon: 'error',
                confirmButtonText: 'Tamam'
            });
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => status ? '✅' : '❌';
    const getStatusText = (status) => status ? 'Calisiyor' : 'Kapali';
    const getStatusClass = (status) => status ? 'status-healthy' : 'status-error';

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h2>System Health Check</h2>
                <div className="dashboard-user">
                    <span>Hosgeldin, {user?.username}</span>
                    <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                    <button onClick={handleLogout}>Cikis Yap</button>
                </div>
            </div>

            <div className="health-check-container">
                <div className="health-check-card">
                    <h1>Sistem Saglik Kontrolu</h1>
                    <p className="health-check-description">
                        Sunucu ve servislerin durumunu kontrol edin
                    </p>

                    {/* Auto refresh toggle */}
                    <div className="auto-refresh-toggle">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                            <span>Otomatik yenile (30sn)</span>
                        </label>
                    </div>

                    <button
                        className="health-check-button"
                        onClick={handleHealthCheck}
                        disabled={loading}
                    >
                        {loading ? 'Kontrol Ediliyor...' : 'Sistemi Kontrol Et'}
                    </button>

                    {lastCheck && (
                        <p className="last-check">Son Kontrol: {lastCheck}</p>
                    )}

                    {healthData && (
                        <div className="health-results">
                            <h2>Sonuclar</h2>

                            <div className="health-item">
                                <div className="health-item-header">
                                    <span className="health-icon">{getStatusIcon(healthData.mongodb)}</span>
                                    <span className="health-name">MongoDB</span>
                                </div>
                                <span className={`health-status ${getStatusClass(healthData.mongodb)}`}>
                                    {getStatusText(healthData.mongodb)}
                                </span>
                            </div>

                            <div className="health-item">
                                <div className="health-item-header">
                                    <span className="health-icon">{getStatusIcon(healthData.redis)}</span>
                                    <span className="health-name">Redis Cache</span>
                                </div>
                                <span className={`health-status ${getStatusClass(healthData.redis)}`}>
                                    {getStatusText(healthData.redis)}
                                </span>
                            </div>

                            {healthData.response_time_ms && (
                                <div className="health-item">
                                    <div className="health-item-header">
                                        <span className="health-icon">⚡</span>
                                        <span className="health-name">Response Time</span>
                                    </div>
                                    <span className="health-status status-info">
                                        {healthData.response_time_ms} ms
                                    </span>
                                </div>
                            )}

                            <div className="health-summary">
                                {healthData.mongodb && healthData.redis ? (
                                    <div className="summary-success">
                                        <h3>Tum Sistemler Normal</h3>
                                        <p>Servisler sorunsuz calisiyor</p>
                                    </div>
                                ) : (
                                    <div className="summary-error">
                                        <h3>Dikkat Gerekli</h3>
                                        <p>Bazi servisler yanit vermiyor</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {!healthData && !loading && (
                        <div className="health-placeholder">
                            <p>Yukleniiyor...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default HealthCheck;
