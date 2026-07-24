import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Gallery from './pages/Gallery';
import VisaoGeral from './pages/VisaoGeral';
import Engenharia from './pages/Engenharia';
import EngenhariaObras from './pages/EngenhariaObras';
import EngenhariaObraDetalhe from './pages/EngenhariaObraDetalhe';

export default function App() {
  return (
    <BrowserRouter basename="/mockups-v2">
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/visao-geral" element={<VisaoGeral />} />
        <Route path="/engenharia" element={<Engenharia />} />
        <Route path="/engenharia/obras" element={<EngenhariaObras />} />
        <Route path="/engenharia/obras/obra-exemplo" element={<EngenhariaObraDetalhe />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
