import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** requireRole: "driver" | "rider" — user.role "both" always satisfies either. */
export default function ProtectedRoute({ children, requireRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="row" style={{ justifyContent: "center", padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireRole && user.role !== requireRole && user.role !== "both") {
    return <Navigate to={user.role === "driver" ? "/driver" : "/rider"} replace />;
  }

  return children;
}
