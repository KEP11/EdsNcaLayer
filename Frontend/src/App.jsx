import React, { useState, useEffect, useRef } from 'react'
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';

function App() {
  const [activeTab, setActiveTab] = useState('sign');
  const [file, setFile] = useState(null);
  const fileNameRef = useRef('');
  const [filePath, setFilePath] = useState('');
  const [fileDir, setFileDir] = useState('');
  const [storage, setStorage] = useState(null);
  const [storages, setStorages] = useState([]);
  const [lastSignature, setLastSignature] = useState('');
  const [lastFileName, setLastFileName] = useState('');
  const [status, setStatus] = useState('');
  const [socket, setSocket] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const pendingRequestRef = useRef(null);
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [collapsedSigners, setCollapsedSigners] = useState({});

  // Auto-connect to NCALayer on page load
  useEffect(() => {
    connectNCALayer();
    setStatus('Connected to NCALayer');
    selectStorage('PKCS12');
  }, []);

  const connectNCALayer = () => {
    const ws = new WebSocket('wss://127.0.0.1:13579');
    
    ws.onopen = () => {
      console.log('WebSocket opened');
      setStatus('Connected to NCALayer');
      setSocket(ws);
      getActiveTokens(ws);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Connection failed. Make sure NCALayer is running on https://127.0.0.1:13579');
    };

    ws.onmessage = (event) => {
      console.log('Received message:', event.data);
      try {
        const response = JSON.parse(event.data);
        console.log('Parsed response:', response);
        handleNCAResponse(response);
      } catch (err) {
        console.error('Failed to parse response:', err);
        setStatus('Error parsing response from NCALayer');
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setStatus('Disconnected from NCALayer');
      setSocket(null);
    };
  };

  const getActiveTokens = (ws) => {
    const request = {
      module: 'kz.gov.pki.knca.commonUtils',
      method: 'getActiveTokens'
    };
    console.log('Sending getActiveTokens request:', request);
    ws.send(JSON.stringify(request));
  };

  const selectStorage = (storageType) => {
    setStorage(storageType);
    setStatus(`Storage selected: ${storageType}`);
  };

  const requestFilePath = () => {
    if (!socket) {
      setStatus('Please connect to NCALayer first');
      return;
    }

    setPendingRequest('getFilePath');
    pendingRequestRef.current = 'getFilePath';
    const request = {
      module: 'kz.gov.pki.cms.CMSSignUtil',
      lang: 'en',
      method: 'getFilePath',
      args: ['all', fileDir || '']
    };

    socket.send(JSON.stringify(request));
    setStatus('Select a file in NCALayer...');
  };

  const verifyDocument = async () => {
    if (!verifyFile) {
      setVerifyStatus('Please choose a signature file (.cms)');
      return;
    }

    try {
      setVerifyStatus('Verifying signature...');
      const signatureBase64 = await readFileAsBase64(verifyFile);

      const response = await fetch(`${API_BASE}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentBase64: '',
          signatureBase64,
          fileName: verifyFile.name
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setVerifyStatus(`Verify error: ${response.status} ${response.statusText}\n${errorText}`);
        return;
      }

      const result = await response.json();
      
      if (result.responseObject && result.responseObject.signerInfos && result.responseObject.signerInfos.length > 0) {
        // Store the full result for table display
        setVerifyResult(result);
        // Initialize collapsed state - first signer expanded, others collapsed
        const collapseState = {};
        result.responseObject.signerInfos.forEach((_, idx) => {
          collapseState[idx] = idx !== 0; // Expand first, collapse others
        });
        setCollapsedSigners(collapseState);
        setVerifyStatus(''); // Clear text status
      } else {
        setVerifyStatus(`❌ Verification Failed\n\n${result.message || 'Invalid response'}`);
        setVerifyResult(null);
      }
    } catch (error) {
      setVerifyStatus(`Verification error: ${error.message}`);
    }
  };

  const signDocument = () => {
    if (!socket || !filePath || !fileDir || !storage) {
      setStatus('Please connect to NCALayer, select storage and choose file');
      return;
    }

    setPendingRequest('signDocument');
    pendingRequestRef.current = 'signDocument';

    const request = {
      module: 'kz.gov.pki.cms.CMSSignUtil',
      lang: 'en',
      method: 'signFilePath',
      args: [filePath, fileDir, storage]
    };

    socket.send(JSON.stringify(request));
    setStatus(`Signing document from: ${fileNameRef.current || 'selected file'}`);
  };

  const handleNCAResponse = (response) => {
    console.log('Handling response:', response);
    console.log('Current pendingRequest:', pendingRequest);
    
    if (response.responseObject || response.result) {
      const result = response.responseObject || response.result;
      console.log('Extracted result:', result);
      
      if (Array.isArray(result)) {
        console.log('Setting storages:', result);
        setStorages(result);
        // selectStorage('PKCS12')
        // if (result.length === 0) {
        //   setStatus('No storage devices found. Please connect a Kaztoken device or ensure PKCS12 support is enabled in NCALayer.');
        // } else {
        //   setStatus('Available storages loaded: ' + result.join(', '));
        // }
        setPendingRequest(null);

      } else if (typeof result === 'string') {
        if (pendingRequestRef.current === 'getFilePath') {
          const normalized = result.replace(/\//g, '\\');
          const lastSep = normalized.lastIndexOf('\\');
          const dirPath = lastSep >= 0 ? normalized.slice(0, lastSep) : '';
          const name = lastSep >= 0 ? normalized.slice(lastSep + 1) : normalized;

          setFilePath(normalized);
          setFileDir(dirPath);
          fileNameRef.current = name;
          setStatus(`Selected file: ${name}`);
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }

        // Check if result is a file path (signed file already saved by NCALayer)
        if (result.includes('\\') && result.endsWith('.cms')) {
          setLastSignature(result);
          const lastSep = result.lastIndexOf('\\');
          const fileName = lastSep >= 0 ? result.slice(lastSep + 1) : result;
          setLastFileName(fileName);
          setStatus(`Document signed successfully! File saved at:\n${result}`);
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }

        const isPem = result.includes('-----BEGIN');
        const isBase64 = result.length > 100;

        if (isPem || isBase64) {
          setLastSignature(result);
          const fileNameToUse = fileNameRef.current || 'document';
          setLastFileName(fileNameToUse);
          setStatus(`Document signed successfully! The file saved to Downloads folder as: ${fileNameToUse}.cms`);
          //sendToBackend(result);
          // Automatically download the signature with .cms extension
          downloadSignatureFile(result, fileNameToUse);
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }

        setStatus('Response: ' + result.substring(0, 100));
        setPendingRequest(null);
      } else {
        console.log('Unhandled result type:', typeof result, result);

        if (pendingRequestRef.current === 'getFilePath' && result) {
          const fullPath =
            result.fullPath ||
            result.filePath ||
            result.path ||
            result.file ||
            '';
          const dirPath =
            result.directory ||
            result.dir ||
            result.folder ||
            (fullPath ? fullPath.slice(0, Math.max(fullPath.lastIndexOf('\\'), fullPath.lastIndexOf('/'))) : '');

          if (fullPath) {
            const normalized = fullPath.replace(/\//g, '\\');
            const lastSep = normalized.lastIndexOf('\\');
            const name = lastSep >= 0 ? normalized.slice(lastSep + 1) : normalized;

            setFilePath(normalized);
            setFileDir(dirPath.replace(/\//g, '\\'));
            fileNameRef.current = name;
            setStatus(`Selected file: ${name}`);
            setPendingRequest(null);
            pendingRequestRef.current = null;
            return;
          }
        }
        
        // Handle NCALayer verification response
        if (pendingRequestRef.current === 'verifyDocument' && result.type === 'cms' && result.signerInfos) {
          console.log('Verification result:', result);
          const signer = result.signerInfos[0] || {};
          const isValid = result.signatureVerificationResult?.valid;
          
          let verifyMsg = `Signature is ${isValid ? 'VALID' : 'INVALID'}\n\n`;
          verifyMsg += `Signer: ${signer.name || 'Unknown'}\n`;
          verifyMsg += `IIN: ${signer.iin || 'N/A'}\n`;
          verifyMsg += `Certificate Valid: ${signer.certificateVerificationResult?.valid ? 'Yes' : 'No'}\n`;
          verifyMsg += `Certificate Period: ${signer.certificateValidityPeriod || 'N/A'}\n`;
          verifyMsg += `Timestamp: ${result.tspVerificationResult?.valid ? 'Valid' : 'Not present'}\n`;
          
          setVerifyStatus(verifyMsg);
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }
        
        setStatus('Response: ' + JSON.stringify(result).substring(0, 100));
        setPendingRequest(null);
        pendingRequestRef.current = null;
      }
    } else if (response.error || response.code === 500) {
      console.error('Error response:', response);
      if (response.message !== 'action.canceled') {
        setStatus('Error: ' + (response.message || response.error || 'Unknown error'));
        setPendingRequest(null);
        pendingRequestRef.current = null;
      } else {
        setStatus('Certificate selection canceled by user');
      }
    } else {
      console.log('Unexpected response format:', response);
      setStatus('Unexpected response format');
    }
  };

  const sendToBackend = async (signature) => {
    try {
      // Convert file to Base64
      const documentBase64 = await readFileAsBase64(file);
      
      // Extract signature Base64 if it's PEM format
      const signatureBase64 = signature.includes('-----BEGIN')
        ? signature
            .replace(/-----BEGIN[^-]*-----/g, '')
            .replace(/-----END[^-]*-----/g, '')
            .replace(/\s+/g, '')
        : signature;

      const response = await fetch(`${API_BASE}/api/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentBase64,
          signatureBase64,
          verifyAfterStore: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        setStatus(`Backend error: ${response.status} ${response.statusText}`);
        return;
      }

      const result = await response.json();
      console.log('Backend response:', result);
      setStatus(`Document signed and stored: ID ${result.id}`);
    } catch (error) {
      console.error('Send to backend error:', error);
      setStatus('Backend error: ' + error.message);
    }
  };

  const readFileAsBase64 = (inputFile) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = reader.result?.toString() || '';
        resolve(value.split(',')[1] || '');
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(inputFile);
    });

  const downloadSignatureFile = (signature, fileName) => {
    // Convert signature to binary data
    let binaryData;
    if (signature.includes('-----BEGIN')) {
      // PEM format - extract base64 content
      const base64Content = signature
        .replace(/-----BEGIN[^-]*-----/g, '')
        .replace(/-----END[^-]*-----/g, '')
        .replace(/\s+/g, '');
      binaryData = atob(base64Content);
    } else {
      // Already base64
      binaryData = atob(signature);
    }
    
    // Convert to Uint8Array
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    
    // Create blob and download
    const blob = new Blob([bytes], { type: 'application/pkcs7-signature' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.cms`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSignerCollapsed = (index) => {
    setCollapsedSigners(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const extractDocumentFromCMS = async () => {
    if (!verifyFile) {
      setVerifyStatus('No CMS file selected for extraction');
      return;
    }

    try {
      setVerifyStatus('Extracting document from CMS...');
      const signatureBase64 = await readFileAsBase64(verifyFile);

      const response = await fetch(`${API_BASE}/api/verify/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureBase64 })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setVerifyStatus(`Extraction error: ${response.status} ${response.statusText}\n${errorText}`);
        return;
      }

      const result = await response.json();
      
      if (result.documentBase64) {
        // Decode base64 and download
        const binaryData = atob(result.documentBase64);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // Remove .cms, .sig, .p7s extension from filename
        const cmsFileName = verifyFile.name;
        const fileNameWithoutExt = cmsFileName.replace(/\.(cms|sig|p7s)$/i, '');
        link.download = fileNameWithoutExt;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setVerifyStatus('✓ Document extracted and downloaded successfully');
      } else {
        setVerifyStatus('Failed to extract document: No document found in CMS');
      }
    } catch (error) {
      setVerifyStatus(`Extraction error: ${error.message}`);
    }
  };

  const renderVerificationResult = () => {
    if (!verifyResult) {
      return null;
    }

    const signers = verifyResult.responseObject?.signerInfos || [];
    
    return (
      <div style={{ marginTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Информация об электронном документе</h3>
          <button 
            onClick={extractDocumentFromCMS}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Извлечь документ
          </button>
        </div>
        {signers.map((signer, idx) => {
          const isCollapsed = collapsedSigners[idx];
          const resultClass = signer.validSignature ? 'success' : 'danger';
          const resultText = signer.validSignature ? 'Успешно' : 'Неудачно';
          
          return (
            <div key={idx} style={{ marginBottom: '15px' }}>
              <table className="table table-hover table-striped" style={{ marginBottom: 0 }}>
                <thead className="thead-default" style={{ cursor: 'pointer' }}>
                  <tr onClick={() => toggleSignerCollapsed(idx)} style={{ backgroundColor: signer.validSignature ? '#d4edda' : '#f8d7da' }}>
                    <th style={{ textAlign: 'center' }}>
                      {idx + 1}) Подписант – {signer.name}; Результат проверки – {resultText}
                      <i style={{ 
                        float: 'right',
                        marginTop: '3px',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s'
                      }}>
                        ▼
                      </i>
                    </th>
                  </tr>
                </thead>
              </table>
              
              {!isCollapsed && (
                <table className="table table-hover table-striped">
                  <tbody>
                    <tr>
                      <td>Результат проверки сертификата</td>
                      <td style={{ color: signer.certificateVerificationResult?.valid ? '#28a745' : '#dc3545' }}>
                        {signer.certificateVerificationResult?.valid ? 'Успешно' : 'Неудачно'}
                      </td>
                    </tr>
                    <tr>
                      <td>Результат проверки TSP</td>
                      <td style={{ color: signer.tspVerificationResult?.valid ? '#28a745' : '#dc3545' }}>
                        {signer.tspVerificationResult?.valid ? 'Успешно' : 'Неудачно'}
                      </td>
                    </tr>
                    <tr>
                      <td>Результат проверки подписи</td>
                      <td style={{ color: signer.signatureVerificationResult?.valid ? '#28a745' : '#dc3545' }}>
                        {signer.signatureVerificationResult?.valid ? 'Успешно' : 'Неудачно'}
                      </td>
                    </tr>
                    <tr>
                      <td>ИИН</td>
                      <td>{signer.iin || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>ФИО</td>
                      <td>{signer.name || 'N/A'}</td>
                    </tr>
                    {!signer.personCertificate && (
                      <>
                        <tr>
                          <td>БИН</td>
                          <td>{signer.bin || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td>Наименование организации</td>
                          <td>{signer.organizationName || 'N/A'}</td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td>Серийный номер сертификата</td>
                      <td>{signer.serialNumber || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>Срок действия сертификата</td>
                      <td>{signer.certificateValidityPeriod || 'N/A'}</td>
                    </tr>
                    {signer.certtemplateName && (
                      <tr>
                        <td>Шаблон сертификата</td>
                        <td>{signer.certtemplateName}</td>
                      </tr>
                    )}
                    {signer.tspDate && (
                      <tr>
                        <td>Дата подписания</td>
                        <td>{signer.tspDate}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
          onClick={() => setActiveTab('verify')}
          disabled={activeTab === 'verify'}
          style={{ marginLeft: '10px' }}
        >
          Verify Document
        </button>
      </div>
      
      {activeTab === 'sign' && (
        <div className="section">
          <button onClick={connectNCALayer}>Connect to NCALayer</button>
          <p>Status: {status}</p>
        </div>
      )}

      {/* {activeTab === 'sign' && socket && storages.length === 0 && (
        <div className="section">
          <h3>No Storage Devices Detected</h3>
          <p>NCALayer did not detect any storage devices. This could mean:</p>
          <ul style={{ textAlign: 'left', marginLeft: '20px' }}>
            <li>No Kaztoken device is connected</li>
            <li>PKCS12 file storage is not available in your NCALayer version</li>
          </ul>
          <p>To proceed, you can manually specify the storage type:</p>
          <select 
            value={storage || ''} 
            onChange={(e) => selectStorage(e.target.value)}
            style={{ width: '300px', padding: '8px' }}
          >
            <option value="">-- Choose storage type --</option>
            <option value="PKCS12">PKCS12 (File-based certificate)</option>
            <option value="AKKaztokenStore">AKKaztoken (Hardware token)</option>
            <option value="AKKZIDCardStore">KZID Card</option>
          </select>
        </div>
      )} */}

      {/* {activeTab === 'sign' && storages.length > 0 && (
        <div className="section">
          <h3>Select Storage:</h3>
          <select 
            value={storage || ''} 
            onChange={(e) => selectStorage(e.target.value)}
            style={{ width: '300px', padding: '8px' }}
          >
            <option value="">-- Choose storage type --</option>
            {storages.map((s, idx) => (
              <option key={idx} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )} */}

      {activeTab === 'sign' && storage && (
        <div className="section">
          <h3>Sign Document</h3>
          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={requestFilePath}
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#0078d4',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                border: 'none'
              }}
            >
              Choose File (NCALayer)
            </button>
          </div>
          {filePath && (
            <div style={{ marginBottom: '15px' }}>
              <p style={{ color: 'green' }}>✓ Selected file: <strong>{fileNameRef.current}</strong></p>
              <p style={{ fontSize: '12px', color: '#666' }}>{filePath}</p>
            </div>
          )}
          <button onClick={signDocument} disabled={!filePath}>Sign Document</button>
          {lastSignature && lastSignature.includes('\\') && (
            <div style={{ marginTop: '15px' }}>
              <p style={{ color: 'green' }}>✓ File signed and saved: <strong>{lastFileName}</strong></p>
              <p style={{ fontSize: '12px', color: '#666' }}>{lastSignature}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'verify' && (
        <div className="section">
          <h3>Verify Document</h3>

          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="verify-sig-upload" style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#0078d4',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}>
              Choose File (.cms)
            </label>
            <input
              id="verify-sig-upload"
              type="file"
              accept=".cms,.sig,.p7s"
              onChange={(e) => setVerifyFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            {verifyFile && <p>Selected: <strong>{verifyFile.name}</strong></p>}
          </div>

          <button onClick={verifyDocument} disabled={!verifyFile}>
            Check
          </button>
          {verifyStatus && (
            <div style={{ 
              marginTop: '15px', 
              padding: '15px', 
              backgroundColor: '#f8d7da',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '13px',
              border: '1px solid #f5c6cb',
              color: '#721c24'
            }}>
              {verifyStatus}
            </div>
          )}
          {renderVerificationResult()}
        </div>
      )}
    </div>
  );
}

export default App;
