import React, { useState, useRef } from 'react';
import { connectToNCALayer } from '../services/common';
import { requestFilePath as requestSignFilePath, signDocument as signDocumentService } from '../services/signService';

const SignModule = () => {
  const fileNameRef = useRef('');
  const [filePath, setFilePath] = useState('');
  const [fileDir, setFileDir] = useState('');
  const [storage, setStorage] = useState('PKCS12');
  const [lastSignature, setLastSignature] = useState('');
  const [lastFileName, setLastFileName] = useState('');
  const [status, setStatus] = useState('');
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const pendingRequestRef = useRef(null);

  // Auto-connect to NCALayer on component mount
  React.useEffect(() => {
    const ws = connectToNCALayer(
      // onOpen
      () => {
        console.log('SignModule: WebSocket connected');
        setStatus('Connected to NCALayer');
        setSocket(ws);
        socketRef.current = ws;
      },
      // onMessage
      (response) => {
        console.log('SignModule: Received parsed response:', response);
        handleNCAResponse(response);
      },
      // onError
      (error) => {
        console.error('SignModule: WebSocket error:', error);
        setStatus('Connection failed. Make sure NCALayer is running on https://127.0.0.1:13579');
      },
      // onClose
      () => {
        console.log('SignModule: WebSocket closed');
        setStatus('Disconnected from NCALayer');
        setSocket(null);
        socketRef.current = null;
      }
    );

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const handleNCAResponse = (response) => {
    console.log('Handling response:', response);
    console.log('Current pendingRequest:', pendingRequestRef.current);
    
    // Handle browseForFile response (getFilePath)
    if (pendingRequestRef.current === 'getFilePath') {
      // Success response with responseObject
      if (response.responseObject && response.code === '200') {
        const selectedPath = response.responseObject.path;
        const fileName = response.responseObject.filename || selectedPath.split('\\').pop() || selectedPath.split('/').pop();
        const dir = response.responseObject.filedir || selectedPath.substring(0, selectedPath.lastIndexOf('\\'));
        
        fileNameRef.current = fileName;
        setFilePath(selectedPath);
        setFileDir(dir);
        setStatus(`File selected: ${fileName}`);
        pendingRequestRef.current = null;
        return;
      }
      
      // Handle error or cancellation
      if (response.result === 'error' || (response.code && response.code !== '200')) {
        const errorMsg = response.message || 'File selection failed';
        setStatus(errorMsg === 'action.canceled' ? 'File selection canceled' : `Error: ${errorMsg}`);
        pendingRequestRef.current = null;
        return;
      }
    }

    // Handle signXml response
    if (response.responseObject && pendingRequestRef.current === 'signDocument') {
      const signedData = response.responseObject;
      const signedFileName = `${fileNameRef.current}.cms`;
      const signedFilePath = `${fileDir}\\${signedFileName}`;
      
      setLastSignature(signedFilePath);
      setLastFileName(signedFileName);
      setStatus(`✓ Document signed successfully: ${signedFileName}`);
      pendingRequestRef.current = null;
      return;
    }

    // Handle general error response
    if (response.result === 'error' || (response.code && response.code !== '200')) {
      const errorMsg = response.message || `Error code: ${response.code}`;
      setStatus(`Error: ${errorMsg}`);
      pendingRequestRef.current = null;
    }
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

  return (
    <div className="sign-module">
      <h2>Sign Document via NCALayer</h2>

      {/* Connection Status */}
      {status && (
        <div className={`status-message ${status.includes('✓') || status.includes('Connected') ? 'success' : ''}`}>
          {status}
        </div>
      )}

      {/* File Selection */}
      <div className="section">
        <h3>1. Select Document to Sign</h3>
        <button
          onClick={requestFilePath}
          disabled={!socket}
          className="btn-primary"
        >
          Choose File (NCALayer)
        </button>
        
        {filePath && (
          <div className="file-info">
            <p className="success-text">✓ Selected file: <strong>{fileNameRef.current}</strong></p>
            <p className="file-path">{filePath}</p>
          </div>
        )}
      </div>

      {/* Sign Button */}
      <div className="section">
        <h3>2. Sign Document</h3>
        <button 
          onClick={signDocument} 
          disabled={!filePath || !socket}
          className="btn-primary btn-large"
        >
          Sign Document
        </button>
        
        {lastSignature && lastSignature.includes('\\') && (
          <div className="signature-info">
            <p className="success-text">✓ File signed and saved: <strong>{lastFileName}</strong></p>
            <p className="file-path">{lastSignature}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignModule;
