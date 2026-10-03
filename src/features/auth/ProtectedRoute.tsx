import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
export default function ProtectedRoute(){const {user,profile,loading}=useAuth();const loc=useLocation();if(loading)return <div className="center-screen"><div className="spinner"/></div>;if(!user)return <Navigate to="/login" replace/>;if(!profile&&loc.pathname!=='/setup')return <Navigate to="/setup" replace/>;return <Outlet/>}
