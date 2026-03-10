import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
})

function App() {
  return (
    <>
      <QueryClientProvider client={queryClient}>
      <Pages />
      <Toaster />
      </QueryClientProvider>
    </>
  )
}

export default App 