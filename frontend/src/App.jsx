import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import RiderDashboard from "./pages/RiderDashboard";
import ChatPage from "./pages/ChatPage";
import ReviewPage from "./pages/ReviewPage";
import BalancePage from "./pages/BalancePage";

export default function App() {
  return (
    <div className="page">
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/rider"
          element={
            <ProtectedRoute>
              <RiderDashboard />
            </ProtectedRoute>
          }
        />
        {/* One dashboard for everyone now — anything driver-specific lives
            inside RiderDashboard, gated by whether the account has a car. */}
        <Route path="/driver" element={<Navigate to="/rider" replace />} />
        <Route
          path="/chat/:rideRequestId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review/:rideRequestId"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/balance"
          element={
            <ProtectedRoute>
              <BalancePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}
