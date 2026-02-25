import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginRegister from './pages/LoginRegister';
import Dashboard from './pages/Dashboard';
import HealthCheck from './pages/HealthCheck';
import CeyizListesi from './pages/CeyizListesi';


function MainRouter() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<LoginRegister />} />

                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

                    <Route path="/716f00dec2034ea9" element={<PrivateRoute><HealthCheck /></PrivateRoute>} />

                    {/*<Route path="/ceyiz" element={<PrivateRoute><CeyizListesi /></PrivateRoute>} />*/}

                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default MainRouter;
