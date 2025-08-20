const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

class MediaCompressionService {
    constructor() {
        // Compression settings
        this.imageSettings = {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 80,
            format: 'jpeg', // Convert all images to JPEG for better compression
            progressive: true
        };
        
        this.videoSettings = {
            maxWidth: 1280,
            maxHeight: 720,
            videoBitrate: '1000k',
            audioBitrate: '128k',
            format: 'mp4',
            codec: 'libx264'
        };
        
        this.audioSettings = {
            bitrate: '128k',
            format: 'mp3',
            codec: 'libmp3lame'
        };
        
        // Size limits (in bytes) - lower thresholds for more aggressive compression
        this.sizeLimit = {
            image: 500 * 1024, // 500KB for images
            video: 5 * 1024 * 1024, // 5MB for videos  
            audio: 2 * 1024 * 1024, // 2MB for audio
            document: 20 * 1024 * 1024 // 20MB for documents
        };
    }

    /**
     * Compress media file based on file type
     * @param {Buffer} inputBuffer - Original file buffer
     * @param {string} mimeType - File MIME type
     * @param {string} originalName - Original filename
     * @param {Object} options - Compression options
     * @returns {Object} - Compressed file info
     */
    async compressMedia(inputBuffer, mimeType, originalName, options = {}) {
        try {
            const fileSize = inputBuffer.length;
            console.log(`[MediaCompressionService] Starting compression for ${originalName} (${(fileSize/1024/1024).toFixed(2)}MB)`);
            
            let compressedBuffer = inputBuffer;
            let compressionApplied = false;
            let newMimeType = mimeType;
            let newFileName = originalName;
            
            if (mimeType.startsWith('image/')) {
                const result = await this.compressImage(inputBuffer, originalName, options);
                compressedBuffer = result.buffer;
                compressionApplied = result.compressed;
                newMimeType = result.mimeType;
                newFileName = result.fileName;
                
            } else if (mimeType.startsWith('video/')) {
                const result = await this.compressVideo(inputBuffer, originalName, options);
                compressedBuffer = result.buffer;
                compressionApplied = result.compressed;
                newMimeType = result.mimeType;
                newFileName = result.fileName;
                
            } else if (mimeType.startsWith('audio/')) {
                const result = await this.compressAudio(inputBuffer, originalName, options);
                compressedBuffer = result.buffer;
                compressionApplied = result.compressed;
                newMimeType = result.mimeType;
                newFileName = result.fileName;
            }
            
            const compressedSize = compressedBuffer.length;
            const compressionRatio = ((fileSize - compressedSize) / fileSize * 100).toFixed(1);
            
            console.log(`[MediaCompressionService] Compression completed:`, {
                originalSize: `${(fileSize/1024/1024).toFixed(2)}MB`,
                compressedSize: `${(compressedSize/1024/1024).toFixed(2)}MB`,
                compressionRatio: `${compressionRatio}%`,
                compressionApplied
            });
            
            return {
                buffer: compressedBuffer,
                mimeType: newMimeType,
                fileName: newFileName,
                originalSize: fileSize,
                compressedSize: compressedSize,
                compressionRatio: parseFloat(compressionRatio),
                compressionApplied
            };
            
        } catch (error) {
            console.error('[MediaCompressionService] Compression error:', error);
            console.warn('[MediaCompressionService] Falling back to original file');
            
            // Return original file if compression fails
            return {
                buffer: inputBuffer,
                mimeType: mimeType,
                fileName: originalName,
                originalSize: inputBuffer.length,
                compressedSize: inputBuffer.length,
                compressionRatio: 0,
                compressionApplied: false,
                error: error.message
            };
        }
    }

