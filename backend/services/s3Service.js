const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class S3Service {
    constructor() {
        this.s3 = null;
        this.bucketName = process.env.AWS_S3_BUCKET_NAME;
        this.isS3Enabled = process.env.MEDIA_STORAGE_TYPE === 's3';
        
        if (this.isS3Enabled) {
            this.initializeS3();
        }
    }

    initializeS3() {
        try {
            // Validate required environment variables
            if (!process.env.AWS_ACCESS_KEY_ID) {
                throw new Error('AWS_ACCESS_KEY_ID is not configured');
            }
            if (!process.env.AWS_SECRET_ACCESS_KEY) {
                throw new Error('AWS_SECRET_ACCESS_KEY is not configured');
            }
            if (!process.env.AWS_REGION) {
                throw new Error('AWS_REGION is not configured');
            }
            if (!this.bucketName) {
                throw new Error('AWS_S3_BUCKET_NAME is not configured');
            }

            // Configure AWS SDK
            AWS.config.update({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            });

            this.s3 = new AWS.S3();
            console.log('[S3Service] S3 initialized successfully');
        } catch (error) {
            console.error('[S3Service] Failed to initialize S3:', error.message);
            throw new Error(`S3 initialization failed: ${error.message}`);
        }
    }

    /**
     * Upload file to S3 or local storage based on configuration
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} originalName - Original filename
     * @param {string} mimeType - File MIME type
     * @param {string} userId - User ID for folder organization
     * @returns {Object} - Upload result with file URL and metadata
     */
    async uploadFile(fileBuffer, originalName, mimeType, userId) {
        if (this.isS3Enabled) {
            return await this.uploadToS3(fileBuffer, originalName, mimeType, userId);
        } else {
            return await this.uploadToLocal(fileBuffer, originalName, mimeType, userId);
        }
    }

    /**
     * Upload file to S3
     */
    async uploadToS3(fileBuffer, originalName, mimeType, userId) {
        try {
            const fileExtension = path.extname(originalName);
            const fileName = `${uuidv4()}${fileExtension}`;
            const key = `media/${userId}/${fileName}`;

            const uploadParams = {
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: mimeType,
                ACL: 'private' // Files are private by default
            };

            const result = await this.s3.upload(uploadParams).promise();

            console.log('[S3Service] File uploaded to S3:', result.Location);

            return {
                success: true,
                fileName: fileName,
                filePath: key, // S3 key path
                fileUrl: result.Location, // Public S3 URL (though files are private)
                fileSize: fileBuffer.length,
                storageType: 's3',
                metadata: {
                    bucket: this.bucketName,
                    key: key,
                    eTag: result.ETag,
                    location: result.Location
                }
            };
        } catch (error) {
            console.error('[S3Service] S3 upload failed:', error);
            
            // Provide more specific error messages
            if (error.code === 'NoSuchBucket') {
                throw new Error(`S3 bucket '${this.bucketName}' does not exist`);
            } else if (error.code === 'AccessDenied') {
                throw new Error('Access denied - check AWS credentials and bucket permissions');
            } else if (error.code === 'InvalidAccessKeyId') {
                throw new Error('Invalid AWS Access Key ID');
            } else if (error.code === 'SignatureDoesNotMatch') {
                throw new Error('Invalid AWS Secret Access Key');
            } else {
                throw new Error(`S3 upload failed: ${error.message}`);
            }
        }
    }

    /**
     * Upload file to local storage (fallback)
     */
    async uploadToLocal(fileBuffer, originalName, mimeType, userId) {
        try {
            const fileExtension = path.extname(originalName);
            const fileName = `${uuidv4()}${fileExtension}`;
            const uploadsDir = path.join(__dirname, '..', 'uploads', 'media');
            
            // Ensure upload directory exists
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const filePath = path.join(uploadsDir, fileName);
            
            // Write file to local storage
            fs.writeFileSync(filePath, fileBuffer);

            const relativeFilePath = `/uploads/media/${fileName}`;
            const fileUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}${relativeFilePath}`;

            console.log('[S3Service] File uploaded to local storage:', filePath);

            return {
                success: true,
                fileName: fileName,
                filePath: relativeFilePath,
                fileUrl: fileUrl,
                fileSize: fileBuffer.length,
                storageType: 'local',
                metadata: {
                    localPath: filePath
                }
            };
        } catch (error) {
            console.error('[S3Service] Local upload failed:', error);
            throw new Error(`Local upload failed: ${error.message}`);
        }
    }

    /**
     * Generate presigned URL for S3 objects (for secure access)
     * @param {string} key - S3 object key
     * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
     * @returns {string} - Presigned URL
     */
    async getPresignedUrl(key, expiresIn = 3600) {
        if (!this.isS3Enabled) {
            return null; // Not applicable for local storage
        }

        try {
            const params = {
                Bucket: this.bucketName,
                Key: key,
                Expires: expiresIn
            };

            const url = await this.s3.getSignedUrlPromise('getObject', params);
            console.log('[S3Service] Generated presigned URL for:', key);
            return url;
        } catch (error) {
            console.error('[S3Service] Failed to generate presigned URL:', error);
            
            if (error.code === 'NoSuchBucket') {
                throw new Error(`S3 bucket '${this.bucketName}' does not exist`);
            } else if (error.code === 'NoSuchKey') {
                throw new Error(`File not found in S3: ${key}`);
            } else {
                throw new Error(`Failed to generate presigned URL: ${error.message}`);
            }
        }
    }

    /**
     * Delete file from S3 or local storage
     * @param {string} filePath - File path or S3 key
     * @param {string} storageType - 's3' or 'local'
     * @returns {boolean} - Success status
     */
    async deleteFile(filePath, storageType = 'local') {
        try {
            if (storageType === 's3' && this.isS3Enabled) {
                const params = {
                    Bucket: this.bucketName,
                    Key: filePath
                };

                await this.s3.deleteObject(params).promise();
                console.log('[S3Service] File deleted from S3:', filePath);
                return true;
            } else {
                // Local file deletion
                const fullPath = path.join(__dirname, '..', filePath.replace(/^\//, ''));
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    console.log('[S3Service] File deleted from local storage:', fullPath);
                }
                return true;
            }
        } catch (error) {
            console.error('[S3Service] File deletion failed:', error);
            return false;
        }
    }

    /**
     * Check if S3 is properly configured and accessible
     * @returns {Promise<boolean>} - Configuration status
     */
    async testConnection() {
        if (!this.isS3Enabled) {
            console.log('[S3Service] Using local storage - no S3 connection to test');
            return true;
        }

        try {
            // Try to list objects in bucket (with limit 1 to minimize cost)
            const params = {
                Bucket: this.bucketName,
                MaxKeys: 1
            };

            await this.s3.listObjectsV2(params).promise();
            console.log('[S3Service] S3 connection test successful');
            return true;
        } catch (error) {
            console.error('[S3Service] S3 connection test failed:', error);
            
            // Log specific error types for debugging
            if (error.code === 'NoSuchBucket') {
                console.error(`[S3Service] Bucket '${this.bucketName}' does not exist`);
            } else if (error.code === 'AccessDenied') {
                console.error('[S3Service] Access denied - check AWS credentials and permissions');
            } else if (error.code === 'InvalidAccessKeyId') {
                console.error('[S3Service] Invalid AWS Access Key ID');
            } else if (error.code === 'SignatureDoesNotMatch') {
                console.error('[S3Service] Invalid AWS Secret Access Key');
            }
            
            return false;
        }
    }

    /**
     * Get file info and URL based on storage type
     * @param {Object} mediaRecord - Media record from database
     * @returns {Object} - File info with accessible URL
     */
    async getFileInfo(mediaRecord) {
        try {
            console.log('[S3Service] Processing media record:', {
                id: mediaRecord._id,
                fileName: mediaRecord.fileName,
                filePath: mediaRecord.filePath,
                storageType: mediaRecord.storageType,
                isS3Enabled: this.isS3Enabled
            });

            if (mediaRecord.storageType === 's3' && this.isS3Enabled) {
                // Generate presigned URL for S3 files
                const presignedUrl = await this.getPresignedUrl(mediaRecord.filePath);
                console.log('[S3Service] Generated presigned URL for:', mediaRecord.fileName);
                return {
                    ...mediaRecord.toObject(),
                    accessUrl: presignedUrl,
                    isS3: true
                };
            } else {
                // Local files - construct full URL from backend
                const backendPort = process.env.PORT || 5000;
                const baseUrl = `http://localhost:${backendPort}`;
                const accessUrl = `${baseUrl}${mediaRecord.filePath}`;
                console.log('[S3Service] Generated local URL:', accessUrl, 'for file:', mediaRecord.fileName);
                return {
                    ...mediaRecord.toObject(),
                    accessUrl: accessUrl,
                    isS3: false
                };
            }
        } catch (error) {
            console.error('[S3Service] Failed to get file info:', error);
            throw new Error(`Failed to get file info: ${error.message}`);
        }
    }
}

// Export singleton instance
module.exports = new S3Service();