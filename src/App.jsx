import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
// HashRouter, not BrowserRouter: GitHub Pages has no server to rewrite deep
// links back to index.html, so a refresh on any other path would 404.
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from '@/lib/PageNotFound';
import { OwnerProvider } from '@/lib/OwnerContext';
import ScrollToTop from '@/components/ScrollToTop';
import Wishlist from '@/pages/Wishlist';

function App() {
  return (
    <OwnerProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Wishlist />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </OwnerProvider>
  )
}

export default App
