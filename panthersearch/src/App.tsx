import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ClassDetail from './pages/ClassDetail';
import Compare from './pages/Compare';
import Home from './pages/Home';
import InstructorDetail from './pages/InstructorDetail';
import OpenSeats from './pages/OpenSeats';
import Statistics from './pages/Statistics';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/class/:code" element={<ClassDetail />} />
        <Route path="/instructor/:id" element={<InstructorDetail />} />
        <Route path="/stats" element={<Statistics />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/seats" element={<OpenSeats />} />
      </Routes>
    </BrowserRouter>
  );
}
