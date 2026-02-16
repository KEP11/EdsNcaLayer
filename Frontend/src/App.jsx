import React, { useState, useEffect, useRef } from 'react'
import './App.css';
import SignModule from './components/SignModule';
import BatchSignModule from './components/BatchSignModule';
import VerifyModule from './components/VerifyModule';
import VerifyCmsModule from './components/VerifyCmsModule';
import { requestFilePath as requestSignFilePath, signDocument as signDocumentService } from './services/signService';
import { clearBatchFiles as clearBatchFilesService, requestBatchSignFiles as requestBatchSignFilesService, batchSignDocuments as batchSignDocumentsService, processBatchSignFile as processBatchSignFileService } from './services/batchSignService';

function App() {
  const showBatchSign = false;
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
  const socketRef = useRef(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const pendingRequestRef = useRef(null);
  const batchSignContextRef = useRef({});
  
  // Batch signing operations state
  const [batchSignFiles, setBatchSignFiles] = useState([]);
  const [batchSignProgress, setBatchSignProgress] = useState('');
  const [batchSignResults, setBatchSignResults] = useState([]);

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
      socketRef.current = ws;
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
      socketRef.current = null;
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
    requestSignFilePath({
      socketRef,
      socket,
      fileDir,
      setStatus,
      setPendingRequest,
      pendingRequestRef
    });
  };

  const signDocument = () => {
    signDocumentService({
      socketRef,
      socket,
      filePath,
      fileDir,
      storage,
      fileNameRef,
      setStatus,
      setPendingRequest,
      pendingRequestRef
    });
  };

  const handleNCAResponse = (response) => {
    console.log('Handling response:', response);
    console.log('Current pendingRequest:', pendingRequest);
    console.log('Current pendingRequestRef:', pendingRequestRef.current);
    
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

        // Handle batch file selection for signing
        if (pendingRequestRef.current === 'batchSelectFiles') {
          const selectedFile = result.replace(/\//g, '\\');
          const lastSep = selectedFile.lastIndexOf('\\');
          const fileName = lastSep >= 0 ? selectedFile.slice(lastSep + 1) : selectedFile;
          
          // Add file to batch if not already present
          const newBatchSignFiles = [...batchSignFiles];
          if (!newBatchSignFiles.some(f => f.path === selectedFile)) {
            newBatchSignFiles.push({ path: selectedFile, fileName: fileName, status: 'pending' });
            setBatchSignFiles(newBatchSignFiles);
            setBatchSignProgress(`Selected ${newBatchSignFiles.length} file(s). Click "Select Files" again to add more, or click "Sign Batch" to proceed.`);
          }
          
          // Clear pending request to allow selecting more files
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }

        // (String handler for batchSelectFile removed - now handled in object section above)

        // Check if result is a file path (signed file already saved by NCALayer)
        if (result.includes('\\') && result.endsWith('.cms')) {
          // Handle batch signing response
          if (pendingRequestRef.current === 'batchSignFile') {
            const ctx = batchSignContextRef.current;
            if (ctx && ctx.results && ctx.files) {
              const currentIndex = ctx.currentIndex;
              const files = ctx.files;
              
              // Update results for current file
              const updatedResults = [...ctx.results];
              updatedResults[currentIndex] = {
                ...updatedResults[currentIndex],
                status: 'success',
                message: `✓ Signed: ${result}`
              };
              
              // Update state
              setBatchSignResults(updatedResults);
              
              // Move to next file
              const nextIndex = currentIndex + 1;
              if (nextIndex < files.length) {
                processBatchSignFile(nextIndex, files, updatedResults);
              } else {
                // All files processed
                setBatchSignProgress('✓ Batch signing complete!');
                pendingRequestRef.current = null;
              }
              return;
            }
          }
          
          // Regular single-file signing
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
          // Handle batch signing response with PEM/Base64 result
          if (pendingRequestRef.current === 'batchSignFile') {
            const ctx = batchSignContextRef.current;
            if (ctx && ctx.results && ctx.files) {
              const currentIndex = ctx.currentIndex;
              const files = ctx.files;
              
              // Update results for current file
              const updatedResults = [...ctx.results];
              updatedResults[currentIndex] = {
                ...updatedResults[currentIndex],
                status: 'success',
                message: '✓ Signature generated (Base64)'
              };
              
              // Update state
              setBatchSignResults(updatedResults);
              
              // Move to next file
              const nextIndex = currentIndex + 1;
              if (nextIndex < files.length) {
                processBatchSignFile(nextIndex, files, updatedResults);
              } else {
                // All files processed
                setBatchSignProgress('✓ Batch signing complete!');
                pendingRequestRef.current = null;
              }
              return;
            }
          }
          
          // Regular single-file signing
          setLastSignature(result);
          const fileNameToUse = fileNameRef.current || 'document';
          setLastFileName(fileNameToUse);
          setStatus(`Document signed successfully! The file saved to Downloads folder as: ${fileNameToUse}.cms`);
          // Automatically download the signature with .cms extension
          downloadSignatureFile(result, fileNameToUse);
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }

        // Handle batch signing errors (unexpected response)
        if (pendingRequestRef.current === 'batchSignFile') {
          const ctx = batchSignContextRef.current;
          if (ctx && ctx.results) {
            const currentIndex = ctx.currentIndex;
            
            // Update results for current file with error
            const updatedResults = [...ctx.results];
            updatedResults[currentIndex] = {
              ...updatedResults[currentIndex],
              status: 'error',
              message: `Error: ${result.substring(0, 100)}`
            };
            
            // Update state
            setBatchSignResults(updatedResults);
            
            // Move to next file
            const nextIndex = currentIndex + 1;
            if (nextIndex < batchSignFiles.length) {
              processBatchSignFile(nextIndex, batchSignFiles, updatedResults);
            } else {
              // All files processed
              setBatchSignProgress('✓ Batch signing complete (with errors)!');
              pendingRequestRef.current = null;
            }
            return;
          }
        }

        setStatus('Response: ' + result.substring(0, 100));
        setPendingRequest(null);
      } else {
        // Handle batch file selection (FileInfo object)
        if (pendingRequestRef.current === 'batchSelectFile' && result) {
          const fullPath =
            result.fullPath ||
            result.filePath ||
            result.path ||
            result.file ||
            '';
          const fileName =
            result.filename ||
            result.fileName ||
            result.name ||
            '';

          if (fullPath && fileName) {
            const normalized = fullPath.replace(/\//g, '\\');
            const newFile = {
              path: normalized,
              fileName: fileName,
              status: 'pending'
            };
            
            setBatchSignFiles(prev => {
              const updated = [...prev, newFile];
              setBatchSignProgress(`Added: ${fileName}. Total: ${updated.length} file(s). Click "Add File" to add more, or "Sign Batch" to start.`);
              return updated;
            });

            setPendingRequest(null);
            pendingRequestRef.current = null;
          } else {
            // User cancelled file selection
            setBatchSignProgress('No file selected. Click "Add File" to select files.');
            setPendingRequest(null);
            pendingRequestRef.current = null;
          }
          return;
        }

        // Handle batch verification file selection (FileInfo object response)
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
            result.filedir ||
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
        
        setStatus('Response: ' + JSON.stringify(result).substring(0, 100));
        setPendingRequest(null);
        pendingRequestRef.current = null;
      }
    } else if (response.error || response.code === 500 || response.code === '500') {
      console.error('Error response:', response);
      
      // Handle batch signing errors
      if (pendingRequestRef.current === 'batchSignFile') {
        const ctx = batchSignContextRef.current;
        if (ctx && ctx.results && ctx.files) {
          const currentIndex = ctx.currentIndex;
          const files = ctx.files;
          const currentFile = files[currentIndex];
          
          // Check if user canceled
          const isCanceled = response.message === 'action.canceled' || 
                            response.message?.includes('canceled') ||
                            response.message?.includes('cancelled');
          
          // Update results for current file
          const updatedResults = [...ctx.results];
          updatedResults[currentIndex] = {
            ...updatedResults[currentIndex],
            status: 'error',
            message: isCanceled 
              ? '✗ Canceled by user' 
              : `✗ Error: ${response.message || response.error || 'Unknown error'}`
          };
          
          // Update state
          setBatchSignResults(updatedResults);
          
          if (isCanceled) {
            // User canceled - stop batch signing
            setBatchSignProgress('Batch signing canceled by user');
            pendingRequestRef.current = null;
          } else {
            // Error occurred - move to next file
            const nextIndex = currentIndex + 1;
            if (nextIndex < files.length) {
              setBatchSignProgress(`Error on file ${currentIndex + 1}. Continuing to next file...`);
              processBatchSignFile(nextIndex, files, updatedResults);
            } else {
              // All files processed
              setBatchSignProgress('✓ Batch signing complete (with errors)!');
              pendingRequestRef.current = null;
            }
          }
          return;
        }
      }

      // Regular error handling
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

  // Batch Signing Functions - Clear files
  const clearBatchFiles = () => {
    clearBatchFilesService({
      setBatchSignFiles,
      setBatchSignResults,
      setBatchSignProgress
    });
  };

  const requestBatchSignFiles = () => {
    requestBatchSignFilesService({
      socketRef,
      socket,
      fileDir,
      batchSignFiles,
      setBatchSignResults,
      setBatchSignProgress,
      setPendingRequest,
      pendingRequestRef
    });
  };

  const handleBatchSignFiles = (event) => {
    const files = Array.from(event.target.files);
    setBatchSignFiles(files);
    setBatchSignResults([]);
    setBatchSignProgress(`Selected ${files.length} file(s) for batch signing`);
  };

  const batchSignDocuments = async () => {
    batchSignDocumentsService({
      socketRef,
      socket,
      storage,
      batchSignFiles,
      setBatchSignProgress,
      setBatchSignResults,
      batchSignContextRef,
      processBatchSignFile
    });
  };

  const processBatchSignFile = (index, files, results) => {
    processBatchSignFileService({
      index,
      files,
      results,
      socketRef,
      socket,
      storage,
      setBatchSignProgress,
      batchSignContextRef,
      pendingRequestRef
    });
  };

  const renderBatchSignResults = () => {
    if (batchSignResults.length === 0) return null;

    return (
      <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h4>Batch Signing Results</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
          <thead>
            <tr style={{ backgroundColor: '#e0e0e0' }}>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>File Name</th>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {batchSignResults.map((result, idx) => {
              const isSuccess = result.status === 'success';
              const isError = result.status === 'error';
              const isPending = result.status === 'pending';
              const bgColor = isSuccess ? '#d4edda' : isError ? '#f8d7da' : 'white';
              
              return (
                <tr key={idx} style={{ backgroundColor: bgColor, borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{result.fileName}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>
                    {isSuccess && '✓ Signed'}
                    {isError && '✗ Error'}
                    {isPending && '⏳ Pending'}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #ccc', fontSize: '12px' }}>{result.message}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="App">
      <h1>ЭЦП НУЦ РК</h1>

      <div className="section">
        <button onClick={connectNCALayer}>Connect to NCALayer</button>
        <p>Status: {status}</p>
      </div>

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
        {/* <button
          onClick={() => setActiveTab('verify-cms')}
          disabled={activeTab === 'verify-cms'}
          style={{ marginLeft: '10px' }}
        >
          Verify CMS
        </button> */}
      </div>

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

      {/* Sign Tab */}
      {activeTab === 'sign' && (
        <SignModule />
      )}

      {showBatchSign && activeTab === 'sign' && storage && (
        <div className="section">
          <h3>Batch Sign Documents</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            Click "Add File" to select files one by one. Each file will require authentication during signing.
          </p>
          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={requestBatchSignFiles}
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#0078d4',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                border: 'none',
                marginRight: '10px'
              }}
            >
              Add File
            </button>
            {batchSignFiles.length > 0 && (
              <button
                onClick={() => {
                  clearBatchFiles();
                }}
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#d13438',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  border: 'none'
                }}
              >
                Clear Files
              </button>
            )}
          </div>

          {batchSignFiles.length > 0 && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <h4>Selected Files ({batchSignFiles.length}):</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', backgroundColor: 'white' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e0e0e0' }}>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>File Name</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ccc', fontWeight: 'bold' }}>File Path</th>
                  </tr>
                </thead>
                <tbody>
                  {batchSignFiles.map((file, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }}>{file.fileName}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc', fontSize: '12px', color: '#555' }}>{file.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={batchSignDocuments}
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#107c10',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  border: 'none',
                  marginTop: '10px'
                }}
              >
                Sign Batch ({batchSignFiles.length} file{batchSignFiles.length !== 1 ? 's' : ''})
              </button>
            </div>
          )}

          {batchSignProgress && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px', color: '#003d82' }}>
              {batchSignProgress}
            </div>
          )}
          {renderBatchSignResults()}
        </div>
      )}

      {/* Verify Document Tab */}
      {activeTab === 'verify' && (
        <VerifyModule />
      )}

      {/* Batch Sign Tab */}
      {activeTab === 'batch-sign' && (
        <BatchSignModule />
      )}

      {/* Verify CMS Tab */}
      {/* {activeTab === 'verify-cms' && (
        <VerifyCmsModule />
      )} */}
    </div>
  );
}

export default App;
