import React from "react";

export const AuthContext = React.createContext(null);
export const useAuth = () => React.useContext(AuthContext);

const PUBLIC_PATHS = new Set([
  "/Welcome",
  "/PinAccess",
  "/Setup",
  "/InitialSetup",
  "/VerifySetup",
  "/Activate",
  "/TenantActivate",
  "/returnlogin",
]);

function readPinSession() {
  const raw =
    localStorage.getItem("employee_session") ||
    sessionStorage.getItem("911-session");

  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!session?.id) return null;

    return {
      id: session.id,
      email: session.email || session.userEmail || "",
      full_name: session.full_name || session.userName || "",
      role: session.role || session.userRole || "user",
      userRole: session.userRole || session.role || "user",
      position: session.position || session.role || session.userRole || "user",
      permissions: session.permissions || {},
      permissions_list: session.permissions_list || [],
    };
  } catch {
    return null;
  }
}

export default function AuthGate({ children }) {
  const [user, setUser] = React.useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  React.useEffect(() => {
    const currentPath = window.location.pathname;
    const isPublicPath = PUBLIC_PATHS.has(currentPath);
    const sessionUser = readPinSession();

    if (sessionUser) {
      setUser(sessionUser);
      setIsCheckingAuth(false);
      return;
    }

    setUser(null);
    setIsCheckingAuth(false);

    if (!isPublicPath) {
      window.location.href = "/Welcome";
    }
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("employee_session");
    sessionStorage.removeItem("911-session");
    setUser(null);
    window.location.href = "/Welcome";
  };

  if (isCheckingAuth) {
    return null;
  }

  if (user) {
    return (
      <AuthContext.Provider value={{ user, handleLogout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  const currentPath = window.location.pathname;
  if (PUBLIC_PATHS.has(currentPath)) {
    return <>{children}</>;
  }

  return null;
}
