import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import SignModule from './components/SignModule';
import BatchSignModule from './components/BatchSignModule';
import VerifyModule from './components/VerifyModule';

function App() {
  const [activeTab, setActiveTab] = useState('sign');

  return (
    <div className="App">
      <h1>ЭЦП НУЦ РК</h1>

      <div className="section">
        <button
          onClick={() => setActiveTab('sign')}
          disabled={activeTab === 'sign'}
        >
          Sign Document
        </button>
        <button
          onClick={() => setActiveTab('batch-sign')}
          disabled={activeTab === 'batch-sign'}
          style={{ marginLeft: '10px' }}
        >
          Batch Sign
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          disabled={activeTab === 'verify'}
          style={{ marginLeft: '10px' }}
        >
          Verify Document
        </button>
      </div>

      {activeTab === 'sign' && <SignModule />}
      {activeTab === 'verify' && <VerifyModule />}
      {activeTab === 'batch-sign' && <BatchSignModule />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
