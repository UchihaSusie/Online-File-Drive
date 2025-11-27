const fileService = require('./fileService');

const MAX_VERSIONS = parseInt(process.env.MAX_VERSIONS) || 3;

class VersionService {
    /**
     * Add new version to versions array
     */
    addVersion(currentVersions, newVersion) {
        const versions = [...currentVersions];
        versions.push(newVersion);

        // Keep only last MAX_VERSIONS versions
        if (versions.length > MAX_VERSIONS) {
            return {
                versionsToKeep: versions.slice(-MAX_VERSIONS),
                deletedVersion: versions[0]
            };
        }

        return {
            versionsToKeep: versions,
            deletedVersion: null
        };
    }

    /**
     * Find specific version
     */
    findVersion(versions, versionNumber) {
        return versions.find(v => v.version === parseInt(versionNumber));
    }

    /**
     * Get current version
     */
    getCurrentVersion(metadata) {
        return this.findVersion(metadata.versions, metadata.currentVersion);
    }

    /**
     * Delete old version from S3
     */
    async deleteOldVersion(deletedVersion) {
        if (!deletedVersion) return;

        try {
            await fileService.deleteFromS3(deletedVersion.s3Key);
            console.log(`✓ Deleted old version ${deletedVersion.version}`);
        } catch (error) {
            console.error(`Failed to delete version ${deletedVersion.version}:`, error.message);
        }
    }

    /**
     * Create version metadata object
     */
    createVersionMetadata(versionNumber, s3Key, size) {
        return {
            version: versionNumber,
            s3Key,
            size,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Format versions for response
     */
    formatVersionsResponse(versions, currentVersion) {
        return versions.map(v => ({
            version: v.version,
            size: v.size,
            createdAt: v.createdAt,
            isCurrent: v.version === currentVersion
        }));
    }
}

module.exports = new VersionService();