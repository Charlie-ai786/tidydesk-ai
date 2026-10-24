import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Notification } from './components/Notification';
import { Dashboard } from './views/Dashboard';
import { Scanner } from './views/Scanner';
import { Suggestions } from './views/Suggestions';
import { History } from './views/History';
import { Settings } from './views/Settings';
import { useAppStore } from './store/appStore';
import './index.css';

function App() {
  const { currentView, checkOllama, loadHistory } = useAppStore();

  useEffect(() => {
    // Initial checks on app load
    checkOllama();
    loadHistory();
    // Re-check Ollama every 30 seconds
    const interval = setInterval(checkOllama, 30_000);
    return () => clearInterval(interval);
  }, [checkOllama, loadHistory]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':   return <Dashboard />;
      case 'scanner':     return <Scanner />;
      case 'suggestions': return <Suggestions />;
      case 'history':     return <History />;
      case 'settings':    return <Settings />;
      default:            return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117] text-slate-200">
      <Sidebar />
      <main className="main-content flex-1" role="main" id="main-content">
        {renderView()}
      </main>
      <Notification />
    </div>
  );
}

export default App;
