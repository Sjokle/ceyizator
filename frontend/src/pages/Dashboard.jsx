import Swal from 'sweetalert2';
import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storiesAPI } from '../services/api';
import ResultCode from '../constants/resultcodes';
import '../App.css';
import { io } from "socket.io-client";

function timestampToDate(ts) {
    if (!ts) return null;
    return new Date(ts * 1000).toLocaleString();
}

function Dashboard() {
    const [storiesApi, setStoriesApi] = useState([]);
    const [storiesFetchedAtApi, setStoriesFetchedAtApi] = useState(null);
    const [storiesHtml, setStoriesHtml] = useState([]);
    const [storiesFetchedAtHtml, setStoriesFetchedAtHtml] = useState(null);

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

    useEffect(() => {
        const socket = io(window.location.origin, {
            path: "/socket.io",
            withCredentials: true,
            transports: ["websocket"]
        });

        socket.on("new_stories", (result) => {
            if (result.code === ResultCode.SUCCESS) {
                setStoriesApi(result.data.stories);
                setStoriesFetchedAtApi(result.data.fetched_at);
            } else if (result.code === ResultCode.ERROR) {
                console.error('Socket hatasi:', result.message);
            }
        });

        socket.on("new_stories_html", (result) => {
            if (result.code === ResultCode.SUCCESS) {
                setStoriesHtml(result.data.stories);
                setStoriesFetchedAtHtml(result.data.fetched_at);
            } else if (result.code === ResultCode.ERROR) {
                console.error('Socket hatasi:', result.message);
            }
        });

        const fetchStories = async () => {
            try {
                const apiData = await storiesAPI.getStories('api');
                if (apiData.result.code === ResultCode.SUCCESS) {
                    setStoriesApi(apiData.result.data.stories);
                    setStoriesFetchedAtApi(apiData.result.data.fetched_at);
                }

                const htmlData = await storiesAPI.getStories('html');
                if (htmlData.result.code === ResultCode.SUCCESS) {
                    setStoriesHtml(htmlData.result.data.stories);
                    setStoriesFetchedAtHtml(htmlData.result.data.fetched_at);
                }
            } catch (error) {
                console.error('fetchStories hatasi:', error);
                Swal.fire({
                    title: 'Hata',
                    text: 'Veriler yuklenirken hata olustu!',
                    icon: 'error',
                    confirmButtonText: 'Tamam'
                });
            }
        };

        fetchStories();

        return () => {
            socket.disconnect();
        };
    }, []);

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h2>Dashboard</h2>
                <div className="dashboard-user">
                    <span>Hosgeldin, {user?.username}</span>
                    {user?.role === 'admin' && (
                        <button onClick={() => navigate('/716f00dec2034ea9')}>Health Check</button>
                    )}
                    {/*<button onClick={() => navigate('/ceyiz')}>Çeyiz Listem</button>*/}

                    <button onClick={handleLogout}>Cikis Yap</button>
                </div>
            </div>

            <div className="dashboard-container">
                <div className="dashboard-left">
                    <h2 style={{ textAlign: "center" }}>API Ile Cekilen Datalar</h2>
                    <ul style={{ listStyleType: "disc", paddingLeft: "20px" }}>
                        {storiesApi.map(story => (
                            <li key={story.id}>
                                <a href={story.url || "#"} target="_blank" rel="noreferrer">
                                    {story.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                    {storiesFetchedAtApi && (
                        <div className="fetched-at">
                            <p>Son Guncelleme: {timestampToDate(storiesFetchedAtApi)}</p>
                        </div>
                    )}
                </div>

                <div className="dashboard-right">
                    <h2 style={{ textAlign: "center" }}>HTML Ile Cekilen Datalar</h2>
                    <ul style={{ listStyleType: "disc", paddingLeft: "20px" }}>
                        {storiesHtml.map(story => (
                            <li key={story.id}>
                                <a href={story.url || "#"} target="_blank" rel="noreferrer">
                                    {story.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                    {storiesFetchedAtHtml && (
                        <div className="fetched-at">
                            <p>Son Guncelleme: {timestampToDate(storiesFetchedAtHtml)}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
