import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import { api } from './lib/api';
import ClassDetail from './pages/ClassDetail';
import Compare from './pages/Compare';
import Home from './pages/Home';
import InstructorDetail from './pages/InstructorDetail';
import OpenSeats from './pages/OpenSeats';
import Statistics from './pages/Statistics';

export default function App() {
  useEffect(() => {
    void api.getSearchIndex().catch(() => undefined);
  }, []);

  return (
    <BrowserRouter>
      <Navbar />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/class/:code" element={<ClassDetail />} />
          <Route path="/instructor/:id" element={<InstructorDetail />} />
          <Route path="/stats" element={<Statistics />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/seats" element={<OpenSeats />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
