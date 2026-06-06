import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Module1TaskMarket from './pages/Module1TaskMarket';
import Module2AuditEngine from './pages/Module2AuditEngine';
import Module3CommitReveal from './pages/Module3CommitReveal';
import Module4Clustering from './pages/Module4Clustering';
import Module5Settlement from './pages/Module5Settlement';

export default function App() {
  return (
    <>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px', overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/module1" element={<Module1TaskMarket />} />
          <Route path="/module2" element={<Module2AuditEngine />} />
          <Route path="/module3" element={<Module3CommitReveal />} />
          <Route path="/module4" element={<Module4Clustering />} />
          <Route path="/module5" element={<Module5Settlement />} />
        </Routes>
      </main>
    </>
  );
}
