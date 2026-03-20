import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect } from "react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,   // Recarga en desktop al volver al tab
      refetchOnReconnect: true,     // Recarga al recuperar red
      retry: 1,
      staleTime: 30 * 1000,         // 30s — sincroniza cambios entre dispositivos
    },
  },
})

// Invalida queries cuando el app vuelve al frente en iOS/Android (Capacitor)
function AppSyncListener() {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return null;
}

function App() {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <AppSyncListener />
        <Pages />
        <Toaster />
      </QueryClientProvider>
    </>
  )
}

export default App 