import { BaseService } from "medusa-interfaces";
import { Logger } from "@medusajs/medusa";

/**
 * Enterprise Cloudflare Integration Service
 * Handles image/video uploads to Cloudflare R2 and Images API
 */
class CloudflareService extends BaseService {
  protected logger_: Logger;
  private accountId: string;
  private imagesToken: string;
  private cdnUrl: string;
  private imageDeliveryUrl: string;
  private videoStreamUrl: string;

  constructor({ logger }: { logger: Logger }, options?: any) {
    super();
    this.logger_ = logger;
    
    // Cloudflare configuration from environment
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.imagesToken = process.env.CLOUDFLARE_IMAGES_TOKEN || '';
    this.cdnUrl = process.env.CLOUDFLARE_CDN_URL || '';
    this.imageDeliveryUrl = process.env.CLOUDFLARE_IMAGE_DELIVERY_URL || '';
    this.videoStreamUrl = process.env.CLOUDFLARE_VIDEO_STREAM_URL || '';

    if (!this.accountId || !this.imagesToken) {
      this.logger_.warn("Cloudflare credentials not found. Image upload will be disabled.");
    }
  }

  /**
   * Upload image to Cloudflare Images API
   */
  async uploadImage(file: Buffer, filename: string, metadata?: Record<string, any>) {
    if (!this.accountId || !this.imagesToken) {
      throw new Error("Cloudflare credentials not configured");
    }

    try {
      const formData = new FormData();
      formData.append('file', new Blob([file]), filename);
      
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.imagesToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare upload failed: ${errorText}`);
      }

      const result: any = await response.json();
      
      this.logger_.info(`Image uploaded successfully: ${result.result?.id}`);
      
      return {
        id: result.result?.id,
        url: `${this.imageDeliveryUrl}/${result.result?.id}/public`,
        variants: result.result?.variants,
        metadata: result.result?.meta,
      };
    } catch (error) {
      this.logger_.error('Failed to upload image to Cloudflare:', error);
      throw error;
    }
  }

  /**
   * Upload multiple images in batch
   */
  async uploadImagesBatch(files: { buffer: Buffer; filename: string; metadata?: Record<string, any> }[]) {
    const results = [];
    
    for (const file of files) {
      try {
        const result = await this.uploadImage(file.buffer, file.filename, file.metadata);
        results.push(result);
      } catch (error: any) {
        this.logger_.error(`Failed to upload ${file.filename}:`, error);
        results.push({ error: error.message, filename: file.filename });
      }
    }
    
    return results;
  }

  /**
   * Delete image from Cloudflare
   */
  async deleteImage(imageId: string) {
    if (!this.accountId || !this.imagesToken) {
      throw new Error("Cloudflare credentials not configured");
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1/${imageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.imagesToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete image: ${errorText}`);
      }

      this.logger_.info(`Image deleted successfully: ${imageId}`);
      return true;
    } catch (error) {
      this.logger_.error('Failed to delete image from Cloudflare:', error);
      throw error;
    }
  }

  /**
   * Generate optimized image URLs for different variants
   */
  generateImageVariants(imageId: string) {
    const baseUrl = `${this.imageDeliveryUrl}/${imageId}`;
    
    return {
      original: `${baseUrl}/public`,
      thumbnail: `${baseUrl}/w=150,h=150,fit=cover`,
      small: `${baseUrl}/w=400,h=400,fit=cover`,
      medium: `${baseUrl}/w=800,h=800,fit=cover`,
      large: `${baseUrl}/w=1200,h=1200,fit=cover`,
      // Product-specific variants for menswear
      productCard: `${baseUrl}/w=300,h=400,fit=cover`,
      productDetail: `${baseUrl}/w=600,h=800,fit=cover`,
      productZoom: `${baseUrl}/w=1500,h=2000,fit=cover`,
    };
  }

  /**
   * Upload video to Cloudflare Stream
   */
  async uploadVideo(file: Buffer, filename: string, metadata?: Record<string, any>) {
    // Note: This would require Cloudflare Stream API integration
    // For now, return a placeholder implementation
    this.logger_.warn("Video upload to Cloudflare Stream not yet implemented");
    
    return {
      id: `video_${Date.now()}`,
      url: `${this.videoStreamUrl}/placeholder`,
      status: 'pending'
    };
  }
}

export default CloudflareService;