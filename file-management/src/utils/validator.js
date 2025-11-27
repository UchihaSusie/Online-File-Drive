const Joi = require('joi');

/**
 * Validate file upload request
 */
const validateUpload = (body) => {
    const schema = Joi.object({
        folderId: Joi.string().allow(null, '').optional(),
        isPublic: Joi.boolean().optional()
    });

    return schema.validate(body);
};

/**
 * Validate version query parameter
 */
const validateVersionParam = (version) => {
    if (!version) return { error: null };
    
    const parsed = parseInt(version);
    if (isNaN(parsed) || parsed < 1) {
        return { error: new Error('Invalid version number') };
    }
    
    return { error: null, value: parsed };
};

module.exports = {
    validateUpload,
    validateVersionParam
};