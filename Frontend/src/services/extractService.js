import { createRequest, sendWs } from './common';

export const extractDocumentViaNCAlayer = ({
  socketRef,
  socket,
  cmsFilePathRef,
  cmsFileDirRef,
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
    setVerifyStatus('Extracting document from CMS via NCALayer...');

    setPendingRequest('saveCMS');
    pendingRequestRef.current = 'saveCMS';

    const request = createRequest('saveCMS', [cmsFilePathRef.current, cmsFileDirRef.current || '']);
    sendWs(socketRef, socket, request);
  } catch (error) {
    setVerifyStatus(`Error: ${error.message}`);
  }
};
