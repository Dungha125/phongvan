import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CheckInPage from './pages/CheckInPage';
import ViewPage from './pages/ViewPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CheckInPage />} />
        <Route path="/view" element={<Navigate to="/view/1" replace />} />
        <Route path="/view/:tableId" element={<ViewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
