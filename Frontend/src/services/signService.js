import { createRequest, sendWs } from './common';

export const requestFilePath = ({
  socketRef,
  socket,
  fileDir,
  setStatus,
  setPendingRequest,
  pendingRequestRef
}) => {
  if (!socketRef?.current && !socket) {
    setStatus('Please connect to NCALayer first');
    return;
  }

  setPendingRequest('getFilePath');
  pendingRequestRef.current = 'getFilePath';

  const request = createRequest('getFilePath', ['all', fileDir || '']);
  sendWs(socketRef, socket, request);
  setStatus('Select a file in NCALayer...');
};

export const signDocument = ({
  socketRef,
  socket,
  filePath,
  fileDir,
  storage,
  fileNameRef,
  setStatus,
  setPendingRequest,
  pendingRequestRef
}) => {
  if ((!socketRef?.current && !socket) || !filePath || !fileDir || !storage) {
    setStatus('Please connect to NCALayer, select storage and choose file');
    return;
  }

  setPendingRequest('signDocument');
  pendingRequestRef.current = 'signDocument';

  const request = createRequest('signFilePath', [filePath, fileDir, storage]);
  sendWs(socketRef, socket, request);
  setStatus(`Signing document from: ${fileNameRef.current || 'selected file'}`);
};
