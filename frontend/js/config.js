// API Configuration
const CONFIG = {
    // Auth Service (User authentication)
    AUTH_API_URL: "http://localhost:3000",
    
    // File Management Service (File/Folder operations)
    FILE_API_URL: "http://localhost:3002",
    
    // Metadata Service (Search, Sort - can call directly for search)
    // Use AWS deployed URL or local
    METADATA_API_URL: "https://votmaqe624.execute-api.us-east-1.amazonaws.com/prod"
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

