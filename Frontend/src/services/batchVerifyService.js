import { createRequest, sendWs } from './common';

export const requestBatchVerifyFiles = ({
  socketRef,
  socket,
  fileDir,
  setBatchVerifyProgress,
  setPendingRequest,
  pendingRequestRef
}) => {
  if (!socketRef?.current && !socket) {
    setBatchVerifyProgress('Not connected to NCALayer');
    return;
  }

  const request = createRequest('getFilePath', ['cms', fileDir || '']);
  setPendingRequest('batchSelectVerifyFile');
  pendingRequestRef.current = 'batchSelectVerifyFile';
  sendWs(socketRef, socket, request);
  setBatchVerifyProgress('Select a CMS file to add to batch...');
};

export const batchVerifyDocuments = ({
  socketRef,
  socket,
  batchVerifyFiles,
  setBatchVerifyProgress,
  setBatchVerifyResults,
  batchVerifyContextRef,
  processBatchVerifyFile
}) => {
  if (!socketRef?.current && !socket) {
    setBatchVerifyProgress('Not connected to NCALayer. Please check connection.');
    return;
  }

  if (batchVerifyFiles.length === 0) {
    setBatchVerifyProgress('Please select CMS files for batch verification');
    return;
  }

  setBatchVerifyProgress(`Starting batch verification of ${batchVerifyFiles.length} file(s)...`);

  const initialResults = batchVerifyFiles.map(file => ({
    fileName: file.fileName,
    path: file.path,
    status: 'pending',
    message: '',
    signers: []
  }));
  setBatchVerifyResults(initialResults);

  batchVerifyContextRef.current = {
    currentIndex: 0,
    results: initialResults,
    files: batchVerifyFiles
  };

  processBatchVerifyFile(0, batchVerifyFiles, initialResults);
};

export const processBatchVerifyFile = ({
  index,
  files,
  results,
  socketRef,
  socket,
  setBatchVerifyProgress,
  batchVerifyContextRef,
  pendingRequestRef
}) => {
  if (index >= files.length) {
    setBatchVerifyProgress(`✓ Batch verification completed: ${results.length} files processed`);
    return;
  }

  const currentFile = files[index];
  setBatchVerifyProgress(`Verifying file ${index + 1} of ${files.length}: ${currentFile.fileName}...`);

  batchVerifyContextRef.current = {
    currentIndex: index,
    results,
    files
  };

  pendingRequestRef.current = 'batchVerifyFile';

  const request = createRequest('checkCMS', [currentFile.path]);
  sendWs(socketRef, socket, request);
};
