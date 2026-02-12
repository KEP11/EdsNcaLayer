import { createRequest, sendWs } from './common';

export const selectCMSFileForOperations = ({
  socketRef,
  socket,
  cmsFileDirRef,
  setVerifyResult,
  setVerifyStatus,
  setPendingRequest,
  pendingRequestRef
}) => {
  if (!socketRef?.current && !socket) {
    setVerifyStatus('Not connected to NCALayer. Please check connection.');
    return;
  }

  try {
    setVerifyResult(null);
    setVerifyStatus('Select a CMS file to verify or extract...');

    setPendingRequest('selectCMS');
    pendingRequestRef.current = 'selectCMS';

    const request = createRequest('getFilePath', ['all', cmsFileDirRef.current || '']);
    sendWs(socketRef, socket, request);
  } catch (error) {
    setVerifyStatus(`Error: ${error.message}`);
  }
};

export const verifyDocumentViaNCAlayer = ({
  socketRef,
  socket,
  cmsFilePathRef,
  setVerifyStatus,
  setPendingRequest,
  pendingRequestRef
}) => {
  if (!socketRef?.current && !socket) {
    setVerifyStatus('Not connected to NCALayer. Please check connection.');
    return;
  }

  if (!cmsFilePathRef.current) {
    setVerifyStatus('Please choose a signature file (.cms) first');
    return;
  }

  try {
    setVerifyStatus('Verifying signature via NCALayer...');

    setPendingRequest('checkCMS');
    pendingRequestRef.current = 'checkCMS';

    const request = createRequest('checkCMS', [cmsFilePathRef.current]);
    sendWs(socketRef, socket, request);
  } catch (error) {
    setVerifyStatus(`Error: ${error.message}`);
  }
};
