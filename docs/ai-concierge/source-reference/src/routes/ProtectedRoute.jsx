import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import { saveReturnUrl } from '@/constants/login-constants';

const ProtectedRoute = ({ element }) => {
	const { isAuthenticated, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return null;
	}

	if (!isAuthenticated) {
		saveReturnUrl(location.pathname + location.search);
		return <Navigate to="/" replace />;
	}

	return element;
};

export default ProtectedRoute;
