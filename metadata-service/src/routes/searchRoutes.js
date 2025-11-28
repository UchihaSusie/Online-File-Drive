/**
 * Search Routes
 * File search and sorting functionality
 * 
 * These endpoints provide search capabilities for the Cloud Drive:
 * - GET /api/files/search?q={keyword}     - Search by keyword (with optional sorting)
 * - GET /api/files/search/by-type?type=   - Search by file type
 * - GET /api/files/search/recent          - Get recently uploaded files
 * - GET /api/files/search/stats           - Get file statistics
 * - GET /api/files/search/list            - List files with sorting
 * 
 * Sorting Parameters (for /search and /list):
 * - sortBy: 'name' | 'updatedAt' | 'createdAt' | 'size' (default: 'updatedAt')
 * - sortDirection: 'asc' | 'desc' (default: 'desc')
 * 
 * All routes require authentication and operate on the current user's files.
 */

const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const { SORT_OPTIONS } = require('../services/searchService');

// ============================================
// GET /api/files/search?q={keyword}
// Search files by keyword with optional sorting
// ============================================
/**
 * Search files by keyword in filename.
 * Case-insensitive substring matching with sorting support.
 * 
 * Query params:
 * - q: Required. Search keyword
 * - limit: Optional. Max results (default: 50)
 * - sortBy: Optional. Sort field: 'name', 'updatedAt', 'createdAt', 'size' (default: 'updatedAt')
 * - sortDirection: Optional. Sort direction: 'asc' or 'desc' (default: 'desc')
 * 
 * Examples:
 * GET /api/files/search?q=report
 * GET /api/files/search?q=report&sortBy=name&sortDirection=asc
 * GET /api/files/search?q=document&sortBy=updatedAt&sortDirection=desc
 */
router.get('/', async (req, res) => {
    try {
        const { q, limit = 50, sortBy = 'updatedAt', sortDirection = 'desc' } = req.query;
        const userId = req.user.id;

        // Validate search query
        if (!q || q.trim().length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Search query (q) is required'
            });
        }

        // Minimum query length check
        if (q.trim().length < 2) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Search query must be at least 2 characters'
            });
        }

        // Use searchWithSort for sorted results
        const results = await searchService.searchWithSort(userId, q.trim(), {
            sortBy,
            sortDirection,
            limit
        });

        res.json({
            message: 'Search completed successfully',
            ...results
        });

    } catch (error) {
        console.error('[SEARCH] Keyword search error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to search files'
        });
    }
});

// ============================================
// GET /api/files/search/by-type?type={type}
// Search files by type
// ============================================
/**
 * Search files by file type.
 * Filters based on MIME type prefix matching.
 * 
 * Query params:
 * - type: Required. One of: image, video, audio, pdf, document, text
 * - limit: Optional. Max results (default: 50)
 * 
 * Example:
 * GET /api/files/search/by-type?type=image&limit=20
 */
router.get('/by-type', async (req, res) => {
    try {
        const { type, limit = 50 } = req.query;
        const userId = req.user.id;

        // Validate type parameter
        if (!type) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'File type is required. Supported types: image, video, audio, pdf, document, text'
            });
        }

        const results = await searchService.searchByType(userId, type, limit);

        // Check if type was invalid
        if (results.error) {
            return res.status(400).json(results);
        }

        res.json({
            message: 'Search by type completed successfully',
            ...results
        });

    } catch (error) {
        console.error('[SEARCH] Type search error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to search files by type'
        });
    }
});

// ============================================
// GET /api/files/search/recent
// Get recently uploaded files
// ============================================
/**
 * Get files uploaded within a specified time period.
 * Returns files sorted by upload date (newest first).
 * 
 * Query params:
 * - days: Optional. Number of days to look back (default: 7, max: 30)
 * - limit: Optional. Max results (default: 20)
 * 
 * Example:
 * GET /api/files/search/recent?days=3&limit=10
 */
router.get('/recent', async (req, res) => {
    try {
        let { days = 7, limit = 20 } = req.query;
        const userId = req.user.id;

        // Parse and validate days
        days = parseInt(days);
        if (isNaN(days) || days < 1) days = 7;
        if (days > 30) days = 30; // Max 30 days

        // Parse and validate limit
        limit = parseInt(limit);
        if (isNaN(limit) || limit < 1) limit = 20;
        if (limit > 100) limit = 100; // Max 100 results

        const results = await searchService.getRecentFiles(userId, days, limit);

        res.json({
            message: 'Recent files retrieved successfully',
            ...results
        });

    } catch (error) {
        console.error('[SEARCH] Recent files error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get recent files'
        });
    }
});

