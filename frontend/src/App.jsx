import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import RiderDashboard from "./pages/RiderDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import ChatPage from "./pages/ChatPage";
import ReviewPage from "./pages/ReviewPage";

export default function App() {
  return (
    <div className="page">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/rider"
          element={
            <ProtectedRoute requireRole="rider">
              <RiderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver"
          element={
            <ProtectedRoute requireRole="driver">
              <DriverDashboard />
            </ProtectedRoute>
          }
        />
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
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