    /**
     * Compress image using Sharp
     */
    async compressImage(inputBuffer, originalName, options = {}) {
        try {
            const settings = { ...this.imageSettings, ...options };
            const originalSize = inputBuffer.length;
            
            // Skip compression if file is already small enough
            if (originalSize <= this.sizeLimit.image * 0.5) {
                console.log(`[MediaCompressionService] Image is already small (${(originalSize/1024/1024).toFixed(2)}MB), skipping compression`);
                return {
                    buffer: inputBuffer,
                    mimeType: `image/${path.extname(originalName).slice(1)}`,
                    fileName: originalName,
                    compressed: false
                };
            }
            
            console.log(`[MediaCompressionService] Compressing image with settings:`, settings);
            
            let sharpInstance = sharp(inputBuffer);
            
            // Get image metadata
            const metadata = await sharpInstance.metadata();
            console.log(`[MediaCompressionService] Image metadata:`, {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format
            });
            
            // Resize if too large
            if (metadata.width > settings.maxWidth || metadata.height > settings.maxHeight) {
                sharpInstance = sharpInstance.resize(settings.maxWidth, settings.maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }
            
            // Convert to JPEG with quality compression
            const compressedBuffer = await sharpInstance
                .jpeg({
                    quality: settings.quality,
                    progressive: settings.progressive,
                    mozjpeg: true // Use mozjpeg encoder for better compression
                })
                .toBuffer();
            
            const newFileName = originalName.replace(/\.[^/.]+$/, '.jpg');
            
            return {
                buffer: compressedBuffer,
                mimeType: 'image/jpeg',
                fileName: newFileName,
                compressed: true
            };
            
        } catch (error) {
            console.error('[MediaCompressionService] Image compression error:', error);
            throw error;
        }
    }

    /**
     * Compress video using FFmpeg
     */
    async compressVideo(inputBuffer, originalName, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const settings = { ...this.videoSettings, ...options };
                const originalSize = inputBuffer.length;
                
                // Skip compression if file is already small enough
                if (originalSize <= this.sizeLimit.video * 0.5) {
                    console.log(`[MediaCompressionService] Video is already small (${(originalSize/1024/1024).toFixed(2)}MB), skipping compression`);
                    return resolve({
                        buffer: inputBuffer,
                        mimeType: 'video/' + path.extname(originalName).slice(1),
                        fileName: originalName,
                        compressed: false
                    });
                }
                
                console.log(`[MediaCompressionService] Compressing video with settings:`, settings);
                
                // Create temporary files
                const tempDir = path.join(__dirname, '..', 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                
                const inputPath = path.join(tempDir, `input_${Date.now()}_${originalName}`);
                const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);
                
                // Write input buffer to temp file
                fs.writeFileSync(inputPath, inputBuffer);
                
                ffmpeg(inputPath)
                    .videoCodec(settings.codec)
                    .audioCodec('aac')
                    .videoBitrate(settings.videoBitrate)
                    .audioBitrate(settings.audioBitrate)
                    .size(`${settings.maxWidth}x${settings.maxHeight}`)
                    .autopad()
                    .format(settings.format)
                    .on('end', () => {
                        try {
                            const compressedBuffer = fs.readFileSync(outputPath);
                            const newFileName = originalName.replace(/\.[^/.]+$/, '.mp4');
                            
                            // Cleanup temp files
                            fs.unlinkSync(inputPath);
                            fs.unlinkSync(outputPath);
                            
                            resolve({
                                buffer: compressedBuffer,
                                mimeType: 'video/mp4',
                                fileName: newFileName,
                                compressed: true
                            });
                        } catch (readError) {
                            reject(readError);
                        }
                    })
                    .on('error', (err) => {
                        // Cleanup temp files on error
                        try {
                            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        } catch (cleanupError) {
                            console.warn('[MediaCompressionService] Cleanup error:', cleanupError);
                        }
                        reject(err);
                    })
                    .save(outputPath);
                    
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Compress audio using FFmpeg
     */
    async compressAudio(inputBuffer, originalName, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const settings = { ...this.audioSettings, ...options };
                const originalSize = inputBuffer.length;
                
                // Skip compression if file is already small enough
                if (originalSize <= this.sizeLimit.audio * 0.5) {
                    console.log(`[MediaCompressionService] Audio is already small (${(originalSize/1024/1024).toFixed(2)}MB), skipping compression`);
                    return resolve({
                        buffer: inputBuffer,
                        mimeType: 'audio/' + path.extname(originalName).slice(1),
                        fileName: originalName,
                        compressed: false
                    });
                }
                
                console.log(`[MediaCompressionService] Compressing audio with settings:`, settings);
                
                // Create temporary files
                const tempDir = path.join(__dirname, '..', 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                
                const inputPath = path.join(tempDir, `input_${Date.now()}_${originalName}`);
                const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);
                
                // Write input buffer to temp file
                fs.writeFileSync(inputPath, inputBuffer);
                
                ffmpeg(inputPath)
                    .audioCodec(settings.codec)
                    .audioBitrate(settings.bitrate)
                    .format(settings.format)
                    .on('end', () => {
                        try {
                            const compressedBuffer = fs.readFileSync(outputPath);
                            const newFileName = originalName.replace(/\.[^/.]+$/, '.mp3');
                            
                            // Cleanup temp files
                            fs.unlinkSync(inputPath);
                            fs.unlinkSync(outputPath);
                            
                            resolve({
                                buffer: compressedBuffer,
                                mimeType: 'audio/mp3',
                                fileName: newFileName,
                                compressed: true
                            });
                        } catch (readError) {
                            reject(readError);
                        }
                    })
                    .on('error', (err) => {
                        // Cleanup temp files on error
                        try {
                            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        } catch (cleanupError) {
                            console.warn('[MediaCompressionService] Cleanup error:', cleanupError);
                        }
                        reject(err);
                    })
                    .save(outputPath);
                    
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Check if file needs compression
     */
    needsCompression(fileSize, mimeType) {
        if (mimeType.startsWith('image/')) {
            return fileSize > this.sizeLimit.image * 0.5;
        } else if (mimeType.startsWith('video/')) {
            return fileSize > this.sizeLimit.video * 0.5;
        } else if (mimeType.startsWith('audio/')) {
            return fileSize > this.sizeLimit.audio * 0.5;
        }
        return false;
    }

    /**
     * Get compression settings for file type
     */
    getCompressionSettings(mimeType) {
        if (mimeType.startsWith('image/')) {
            return this.imageSettings;
        } else if (mimeType.startsWith('video/')) {
            return this.videoSettings;
        } else if (mimeType.startsWith('audio/')) {
            return this.audioSettings;
        }
        return null;
    }
}

// Export singleton instance
module.exports = new MediaCompressionService();