import React, { useState, useEffect, useRef } from 'react'
import './App.css';
import { requestFilePath as requestSignFilePath, signDocument as signDocumentService } from './services/signService';
import { clearBatchFiles as clearBatchFilesService, requestBatchSignFiles as requestBatchSignFilesService, batchSignDocuments as batchSignDocumentsService, processBatchSignFile as processBatchSignFileService } from './services/batchSignService';
import { selectCMSFileForOperations as selectCMSFileForOperationsService, verifyDocumentViaNCAlayer as verifyDocumentViaNCAlayerService } from './services/verifyService';
import { extractDocumentViaNCAlayer as extractDocumentViaNCAlayerService } from './services/extractService';
import { requestBatchVerifyFiles as requestBatchVerifyFilesService, batchVerifyDocuments as batchVerifyDocumentsService, processBatchVerifyFile as processBatchVerifyFileService } from './services/batchVerifyService';

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
  const [cmsFile, setCmsFile] = useState(null);
  const cmsFilePathRef = useRef('');
  const cmsFileDirRef = useRef('');
  const batchVerifyContextRef = useRef({});
  const batchSignContextRef = useRef({});
  const [verifyStatus, setVerifyStatus] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [collapsedSigners, setCollapsedSigners] = useState({});
  
  // Batch operations state
  const [batchSignFiles, setBatchSignFiles] = useState([]);
  const [batchSignProgress, setBatchSignProgress] = useState('');
  const [batchSignResults, setBatchSignResults] = useState([]);
  const [batchVerifyFiles, setBatchVerifyFiles] = useState([]);
  const [batchVerifyProgress, setBatchVerifyProgress] = useState('');
  const [batchVerifyResults, setBatchVerifyResults] = useState([]);
  const [collapsedBatchResults, setCollapsedBatchResults] = useState({});

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
    
    // Handle responseObjects (plural) from checkCMS
    if (response.responseObjects && Array.isArray(response.responseObjects)) {
      console.log('Response has responseObjects array');
      
      // Handle batch verification
      if (pendingRequestRef.current === 'batchVerifyFile') {
        console.log('Processing batch verify response');
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
      
      // Handle single file checkCMS
      if (pendingRequestRef.current === 'checkCMS') {
        console.log('CheckCMS verification result:', response.responseObjects);
        
        if (response.responseObjects.length > 0) {
          const verificationResult = {
            responseObject: {
              signerInfos: response.responseObjects
            }
          };
          
          setVerifyResult(verificationResult);
          
          const collapseState = {};
          response.responseObjects.forEach((_, idx) => {
            collapseState[idx] = idx !== 0;
          });
          setCollapsedSigners(collapseState);
          setVerifyStatus('');
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        } else {
          setVerifyStatus('❌ Verification Failed - No signers found');
          setVerifyResult(null);
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }
      }
    }
    
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

        // Handle file selection for CMS verification
        if (pendingRequestRef.current === 'selectCMSForVerify') {
          const cmsFilePath = result.replace(/\//g, '\\');
          setVerifyStatus('Verifying CMS signature via NCALayer...');
          
          const request = {
            module: 'kz.gov.pki.cms.CMSSignUtil',
            lang: 'en',
            method: 'checkCMS',
            args: [cmsFilePath]
          };
          
          pendingRequestRef.current = 'checkCMS';
          socket.send(JSON.stringify(request));
          return;
        }

        // Handle file selection for CMS extraction
        if (pendingRequestRef.current === 'selectCMSForExtract') {
          const cmsFilePath = result.replace(/\//g, '\\');
          const dirPath = cmsFilePath.substring(0, cmsFilePath.lastIndexOf('\\'));
          setVerifyStatus('Extracting document from CMS via NCALayer...');
          
          const request = {
            module: 'kz.gov.pki.cms.CMSSignUtil',
            lang: 'en',
            method: 'saveCMS',
            args: [cmsFilePath, dirPath]
          };
          
          pendingRequestRef.current = 'saveCMS';
          socket.send(JSON.stringify(request));
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
        // Handle NCALayer saveCMS (extraction) response - check this FIRST
        if (pendingRequestRef.current === 'saveCMS') {
          console.log('SaveCMS extraction result:', result);
          const extractedPath = result.filepath || result.path || result.file || JSON.stringify(result);
          setVerifyStatus(`✓ Document extracted and saved:\n${extractedPath}`);
          setPendingRequest(null);
          pendingRequestRef.current = null;
          return;
        }

        // Handle CMS file selection from NCALayer (shared for verify and extract)
        if (pendingRequestRef.current === 'selectCMS' && result.path) {
          const fullPath =
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

            // Store CMS file path and directory for use in both verify and extract
            cmsFilePathRef.current = normalized;
            cmsFileDirRef.current = dirPath;
            setCmsFile({ name, path: normalized });
            
            setVerifyStatus('');
            setPendingRequest(null);
            pendingRequestRef.current = null;
          }
          return;
        }

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
        if (pendingRequestRef.current === 'batchSelectVerifyFile' && result) {
          const fullPath =
            result.fullPath ||
            result.filePath ||
            result.path ||
            result.file ||
            '';
          const fileName =
            result.fileName ||
            result.filename ||
            result.name ||
            '';

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

            setPendingRequest(null);
            pendingRequestRef.current = null;
          } else {
            // User cancelled file selection
            setBatchVerifyProgress('No file selected. Click "Add File" to select CMS files.');
            setPendingRequest(null);
            pendingRequestRef.current = null;
          }
          return;
        }

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
        
        // Handle NCALayer checkCMS (verification) response
        if ((pendingRequestRef.current === 'checkCMS' || pendingRequestRef.current === 'batchVerifyFile') && Array.isArray(result)) {
          console.log('CheckCMS verification result:', result);
          
          // Handle batch verification
          if (pendingRequestRef.current === 'batchVerifyFile') {
            const ctx = batchVerifyContextRef.current;
            if (ctx && ctx.results && ctx.files) {
              const currentIndex = ctx.currentIndex;
              const files = ctx.files;
              
              // Update results for current file
              const updatedResults = [...ctx.results];
              updatedResults[currentIndex] = {
                ...updatedResults[currentIndex],
                status: result.length > 0 ? 'verified' : 'invalid',
                message: result.length > 0 ? `✓ Verified - ${result.length} signer(s)` : '✗ No valid signers found',
                signers: result
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
          // Result is array of signer info objects
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

  const toggleSignerCollapsed = (index) => {
    setCollapsedSigners(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
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

  // Batch Verification Functions
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
          onClick={() => setActiveTab('verify')}
          disabled={activeTab === 'verify'}
          style={{ marginLeft: '10px' }}
        >
          Verify Document
        </button>
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

      {activeTab === 'verify' && (
        <div className="section">
          <h3>Verify or Extract Document</h3>

          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={selectCMSFileForOperations}
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
              Choose File (.cms)
            </button>
          </div>

          <div style={{ marginBottom: '15px' }}>
            {cmsFile && <p>Selected: <strong>{cmsFile.name}</strong></p>}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <button onClick={verifyDocumentViaNCAlayer} disabled={!cmsFile} style={{ marginRight: '10px' }}>
              Check
            </button>
          </div>
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

      {activeTab === 'verify' && (
        <div className="section">
          <h3>Batch Verify Documents</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            Click "Add File" to select CMS files one by one for batch verification.
          </p>
          <div style={{ marginBottom: '15px' }}>
            <button 
              onClick={requestBatchVerifyFiles}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
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
            {batchVerifyFiles.length > 0 && (
              <>
                <button 
                  onClick={() => {
                    setBatchVerifyFiles([]);
                    setBatchVerifyResults([]);
                    setBatchVerifyProgress('');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    border: 'none',
                    marginRight: '10px'
                  }}
                >
                  Clear Files
                </button>
                <button 
                  onClick={batchVerifyDocuments} 
                  style={{ 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    padding: '10px 20px', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Verify Batch
                </button>
              </>
            )}
          </div>
          {batchVerifyFiles.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <p><strong>Selected {batchVerifyFiles.length} file(s):</strong></p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>File Name</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>File Path</th>
                  </tr>
                </thead>
                <tbody>
                  {batchVerifyFiles.map((file, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '8px' }}>{file.fileName}</td>
                      <td style={{ padding: '8px', fontSize: '0.9em', color: '#666' }}>{file.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {batchVerifyProgress && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px', color: '#003d82' }}>
              {batchVerifyProgress}
            </div>
          )}
          {renderBatchVerifyResults()}
        </div>
      )}
    </div>
  );
}

export default App;