// ============================================
// GET /api/files/search/stats
// Get file statistics
// ============================================
/**
 * Get comprehensive file statistics for the current user.
 * 
 * Returns:
 * - totalFiles: Total number of files
 * - totalSize: Total storage used (bytes)
 * - totalSizeFormatted: Human-readable size
 * - typeBreakdown: File count by type
 * - recentUploads: Files uploaded in last 7 days
 * 
 * Example:
 * GET /api/files/search/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await searchService.getFileStats(userId);

        res.json({
            message: 'Statistics retrieved successfully',
            stats
        });

    } catch (error) {
        console.error('[SEARCH] Stats error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get file statistics'
        });
    }
});

// ============================================
// GET /api/files/search/list
// List all files with sorting
// ============================================
/**
 * List all user's files with flexible sorting.
 * This is the main endpoint for displaying files in a sorted view.
 * 
 * Query params:
 * - sortBy: Sort field (default: 'updatedAt')
 *   - 'name' or 'filename': Sort by filename (A-Z or Z-A)
 *   - 'updatedAt' or 'updated': Sort by last modified date
 *   - 'createdAt' or 'created': Sort by creation date
 *   - 'size': Sort by file size
 *   - 'type' or 'mimeType': Sort by file type
 * - sortDirection: 'asc' or 'desc' (default: 'desc')
 *   - 'asc': A-Z for names, oldest first for dates, smallest first for size
 *   - 'desc': Z-A for names, newest first for dates, largest first for size
 * - limit: Max results (default: 50, max: 200)
 * - folderId: Optional. Filter by folder
 * 
 * Examples:
 * GET /api/files/search/list                                    - Default (by updatedAt desc)
 * GET /api/files/search/list?sortBy=name&sortDirection=asc      - A-Z by name
 * GET /api/files/search/list?sortBy=name&sortDirection=desc     - Z-A by name
 * GET /api/files/search/list?sortBy=updatedAt&sortDirection=desc - Newest first
 * GET /api/files/search/list?sortBy=updatedAt&sortDirection=asc  - Oldest first
 * GET /api/files/search/list?sortBy=size&sortDirection=desc      - Largest first
 */
router.get('/list', async (req, res) => {
    try {
        let { sortBy = 'updatedAt', sortDirection = 'desc', limit = 50, folderId } = req.query;
        const userId = req.user.id;

        // Validate and normalize sortBy
        const validSortFields = ['name', 'filename', 'updatedat', 'updated', 'createdat', 'created', 'size', 'type', 'mimetype'];
        const sortByLower = sortBy.toLowerCase();
        if (!validSortFields.includes(sortByLower)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Invalid sortBy value. Supported: ${validSortFields.join(', ')}`
            });
        }

        // Validate sortDirection
        sortDirection = sortDirection.toLowerCase();
        if (!['asc', 'desc'].includes(sortDirection)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'sortDirection must be "asc" or "desc"'
            });
        }

        // Parse and validate limit
        limit = parseInt(limit);
        if (isNaN(limit) || limit < 1) limit = 50;
        if (limit > 200) limit = 200;

        const results = await searchService.listFilesWithSort(userId, {
            sortBy: sortByLower,
            sortDirection,
            limit,
            folderId: folderId || null
        });

        res.json({
            message: 'Files retrieved successfully',
            ...results
        });

    } catch (error) {
        console.error('[SEARCH] List files error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to list files'
        });
    }
});

// ============================================
// GET /api/files/search/sort-options
// Get available sort options
// ============================================
/**
 * Returns available sorting options.
 * Useful for frontend to build sort dropdowns.
 */
router.get('/sort-options', (req, res) => {
    res.json({
        message: 'Sort options retrieved successfully',
        options: {
            sortBy: [
                { value: 'name', label: 'Name', description: 'Sort alphabetically by filename' },
                { value: 'updatedAt', label: 'Last Modified', description: 'Sort by last modified date' },
                { value: 'createdAt', label: 'Date Created', description: 'Sort by creation date' },
                { value: 'size', label: 'Size', description: 'Sort by file size' },
                { value: 'type', label: 'Type', description: 'Sort by file type' }
            ],
            sortDirection: [
                { value: 'asc', label: 'Ascending', description: 'A-Z, oldest first, smallest first' },
                { value: 'desc', label: 'Descending', description: 'Z-A, newest first, largest first' }
            ]
        }
    });
});

module.exports = router;

