import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Login from './pages/Login';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import DashboardCloser from './pages/closer/DashboardCloser';
import DashboardSDR from './pages/sdr/DashboardSDR';
import VendasAdmin from './pages/admin/VendasAdmin';
import GestaoVendas from './pages/admin/GestaoVendas';
import GestaoUsuarios from './pages/admin/GestaoUsuarios';
import Agenda from './pages/shared/Agenda';
import NovaVenda from './pages/shared/NovaVenda';
import DashboardCicloComercial from './pages/admin/DashboardCicloComercial';

// Middleware for Private Routes
const PrivateRoute = ({ children, roles }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/" />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
    return children;
};

// Auto-routing based on role
const HomeRedirect = () => {
    const { user } = useAuth();
    if (!user) return <Login />;
    if (user.role === 'ADMIN') return <Navigate to="/admin" />;
    if (user.role === 'CLOSER') return <Navigate to="/closer" />;
    if (user.role === 'SDR') return <Navigate to="/sdr" />;
    return <Login />;
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<HomeRedirect />} />
                    
                    <Route path="/admin" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <DashboardAdmin />
                        </PrivateRoute>
                    } />
                    <Route path="/admin/ciclo-comercial" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <DashboardCicloComercial />
                        </PrivateRoute>
                    } />

                    <Route path="/admin/dashboard-sdr" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <DashboardSDR />
                        </PrivateRoute>
                    } />

                    <Route path="/admin/dashboard-closer" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <DashboardCloser />
                        </PrivateRoute>
                    } />

                    <Route path="/admin/vendas" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <VendasAdmin />
                        </PrivateRoute>
                    } />

                    <Route path="/admin/gestao-vendas" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <GestaoVendas />
                        </PrivateRoute>
                    } />
                    <Route path="/admin/agenda" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <Agenda />
                        </PrivateRoute>
                    } />
                    <Route path="/closer/agenda" element={
                        <PrivateRoute roles={['CLOSER']}>
                            <Agenda />
                        </PrivateRoute>
                    } />
                    <Route path="/sdr/agenda" element={
                        <PrivateRoute roles={['SDR']}>
                            <Agenda />
                        </PrivateRoute>
                    } />
                    <Route path="/admin/usuarios" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <GestaoUsuarios />
                        </PrivateRoute>
                    } />
                    <Route path="/admin/*" element={
                        <PrivateRoute roles={['ADMIN']}>
                            <DashboardAdmin />
                        </PrivateRoute>
                    } />
                    
                    <Route path="/closer/nova-venda" element={
                        <PrivateRoute roles={['CLOSER']}>
                            <NovaVenda />
                        </PrivateRoute>
                    } />
                    <Route path="/closer/*" element={
                        <PrivateRoute roles={['CLOSER']}>
                            <DashboardCloser />
                        </PrivateRoute>
                    } />
                    
                    <Route path="/sdr/nova-venda" element={
                        <PrivateRoute roles={['SDR']}>
                            <NovaVenda />
                        </PrivateRoute>
                    } />
                    <Route path="/sdr/*" element={
                        <PrivateRoute roles={['SDR']}>
                            <DashboardSDR />
                        </PrivateRoute>
                    } />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
