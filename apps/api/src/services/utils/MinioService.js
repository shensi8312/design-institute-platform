const Minio = require('minio');
const fs = require('fs');
const path = require('path');

class MinioService {
    constructor() {
        // MinIO客户端配置
        this.minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9003'),
            useSSL: false,
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
        });
        
        this.bucketName = 'knowledge-documents';
        this.initBucket();
    }
    
    // 初始化bucket
    async initBucket() {
        try {
            const exists = await this.minioClient.bucketExists(this.bucketName);
            if (!exists) {
                await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
                console.log(`✅ MinIO bucket "${this.bucketName}" created`);
            } else {
                console.log(`✅ MinIO bucket "${this.bucketName}" already exists`);
            }
        } catch (error) {
            console.error('❌ MinIO bucket initialization failed:', error);
        }
    }
    
    // 上传文件到MinIO（支持文件路径或Buffer）
    async uploadFile(filePathOrBuffer, objectName, metadata = {}) {
        try {
            let fileStream;
            let fileSize;
            let fileName;
            
            // 判断输入是文件路径还是Buffer
            if (Buffer.isBuffer(filePathOrBuffer)) {
                // 如果是Buffer，直接使用
                fileStream = filePathOrBuffer;
                fileSize = filePathOrBuffer.length;
                fileName = objectName || `${Date.now()}_upload`;
            } else if (typeof filePathOrBuffer === 'string') {
                // 如果是文件路径
                fileStream = fs.createReadStream(filePathOrBuffer);
                const fileStat = fs.statSync(filePathOrBuffer);
                fileSize = fileStat.size;
                fileName = objectName || `${Date.now()}_${path.basename(filePathOrBuffer)}`;
            } else {
                throw new Error('Invalid input: expected file path or Buffer');
            }
            
            // 生成唯一的对象名
            const uniqueName = fileName;
            
            // 上传到MinIO
            await this.minioClient.putObject(
                this.bucketName,
                uniqueName,
                fileStream,
                fileSize,
                metadata
            );
            
            // 生成访问URL（有效期7天）
            const url = await this.minioClient.presignedGetObject(
                this.bucketName, 
                uniqueName, 
                7 * 24 * 60 * 60
            );
            
            console.log(`✅ File uploaded to MinIO: ${uniqueName}`);

            return {
                success: true,
                path: uniqueName,  // minio_path字段
                objectName: uniqueName,
                bucket: this.bucketName,
                url: url,
                size: fileSize
            };
        } catch (error) {
            console.error('❌ MinIO upload failed:', error);
            throw error;
        }
    }
    
    // 下载文件
    async downloadFile(objectName, downloadPath) {
        try {
            await this.minioClient.fGetObject(this.bucketName, objectName, downloadPath);
            return { success: true, path: downloadPath };
        } catch (error) {
            console.error('❌ MinIO download failed:', error);
            throw error;
        }
    }
    
    // 删除文件
    async deleteFile(objectName) {
        try {
            await this.minioClient.removeObject(this.bucketName, objectName);
            console.log(`✅ File deleted from MinIO: ${objectName}`);
            return { success: true };
        } catch (error) {
            console.error('❌ MinIO delete failed:', error);
            throw error;
        }
    }
    
    // 获取文件URL
    async getFileUrl(objectName, expiry = 7 * 24 * 60 * 60) {
        try {
            const url = await this.minioClient.presignedGetObject(
                this.bucketName, 
                objectName, 
                expiry
            );
            return url;
        } catch (error) {
            console.error('❌ Failed to get MinIO URL:', error);
            throw error;
        }
    }
    
    // 获取文件内容（返回Buffer）
    async getFile(bucketName, objectName) {
        try {
            const stream = await this.minioClient.getObject(
                bucketName || this.bucketName, 
                objectName
            );
            
            // 将Stream转换为Buffer
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => resolve(Buffer.concat(chunks)));
                stream.on('error', reject);
            });
        } catch (error) {
            console.error('❌ Failed to get file from MinIO:', error);
            throw error;
        }
    }
    
    // 上传Buffer到MinIO
    async uploadBuffer(buffer, objectName, bucketName, metadata = {}) {
        try {
            const bucket = bucketName || this.bucketName;
            
            await this.minioClient.putObject(
                bucket,
                objectName,
                buffer,
                buffer.length,
                metadata
            );
            
            console.log(`✅ Buffer uploaded to MinIO: ${bucket}/${objectName}`);
            return {
                success: true,
                objectName: objectName,
                bucket: bucket,
                size: buffer.length
            };
        } catch (error) {
            console.error('❌ MinIO buffer upload failed:', error);
            throw error;
        }
    }
    
    // 获取对象流（用于下载）
    async getObject(bucketName, objectName) {
        try {
            return await this.minioClient.getObject(
                bucketName || this.bucketName, 
                objectName
            );
        } catch (error) {
            console.error('❌ Failed to get object stream from MinIO:', error);
            throw error;
        }
    }
    
    // 生成预签名URL（用于直接访问）
    async getPresignedUrl(bucketName, objectName, expiry = 24 * 60 * 60) {
        try {
            return await this.minioClient.presignedGetObject(
                bucketName || this.bucketName, 
                objectName, 
                expiry
            );
        } catch (error) {
            console.error('❌ Failed to generate presigned URL:', error);
            throw error;
        }
    }
}

// 导出单例
module.exports = new MinioService();