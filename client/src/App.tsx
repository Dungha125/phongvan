import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireCheckin from './components/RequireCheckin';
import CheckInPage from './pages/CheckInPage';
import LoginPage from './pages/LoginPage';
import ViewPage from './pages/ViewPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireCheckin>
              <CheckInPage />
            </RequireCheckin>
          }
        />
        <Route path="/view" element={<Navigate to="/view/1" replace />} />
        <Route path="/view/:tableId" element={<ViewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
