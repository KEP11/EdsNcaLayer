// Batch signing service using backend API
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Converts a file to Base64 string
 * @param {File} file - The file to convert
 * @returns {Promise<string>} Base64 encoded string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Reads a CMS signature file (handles both PEM text and DER binary formats)
 * @param {File} file - The CMS signature file
 * @returns {Promise<string>} CMS signature as string (PEM format with headers or base64)
 */
export const readCmsFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      // If it's PEM format (contains headers), return as-is
      if (text.includes('-----BEGIN')) {
        resolve(text);
      } else {
        // If it's not text, re-read as binary and convert to base64
        const binaryReader = new FileReader();
        binaryReader.onload = () => {
          const base64 = binaryReader.result.split(',')[1];
          resolve(base64);
        };
        binaryReader.onerror = (error) => reject(error);
        binaryReader.readAsDataURL(file);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

/**
 * Gets certificate information from keystore
 * @param {string} keyStoreBase64 - Base64 encoded keystore file
 * @param {string} password - Password for the keystore
 * @param {string} storageType - Storage type (PKCS12, JKS, etc.)
 * @param {string} certificateAlias - Optional certificate alias
 * @returns {Promise<Object>} Certificate information
 */
export const getCertificateInfo = async (keyStoreBase64, password, storageType = 'PKCS12', certificateAlias = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sign/certificate/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyStoreBase64,
        password,
        storageType,
        certificateAlias
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to load certificate');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting certificate info:', error);
    throw error;
  }
};

/**
 * Signs a single document
 * @param {string} documentBase64 - Base64 encoded document
 * @param {string} keyStoreBase64 - Base64 encoded keystore file
 * @param {string} password - Password for the keystore
 * @param {string} storageType - Storage type (PKCS12, JKS, etc.)
 * @param {string} certificateAlias - Optional certificate alias
 * @returns {Promise<Object>} Sign response
 */
export const signDocument = async (documentBase64, keyStoreBase64, password, storageType = 'PKCS12', certificateAlias = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentBase64,
        keyStoreBase64,
        password,
        storageType,
        certificateAlias
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sign document');
    }

    return await response.json();
  } catch (error) {
    console.error('Error signing document:', error);
    throw error;
  }
};

/**
 * Signs multiple documents in batch
 * @param {Array<{fileName: string, documentBase64: string}>} documents - Array of documents to sign
 * @param {string} keyStoreBase64 - Base64 encoded keystore file
 * @param {string} password - Password for the keystore
 * @param {string} storageType - Storage type (PKCS12, JKS, etc.)
 * @param {string} certificateAlias - Optional certificate alias
 * @returns {Promise<Object>} Batch sign response
 */
export const signDocumentsBatch = async (documents, keyStoreBase64, password, storageType = 'PKCS12', certificateAlias = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sign/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documents,
        keyStoreBase64,
        password,
        storageType,
        certificateAlias
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sign documents');
    }

    return await response.json();
  } catch (error) {
    console.error('Error in batch signing:', error);
    throw error;
  }
};

/**
 * Downloads a base64 encoded file
 * @param {string} base64Data - Base64 encoded file content (can be PEM format)
 * @param {string} fileName - Name of the file to download
 */
export const downloadBase64File = (base64Data, fileName) => {
  try {
    let blob;
    
    // Check if data is in PEM format (contains -----BEGIN/END-----)
    if (base64Data.includes('-----BEGIN') || base64Data.includes('-----END')) {
      // PEM format - save as text file
      blob = new Blob([base64Data], { type: 'application/pkcs7-mime' });
    } else {
      // Try to decode as pure base64
      try {
        // Remove any whitespace that might be present
        const cleanBase64 = base64Data.replace(/\s/g, '');
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'application/pkcs7-mime' });
      } catch (decodeError) {
        // If decode fails, treat as text
        console.warn('Failed to decode as base64, treating as text:', decodeError);
        blob = new Blob([base64Data], { type: 'application/pkcs7-mime' });
      }
    }

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error('Failed to download file: ' + error.message);
  }
};

/**
 * Verifies a CMS signature using KalkanAPI
 * @param {string} cmsSignature - CMS signature (can be PEM format with headers or base64)
 * @param {string} originalDocumentBase64 - Optional: Base64 encoded original document
 * @param {string} keyStoreBase64 - Optional: Base64 encoded keystore
 * @param {string} password - Optional: Keystore password
 * @param {string} storageType - Optional: Storage type (PKCS12, KazToken, etc.)
 * @param {string} certificateAlias - Optional: Certificate alias
 * @returns {Promise<Object>} Verification result with certificate information
 */
export const verifyCmsSignature = async (
  cmsSignature, 
  originalDocumentBase64 = null,
  keyStoreBase64 = null,
  password = null,
  storageType = null,
  certificateAlias = null
) => {
  try {
    const requestBody = {
      cmsSignatureBase64: cmsSignature,
      originalDocumentBase64
    };
    
    // Add optional keystore parameters if provided
    if (keyStoreBase64 && password) {
      requestBody.keyStoreBase64 = keyStoreBase64;
      requestBody.password = password;
      requestBody.storageType = storageType || 'PKCS12';
      if (certificateAlias) {
        requestBody.certificateAlias = certificateAlias;
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/sign/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = 'Failed to verify signature';
      try {
        // Clone the response before reading to allow retry
        const errorData = await response.clone().json();
        errorMessage = errorData.message || errorMessage;
      } catch (parseError) {
        // If JSON parsing fails, try to get text from original response
        try {
          const text = await response.text();
          errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
        } catch (textError) {
          // Use status-based error message
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
    try {
      return await response.json();
    } catch (jsonError) {
      console.error('Failed to parse response JSON:', jsonError);
      // Try to get response as text for debugging
      const responseText = await response.clone().text();
      console.error('Response text:', responseText);
      throw new Error('Server returned invalid JSON response: ' + responseText.substring(0, 200));
    }
  } catch (error) {
    console.error('Error verifying signature:', error);
    throw error;
  }
};
