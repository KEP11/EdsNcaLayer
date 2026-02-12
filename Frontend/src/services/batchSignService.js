import { createRequest, sendWs } from './common';

export const clearBatchFiles = ({
  setBatchSignFiles,
  setBatchSignResults,
  setBatchSignProgress
}) => {
  setBatchSignFiles([]);
  setBatchSignResults([]);
  setBatchSignProgress('Files cleared. Click "Add Files" to select files for signing.');
};

export const requestBatchSignFiles = ({
  socketRef,
  socket,
  fileDir,
  batchSignFiles,
  setBatchSignResults,
  setBatchSignProgress,
  setPendingRequest,
  pendingRequestRef
}) => {
  if (!socketRef?.current && !socket) {
    setBatchSignProgress('Not connected to NCALayer. Please check connection.');
    return;
  }

  if (batchSignFiles.length === 0) {
    setBatchSignResults([]);
  }

  setBatchSignProgress('Selecting file... Click again to add more files.');
  setPendingRequest('batchSelectFile');
  pendingRequestRef.current = 'batchSelectFile';

  const request = createRequest('getFilePath', ['all', fileDir || '']);
  sendWs(socketRef, socket, request);
};

export const batchSignDocuments = ({
  socketRef,
  socket,
  storage,
  batchSignFiles,
  setBatchSignProgress,
  setBatchSignResults,
  batchSignContextRef,
  processBatchSignFile
}) => {
  if ((!socketRef?.current && !socket) || !storage) {
    setBatchSignProgress('Please connect to NCALayer and select storage first');
    return;
  }

  if (batchSignFiles.length === 0) {
    setBatchSignProgress('Please select files for batch signing');
    return;
  }

  setBatchSignProgress(`Starting batch signing of ${batchSignFiles.length} file(s)...`);

  const initialResults = batchSignFiles.map(file => ({
    fileName: file.fileName,
    path: file.path,
    status: 'pending',
    message: ''
  }));
  setBatchSignResults(initialResults);

  batchSignContextRef.current = {
    currentIndex: 0,
    results: initialResults,
    files: batchSignFiles
  };

  processBatchSignFile(0, batchSignFiles, initialResults);
};

export const processBatchSignFile = ({
  index,
  files,
  results,
  socketRef,
  socket,
  storage,
  setBatchSignProgress,
  batchSignContextRef,
  pendingRequestRef
}) => {
  if (index >= files.length) {
    setBatchSignProgress('Batch signing complete!');
    return;
  }

  const currentFile = files[index];
  setBatchSignProgress(`Signing file ${index + 1}/${files.length}: ${currentFile.fileName}...`);

  batchSignContextRef.current = {
    currentIndex: index,
    results,
    files
  };

  pendingRequestRef.current = 'batchSignFile';

  const request = createRequest('signFilePath', [
    currentFile.path,
    currentFile.path.substring(0, currentFile.path.lastIndexOf('\\')),
    storage
  ]);

  if (!sendWs(socketRef, socket, request)) {
    setBatchSignProgress('Error: Socket connection lost');
  }
};
