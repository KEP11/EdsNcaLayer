import React, { useState } from 'react';
import {
  fileToBase64,
  getCertificateInfo,
  signDocumentsBatch,
  downloadBase64File
} from '../services/batchSignApiService';

const BatchSignModule = () => {
  const [keyStoreFile, setKeyStoreFile] = useState(null);
  const [password, setPassword] = useState('');
  const [storageType, setStorageType] = useState('PKCS12');
  const [certificateAlias, setCertificateAlias] = useState('');
  const [certificateInfo, setCertificateInfo] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handle keystore file selection
  const handleKeyStoreChange = (e) => {
    const file = e.target.files[0];
    setKeyStoreFile(file);
    setCertificateInfo(null);
    setStatus(file ? `Keystore selected: ${file.name}` : '');
  };

  // Load certificate information
  const handleLoadCertificate = async () => {
    if (!keyStoreFile || !password) {
      setStatus('Please select a keystore file and enter password');
      return;
    }

    setLoading(true);
    setStatus('Loading certificate...');

    try {
      const keyStoreBase64 = await fileToBase64(keyStoreFile);
      const certInfo = await getCertificateInfo(
        keyStoreBase64,
        password,
        storageType,
        certificateAlias || null
      );

      setCertificateInfo(certInfo);
      setStatus('Certificate loaded successfully');
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      
      // Provide helpful guidance for common errors
      if (errorMsg.includes('Root/intermediate certificates') || errorMsg.includes('PKI root certificates')) {
        setStatus('⚠️ ' + errorMsg + ' See CERTIFICATE_INSTALLATION.md for instructions.');
      } else if (errorMsg.includes('Invalid password')) {
        setStatus('❌ ' + errorMsg);
      } else {
        setStatus(`Error loading certificate: ${errorMsg}`);
      }
      
      setCertificateInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle document files selection
  const handleDocumentsChange = (e) => {
    const files = Array.from(e.target.files);
    setDocuments(files);
    setResults(null);
    setStatus(files.length > 0 ? `${files.length} document(s) selected` : '');
  };

  // Clear all selected documents
  const handleClearDocuments = () => {
    setDocuments([]);
    setResults(null);
    setStatus('Documents cleared');
  };

  // Sign all documents in batch
  const handleBatchSign = async () => {
    if (!keyStoreFile || !password) {
      setStatus('Please select a keystore file and enter password');
      return;
    }

    if (documents.length === 0) {
      setStatus('Please select documents to sign');
      return;
    }

    setLoading(true);
    setStatus(`Signing ${documents.length} document(s)...`);
    setResults(null);

    try {
      // Convert keystore to base64
      const keyStoreBase64 = await fileToBase64(keyStoreFile);

      // Convert all documents to base64
      const documentsData = await Promise.all(
        documents.map(async (file) => ({
          fileName: file.name,
          documentBase64: await fileToBase64(file)
        }))
      );

      // Sign in batch
      const batchResult = await signDocumentsBatch(
        documentsData,
        keyStoreBase64,
        password,
        storageType,
        certificateAlias || null
      );

      setResults(batchResult);
      setStatus(
        `Batch signing completed! Success: ${batchResult.successCount}, Failed: ${batchResult.failedCount}`
      );
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      
      if (errorMsg.includes('Root/intermediate certificates') || errorMsg.includes('PKI root certificates')) {
        setStatus('⚠️ ' + errorMsg + ' See CERTIFICATE_INSTALLATION.md for instructions.');
      } else {
        setStatus(`Error in batch signing: ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Download a single signed document
  const handleDownloadSignature = (result) => {
    if (result.signatureBase64) {
      const signedFileName = result.fileName.replace(/\.[^/.]+$/, '') + '.cms';
      downloadBase64File(result.signatureBase64, signedFileName);
    }
  };

  // Download all successful signatures
  const handleDownloadAll = () => {
    if (!results || results.successCount === 0) return;

    results.results
      .filter((r) => r.success && r.signatureBase64)
      .forEach((result) => {
        handleDownloadSignature(result);
      });

    setStatus(`Downloaded ${results.successCount} signed document(s)`);
  };

  return (
    <div className="batch-sign-module">
      <h2>Batch Document Signing</h2>

      {/* Keystore Section */}
      <div className="section certificate-section">
        {/* <h3>1. Certificate (Keystore)</h3>
        <div className="form-group">
          <label>
            Storage Type:
            <select
              value={storageType}
              onChange={(e) => setStorageType(e.target.value)}
              disabled={loading}
            >
              <option value="PKCS12">PKCS12 (.p12, .pfx)</option>
              <option value="KAZTOKEN">KazToken</option>
            </select>
          </label>
        </div> */}

        <div className="form-group">
          <label>
            Keystore File:
            <input
              type="file"
              onChange={handleKeyStoreChange}
              accept=".p12,.pfx"
              disabled={loading}
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Password:
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter keystore password"
              disabled={loading}
            />
          </label>
        </div>

        <button
          onClick={handleLoadCertificate}
          disabled={!keyStoreFile || !password || loading}
          className="btn-primary"
        >
          Load Certificate
        </button>

        {certificateInfo && (
          <div className="certificate-info">
            <h4>Certificate Information</h4>
            <p><strong>Subject:</strong> {certificateInfo.subject}</p>
            <p><strong>Issuer:</strong> {certificateInfo.issuer}</p>
            <p><strong>Serial Number:</strong> {certificateInfo.serialNumber}</p>
            <p><strong>Valid From:</strong> {certificateInfo.validFrom}</p>
            <p><strong>Valid To:</strong> {certificateInfo.validTo}</p>
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="section documents-section">
        <h3>2. Documents to Sign</h3>
        <div className="form-group">
          <label>
            Select Documents:
            <input
              type="file"
              onChange={handleDocumentsChange}
              multiple
              disabled={loading}
            />
          </label>
        </div>

        {documents.length > 0 && (
          <div className="documents-list">
            <h4>Selected Documents ({documents.length})</h4>
            <ul>
              {documents.map((doc, index) => (
                <li key={index}>
                  {doc.name} ({(doc.size / 1024).toFixed(2)} KB)
                </li>
              ))}
            </ul>
            <button
              onClick={handleClearDocuments}
              disabled={loading}
              className="btn-secondary"
            >
              Clear Documents
            </button>
          </div>
        )}
      </div>

      {/* Actions Section */}
      <div className="section actions-section">
        <h3>3. Sign Documents</h3>
        <button
          onClick={handleBatchSign}
          disabled={!keyStoreFile || !password || documents.length === 0 || loading}
          className="btn-primary btn-large"
        >
          {loading ? 'Signing...' : `Sign ${documents.length} Document(s)`}
        </button>
      </div>

      {/* Status Section */}
      {status && (
        <div className={`status-message ${results ? 'success' : ''}`}>
          {status}
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="section results-section">
          <h3>Signing Results</h3>
          <div className="results-summary">
            <p><strong>Total:</strong> {results.totalDocuments}</p>
            <p className="success"><strong>Success:</strong> {results.successCount}</p>
            <p className="error"><strong>Failed:</strong> {results.failedCount}</p>
          </div>

          {results.successCount > 0 && (
            <button onClick={handleDownloadAll} className="btn-primary">
              Download All Signatures ({results.successCount})
            </button>
          )}

          <div className="results-list">
            {results.results.map((result, index) => (
              <div
                key={index}
                className={`result-item ${result.success ? 'success' : 'error'}`}
              >
                <div className="result-header">
                  <span className="result-icon">
                    {result.success ? '✓' : '✗'}
                  </span>
                  <span className="result-filename">{result.fileName}</span>
                  {result.success && (
                    <button
                      onClick={() => handleDownloadSignature(result)}
                      className="btn-download"
                    >
                      Download
                    </button>
                  )}
                </div>
                {result.errorMessage && (
                  <div className="result-error">{result.errorMessage}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchSignModule;
