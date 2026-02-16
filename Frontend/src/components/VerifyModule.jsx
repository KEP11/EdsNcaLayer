import React, { useState, useRef, useEffect } from 'react';
import { connectToNCALayer } from '../services/common';
import { 
  selectCMSFileForOperations as selectCMSFileForOperationsService, 
  verifyDocumentViaNCAlayer as verifyDocumentViaNCAlayerService 
} from '../services/verifyService';
import { extractDocumentViaNCAlayer as extractDocumentViaNCAlayerService } from '../services/extractService';
import { 
  requestBatchVerifyFiles as requestBatchVerifyFilesService, 
  batchVerifyDocuments as batchVerifyDocumentsService, 
  processBatchVerifyFile as processBatchVerifyFileService 
} from '../services/batchVerifyService';

function VerifyModule() {
  // State management
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const pendingRequestRef = useRef(null);
  const [status, setStatus] = useState('');
  
  // Single file verification state
  const [cmsFile, setCmsFile] = useState(null);
  const cmsFilePathRef = useRef('');
  const cmsFileDirRef = useRef('');
  const [verifyStatus, setVerifyStatus] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [collapsedSigners, setCollapsedSigners] = useState({});
  const [fileDir, setFileDir] = useState('');
  
  // Batch verification state
  const [batchVerifyFiles, setBatchVerifyFiles] = useState([]);
  const [batchVerifyProgress, setBatchVerifyProgress] = useState('');
  const [batchVerifyResults, setBatchVerifyResults] = useState([]);
  const [collapsedBatchResults, setCollapsedBatchResults] = useState({});
  const batchVerifyContextRef = useRef({});

  // Connect to NCALayer function
  const connectToNCA = () => {
    setStatus('Connecting to NCALayer...');
    const ws = connectToNCALayer(
      // onOpen
      () => {
        console.log('VerifyModule: WebSocket connected');
        setStatus('Connected to NCALayer');
        setSocket(ws);
        socketRef.current = ws;
      },
      // onMessage
      (response) => {
        console.log('VerifyModule: Received parsed response:', response);
        handleNCAResponse(response);
      },
      // onError
      (error) => {
        console.error('VerifyModule: WebSocket error:', error);
        setStatus('Connection failed. Make sure NCALayer is running on https://127.0.0.1:13579');
      },
      // onClose
      () => {
        console.log('VerifyModule: WebSocket closed');
        setStatus('Disconnected from NCALayer');
        setSocket(null);
        socketRef.current = null;
      }
    );
  };

  // Connect to NCALayer on component mount
  useEffect(() => {
    connectToNCA();

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, []);

  // Handle NCALayer responses
  const handleNCAResponse = (response) => {
    console.log('VerifyModule: Handling response:', response);
    console.log('VerifyModule: Current pendingRequest:', pendingRequestRef.current);

    // Handle file selection response (selectCMS)
    if (pendingRequestRef.current === 'selectCMS') {
      if (response.responseObject && response.code === '200') {
        const fullPath = response.responseObject.path;
        const fileName = response.responseObject.filename || fullPath.split('\\').pop() || fullPath.split('/').pop();
        const dirPath = response.responseObject.filedir;

        if (fullPath) {
          const normalized = fullPath.replace(/\//g, '\\');
          cmsFilePathRef.current = normalized;
          cmsFileDirRef.current = dirPath.replace(/\//g, '\\');
          setCmsFile(fileName);
          setVerifyResult(null);
          setVerifyStatus(`Selected file: ${fileName}`);
        }

        setPendingRequest(null);
        pendingRequestRef.current = null;
        return;
      }
      
      // Handle error or cancellation
      if (response.result === 'error' || (response.code && response.code !== '200')) {
        const errorMsg = response.message || 'File selection failed';
        setVerifyStatus(errorMsg === 'action.canceled' ? 'File selection canceled' : `Error: ${errorMsg}`);
        setPendingRequest(null);
        pendingRequestRef.current = null;
        return;
      }
    }

    // Handle batch verify file selection (batchSelectVerifyFile)
    if (pendingRequestRef.current === 'batchSelectVerifyFile') {
      if (response.responseObject && response.code === '200') {
        const fullPath = response.responseObject.path;
        const fileName = response.responseObject.filename || fullPath.split('\\').pop() || fullPath.split('/').pop();

        if (fullPath && fileName) {
          const normalized = fullPath.replace(/\//g, '\\');
          const newFile = {
            path: normalized,
            fileName: fileName,
            status: 'pending'
          };
          
          setBatchVerifyFiles(prev => {
            const updated = [...prev, newFile];
            setBatchVerifyProgress(`Added: ${fileName}. Total: ${updated.length} file(s). Click "Add File" to add more, or "Verify Batch" to start.`);
            return updated;
          });
        } else {
          setBatchVerifyProgress('No file selected. Click "Add File" to select CMS files.');
        }

        setPendingRequest(null);
        pendingRequestRef.current = null;
        return;
      }
      
      // Handle error or cancellation
      if (response.result === 'error' || (response.code && response.code !== '200')) {
        const errorMsg = response.message || 'File selection failed';
        setBatchVerifyProgress(errorMsg === 'action.canceled' ? 'File selection canceled' : `Error: ${errorMsg}`);
        setPendingRequest(null);
        pendingRequestRef.current = null;
        return;
      }
    }

    // Handle responseObjects array from checkCMS (verification results)
    if (response.responseObjects && Array.isArray(response.responseObjects)) {
        console.log('VerifyModule: Response has responseObjects array');
        
        // Handle batch verification
        if (pendingRequestRef.current === 'batchVerifyFile') {
          console.log('VerifyModule: Processing batch verify response');
          const ctx = batchVerifyContextRef.current;
          if (ctx && ctx.results && ctx.files) {
            const currentIndex = ctx.currentIndex;
            const files = ctx.files;
            
            // Update results for current file
            const updatedResults = [...ctx.results];
            updatedResults[currentIndex] = {
              ...updatedResults[currentIndex],
              status: response.responseObjects.length > 0 ? 'verified' : 'invalid',
              message: response.responseObjects.length > 0 ? `✓ Verified - ${response.responseObjects.length} signer(s)` : '✗ No valid signers found',
              signers: response.responseObjects
            };
            
            // Update state
            setBatchVerifyResults(updatedResults);
            
            // Move to next file
            const nextIndex = currentIndex + 1;
            if (nextIndex < files.length) {
              processBatchVerifyFile(nextIndex, files, updatedResults);
            } else {
              // All files processed
              setBatchVerifyProgress('✓ Batch verification complete!');
              pendingRequestRef.current = null;
              
              // Initialize collapsed state for all signers
              const collapseState = {};
              updatedResults.forEach((fileResult, resultIdx) => {
                if (fileResult.signers && fileResult.signers.length > 0) {
                  fileResult.signers.forEach((_, signerIdx) => {
                    collapseState[`${resultIdx}-${signerIdx}`] = signerIdx !== 0;
                  });
                }
              });
              setCollapsedBatchResults(collapseState);
            }
            return;
          }
        }

        // Single file verification (original checkCMS handler)
        const result = response.responseObjects;
        if (result.length > 0) {
          // Format the response to match our VerificationResult structure
          const verificationResult = {
            responseObject: {
              signerInfos: result
            }
          };
          
          setVerifyResult(verificationResult);
          
          // Initialize collapsed state - first signer expanded, others collapsed
          const collapseState = {};
          result.forEach((_, idx) => {
            collapseState[idx] = idx !== 0;
          });
          setCollapsedSigners(collapseState);
          setVerifyStatus(''); // Clear status, show table
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        } else {
          setVerifyStatus('❌ Verification Failed - No signers found');
          setVerifyResult(null);
        }
    }
    
    // Handle error responses
    if (response.error || response.code === 500 || response.code === '500') {
      console.error('VerifyModule: Error response:', response);
      
      // Handle batch verification errors
      if (pendingRequestRef.current === 'batchVerifyFile') {
        const ctx = batchVerifyContextRef.current;
        if (ctx && ctx.results && ctx.files) {
          const currentIndex = ctx.currentIndex;
          const files = ctx.files;
          
          // Update results for current file with error
          const updatedResults = [...ctx.results];
          updatedResults[currentIndex] = {
            ...updatedResults[currentIndex],
            status: 'error',
            message: `✗ Error: ${response.message || response.error || 'Verification failed'}`,
            signers: []
          };
          
          // Update state
          setBatchVerifyResults(updatedResults);
          
          // Move to next file
          const nextIndex = currentIndex + 1;
          if (nextIndex < files.length) {
            setBatchVerifyProgress(`Error on file ${currentIndex + 1}. Continuing to next file...`);
            processBatchVerifyFile(nextIndex, files, updatedResults);
          } else {
            // All files processed
            setBatchVerifyProgress('✓ Batch verification complete (with errors)!');
            pendingRequestRef.current = null;
          }
          return;
        }
      }
      
      // Regular error handling
      if (response.message !== 'action.canceled') {
        setVerifyStatus('Error: ' + (response.message || response.error || 'Unknown error'));
        setPendingRequest(null);
        pendingRequestRef.current = null;
      } else {
        setVerifyStatus('File selection canceled by user');
      }
    }
  };

  // Single file verification functions
  const selectCMSFileForOperations = () => {
    selectCMSFileForOperationsService({
      socketRef,
      socket,
      cmsFileDirRef,
      setVerifyResult,
      setVerifyStatus,
      setPendingRequest,
      pendingRequestRef
    });
  };

  const verifyDocumentViaNCAlayer = () => {
    verifyDocumentViaNCAlayerService({
      socketRef,
      socket,
      cmsFilePathRef,
      setVerifyStatus,
      setPendingRequest,
      pendingRequestRef
    });
  };

  const extractDocumentViaNCAlayer = () => {
    extractDocumentViaNCAlayerService({
      socketRef,
      socket,
      cmsFilePathRef,
      cmsFileDirRef,
      setVerifyStatus,
      setPendingRequest,
      pendingRequestRef
    });
  };

  const toggleSignerCollapsed = (index) => {
    setCollapsedSigners(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Batch verification functions
  const requestBatchVerifyFiles = () => {
    requestBatchVerifyFilesService({
      socketRef,
      socket,
      fileDir,
      setBatchVerifyProgress,
      setPendingRequest,
      pendingRequestRef
    });
  };

  const batchVerifyDocuments = () => {
    batchVerifyDocumentsService({
      socketRef,
      socket,
      batchVerifyFiles,
      setBatchVerifyProgress,
      setBatchVerifyResults,
      batchVerifyContextRef,
      processBatchVerifyFile
    });
  };

  const processBatchVerifyFile = (index, files, results) => {
    processBatchVerifyFileService({
      index,
      files,
      results,
      socketRef,
      socket,
      setBatchVerifyProgress,
      batchVerifyContextRef,
      pendingRequestRef
    });
  };

  // Render functions
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
            onClick={extractDocumentViaNCAlayer}
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

  const renderBatchVerifyResults = () => {
    if (batchVerifyResults.length === 0) return null;

    return (
      <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h4>Batch Verification Results</h4>
        {batchVerifyResults.map((result, resultIdx) => {
          const isVerified = result.status === 'verified';
          const isError = result.status === 'error';
          const isPending = result.status === 'pending';
          
          const bgColor = isVerified ? '#d4edda' : isError ? '#f8d7da' : 'white';
          const statusText = isVerified ? '✓ Verified' : isError ? '✗ Error' : '⏳ Pending';
          
          return (
            <div key={resultIdx} style={{ marginBottom: '10px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                padding: '10px',
                backgroundColor: bgColor,
                fontWeight: 'bold'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{result.fileName}</span>
                  <span>{statusText}</span>
                </div>
                {result.message && (
                  <div style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: '5px' }}>
                    {result.message}
                  </div>
                )}
              </div>
              
              {result.signers && result.signers.length > 0 && (
                <div style={{ padding: '10px', backgroundColor: '#f9f9f9' }}>
                  {result.signers.map((signer, signerIdx) => {
                    const signerKey = `${resultIdx}-${signerIdx}`;
                    const isCollapsed = collapsedBatchResults[signerKey];
                    
                    return (
                      <div key={signerIdx} style={{ marginBottom: signerIdx < result.signers.length - 1 ? '10px' : '0' }}>
                        <div
                          onClick={() => setCollapsedBatchResults(prev => ({ ...prev, [signerKey]: !isCollapsed }))}
                          style={{
                            padding: '8px',
                            backgroundColor: signer.validSignature ? '#d4edda' : '#f8d7da',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '0.95em'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{signerIdx + 1}. {signer.name || 'Unknown Signer'}</span>
                            <span style={{
                              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.3s',
                              display: 'inline-block'
                            }}>▼</span>
                          </div>
                        </div>
                        
                        {!isCollapsed && (
                          <div style={{ 
                            padding: '10px', 
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            marginTop: '5px',
                            fontSize: '0.9em'
                          }}>
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold', width: '40%' }}>Результат проверки сертификата</td>
                                  <td style={{ padding: '8px', color: signer.certificateVerificationResult?.valid ? '#28a745' : '#dc3545' }}>
                                    {signer.certificateVerificationResult?.valid ? 'Успешно' : 'Неудачно'}
                                  </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Результат проверки TSP</td>
                                  <td style={{ padding: '8px', color: signer.tspVerificationResult?.valid ? '#28a745' : '#dc3545' }}>
                                    {signer.tspVerificationResult?.valid ? 'Успешно' : 'Неудачно'}
                                  </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Результат проверки подписи</td>
                                  <td style={{ padding: '8px', color: signer.signatureVerificationResult?.valid ? '#28a745' : '#dc3545' }}>
                                    {signer.signatureVerificationResult?.valid ? 'Успешно' : 'Неудачно'}
                                  </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>ИИН</td>
                                  <td style={{ padding: '8px' }}>{signer.iin || 'N/A'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>ФИО субъекта</td>
                                  <td style={{ padding: '8px' }}>{signer.name || 'N/A'}</td>
                                </tr>
                                {!signer.personCertificate && (
                                  <>
                                    <tr style={{ borderBottom: '1px solid #eee' }}>
                                      <td style={{ padding: '8px', fontWeight: 'bold' }}>БИН</td>
                                      <td style={{ padding: '8px' }}>{signer.bin || 'N/A'}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #eee' }}>
                                      <td style={{ padding: '8px', fontWeight: 'bold' }}>Наименование организации</td>
                                      <td style={{ padding: '8px' }}>{signer.organizationName || 'N/A'}</td>
                                    </tr>
                                  </>
                                )}
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Серийный номер сертификата</td>
                                  <td style={{ padding: '8px' }}>{signer.serialNumber || 'N/A'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Срок действия сертификата</td>
                                  <td style={{ padding: '8px' }}>{signer.certificateValidityPeriod || 'N/A'}</td>
                                </tr>
                                {signer.certtemplateName && (
                                  <tr style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Шаблон сертификата</td>
                                    <td style={{ padding: '8px' }}>{signer.certtemplateName}</td>
                                  </tr>
                                )}
                                {signer.tspDate && (
                                  <tr>
                                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Дата подписания</td>
                                    <td style={{ padding: '8px' }}>{signer.tspDate}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="verify-module">
      <h2>Verify Document via NCALayer</h2>

      {/* Connection Status */}
      {status && (
        <div className={`status-message ${status.includes('Connected') ? 'success' : ''}`}>
          {status}
          {!socket && (
            <button 
              onClick={connectToNCA}
              className="btn-primary"
              style={{ marginLeft: '15px', padding: '8px 16px' }}
            >
              Connect
            </button>
          )}
        </div>
      )}

      {/* Single File Verification Section */}
      <div className="section">
        <h3>1. Select Document to Verify</h3>
        <button 
          onClick={selectCMSFileForOperations}
          disabled={!socket}
          className="btn-primary"
        >
          Choose CMS File (NCALayer)
        </button>
        
        {cmsFile && (
          <div className="file-info">
            <p className="success-text">✓ Selected file: <strong>{cmsFile}</strong></p>
            <p className="file-path">{cmsFilePathRef.current}</p>
          </div>
        )}
      </div>

      {/* Verify Document Section */}
      <div className="section">
        <h3>2. Verify Document</h3>
        <button 
          onClick={verifyDocumentViaNCAlayer} 
          disabled={!cmsFile || !socket}
          className="btn-primary btn-large"
        >
          Verify Document
        </button>
        
        {verifyStatus && (
          <div className="status-message">
            <pre>{verifyStatus}</pre>
          </div>
        )}
        {renderVerificationResult()}
      </div>

      {/* Batch Verification Section */}
      <div className="section">
        <h3>3. Batch Verification</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            onClick={requestBatchVerifyFiles}
            disabled={!socket}
            className="btn-primary"
          >
            Add File
          </button>
          <button 
            onClick={() => {
              setBatchVerifyFiles([]);
              setBatchVerifyProgress('');
              setBatchVerifyResults([]);
              setCollapsedBatchResults({});
            }}
            disabled={!socket}
            className="btn-primary"
            style={{ backgroundColor: '#dc3545' }}
          >
            Clear Files
          </button>
        </div>
        
        {batchVerifyFiles.length > 0 && (
          <div className="file-info">
            <p className="success-text">✓ Files added: <strong>{batchVerifyFiles.length}</strong></p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
              {batchVerifyFiles.map((file, idx) => (
                <li key={idx}>{file.fileName}</li>
              ))}
            </ul>
          </div>
        )}
        
        <button 
          onClick={batchVerifyDocuments} 
          disabled={batchVerifyFiles.length === 0 || !socket}
          className="btn-primary btn-large"
          style={{ marginTop: '15px' }}
        >
          Verify Batch
        </button>
        
        {batchVerifyProgress && (
          <div className="status-message">
            <p>{batchVerifyProgress}</p>
          </div>
        )}
        {renderBatchVerifyResults()}
      </div>
    </div>
  );
}

export default VerifyModule;
