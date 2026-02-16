export const CMS_MODULE = 'kz.gov.pki.cms.CMSSignUtil';
export const UTIL_MODULE = 'kz.gov.pki.knca.commonUtils';

export const createRequest = (method, args, module = CMS_MODULE, lang = 'en') => ({
  module,
  lang,
  method,
  args
});

export const normalizePath = (value) => (value || '').replace(/\//g, '\\');

export const getDirPath = (fullPath) => {
  const path = fullPath || '';
  const last = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return last >= 0 ? path.slice(0, last) : '';
};

export const getFileName = (fullPath) => {
  const path = fullPath || '';
  const last = path.lastIndexOf('\\');
  return last >= 0 ? path.slice(last + 1) : path;
};

export const extractFileInfo = (result) => {
  const fullPath =
    result?.fullPath ||
    result?.filePath ||
    result?.path ||
    result?.file ||
    '';
  const fileName =
    result?.fileName ||
    result?.filename ||
    result?.name ||
    '';
  const dirPath =
    result?.directory ||
    result?.dir ||
    result?.folder ||
    result?.filedir ||
    (fullPath ? getDirPath(fullPath) : '');

  return {
    fullPath,
    fileName,
    dirPath
  };
};

export const sendWs = (socketRef, socket, request) => {
  const ws = socketRef?.current || socket;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(request));
    return true;
  }
  return false;
};

/**
 * Establishes WebSocket connection to NCALayer
 * @param {Function} onOpen - Callback when connection opens
 * @param {Function} onMessage - Callback when message is received
 * @param {Function} onError - Callback when error occurs
 * @param {Function} onClose - Callback when connection closes
 * @returns {WebSocket} WebSocket instance
 */
export const connectToNCALayer = (onOpen, onMessage, onError, onClose) => {
  const ws = new WebSocket('wss://127.0.0.1:13579');
  
  ws.onopen = () => {
    console.log('WebSocket opened');
    if (onOpen) onOpen(ws);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (onError) onError(error);
  };

  ws.onmessage = (event) => {
    console.log('Received message:', event.data);
    try {
      const response = JSON.parse(event.data);
      console.log('Parsed response:', response);
      if (onMessage) onMessage(response);
    } catch (err) {
      console.error('Failed to parse response:', err);
      if (onError) onError(err);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    if (onClose) onClose();
  };

  return ws;
};
