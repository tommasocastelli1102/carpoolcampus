import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/theme.css";

// No <React.StrictMode> here on purpose: @react-google-maps/api's OverlayView
// (used by CampusMap for the home/destination/driver pins) is a class
// component whose mount lifecycle doesn't survive StrictMode's dev-only
// double-invoke — pins silently fail to render. StrictMode has no effect in
// production builds anyway, so this only changes local dev behavior.
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
