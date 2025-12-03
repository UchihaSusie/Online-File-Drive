// API calls for File and Folder operations
// Uses CONFIG from config.js

// ============================================
// File Operations (via File Management Service)
// ============================================

// Upload file
async function uploadFile(file, folderId = null) {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
        formData.append('folderId', folderId);
    }

    const response = await fetch(`${CONFIG.FILE_API_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
    }
    return data;
}

// List files (optionally in a folder)
async function listFiles(folderId = null) {
    const token = getToken();
    let url = `${CONFIG.FILE_API_URL}/api/files`;
    if (folderId) {
        url += `?folderId=${folderId}`;
    }

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to list files');
    }
    return data;
}

// Download file
async function downloadFile(fileId) {
    const token = getToken();
    const response = await fetch(`${CONFIG.FILE_API_URL}/api/files/${fileId}/download`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Download failed');
    }
    
    // Open download URL in new tab (handle both response formats)
    const downloadUrl = data.data?.downloadUrl || data.downloadUrl;
    if (downloadUrl) {
        window.open(downloadUrl, '_blank');
    } else {
        throw new Error('No download URL received');
    }
    return data;
}

// Delete file
async function deleteFile(fileId) {
    const token = getToken();
    const response = await fetch(`${CONFIG.FILE_API_URL}/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
    }
    return data;
}

// Move file to folder
async function moveFile(fileId, targetFolderId) {
    const token = getToken();
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/metadata/${fileId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({folderId: targetFolderId === 'root' ? null : targetFolderId})
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Move failed');
    }
    return data;
}

// ============================================
// Folder Operations (via Metadata Service)
// ============================================

// Create folder
async function createFolder(name, parentId = 'root') {
    const token = getToken();
    const user = getUser();
    if (!user || !user.id) {
        throw new Error('User ID not found. Please log in again.');
    }
    const folderId = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/folders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folderId, userId: user.id, name, parentId })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to create folder');
    }
    return data;
}

// List all folders
async function listFolders() {
    const token = getToken();
    const user = getUser();
    if (!user || !user.id) {
        throw new Error('User ID not found. Please log in again.');
    }
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/folders?userId=${user.id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to list folders');
    }
    return data;
}

// Get folder content (subfolders + files)
async function getFolderContent(folderId) {
    const token = getToken();
    const user = getUser();
    if (!user || !user.id) {
        throw new Error('User ID not found. Please log in again.');
    }
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/folders/${folderId}/content?userId=${user.id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to get folder content');
    }
    return data;
}

// Get folder info
async function getFolderInfo(folderId) {
    const token = getToken();
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/folders/${folderId}/info`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to get folder info');
    }
    return data;
}

// Move folder
async function moveFolder(folderId, targetFolderId) {
    const token = getToken();
    const user = getUser();
    if (!user || !user.id) {
        throw new Error('User ID not found. Please log in again.');
    }
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/folders/${folderId}/move`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetFolderId, userId: user.id })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Move folder failed');
    }
    return data;
}

// Delete folder
async function deleteFolder(folderId) {
    const token = getToken();
    const user = getUser();
    if (!user || !user.id) {
        throw new Error('User ID not found. Please log in again.');
    }
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/folders/${folderId}?userId=${user.id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Delete folder failed');
    }
    return data;
}

// ============================================
// Search Operations (via Metadata Service)
// ============================================

// Search files by keyword
async function searchFiles(keyword, sortBy = 'updatedAt', sortDirection = 'desc') {
    const token = getToken();
    const url = `${CONFIG.METADATA_API_URL}/api/files/search?q=${encodeURIComponent(keyword)}&sortBy=${sortBy}&sortDirection=${sortDirection}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Search failed');
    }
    return data;
}

// List files with sorting
async function listFilesWithSort(sortBy = 'updatedAt', sortDirection = 'desc', folderId = null) {
    const token = getToken();
    let url = `${CONFIG.METADATA_API_URL}/api/files/search/list?sortBy=${sortBy}&sortDirection=${sortDirection}`;
    if (folderId) {
        url += `&folderId=${encodeURIComponent(folderId)}`;
    }
    // const url = `${CONFIG.METADATA_API_URL}/api/files/search/list?sortBy=${sortBy}&sortDirection=${sortDirection}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to list files');
    }
    return data;
}

// Search by file type
async function searchByType(type) {
    const token = getToken();
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/files/search/by-type?type=${type}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Search failed');
    }
    return data;
}

// Get recent files
async function getRecentFiles(days = 7) {
    const token = getToken();
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/files/search/recent?days=${days}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to get recent files');
    }
    return data;
}

// Get file statistics
async function getFileStats() {
    const token = getToken();
    const response = await fetch(`${CONFIG.METADATA_API_URL}/api/files/search/stats`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to get stats');
    }
    return data;
}

async function createShareLink(fileId) {
    const token = getToken();
    const user = getUser();
    
    if (!user || !user.id) {
        throw new Error('User ID not found. Please log in again.');
    }
    
    const response = await fetch(`${CONFIG.SHARE_API_URL}/share`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'x-user-id': user.id,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileId })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create share link');
    }
    return data;
}

