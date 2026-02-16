import React, { useState } from 'react';
import {
  fileToBase64,
  readCmsFile,
  getCertificateInfo,
  verifyCmsSignature
} from '../services/batchSignApiService';

const VerifyCmsModule = () => {
  // Certificate state
  const [keyStoreFile, setKeyStoreFile] = useState(null);
  const [password, setPassword] = useState('');
  const [storageType, setStorageType] = useState('PKCS12');
  const [certificateAlias, setCertificateAlias] = useState('');
  const [certificateInfo, setCertificateInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Verification state
  const [cmsSignatureFile, setCmsSignatureFile] = useState(null);
  const [originalDocumentFile, setOriginalDocumentFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Handle keystore file selection
  const handleKeyStoreChange = (e) => {
    const file = e.target.files[0];
    setKeyStoreFile(file);
    setCertificateInfo(null);
    setVerifyStatus(file ? `Keystore selected: ${file.name}` : '');
  };

  // Load certificate information
  const handleLoadCertificate = async () => {
    if (!keyStoreFile || !password) {
      setVerifyStatus('Please select a keystore file and enter password');
      return;
    }

    setLoading(true);
    setVerifyStatus('Loading certificate...');

    try {
      const keyStoreBase64 = await fileToBase64(keyStoreFile);
      const certInfo = await getCertificateInfo(
        keyStoreBase64,
        password,
        storageType,
        certificateAlias || null
      );

      setCertificateInfo(certInfo);
      setVerifyStatus('Certificate loaded successfully');
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      
      if (errorMsg.includes('Root/intermediate certificates') || errorMsg.includes('PKI root certificates')) {
        setVerifyStatus('⚠️ ' + errorMsg + ' See CERTIFICATE_INSTALLATION.md for instructions.');
      } else if (errorMsg.includes('Invalid password')) {
        setVerifyStatus('❌ ' + errorMsg);
      } else {
        setVerifyStatus(`Error loading certificate: ${errorMsg}`);
      }
      
      setCertificateInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle CMS signature file selection
  const handleCmsSignatureChange = (e) => {
    const file = e.target.files[0];
    setCmsSignatureFile(file);
    setVerificationResult(null);
    setVerifyStatus(file ? `CMS signature selected: ${file.name}` : '');
  };

  // Handle original document file selection (optional)
  const handleOriginalDocumentChange = (e) => {
    const file = e.target.files[0];
    setOriginalDocumentFile(file);
    setVerifyStatus(file ? `Original document selected: ${file.name}` : '');
  };

  // Verify CMS signature
  const handleVerifySignature = async () => {
    if (!cmsSignatureFile) {
      setVerifyStatus('Please select a CMS signature file');
      return;
    }

    setVerifyLoading(true);
    setVerifyStatus('Verifying signature...');
    setVerificationResult(null);

    try {
      // Read CMS signature file (handles both PEM text and DER binary)
      const cmsSignature = await readCmsFile(cmsSignatureFile);

      // Convert original document if provided
      let originalDocumentBase64 = null;
      if (originalDocumentFile) {
        originalDocumentBase64 = await fileToBase64(originalDocumentFile);
      }
      
      // Convert keystore if provided
      let keyStoreBase64 = null;
      if (keyStoreFile && password) {
        keyStoreBase64 = await fileToBase64(keyStoreFile);
      }

      // Verify signature
      const result = await verifyCmsSignature(
        cmsSignature,
        originalDocumentBase64,
        keyStoreBase64,
        password,
        storageType,
        certificateAlias || null
      );

      setVerificationResult(result);
      
      if (result.success) {
        setVerifyStatus('✓ Signature verified successfully!');
      } else {
        setVerifyStatus('✗ Signature verification failed: ' + result.message);
      }
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      
      if (errorMsg.includes('Root/intermediate certificates') || errorMsg.includes('PKI root certificates')) {
        setVerifyStatus('⚠️ ' + errorMsg + ' See CERTIFICATE_INSTALLATION.md for instructions.');
      } else {
        setVerifyStatus(`Error verifying signature: ${errorMsg}`);
      }
      setVerificationResult(null);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Clear verification inputs
  const handleClearVerification = () => {
    setCmsSignatureFile(null);
    setOriginalDocumentFile(null);
    setVerificationResult(null);
    setVerifyStatus('');
    setKeyStoreFile(null);
    setPassword('');
    setCertificateAlias('');
    setCertificateInfo(null);
  };

  return (
    <div className="verify-cms-module">
      <h2>Verify CMS Signature (SDK)</h2>

      {/* Certificate Section */}
      <div className="section certificate-section">
        <h3>1. Certificate (Keystore) - Optional</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          Loading a certificate helps with verification. If not provided, system certificates will be used.
        </p>
        
        {/* <div className="form-group">
          <label>
            Storage Type:
            <select
              value={storageType}
              onChange={(e) => setStorageType(e.target.value)}
              disabled={loading || verifyLoading}
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
              disabled={loading || verifyLoading}
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
              disabled={loading || verifyLoading}
            />
          </label>
        </div>
        <button
          onClick={handleLoadCertificate}
          disabled={!keyStoreFile || !password || loading || verifyLoading}
          className="btn-primary"
        >
          {loading ? 'Loading...' : 'Load Certificate'}
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

      {/* Verification Section */}
      <div className="section verification-section">
        <h3>2. Signature Verification</h3>
        
        <div className="form-group">
          <label>
            CMS Signature File (.cms, .p7s, .p7m):
            <input
              type="file"
              onChange={handleCmsSignatureChange}
              accept=".cms,.p7s,.p7m"
              disabled={verifyLoading}
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Original Document (optional):
            <input
              type="file"
              onChange={handleOriginalDocumentChange}
              disabled={verifyLoading}
            />
          </label>
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            Optional: If signature is detached, provide the original document
          </small>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleVerifySignature}
            disabled={!cmsSignatureFile || verifyLoading}
            className="btn-primary"
          >
            {verifyLoading ? 'Verifying...' : 'Verify SDK'}
          </button>
          
          <button
            onClick={handleClearVerification}
            disabled={verifyLoading}
            className="btn-secondary"
          >
            Clear
          </button>
        </div>

        {verifyStatus && (
          <div className={`status-message ${verificationResult?.success ? 'success' : ''}`}>
            {verifyStatus}
          </div>
        )}

        {verificationResult && verificationResult.success && (
          <div className="verification-info">
            <h4>Verification Details</h4>
            {verificationResult.signedData && (
              <div className="verification-detail">
                <strong>Signed Data Size:</strong> {verificationResult.signedData.length} bytes
              </div>
            )}
            {verificationResult.signerCertificate && (
              <div className="certificate-info">
                <h5>Signer Certificate</h5>
                <p><strong>Subject:</strong> {verificationResult.signerCertificate.subject}</p>
                <p><strong>Issuer:</strong> {verificationResult.signerCertificate.issuer}</p>
                <p><strong>Serial Number:</strong> {verificationResult.signerCertificate.serialNumber}</p>
                <p><strong>Valid From:</strong> {verificationResult.signerCertificate.validFrom}</p>
                <p><strong>Valid To:</strong> {verificationResult.signerCertificate.validTo}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .verify-cms-module {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }

        .section {
          background: #f5f5f5;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .verification-section {
          background: #e3f2fd;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }

        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-right: 10px;
        }

        .btn-primary {
          background: #2196f3;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1976d2;
        }

        .btn-secondary {
          background: #757575;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #616161;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status-message {
          padding: 15px;
          border-radius: 4px;
          margin: 15px 0;
          background: #fff3cd;
          border: 1px solid #ffc107;
        }

        .status-message.success {
          background: #d4edda;
          border-color: #28a745;
          color: #155724;
        }

        .verification-info {
          background: #e8f5e9;
          border: 1px solid #4caf50;
          border-radius: 4px;
          padding: 15px;
          margin-top: 15px;
        }

        .verification-info h4 {
          margin-top: 0;
          color: #2e7d32;
        }

        .verification-info h5 {
          margin-top: 10px;
          margin-bottom: 10px;
          color: #2e7d32;
        }

        .verification-detail {
          margin: 8px 0;
        }

        .certificate-info {
          background: #fff;
          border: 1px solid #c8e6c9;
          border-radius: 4px;
          padding: 15px;
          margin-top: 10px;
        }

        .certificate-info {
          background: #e8f5e9;
          border: 1px solid #4caf50;
          border-radius: 4px;
          padding: 15px;
          margin-top: 15px;
        }

        .certificate-info h4 {
          margin-top: 0;
          color: #2e7d32;
        }

        .certificate-info p {
          margin: 8px 0;
        }

        .certificate-section {
          background: #f9f9f9;
        }

        .form-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        small {
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default VerifyCmsModule;
